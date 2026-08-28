import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import { assertAccountingPeriodOpen } from './periodLockService.js';
import { ensureCashCustomers, getCashCustomerCurrency, isCashCustomerCode } from './customerService.js';
import { ensureFinanceAccountTables, resolveFinanceAccount, writeFinanceAccountMovement } from './financeService.js';

const VALID_CURRENCIES = new Set(['TRY', 'USD', 'EUR']);

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function hasPersonnelSalesSchema(request) {
  const result = await request.query(`
    SELECT CASE
      WHEN OBJECT_ID(N'dbo.employees', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.terminal_devices', N'assigned_employee_id') IS NOT NULL
       AND COL_LENGTH(N'dbo.sales_invoices', N'employee_id') IS NOT NULL
      THEN 1 ELSE 0
    END AS is_ready;
  `);
  return Boolean(result.recordset?.[0]?.is_ready);
}

function numberValue(value, fieldName, { min = 0, allowZero = true } = {}) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || (!allowZero && number === 0)) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `${fieldName} is invalid`);
  }

  return number;
}

function normalizeCurrency(value) {
  return trimText(value || 'TRY').toUpperCase();
}

function normalizeDate(value) {
  return trimText(value) || new Date().toISOString().slice(0, 10);
}

function normalizeCancelReason(value, code = 'SALES_CANCEL_REASON_REQUIRED') {
  const reason = trimText(value);

  if (!reason) {
    throw makeServiceError(code, 'Cancel reason is required', 400);
  }

  return reason.slice(0, 500);
}

function createDocumentNo(prefix) {
  const now = new Date();
  const stamp = [
    String(now.getUTCFullYear()).slice(-2),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('');

  return `${prefix}-${stamp}`;
}

function parseDraftListQuery(query = {}) {
  const options = parseListQuery(query);
  const status = trimText(query.status || 'DRAFT').toUpperCase();
  const partySearch = trimText(query.customer || query.supplier || query.party);
  const dateFrom = trimText(query.dateFrom);
  const dateTo = trimText(query.dateTo);
  const currency = trimText(query.currency).toUpperCase();
  const amountMinText = trimText(query.amountMin);
  const amountMaxText = trimText(query.amountMax);
  const amountMin = amountMinText === '' ? null : Number(amountMinText);
  const amountMax = amountMaxText === '' ? null : Number(amountMaxText);
  const allowedStatuses = new Set(['DRAFT', 'FINALIZED', 'CANCELLED', 'ARCHIVED_TEST']);

  if (currency && currency !== 'ALL' && !VALID_CURRENCIES.has(currency)) {
    throw makeServiceError('INVOICE_LIST_CURRENCY_INVALID', 'Currency filter must be TRY, USD or EUR');
  }
  if (amountMin !== null && (!Number.isFinite(amountMin) || amountMin < 0)) {
    throw makeServiceError('INVOICE_LIST_AMOUNT_MIN_INVALID', 'Minimum amount must be zero or greater');
  }
  if (amountMax !== null && (!Number.isFinite(amountMax) || amountMax < 0)) {
    throw makeServiceError('INVOICE_LIST_AMOUNT_MAX_INVALID', 'Maximum amount must be zero or greater');
  }
  if (amountMin !== null && amountMax !== null && amountMin > amountMax) {
    throw makeServiceError('INVOICE_LIST_AMOUNT_RANGE_INVALID', 'Minimum amount cannot exceed maximum amount');
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw makeServiceError('INVOICE_LIST_DATE_RANGE_INVALID', 'Start date cannot be after end date');
  }

  return {
    ...options,
    status: status === 'ALL' || status === '' ? 'all' : allowedStatuses.has(status) ? status.toLowerCase() : 'unsupported',
    partySearch,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    currency: currency === 'ALL' ? null : currency || null,
    amountMin,
    amountMax,
    employeeSearch: trimText(query.employee),
    terminalSearch: trimText(query.terminal),
  };
}

function toSalesListDto(row) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    customerName: row.customer_name || '-',
    terminalCode: row.terminal_code || '',
    employeeId: row.employee_id ? Number(row.employee_id) : null,
    employeeName: row.employee_name || '',
    currency: row.currency_code,
    totalAmount: Number(row.total_amount || 0),
    status: String(row.status || '').toUpperCase(),
    itemCount: Number(row.item_count || 0),
    documentDate: row.document_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPurchaseListDto(row) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    supplierName: row.supplier_name || '-',
    currency: row.currency_code,
    totalAmount: Number(row.total_amount || 0),
    status: String(row.status || '').toUpperCase(),
    itemCount: Number(row.item_count || 0),
    documentDate: row.document_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFinalizeResult(snapshot, warnings = []) {
  return {
    ...snapshot,
    finalizedAt: snapshot.finalizedAt || null,
    commercialEffect: true,
    warnings,
  };
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function calculateWeightedAverageCostTry({
  currentStock,
  currentAverageCostTry,
  purchaseQuantity,
  purchaseAmountTry,
}) {
  if (purchaseQuantity <= 0) {
    return 0;
  }

  const incomingUnitCostTry = purchaseAmountTry / purchaseQuantity;

  if (currentStock <= 0) {
    return incomingUnitCostTry;
  }

  const nextStock = currentStock + purchaseQuantity;

  if (nextStock <= 0) {
    return incomingUnitCostTry;
  }

  return ((currentStock * currentAverageCostTry) + purchaseAmountTry) / nextStock;
}

async function recalculateProductAverageCostTry(sqlDriver, transaction, productId, actor = null) {
  const purchaseTotals = await new sqlDriver.Request(transaction)
    .input('averageCostProductId', sql.BigInt, productId)
    .query(`
      SELECT
        COALESCE(SUM(quantity_net), 0) AS net_purchase_quantity,
        COALESCE(SUM(amount_try), 0) AS net_purchase_amount_try
      FROM dbo.stock_movements
      WHERE product_id = @averageCostProductId
        AND source_type = N'purchase_invoice';
    `);

  const totalRow = purchaseTotals.recordset?.[0] || {};
  const netPurchaseQuantity = safeNumber(totalRow.net_purchase_quantity);
  const netPurchaseAmountTry = safeNumber(totalRow.net_purchase_amount_try);
  const nextAverageCostTry = netPurchaseQuantity > 0 ? netPurchaseAmountTry / netPurchaseQuantity : 0;

  const beforeProduct = await new sqlDriver.Request(transaction)
    .input('averageCostBeforeProductId', sql.BigInt, productId)
    .query(`
      SELECT TOP (1)
        average_cost_try AS averageCostTry
      FROM dbo.products
      WHERE id = @averageCostBeforeProductId;
    `);
  const beforeAverageCostTry = safeNumber(beforeProduct.recordset?.[0]?.averageCostTry);

  await new sqlDriver.Request(transaction)
    .input('averageCostUpdateProductId', sql.BigInt, productId)
    .input('averageCostUpdateValue', sql.Decimal(18, 4), nextAverageCostTry)
    .query(`
      UPDATE dbo.products
      SET
        average_cost_try = @averageCostUpdateValue,
        updated_at = SYSUTCDATETIME()
      WHERE id = @averageCostUpdateProductId;
    `);

  await writeAuditLog(new sqlDriver.Request(transaction), {
    action: 'product_average_cost_recalculated',
    entityType: 'product',
    entityId: productId,
    beforeSnapshot: {
      averageCostTry: beforeAverageCostTry,
    },
    afterSnapshot: {
      averageCostTry: nextAverageCostTry,
      netPurchaseQuantity,
      netPurchaseAmountTry,
      policy: 'recalculate_from_purchase_stock_movements',
    },
    actor,
  });

  return nextAverageCostTry;
}

function calculateSalesProfitSnapshot({ salesAmountTry, averageCostTry, quantity }) {
  const costAmountTry = averageCostTry * quantity;
  const grossProfitTry = salesAmountTry - costAmountTry;

  return {
    grossProfitTry,
    grossProfitRate: salesAmountTry > 0 ? grossProfitTry / salesAmountTry : 0,
  };
}

function purchaseLineCostTry(item, exchangeRate) {
  const lineTotal = safeNumber(item.lineTotal);
  const lineTotalTry = safeNumber(item.lineTotalTry);
  const rate = safeNumber(exchangeRate, 1);

  if (lineTotalTry > 0 && (rate <= 1 || lineTotalTry > lineTotal * 1.0001)) {
    return lineTotalTry;
  }

  return lineTotal * rate;
}

function applyDiscount(amount, discountRate) {
  const rate = Math.min(100, Math.max(0, safeNumber(discountRate)));
  return safeNumber(amount) * (1 - (rate / 100));
}

function rateToTryForCurrency(currencyRateMap, currency, fallback = 1) {
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === 'TRY') {
    return 1;
  }

  return safeNumber(currencyRateMap?.get(normalizedCurrency), fallback);
}

function calculatePurchaseLineTotals(items, invoiceDiscountRate, supplierDiscountRate, exchangeRate) {
  const normalizedItems = items.map((item) => {
    const quantity = safeNumber(item.quantity);
    const purchasePrice = safeNumber(item.purchasePrice);
    const lineDiscountRate = safeNumber(item.lineDiscountRate);
    const gross = quantity * purchasePrice;
    const lineDiscount = gross * (lineDiscountRate / 100);
    const afterLineDiscount = gross - lineDiscount;

    return {
      item,
      gross,
      lineDiscount,
      afterLineDiscount,
    };
  });

  const subtotal = normalizedItems.reduce((total, entry) => total + entry.gross, 0);
  const lineDiscountTotal = normalizedItems.reduce((total, entry) => total + entry.lineDiscount, 0);
  const afterLineDiscounts = normalizedItems.reduce((total, entry) => total + entry.afterLineDiscount, 0);
  const invoiceDiscountTotal = afterLineDiscounts * (safeNumber(invoiceDiscountRate) / 100);
  const afterInvoiceDiscount = afterLineDiscounts - invoiceDiscountTotal;
  const supplierDiscountTotal = afterInvoiceDiscount * (safeNumber(supplierDiscountRate) / 100);
  const grandTotal = afterInvoiceDiscount - supplierDiscountTotal;
  const rate = safeNumber(exchangeRate, 1);
  const allocationBase = afterLineDiscounts > 0 ? afterLineDiscounts : 0;

  return {
    subtotal,
    lineDiscountTotal,
    invoiceDiscountTotal,
    supplierDiscountTotal,
    grandTotal,
    amountTry: grandTotal * rate,
    stockCostEffectTry: grandTotal * rate,
    items: normalizedItems.map((entry) => {
      const share = allocationBase > 0 ? entry.afterLineDiscount / allocationBase : 0;
      const invoiceDiscountShare = invoiceDiscountTotal * share;
      const afterInvoiceDiscountShare = entry.afterLineDiscount - invoiceDiscountShare;
      const supplierDiscountShare = supplierDiscountTotal * (afterInvoiceDiscount > 0 ? afterInvoiceDiscountShare / afterInvoiceDiscount : share);
      const netLineTotal = afterInvoiceDiscountShare - supplierDiscountShare;

      return {
        item: entry.item,
        lineTotal: entry.afterLineDiscount,
        netLineTotal,
        lineTotalTry: netLineTotal * rate,
      };
    }),
  };
}

async function readCurrencyRateMap(request) {
  const result = await request.query(`
    WITH latest_rates AS (
      SELECT
        currency_code,
        rate_to_try,
        ROW_NUMBER() OVER (PARTITION BY currency_code ORDER BY rate_date DESC, id DESC) AS row_number
      FROM dbo.currency_rates
      WHERE currency_code IN (N'USD', N'EUR')
    )
    SELECT currency_code, rate_to_try
    FROM latest_rates
    WHERE row_number = 1;
  `);

  return new Map((result.recordset || []).map((row) => [row.currency_code, safeNumber(row.rate_to_try)]));
}

function resolveSalesUnitCostTry(item, documentCurrency, exchangeRate, currencyRateMap = new Map()) {
  const productCurrency = normalizeCurrency(item.productCurrency || item.currency);
  const lineCurrency = normalizeCurrency(documentCurrency || item.currency);
  const purchasePrice = applyDiscount(item.productPurchasePrice, item.productPurchaseDiscountRate);
  const rate = safeNumber(exchangeRate, 1);

  const productAverageCostTry = safeNumber(item.productAverageCostTry);
  if (productAverageCostTry > 0) {
    return productAverageCostTry;
  }

  const itemAverageCostTry = safeNumber(item.averageCostTry);
  if (itemAverageCostTry > 0) {
    return itemAverageCostTry;
  }

  if (productCurrency !== 'TRY' && purchasePrice > 0) {
    const productRate = rateToTryForCurrency(
      currencyRateMap,
      productCurrency,
      productCurrency === lineCurrency ? rate : 0,
    );

    if (productRate > 0) {
      return purchasePrice * productRate;
    }
  }

  if (productCurrency === 'TRY' && purchasePrice > 0) {
    return purchasePrice;
  }

  return 0;
}

function normalizeSalesPayload(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const discountRate = numberValue(payload.discountRate ?? 0, 'discountRate');
  const subtotal = items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const discountTotal = subtotal * (discountRate / 100);
  const grandTotal = subtotal - discountTotal;

  if (!payload.customerId) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'customerId is required');
  }

  if (items.length < 1) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'At least one product line is required');
  }

  if (grandTotal < 0) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'grandTotal cannot be negative');
  }

  return {
    documentNo: trimText(payload.documentNo) || createDocumentNo('SDR'),
    documentDate: normalizeDate(payload.documentDate),
    customerId: Number(payload.customerId),
    terminalDeviceId: payload.terminalDeviceId ? Number(payload.terminalDeviceId) : null,
    employeeId: payload.employeeId ? Number(payload.employeeId) : null,
    customerCurrency: normalizeCurrency(payload.customerCurrency),
    documentCurrency: normalizeCurrency(payload.documentCurrency),
    exchangeRate: numberValue(payload.exchangeRate ?? 1, 'exchangeRate', { min: 0, allowZero: false }),
    description: trimText(payload.description),
    discountRate,
    subtotal,
    discountTotal,
    grandTotal,
    amountTry: grandTotal * Number(payload.exchangeRate ?? 1),
    estimatedProfitTry: Number(payload.estimatedProfitTry || 0),
    items: items.map((item, index) => normalizeSalesItem(item, index)),
  };
}

function normalizeSalesItem(item, index) {
  const quantity = numberValue(item.quantity, `items[${index}].quantity`, { min: 0, allowZero: false });
  const unitPrice = numberValue(item.unitPrice, `items[${index}].unitPrice`);
  const lineTotal = quantity * unitPrice;

  if (!item.productId) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `items[${index}].productId is required`);
  }

  if (lineTotal < 0) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `items[${index}].lineTotal cannot be negative`);
  }

  return {
    productId: Number(item.productId),
    stockCode: trimText(item.stockCode),
    barcode: trimText(item.barcode),
    productName: trimText(item.productName),
    quantity,
    currency: normalizeCurrency(item.currency),
    unitPrice,
    lineTotal,
    averageCostTry: numberValue(item.averageCostTry ?? 0, `items[${index}].averageCostTry`),
    stockStatus: trimText(item.stockStatus),
    note: trimText(item.note),
  };
}

function normalizePurchasePayload(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const invoiceDiscountRate = numberValue(payload.invoiceDiscountRate ?? 0, 'invoiceDiscountRate');
  const supplierDiscountRate = numberValue(payload.supplierDiscountRate ?? 0, 'supplierDiscountRate');
  const exchangeRate = numberValue(payload.exchangeRate ?? 1, 'exchangeRate', { min: 0, allowZero: false });
  const normalizedItems = items.map((item, index) => normalizePurchaseItem(item, index));
  const totals = calculatePurchaseLineTotals(normalizedItems, invoiceDiscountRate, supplierDiscountRate, exchangeRate);

  if (!payload.supplierId && !trimText(payload.supplierName)) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'supplierId or supplierName is required');
  }

  if (items.length < 1) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'At least one product line is required');
  }

  if (totals.grandTotal < 0) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'grandTotal cannot be negative');
  }

  return {
    documentNo: trimText(payload.documentNo) || createDocumentNo('PDR'),
    documentDate: normalizeDate(payload.documentDate),
    supplierId: payload.supplierId ? Number(payload.supplierId) : null,
    supplierName: trimText(payload.supplierName),
    supplierCurrency: normalizeCurrency(payload.supplierCurrency),
    documentCurrency: normalizeCurrency(payload.documentCurrency),
    exchangeRate,
    description: trimText(payload.description),
    subtotal: totals.subtotal,
    lineDiscountTotal: totals.lineDiscountTotal,
    invoiceDiscountRate,
    supplierDiscountRate,
    discountTotal: totals.lineDiscountTotal + totals.invoiceDiscountTotal + totals.supplierDiscountTotal,
    grandTotal: totals.grandTotal,
    amountTry: totals.amountTry,
    stockCostEffectTry: totals.stockCostEffectTry,
    items: totals.items.map((entry) => ({
      ...entry.item,
      lineTotal: entry.lineTotal,
      lineTotalTry: entry.lineTotalTry,
    })),
  };
}

function normalizePurchaseItem(item, index) {
  const quantity = numberValue(item.quantity, `items[${index}].quantity`, { min: 0, allowZero: false });
  const purchasePrice = numberValue(item.purchasePrice, `items[${index}].purchasePrice`);
  const lineDiscountRate = numberValue(item.lineDiscountRate ?? 0, `items[${index}].lineDiscountRate`);
  const gross = quantity * purchasePrice;
  const lineTotal = gross - gross * (lineDiscountRate / 100);

  if (!item.productId) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `items[${index}].productId is required`);
  }

  if (lineTotal < 0) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', `items[${index}].lineTotal cannot be negative`);
  }

  return {
    productId: Number(item.productId),
    stockCode: trimText(item.stockCode),
    barcode: trimText(item.barcode),
    productName: trimText(item.productName),
    quantity,
    currency: normalizeCurrency(item.currency),
    purchasePrice,
    lineDiscountRate,
    lineTotal,
    lineTotalTry: lineTotal,
    stockEffect: trimText(item.stockEffect),
    note: trimText(item.note),
  };
}

async function getSalesSnapshot(request, id) {
  const personnelReady = await hasPersonnelSalesSchema(request);
  const ownershipColumns = personnelReady
    ? `si.terminal_device_id AS terminalDeviceId,
        td.device_code AS terminalCode,
        td.device_name AS terminalName,
        si.employee_id AS employeeId,
        e.employee_code AS employeeCode,
        e.full_name AS employeeName,`
    : `CAST(NULL AS BIGINT) AS terminalDeviceId,
        CAST(NULL AS NVARCHAR(80)) AS terminalCode,
        CAST(NULL AS NVARCHAR(150)) AS terminalName,
        CAST(NULL AS BIGINT) AS employeeId,
        CAST(NULL AS NVARCHAR(50)) AS employeeCode,
        CAST(NULL AS NVARCHAR(150)) AS employeeName,`;
  const ownershipJoins = personnelReady
    ? `LEFT JOIN dbo.terminal_devices td ON td.id = si.terminal_device_id
       LEFT JOIN dbo.employees e ON e.id = si.employee_id`
    : '';
  const header = await request
    .input('salesSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        si.id,
        si.document_no AS documentNo,
        si.document_date AS documentDate,
        si.customer_id AS customerId,
        c.customer_code AS customerCode,
        c.name AS customerName,
        ${ownershipColumns}
        CASE WHEN COALESCE(si.description, N'') LIKE N'%TEST_ARCHIVED%' THEN N'archived_test' ELSE si.status END AS status,
        si.customer_currency AS customerCurrency,
        si.document_currency AS documentCurrency,
        si.exchange_rate_snapshot AS exchangeRate,
        si.description,
        si.subtotal,
        si.discount_rate AS discountRate,
        si.discount_total AS discountTotal,
        si.grand_total AS grandTotal,
        si.amount_try AS amountTry,
        si.estimated_profit_try AS estimatedProfitTry,
        si.updated_at AS updatedAt
      FROM dbo.sales_invoices si
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
      ${ownershipJoins}
      WHERE si.id = @salesSnapshotId;
    `);

  const row = header.recordset?.[0];

  if (!row) {
    return null;
  }

  const items = await request
    .input('salesItemsSnapshotId', sql.BigInt, id)
    .query(`
      SELECT
        sii.id,
        sii.product_id AS productId,
        p.category,
        sii.stock_code_snapshot AS stockCode,
        sii.barcode_snapshot AS barcode,
        sii.product_name_snapshot AS productName,
        sii.quantity,
        sii.currency_code AS currency,
        sii.unit_price AS unitPrice,
        sii.line_total AS lineTotal,
        sii.average_cost_try_snapshot AS averageCostTry,
        sii.gross_profit_try AS grossProfitTry,
        sii.gross_profit_rate AS grossProfitRate,
        sii.stock_status_snapshot AS stockStatus,
        sii.note
      FROM dbo.sales_invoice_items sii
      LEFT JOIN dbo.products p ON p.id = sii.product_id
      WHERE sii.sales_invoice_id = @salesItemsSnapshotId
      ORDER BY sii.id ASC;
    `);

  return {
    ...row,
    status: row.status?.toUpperCase(),
    items: items.recordset || [],
  };
}

async function getPurchaseSnapshot(request, id) {
  const header = await request
    .input('purchaseSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        pi.id,
        pi.document_no AS documentNo,
        pi.document_date AS documentDate,
        pi.supplier_id AS supplierId,
        s.name AS supplierName,
        pi.status,
        pi.supplier_currency AS supplierCurrency,
        pi.document_currency AS documentCurrency,
        pi.exchange_rate_snapshot AS exchangeRate,
        pi.description,
        pi.subtotal,
        pi.line_discount_total AS lineDiscountTotal,
        pi.invoice_discount_rate AS invoiceDiscountRate,
        pi.supplier_discount_rate AS supplierDiscountRate,
        pi.discount_total AS discountTotal,
        pi.grand_total AS grandTotal,
        pi.amount_try AS amountTry,
        pi.stock_cost_effect_try AS stockCostEffectTry,
        pi.updated_at AS updatedAt
      FROM dbo.purchase_invoices pi
      LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
      WHERE pi.id = @purchaseSnapshotId;
    `);

  const row = header.recordset?.[0];

  if (!row) {
    return null;
  }

  const items = await request
    .input('purchaseItemsSnapshotId', sql.BigInt, id)
    .query(`
      SELECT
        id,
        product_id AS productId,
        stock_code_snapshot AS stockCode,
        barcode_snapshot AS barcode,
        product_name_snapshot AS productName,
        quantity,
        currency_code AS currency,
        purchase_price AS purchasePrice,
        line_discount_rate AS lineDiscountRate,
        line_total AS lineTotal,
        line_total_try AS lineTotalTry,
        stock_effect_snapshot AS stockEffect,
        note
      FROM dbo.purchase_invoice_items
      WHERE purchase_invoice_id = @purchaseItemsSnapshotId
      ORDER BY id ASC;
    `);

  return {
    ...row,
    status: row.status?.toUpperCase(),
    items: items.recordset || [],
  };
}

async function getSalesFinalizeSnapshot(request, id, { lockHeader = false } = {}) {
  const personnelReady = await hasPersonnelSalesSchema(request);
  const ownershipColumns = personnelReady
    ? `si.terminal_device_id AS terminalDeviceId,
        td.device_code AS terminalCode,
        td.device_name AS terminalName,
        si.employee_id AS employeeId,
        e.employee_code AS employeeCode,
        e.full_name AS employeeName,`
    : `CAST(NULL AS BIGINT) AS terminalDeviceId,
        CAST(NULL AS NVARCHAR(80)) AS terminalCode,
        CAST(NULL AS NVARCHAR(150)) AS terminalName,
        CAST(NULL AS BIGINT) AS employeeId,
        CAST(NULL AS NVARCHAR(50)) AS employeeCode,
        CAST(NULL AS NVARCHAR(150)) AS employeeName,`;
  const ownershipJoins = personnelReady
    ? `LEFT JOIN dbo.terminal_devices td ON td.id = si.terminal_device_id
       LEFT JOIN dbo.employees e ON e.id = si.employee_id`
    : '';
  const invoiceTable = lockHeader ? 'dbo.sales_invoices si WITH (UPDLOCK, HOLDLOCK)' : 'dbo.sales_invoices si';
  const header = await request
    .input('finalizeSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        si.id,
        si.document_no AS documentNo,
        si.document_date AS documentDate,
        si.customer_id AS customerId,
        c.customer_code AS customerCode,
        c.name AS customerName,
        ${ownershipColumns}
        c.is_active AS customerIsActive,
        CASE WHEN COALESCE(si.description, N'') LIKE N'%TEST_ARCHIVED%' THEN N'archived_test' ELSE si.status END AS status,
        si.customer_currency AS customerCurrency,
        si.document_currency AS documentCurrency,
        si.exchange_rate_snapshot AS exchangeRate,
        si.description,
        si.subtotal,
        si.discount_rate AS discountRate,
        si.discount_total AS discountTotal,
        si.grand_total AS grandTotal,
        si.amount_try AS amountTry,
        si.estimated_profit_try AS estimatedProfitTry,
        si.finalized_at AS finalizedAt,
        si.updated_at AS updatedAt
      FROM ${invoiceTable}
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
      ${ownershipJoins}
      WHERE si.id = @finalizeSnapshotId;
    `);

  const row = header.recordset?.[0];

  if (!row) {
    return null;
  }

  const items = await request
    .input('finalizeItemsSnapshotId', sql.BigInt, id)
    .query(`
      SELECT
        sii.id,
        sii.product_id AS productId,
        p.current_stock_qty AS currentStockQty,
        p.category,
        p.currency_code AS productCurrency,
        p.purchase_price AS productPurchasePrice,
        p.purchase_discount_rate AS productPurchaseDiscountRate,
        p.average_cost_try AS productAverageCostTry,
        sii.stock_code_snapshot AS stockCode,
        sii.barcode_snapshot AS barcode,
        sii.product_name_snapshot AS productName,
        sii.quantity,
        sii.currency_code AS currency,
        sii.unit_price AS unitPrice,
        sii.line_total AS lineTotal,
        sii.average_cost_try_snapshot AS averageCostTry,
        sii.gross_profit_try AS grossProfitTry,
        sii.gross_profit_rate AS grossProfitRate,
        sii.stock_status_snapshot AS stockStatus,
        sii.note
      FROM dbo.sales_invoice_items sii
      INNER JOIN dbo.products p ON p.id = sii.product_id
      WHERE sii.sales_invoice_id = @finalizeItemsSnapshotId
      ORDER BY sii.id ASC;
    `);

  return {
    ...row,
    status: row.status?.toUpperCase(),
    items: items.recordset || [],
  };
}

async function getPurchaseFinalizeSnapshot(request, id, { lockHeader = false } = {}) {
  const invoiceTable = lockHeader ? 'dbo.purchase_invoices pi WITH (UPDLOCK, HOLDLOCK)' : 'dbo.purchase_invoices pi';
  const header = await request
    .input('purchaseFinalizeSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        pi.id,
        pi.document_no AS documentNo,
        pi.document_date AS documentDate,
        pi.supplier_id AS supplierId,
        s.name AS supplierName,
        s.is_active AS supplierIsActive,
        pi.status,
        pi.supplier_currency AS supplierCurrency,
        pi.document_currency AS documentCurrency,
        pi.exchange_rate_snapshot AS exchangeRate,
        pi.description,
        pi.subtotal,
        pi.line_discount_total AS lineDiscountTotal,
        pi.invoice_discount_rate AS invoiceDiscountRate,
        pi.supplier_discount_rate AS supplierDiscountRate,
        pi.discount_total AS discountTotal,
        pi.grand_total AS grandTotal,
        pi.amount_try AS amountTry,
        pi.stock_cost_effect_try AS stockCostEffectTry,
        pi.finalized_at AS finalizedAt,
        pi.updated_at AS updatedAt
      FROM ${invoiceTable}
      LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
      WHERE pi.id = @purchaseFinalizeSnapshotId;
    `);

  const row = header.recordset?.[0];

  if (!row) {
    return null;
  }

  const items = await request
    .input('purchaseFinalizeItemsSnapshotId', sql.BigInt, id)
    .query(`
      SELECT
        pii.id,
        pii.product_id AS productId,
        p.current_stock_qty AS currentStockQty,
        p.average_cost_try AS currentAverageCostTry,
        pii.stock_code_snapshot AS stockCode,
        pii.barcode_snapshot AS barcode,
        pii.product_name_snapshot AS productName,
        pii.quantity,
        pii.currency_code AS currency,
        pii.purchase_price AS purchasePrice,
        pii.line_discount_rate AS lineDiscountRate,
        pii.line_total AS lineTotal,
        pii.line_total_try AS lineTotalTry,
        pii.stock_effect_snapshot AS stockEffect,
        pii.note
      FROM dbo.purchase_invoice_items pii
      INNER JOIN dbo.products p ON p.id = pii.product_id
      WHERE pii.purchase_invoice_id = @purchaseFinalizeItemsSnapshotId
      ORDER BY pii.id ASC;
    `);

  return {
    ...row,
    status: row.status?.toUpperCase(),
    items: items.recordset || [],
  };
}

async function updateSalesItems(sqlDriver, transaction, invoiceId, items) {
  const existing = await new sqlDriver.Request(transaction)
    .input('invoiceIdForItems', sql.BigInt, invoiceId)
    .query(`
      SELECT id
      FROM dbo.sales_invoice_items
      WHERE sales_invoice_id = @invoiceIdForItems
      ORDER BY id ASC;
    `);

  const existingRows = existing.recordset || [];

  for (const [index, item] of items.entries()) {
    const existingId = existingRows[index]?.id;

    if (existingId) {
      await new sqlDriver.Request(transaction)
        .input('itemId', sql.BigInt, existingId)
        .input('productId', sql.BigInt, item.productId)
        .input('stockCode', sql.NVarChar(50), item.stockCode)
        .input('barcode', sql.NVarChar(80), item.barcode || null)
        .input('productName', sql.NVarChar(250), item.productName)
        .input('quantity', sql.Decimal(18, 3), item.quantity)
        .input('currency', sql.NVarChar(3), item.currency)
        .input('unitPrice', sql.Decimal(18, 4), item.unitPrice)
        .input('lineTotal', sql.Decimal(18, 4), item.lineTotal)
        .input('averageCostTry', sql.Decimal(18, 4), item.averageCostTry)
        .input('stockStatus', sql.NVarChar(50), item.stockStatus || null)
        .input('note', sql.NVarChar(250), item.note || null)
        .query(`
          UPDATE dbo.sales_invoice_items
          SET
            product_id = @productId,
            stock_code_snapshot = @stockCode,
            barcode_snapshot = @barcode,
            product_name_snapshot = @productName,
            quantity = @quantity,
            currency_code = @currency,
            unit_price = @unitPrice,
            line_total = @lineTotal,
            average_cost_try_snapshot = @averageCostTry,
            stock_status_snapshot = @stockStatus,
            note = @note
          WHERE id = @itemId;
        `);
    } else {
      await insertSalesItem(sqlDriver, transaction, invoiceId, item);
    }
  }

  for (const obsoleteRow of existingRows.slice(items.length)) {
    await new sqlDriver.Request(transaction)
      .input('obsoleteSalesItemId', sql.BigInt, obsoleteRow.id)
      .query('DELETE FROM dbo.sales_invoice_items WHERE id = @obsoleteSalesItemId;');
  }
}

async function insertSalesItem(sqlDriver, transaction, invoiceId, item) {
  await new sqlDriver.Request(transaction)
    .input('invoiceId', sql.BigInt, invoiceId)
    .input('productId', sql.BigInt, item.productId)
    .input('stockCode', sql.NVarChar(50), item.stockCode)
    .input('barcode', sql.NVarChar(80), item.barcode || null)
    .input('productName', sql.NVarChar(250), item.productName)
    .input('quantity', sql.Decimal(18, 3), item.quantity)
    .input('currency', sql.NVarChar(3), item.currency)
    .input('unitPrice', sql.Decimal(18, 4), item.unitPrice)
    .input('lineTotal', sql.Decimal(18, 4), item.lineTotal)
    .input('averageCostTry', sql.Decimal(18, 4), item.averageCostTry)
    .input('stockStatus', sql.NVarChar(50), item.stockStatus || null)
    .input('note', sql.NVarChar(250), item.note || null)
    .query(`
      INSERT INTO dbo.sales_invoice_items (
        sales_invoice_id,
        product_id,
        stock_code_snapshot,
        barcode_snapshot,
        product_name_snapshot,
        quantity,
        currency_code,
        unit_price,
        line_total,
        average_cost_try_snapshot,
        stock_status_snapshot,
        note
      )
      VALUES (
        @invoiceId,
        @productId,
        @stockCode,
        @barcode,
        @productName,
        @quantity,
        @currency,
        @unitPrice,
        @lineTotal,
        @averageCostTry,
        @stockStatus,
        @note
      );
    `);
}

async function updatePurchaseItems(sqlDriver, transaction, invoiceId, items) {
  const existing = await new sqlDriver.Request(transaction)
    .input('invoiceIdForItems', sql.BigInt, invoiceId)
    .query(`
      SELECT id
      FROM dbo.purchase_invoice_items
      WHERE purchase_invoice_id = @invoiceIdForItems
      ORDER BY id ASC;
    `);

  const existingRows = existing.recordset || [];

  for (const [index, item] of items.entries()) {
    const existingId = existingRows[index]?.id;

    if (existingId) {
      await new sqlDriver.Request(transaction)
        .input('itemId', sql.BigInt, existingId)
        .input('productId', sql.BigInt, item.productId)
        .input('stockCode', sql.NVarChar(50), item.stockCode)
        .input('barcode', sql.NVarChar(80), item.barcode || null)
        .input('productName', sql.NVarChar(250), item.productName)
        .input('quantity', sql.Decimal(18, 3), item.quantity)
        .input('currency', sql.NVarChar(3), item.currency)
        .input('purchasePrice', sql.Decimal(18, 4), item.purchasePrice)
        .input('lineDiscountRate', sql.Decimal(9, 4), item.lineDiscountRate)
        .input('lineTotal', sql.Decimal(18, 4), item.lineTotal)
        .input('lineTotalTry', sql.Decimal(18, 4), item.lineTotalTry)
        .input('stockEffect', sql.NVarChar(50), item.stockEffect || null)
        .input('note', sql.NVarChar(250), item.note || null)
        .query(`
          UPDATE dbo.purchase_invoice_items
          SET
            product_id = @productId,
            stock_code_snapshot = @stockCode,
            barcode_snapshot = @barcode,
            product_name_snapshot = @productName,
            quantity = @quantity,
            currency_code = @currency,
            purchase_price = @purchasePrice,
            line_discount_rate = @lineDiscountRate,
            line_total = @lineTotal,
            line_total_try = @lineTotalTry,
            stock_effect_snapshot = @stockEffect,
            note = @note
          WHERE id = @itemId;
        `);
    } else {
      await insertPurchaseItem(sqlDriver, transaction, invoiceId, item);
    }
  }

  for (const obsoleteRow of existingRows.slice(items.length)) {
    await new sqlDriver.Request(transaction)
      .input('obsoletePurchaseItemId', sql.BigInt, obsoleteRow.id)
      .query('DELETE FROM dbo.purchase_invoice_items WHERE id = @obsoletePurchaseItemId;');
  }
}

async function insertPurchaseItem(sqlDriver, transaction, invoiceId, item) {
  await new sqlDriver.Request(transaction)
    .input('invoiceId', sql.BigInt, invoiceId)
    .input('productId', sql.BigInt, item.productId)
    .input('stockCode', sql.NVarChar(50), item.stockCode)
    .input('barcode', sql.NVarChar(80), item.barcode || null)
    .input('productName', sql.NVarChar(250), item.productName)
    .input('quantity', sql.Decimal(18, 3), item.quantity)
    .input('currency', sql.NVarChar(3), item.currency)
    .input('purchasePrice', sql.Decimal(18, 4), item.purchasePrice)
    .input('lineDiscountRate', sql.Decimal(9, 4), item.lineDiscountRate)
    .input('lineTotal', sql.Decimal(18, 4), item.lineTotal)
    .input('lineTotalTry', sql.Decimal(18, 4), item.lineTotalTry)
    .input('stockEffect', sql.NVarChar(50), item.stockEffect || null)
    .input('note', sql.NVarChar(250), item.note || null)
    .query(`
      INSERT INTO dbo.purchase_invoice_items (
        purchase_invoice_id,
        product_id,
        stock_code_snapshot,
        barcode_snapshot,
        product_name_snapshot,
        quantity,
        currency_code,
        purchase_price,
        line_discount_rate,
        line_total,
        line_total_try,
        stock_effect_snapshot,
        note
      )
      VALUES (
        @invoiceId,
        @productId,
        @stockCode,
        @barcode,
        @productName,
        @quantity,
        @currency,
        @purchasePrice,
        @lineDiscountRate,
        @lineTotal,
        @lineTotalTry,
        @stockEffect,
        @note
      );
    `);
}

function quantityByProduct(items = []) {
  const quantities = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    quantities.set(productId, safeNumber(quantities.get(productId)) + safeNumber(item.quantity));
  }
  return quantities;
}

async function applyFinalizedStockDifference(sqlDriver, transaction, beforeItems, afterItems, direction) {
  const before = quantityByProduct(beforeItems);
  const after = quantityByProduct(afterItems);
  const productIds = new Set([...before.keys(), ...after.keys()]);

  for (const productId of productIds) {
    const oldQuantity = safeNumber(before.get(productId));
    const newQuantity = safeNumber(after.get(productId));
    const stockDifference = direction === 'sale'
      ? oldQuantity - newQuantity
      : newQuantity - oldQuantity;

    if (stockDifference === 0) continue;

    await new sqlDriver.Request(transaction)
      .input('correctionStockProductId', sql.BigInt, productId)
      .input('correctionStockDifference', sql.Decimal(18, 3), stockDifference)
      .query(`
        UPDATE dbo.products
        SET
          current_stock_qty = current_stock_qty + @correctionStockDifference,
          updated_at = SYSUTCDATETIME()
        WHERE id = @correctionStockProductId;
      `);
  }

  return productIds;
}

async function replaceFinalizedSalesEffects(sqlDriver, transaction, invoiceId, beforeSnapshot, draft, actor) {
  if (Number(beforeSnapshot.customerId) !== Number(draft.customerId)
    || normalizeCurrency(beforeSnapshot.customerCurrency) !== draft.customerCurrency
    || normalizeCurrency(beforeSnapshot.documentCurrency) !== draft.documentCurrency) {
    throw makeServiceError(
      'SALES_FINALIZED_IDENTITY_LOCKED',
      'Kesinlesmis satis fisinde cari ve para birimi degistirilemez',
      409,
    );
  }

  await applyFinalizedStockDifference(sqlDriver, transaction, beforeSnapshot.items, draft.items, 'sale');
  await new sqlDriver.Request(transaction)
    .input('salesCorrectionInvoiceId', sql.BigInt, invoiceId)
    .query(`
      DELETE FROM dbo.stock_movements
      WHERE source_type = N'sales_invoice'
        AND source_id = @salesCorrectionInvoiceId
        AND movement_type = N'out';
    `);

  const afterSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);
  const currencyRateMap = await readCurrencyRateMap(new sqlDriver.Request(transaction));
  let estimatedProfitTry = 0;

  for (const item of afterSnapshot.items) {
    const amountTry = safeNumber(item.lineTotal) * safeNumber(draft.exchangeRate, 1);
    const averageCostTry = resolveSalesUnitCostTry(item, draft.documentCurrency, draft.exchangeRate, currencyRateMap);
    const profit = calculateSalesProfitSnapshot({
      salesAmountTry: amountTry,
      averageCostTry,
      quantity: safeNumber(item.quantity),
    });
    estimatedProfitTry += profit.grossProfitTry;

    await new sqlDriver.Request(transaction)
      .input('salesCorrectionItemId', sql.BigInt, item.id)
      .input('salesCorrectionAverageCost', sql.Decimal(18, 4), averageCostTry)
      .input('salesCorrectionProfit', sql.Decimal(18, 4), profit.grossProfitTry)
      .input('salesCorrectionProfitRate', sql.Decimal(18, 6), profit.grossProfitRate)
      .query(`
        UPDATE dbo.sales_invoice_items
        SET
          average_cost_try_snapshot = @salesCorrectionAverageCost,
          gross_profit_try = @salesCorrectionProfit,
          gross_profit_rate = @salesCorrectionProfitRate
        WHERE id = @salesCorrectionItemId;
      `);

    await new sqlDriver.Request(transaction)
      .input('salesCorrectionProductId', sql.BigInt, item.productId)
      .input('salesCorrectionSourceId', sql.BigInt, invoiceId)
      .input('salesCorrectionQuantity', sql.Decimal(18, 3), item.quantity)
      .input('salesCorrectionUnitCost', sql.Decimal(18, 4), averageCostTry)
      .input('salesCorrectionUnitPrice', sql.Decimal(18, 4), item.unitPrice)
      .input('salesCorrectionCurrency', sql.NVarChar(3), item.currency)
      .input('salesCorrectionAmountTry', sql.Decimal(18, 4), amountTry)
      .input('salesCorrectionDate', sql.Date, draft.documentDate)
      .input('salesCorrectionCustomerId', sql.BigInt, draft.customerId)
      .input('salesCorrectionCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.stock_movements (
          product_id, movement_type, source_type, source_id, quantity_in, quantity_out,
          quantity_net, unit_cost_try, average_cost_try_after, document_date, customer_id,
          created_at, created_by, unit_price, currency_code, amount_try
        ) VALUES (
          @salesCorrectionProductId, N'out', N'sales_invoice', @salesCorrectionSourceId, 0,
          @salesCorrectionQuantity, -@salesCorrectionQuantity, @salesCorrectionUnitCost,
          @salesCorrectionUnitCost, @salesCorrectionDate, @salesCorrectionCustomerId,
          SYSUTCDATETIME(), @salesCorrectionCreatedBy, @salesCorrectionUnitPrice,
          @salesCorrectionCurrency, @salesCorrectionAmountTry
        );
      `);
  }

  const balanceDifference = safeNumber(draft.grandTotal) - safeNumber(beforeSnapshot.grandTotal);
  await new sqlDriver.Request(transaction)
    .input('salesCorrectionCustomerId', sql.BigInt, draft.customerId)
    .input('salesCorrectionBalanceDifference', sql.Decimal(18, 4), balanceDifference)
    .input('salesCorrectionInvoiceId', sql.BigInt, invoiceId)
    .input('salesCorrectionAmount', sql.Decimal(18, 4), draft.grandTotal)
    .input('salesCorrectionCurrency', sql.NVarChar(3), draft.documentCurrency)
    .input('salesCorrectionDate', sql.Date, draft.documentDate)
    .query(`
      UPDATE dbo.customers
      SET balance = balance + @salesCorrectionBalanceDifference, updated_at = SYSUTCDATETIME()
      WHERE id = @salesCorrectionCustomerId;

      UPDATE dbo.customer_movements
      SET
        amount = @salesCorrectionAmount,
        currency_code = @salesCorrectionCurrency,
        balance_effect = @salesCorrectionAmount,
        document_date = @salesCorrectionDate
      WHERE sales_invoice_id = @salesCorrectionInvoiceId
        AND movement_type = N'sales_invoice';
    `);

  if (isCashCustomerCode(beforeSnapshot.customerCode)) {
    await new sqlDriver.Request(transaction)
      .input('cashCorrectionInvoiceId', sql.BigInt, invoiceId)
      .input('cashCorrectionCustomerId', sql.BigInt, draft.customerId)
      .input('cashCorrectionAmount', sql.Decimal(18, 4), draft.grandTotal)
      .input('cashCorrectionBalanceDifference', sql.Decimal(18, 4), balanceDifference)
      .input('cashCorrectionCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('cashCorrectionDate', sql.Date, draft.documentDate)
      .query(`
        DECLARE @cashMovementId BIGINT;
        DECLARE @cashAccountId BIGINT;

        SELECT TOP (1) @cashMovementId = id
        FROM dbo.customer_movements
        WHERE sales_invoice_id = @cashCorrectionInvoiceId AND movement_type = N'collection';

        SELECT TOP (1) @cashAccountId = account_id
        FROM dbo.finance_account_movements
        WHERE source_type = N'collection' AND party_type = N'customer' AND party_movement_id = @cashMovementId;

        UPDATE dbo.customer_movements
        SET
          amount = @cashCorrectionAmount,
          currency_code = @cashCorrectionCurrency,
          balance_effect = -@cashCorrectionAmount,
          document_date = @cashCorrectionDate
        WHERE id = @cashMovementId;

        UPDATE dbo.customers
        SET balance = balance - @cashCorrectionBalanceDifference, updated_at = SYSUTCDATETIME()
        WHERE id = @cashCorrectionCustomerId;

        UPDATE dbo.finance_account_movements
        SET amount = @cashCorrectionAmount, currency_code = @cashCorrectionCurrency, document_date = @cashCorrectionDate
        WHERE source_type = N'collection' AND party_type = N'customer' AND party_movement_id = @cashMovementId;

        UPDATE dbo.finance_accounts
        SET current_balance = current_balance + @cashCorrectionBalanceDifference, updated_at = SYSUTCDATETIME()
        WHERE id = @cashAccountId;
      `);
  }

  await new sqlDriver.Request(transaction)
    .input('salesCorrectionProfitInvoiceId', sql.BigInt, invoiceId)
    .input('salesCorrectionEstimatedProfit', sql.Decimal(18, 4), estimatedProfitTry)
    .query(`
      UPDATE dbo.sales_invoices
      SET estimated_profit_try = @salesCorrectionEstimatedProfit
      WHERE id = @salesCorrectionProfitInvoiceId;
    `);
}

async function replaceFinalizedPurchaseEffects(sqlDriver, transaction, invoiceId, beforeSnapshot, draft, supplierId, actor) {
  if (Number(beforeSnapshot.supplierId) !== Number(supplierId)
    || normalizeCurrency(beforeSnapshot.supplierCurrency) !== draft.supplierCurrency
    || normalizeCurrency(beforeSnapshot.documentCurrency) !== draft.documentCurrency) {
    throw makeServiceError(
      'PURCHASE_FINALIZED_IDENTITY_LOCKED',
      'Kesinlesmis alis fisinde tedarikci ve para birimi degistirilemez',
      409,
    );
  }

  const affectedProductIds = await applyFinalizedStockDifference(
    sqlDriver,
    transaction,
    beforeSnapshot.items,
    draft.items,
    'purchase',
  );

  await new sqlDriver.Request(transaction)
    .input('purchaseCorrectionInvoiceId', sql.BigInt, invoiceId)
    .query(`
      DELETE FROM dbo.stock_movements
      WHERE source_type = N'purchase_invoice'
        AND source_id = @purchaseCorrectionInvoiceId
        AND movement_type = N'in';
    `);

  const afterSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);
  for (const item of afterSnapshot.items) {
    const amountTry = purchaseLineCostTry(item, draft.exchangeRate);
    const unitCostTry = safeNumber(item.quantity) > 0 ? amountTry / safeNumber(item.quantity) : 0;
    await new sqlDriver.Request(transaction)
      .input('purchaseCorrectionProductId', sql.BigInt, item.productId)
      .input('purchaseCorrectionSourceId', sql.BigInt, invoiceId)
      .input('purchaseCorrectionQuantity', sql.Decimal(18, 3), item.quantity)
      .input('purchaseCorrectionUnitCost', sql.Decimal(18, 4), unitCostTry)
      .input('purchaseCorrectionUnitPrice', sql.Decimal(18, 4), item.purchasePrice)
      .input('purchaseCorrectionCurrency', sql.NVarChar(3), item.currency)
      .input('purchaseCorrectionAmountTry', sql.Decimal(18, 4), amountTry)
      .input('purchaseCorrectionDate', sql.Date, draft.documentDate)
      .input('purchaseCorrectionSupplierId', sql.BigInt, supplierId)
      .input('purchaseCorrectionCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.stock_movements (
          product_id, movement_type, source_type, source_id, quantity_in, quantity_out,
          quantity_net, unit_cost_try, average_cost_try_after, document_date, supplier_id,
          created_at, created_by, unit_price, currency_code, amount_try
        ) VALUES (
          @purchaseCorrectionProductId, N'in', N'purchase_invoice', @purchaseCorrectionSourceId,
          @purchaseCorrectionQuantity, 0, @purchaseCorrectionQuantity, @purchaseCorrectionUnitCost,
          @purchaseCorrectionUnitCost, @purchaseCorrectionDate, @purchaseCorrectionSupplierId,
          SYSUTCDATETIME(), @purchaseCorrectionCreatedBy, @purchaseCorrectionUnitPrice,
          @purchaseCorrectionCurrency, @purchaseCorrectionAmountTry
        );
      `);
  }

  const balanceDifference = safeNumber(draft.grandTotal) - safeNumber(beforeSnapshot.grandTotal);
  await new sqlDriver.Request(transaction)
    .input('purchaseCorrectionSupplierId', sql.BigInt, supplierId)
    .input('purchaseCorrectionBalanceDifference', sql.Decimal(18, 4), balanceDifference)
    .input('purchaseCorrectionInvoiceId', sql.BigInt, invoiceId)
    .input('purchaseCorrectionAmount', sql.Decimal(18, 4), draft.grandTotal)
    .input('purchaseCorrectionCurrency', sql.NVarChar(3), draft.documentCurrency)
    .input('purchaseCorrectionDate', sql.Date, draft.documentDate)
    .query(`
      UPDATE dbo.suppliers
      SET balance = balance + @purchaseCorrectionBalanceDifference, updated_at = SYSUTCDATETIME()
      WHERE id = @purchaseCorrectionSupplierId;

      UPDATE dbo.supplier_movements
      SET
        amount = @purchaseCorrectionAmount,
        currency_code = @purchaseCorrectionCurrency,
        balance_effect = @purchaseCorrectionAmount,
        document_date = @purchaseCorrectionDate
      WHERE purchase_invoice_id = @purchaseCorrectionInvoiceId
        AND movement_type = N'purchase_invoice';
    `);

  for (const productId of affectedProductIds) {
    await recalculateProductAverageCostTry(sqlDriver, transaction, productId, actor);
  }
}

async function assertPurchaseItemsBelongToSupplier(sqlDriver, transaction, supplierId, items) {
  for (const [index, item] of items.entries()) {
    const result = await new sqlDriver.Request(transaction)
      .input('purchaseSupplierCheckProductId', sql.BigInt, item.productId)
      .query(`
        SELECT TOP (1)
          id,
          stock_code,
          name,
          supplier_id
        FROM dbo.products
        WHERE id = @purchaseSupplierCheckProductId
          AND is_deleted = 0;
      `);

    const product = result.recordset?.[0];

    if (!product) {
      throw makeServiceError('PURCHASE_PRODUCT_NOT_FOUND', `items[${index}].productId not found`, 400);
    }

    if (String(product.supplier_id || '') !== String(supplierId)) {
      throw makeServiceError(
        'PURCHASE_PRODUCT_SUPPLIER_MISMATCH',
        `Product ${product.stock_code || item.productId} does not belong to selected supplier`,
        400,
      );
    }
  }
}

async function ensureSupplier(sqlDriver, transaction, payload) {
  if (payload.supplierId) {
    return payload.supplierId;
  }

  const supplierName = payload.supplierName || 'Draft Supplier';
  const supplierCode = `DRAFT-${supplierName.replace(/[^A-Za-z0-9]/g, '').slice(0, 18).toUpperCase() || 'SUPPLIER'}`;
  const lookup = await new sqlDriver.Request(transaction)
    .input('supplierCode', sql.NVarChar(50), supplierCode)
    .query(`
      SELECT TOP (1) id
      FROM dbo.suppliers
      WHERE supplier_code = @supplierCode;
    `);

  if (lookup.recordset?.[0]?.id) {
    return Number(lookup.recordset[0].id);
  }

  const insert = await new sqlDriver.Request(transaction)
    .input('supplierCode', sql.NVarChar(50), supplierCode)
    .input('supplierName', sql.NVarChar(250), supplierName)
    .input('currency', sql.NVarChar(3), payload.supplierCurrency)
    .query(`
      INSERT INTO dbo.suppliers (
        supplier_code,
        name,
        currency_code,
        balance,
        is_active,
        is_deleted
      )
      OUTPUT INSERTED.id AS supplierId
      VALUES (
        @supplierCode,
        @supplierName,
        @currency,
        0,
        1,
        0
      );
    `);

  return Number(insert.recordset?.[0]?.supplierId);
}

export async function getSalesDraft(id) {
  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('SALES_DRAFT_ID_INVALID', 'Sales draft id is invalid');
  }

  const pool = await getSqlPool();
  const snapshot = await getSalesSnapshot(pool.request(), invoiceId);

  if (!snapshot) {
    throw makeServiceError('SALES_DRAFT_NOT_FOUND', 'Sales draft not found', 404);
  }

  return snapshot;
}

export async function getSalesDraftsList(query) {
  const options = parseDraftListQuery(query);

  if (options.status === 'unsupported') {
    return {
      data: [],
      meta: buildListMeta({
        ...options,
        total: 0,
        source: 'sql-select-only',
        filters: {
          search: options.search || null,
          status: 'DRAFT',
          customer: options.partySearch || null,
        },
      }),
    };
  }

  const pool = await getSqlPool();
  const personnelReady = await hasPersonnelSalesSchema(pool.request());
  const ownershipColumns = personnelReady
    ? `td.device_code AS terminal_code,
        si.employee_id,
        e.full_name AS employee_name,`
    : `CAST(NULL AS NVARCHAR(80)) AS terminal_code,
        CAST(NULL AS BIGINT) AS employee_id,
        CAST(NULL AS NVARCHAR(150)) AS employee_name,`;
  const ownershipJoins = personnelReady
    ? `LEFT JOIN dbo.terminal_devices td ON td.id = si.terminal_device_id
       LEFT JOIN dbo.employees e ON e.id = si.employee_id`
    : '';
  const ownershipFilters = personnelReady
    ? `AND (
         @employeeSearch IS NULL
         OR ${sqlNormalizedLike('e.full_name', '@employeeSearch')}
       )
       AND (
         @terminalSearch IS NULL
         OR ${sqlNormalizedLike('td.device_code', '@terminalSearch')}
       )`
    : 'AND @employeeSearch IS NULL AND @terminalSearch IS NULL';
  const request = pool.request()
    .input('search', sql.NVarChar(160), toSearchPattern(options.search))
    .input('customerSearch', sql.NVarChar(160), toSearchPattern(options.partySearch))
    .input('status', sql.NVarChar(20), options.status === 'all' ? null : options.status)
    .input('dateFrom', sql.Date, options.dateFrom)
    .input('dateTo', sql.Date, options.dateTo)
    .input('currency', sql.NVarChar(3), options.currency)
    .input('amountMin', sql.Decimal(18, 4), options.amountMin)
    .input('amountMax', sql.Decimal(18, 4), options.amountMax)
    .input('employeeSearch', sql.NVarChar(160), toSearchPattern(options.employeeSearch))
    .input('terminalSearch', sql.NVarChar(160), toSearchPattern(options.terminalSearch))
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_sales AS (
      SELECT
        si.id,
        si.document_no AS invoice_no,
        c.name AS customer_name,
        ${ownershipColumns}
        si.document_currency AS currency_code,
        si.grand_total AS total_amount,
        CASE WHEN COALESCE(si.description, N'') LIKE N'%TEST_ARCHIVED%' THEN N'archived_test' ELSE si.status END AS status,
        si.document_date,
        si.created_at,
        si.updated_at,
        item_counts.item_count
      FROM dbo.sales_invoices si
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
      ${ownershipJoins}
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS item_count
        FROM dbo.sales_invoice_items sii
        WHERE sii.sales_invoice_id = si.id
      ) item_counts
      WHERE
        (
          (@status IS NULL AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
          OR (@status = N'archived_test' AND COALESCE(si.description, N'') LIKE N'%TEST_ARCHIVED%')
          OR (@status IS NOT NULL AND @status <> N'archived_test' AND si.status = @status AND COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
        )
        AND (@dateFrom IS NULL OR si.document_date >= @dateFrom)
        AND (@dateTo IS NULL OR si.document_date <= @dateTo)
        AND (@currency IS NULL OR si.document_currency = @currency)
        AND (@amountMin IS NULL OR si.grand_total >= @amountMin)
        AND (@amountMax IS NULL OR si.grand_total <= @amountMax)
        AND (
          @search IS NULL
          OR ${sqlNormalizedLike('si.document_no')}
          OR ${sqlNormalizedLike('c.name')}
          OR ${sqlNormalizedLike('c.customer_code')}
          OR EXISTS (
            SELECT 1
            FROM dbo.sales_invoice_items search_item
            WHERE search_item.sales_invoice_id = si.id
              AND (
                ${sqlNormalizedLike('search_item.stock_code_snapshot')}
                OR ${sqlNormalizedLike('search_item.barcode_snapshot')}
                OR ${sqlNormalizedLike('search_item.product_name_snapshot')}
              )
          )
        )
        AND (
          @customerSearch IS NULL
          OR ${sqlNormalizedLike('c.name', '@customerSearch')}
          OR ${sqlNormalizedLike('c.customer_code', '@customerSearch')}
        )
        ${ownershipFilters}
    ),
    numbered_sales AS (
      SELECT
        fs.*,
        ROW_NUMBER() OVER (ORDER BY fs.created_at DESC, fs.id DESC) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_sales fs
    )
    SELECT TOP (${options.limit}) ns.*
    FROM numbered_sales ns
    WHERE ns.row_number > @offset
    ORDER BY ns.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toSalesListDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-select-only',
      filters: {
        search: options.search || null,
        status: options.status,
        customer: options.partySearch || null,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        currency: options.currency,
        amountMin: options.amountMin,
        amountMax: options.amountMax,
        employee: options.employeeSearch || null,
        terminal: options.terminalSearch || null,
      },
    }),
  };
}

export async function createSalesDraft(payload, actor = null) {
  assertMelisaWriteEnabled();

  const draft = normalizeSalesPayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const personnelReady = await hasPersonnelSalesSchema(new sqlDriver.Request(transaction));
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), draft.documentDate, 'Satış fişi taslak kaydı');

    const insert = await new sqlDriver.Request(transaction)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('customerId', sql.BigInt, draft.customerId)
      .input('terminalDeviceId', sql.BigInt, draft.terminalDeviceId)
      .input('employeeId', sql.BigInt, draft.employeeId)
      .input('customerCurrency', sql.NVarChar(3), draft.customerCurrency)
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('discountRate', sql.Decimal(9, 4), draft.discountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('estimatedProfitTry', sql.Decimal(18, 4), draft.estimatedProfitTry)
      .query(`
        INSERT INTO dbo.sales_invoices (
          document_no,
          document_date,
          customer_id,
          ${personnelReady ? 'terminal_device_id, employee_id,' : ''}
          status,
          customer_currency,
          document_currency,
          exchange_rate_snapshot,
          description,
          subtotal,
          discount_rate,
          discount_total,
          grand_total,
          amount_try,
          estimated_profit_try,
          created_by,
          updated_by
        )
        OUTPUT INSERTED.id AS invoiceId
        VALUES (
          @documentNo,
          @documentDate,
          @customerId,
          ${personnelReady ? '@terminalDeviceId, @employeeId,' : ''}
          N'draft',
          @customerCurrency,
          @documentCurrency,
          @exchangeRate,
          @description,
          @subtotal,
          @discountRate,
          @discountTotal,
          @grandTotal,
          @amountTry,
          @estimatedProfitTry,
          NULL,
          NULL
        );
      `);

    const invoiceId = Number(insert.recordset?.[0]?.invoiceId);

    for (const item of draft.items) {
      await insertSalesItem(sqlDriver, transaction, invoiceId, item);
    }

    const afterSnapshot = await getSalesSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_invoice_draft_created',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getSalesDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateSalesDraft(id, payload, actor = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('SALES_DRAFT_ID_INVALID', 'Sales draft id is invalid');
  }

  const draft = normalizeSalesPayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getSalesFinalizeSnapshot(
      new sqlDriver.Request(transaction),
      invoiceId,
      { lockHeader: true },
    );

    if (!beforeSnapshot) {
      throw makeServiceError('SALES_DRAFT_NOT_FOUND', 'Sales draft not found', 404);
    }

    if (!['DRAFT', 'FINALIZED'].includes(beforeSnapshot.status)) {
      throw makeServiceError('SALES_DRAFT_STATUS_INVALID', 'Only DRAFT or FINALIZED sales invoices can be corrected', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Satış fişi düzeltme');
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), draft.documentDate, 'Satış fişi düzeltme');

    await new sqlDriver.Request(transaction)
      .input('invoiceId', sql.BigInt, invoiceId)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('customerId', sql.BigInt, draft.customerId)
      .input('customerCurrency', sql.NVarChar(3), draft.customerCurrency)
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('discountRate', sql.Decimal(9, 4), draft.discountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('estimatedProfitTry', sql.Decimal(18, 4), draft.estimatedProfitTry)
      .query(`
        UPDATE dbo.sales_invoices
        SET
          document_no = @documentNo,
          document_date = @documentDate,
          customer_id = @customerId,
          customer_currency = @customerCurrency,
          document_currency = @documentCurrency,
          exchange_rate_snapshot = @exchangeRate,
          description = @description,
          subtotal = @subtotal,
          discount_rate = @discountRate,
          discount_total = @discountTotal,
          grand_total = @grandTotal,
          amount_try = @amountTry,
          estimated_profit_try = @estimatedProfitTry,
          updated_by = NULL,
          updated_at = SYSUTCDATETIME()
        WHERE id = @invoiceId
          AND status IN (N'draft', N'finalized');
      `);

    await updateSalesItems(sqlDriver, transaction, invoiceId, draft.items);

    if (beforeSnapshot.status === 'FINALIZED') {
      await replaceFinalizedSalesEffects(sqlDriver, transaction, invoiceId, beforeSnapshot, draft, actor);
    }

    const afterSnapshot = await getSalesSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: beforeSnapshot.status === 'FINALIZED' ? 'sales_invoice_finalized_corrected' : 'sales_invoice_draft_updated',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getSalesDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function finalizeSalesInvoice(id, actor = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('SALES_FINALIZE_ID_INVALID', 'Sales invoice id is invalid');
  }

  const pool = await getSqlPool();
  await ensureCashCustomers(pool);
  await ensureFinanceAccountTables(pool);
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId, { lockHeader: true });

    if (!beforeSnapshot) {
      throw makeServiceError('SALES_FINALIZE_NOT_FOUND', 'Sales invoice not found', 404);
    }

    if (beforeSnapshot.status !== 'DRAFT') {
      throw makeServiceError('SALES_FINALIZE_STATUS_INVALID', 'Only DRAFT sales invoices can be finalized', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Satış fişi kesinleştirme');

    if (!beforeSnapshot.customerId || !beforeSnapshot.customerName) {
      throw makeServiceError('SALES_FINALIZE_CUSTOMER_INVALID', 'Sales invoice customer is missing', 400);
    }

    if (!beforeSnapshot.items.length) {
      throw makeServiceError('SALES_FINALIZE_ITEMS_REQUIRED', 'Sales invoice must contain at least one item', 400);
    }

    if (Number(beforeSnapshot.grandTotal || 0) < 0) {
      throw makeServiceError('SALES_FINALIZE_TOTAL_INVALID', 'Sales invoice total cannot be negative', 400);
    }

    const cashCustomerCurrency = getCashCustomerCurrency(beforeSnapshot.customerCode);
    if (cashCustomerCurrency && cashCustomerCurrency !== beforeSnapshot.documentCurrency) {
      throw makeServiceError(
        'SALES_FINALIZE_CASH_CUSTOMER_CURRENCY_MISMATCH',
        'Pesin cari para birimi ile fis para birimi ayni olmali',
        400,
      );
    }

    const warnings = [];
    const profitSnapshots = [];
    const currencyRateMap = await readCurrencyRateMap(new sqlDriver.Request(transaction));

    for (const item of beforeSnapshot.items) {
      const quantity = safeNumber(item.quantity);
      const currentStock = safeNumber(item.currentStockQty);
      const nextStock = currentStock - quantity;
      const amountTry = safeNumber(item.lineTotal) * safeNumber(beforeSnapshot.exchangeRate, 1);
      const averageCostTrySnapshot = resolveSalesUnitCostTry(
        item,
        beforeSnapshot.documentCurrency,
        beforeSnapshot.exchangeRate,
        currencyRateMap,
      );
      const profitSnapshot = calculateSalesProfitSnapshot({
        salesAmountTry: amountTry,
        averageCostTry: averageCostTrySnapshot,
        quantity,
      });

      profitSnapshots.push({
        itemId: item.id,
        productId: item.productId,
        stockCode: item.stockCode,
        quantity,
        salesAmountTry: amountTry,
        averageCostTrySnapshot,
        grossProfitTry: profitSnapshot.grossProfitTry,
        grossProfitRate: profitSnapshot.grossProfitRate,
      });

      if (nextStock < 0) {
        warnings.push({
          code: 'NEGATIVE_STOCK',
          productId: item.productId,
          stockCode: item.stockCode,
          currentStock,
          quantity,
          projectedStock: nextStock,
        });
      }

      await new sqlDriver.Request(transaction)
        .input('profitSnapshotItemId', sql.BigInt, item.id)
        .input('profitSnapshotAverageCostTry', sql.Decimal(18, 4), averageCostTrySnapshot)
        .input('profitSnapshotGrossProfitTry', sql.Decimal(18, 4), profitSnapshot.grossProfitTry)
        .input('profitSnapshotGrossProfitRate', sql.Decimal(18, 6), profitSnapshot.grossProfitRate)
        .query(`
          UPDATE dbo.sales_invoice_items
          SET
            average_cost_try_snapshot = @profitSnapshotAverageCostTry,
            gross_profit_try = @profitSnapshotGrossProfitTry,
            gross_profit_rate = @profitSnapshotGrossProfitRate
          WHERE id = @profitSnapshotItemId;
        `);

      await new sqlDriver.Request(transaction)
        .input('productIdForStockUpdate', sql.BigInt, item.productId)
        .input('quantityForStockUpdate', sql.Decimal(18, 3), quantity)
        .query(`
          UPDATE dbo.products
          SET
            current_stock_qty = current_stock_qty - @quantityForStockUpdate,
            updated_at = SYSUTCDATETIME()
          WHERE id = @productIdForStockUpdate;
        `);

      await new sqlDriver.Request(transaction)
        .input('movementProductId', sql.BigInt, item.productId)
        .input('movementSourceId', sql.BigInt, invoiceId)
        .input('movementQuantityOut', sql.Decimal(18, 3), quantity)
        .input('movementQuantityNet', sql.Decimal(18, 3), -quantity)
        .input('movementUnitCostTry', sql.Decimal(18, 4), averageCostTrySnapshot)
        .input('movementUnitPrice', sql.Decimal(18, 4), Number(item.unitPrice || 0))
        .input('movementCurrency', sql.NVarChar(3), item.currency)
        .input('movementAmountTry', sql.Decimal(18, 4), amountTry)
        .input('movementDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('movementCustomerId', sql.BigInt, beforeSnapshot.customerId)
        .query(`
          INSERT INTO dbo.stock_movements (
            product_id,
            movement_type,
            source_type,
            source_id,
            quantity_in,
            quantity_out,
            quantity_net,
            unit_cost_try,
            average_cost_try_after,
            document_date,
            customer_id,
            created_at,
            created_by,
            unit_price,
            currency_code,
            amount_try
          )
          VALUES (
            @movementProductId,
            N'out',
            N'sales_invoice',
            @movementSourceId,
            0,
            @movementQuantityOut,
            @movementQuantityNet,
            @movementUnitCostTry,
            @movementUnitCostTry,
            @movementDocumentDate,
            @movementCustomerId,
            SYSUTCDATETIME(),
            NULL,
            @movementUnitPrice,
            @movementCurrency,
            @movementAmountTry
          );
        `);
    }

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_profit_snapshot_created',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      afterSnapshot: {
        invoiceId,
        snapshots: profitSnapshots,
      },
      actor,
    });

    const estimatedProfitTry = profitSnapshots.reduce(
      (total, snapshot) => total + safeNumber(snapshot.grossProfitTry),
      0,
    );

    await new sqlDriver.Request(transaction)
      .input('customerMovementCustomerId', sql.BigInt, beforeSnapshot.customerId)
      .input('customerMovementInvoiceId', sql.BigInt, invoiceId)
      .input('customerMovementAmount', sql.Decimal(18, 4), Number(beforeSnapshot.grandTotal || 0))
      .input('customerMovementCurrency', sql.NVarChar(3), beforeSnapshot.documentCurrency)
      .input('customerMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
      .query(`
        INSERT INTO dbo.customer_movements (
          customer_id,
          sales_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_at,
          created_by
        )
        VALUES (
          @customerMovementCustomerId,
          @customerMovementInvoiceId,
          N'sales_invoice',
          @customerMovementAmount,
          @customerMovementCurrency,
          @customerMovementAmount,
          @customerMovementDocumentDate,
          SYSUTCDATETIME(),
          NULL
        );
      `);

    await new sqlDriver.Request(transaction)
      .input('customerBalanceId', sql.BigInt, beforeSnapshot.customerId)
      .input('customerBalanceEffect', sql.Decimal(18, 4), Number(beforeSnapshot.grandTotal || 0))
      .query(`
        UPDATE dbo.customers
        SET
          balance = balance + @customerBalanceEffect,
          updated_at = SYSUTCDATETIME()
        WHERE id = @customerBalanceId;
      `);

    let autoCashCollection = null;

    if (isCashCustomerCode(beforeSnapshot.customerCode) && Number(beforeSnapshot.grandTotal || 0) > 0) {
      const cashAmount = Number(beforeSnapshot.grandTotal || 0);
      const cashCurrency = beforeSnapshot.documentCurrency;
      const paymentMethod = 'cash';
      const account = await resolveFinanceAccount(transaction, sqlDriver, {
        paymentMethod,
        currency: cashCurrency,
      });

      const cashMovementResult = await new sqlDriver.Request(transaction)
        .input('cashCollectionCustomerId', sql.BigInt, beforeSnapshot.customerId)
        .input('cashCollectionInvoiceId', sql.BigInt, invoiceId)
        .input('cashCollectionAmount', sql.Decimal(18, 4), cashAmount)
        .input('cashCollectionCurrency', sql.NVarChar(3), cashCurrency)
        .input('cashCollectionDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('cashCollectionCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
        .query(`
          INSERT INTO dbo.customer_movements (
            customer_id,
            sales_invoice_id,
            movement_type,
            amount,
            currency_code,
            balance_effect,
            document_date,
            created_at,
            created_by
          )
          OUTPUT inserted.*
          VALUES (
            @cashCollectionCustomerId,
            @cashCollectionInvoiceId,
            N'collection',
            @cashCollectionAmount,
            @cashCollectionCurrency,
            -@cashCollectionAmount,
            @cashCollectionDocumentDate,
            SYSUTCDATETIME(),
            @cashCollectionCreatedBy
          );

          UPDATE dbo.customers
          SET
            balance = balance - @cashCollectionAmount,
            updated_at = SYSUTCDATETIME()
          WHERE id = @cashCollectionCustomerId;
        `);

      const cashMovement = cashMovementResult.recordset?.[0];
      const updatedAccount = await writeFinanceAccountMovement(transaction, sqlDriver, {
        account,
        sourceType: 'collection',
        partyType: 'customer',
        partyMovementId: cashMovement.id,
        amount: cashAmount,
        currency: cashCurrency,
        paymentMethod,
        documentNo: `PS-${beforeSnapshot.documentNo || invoiceId}`,
        documentDate: beforeSnapshot.documentDate,
        description: `Pesin satis otomatik tahsilat - ${beforeSnapshot.documentNo || invoiceId}`,
        actor,
      });

      autoCashCollection = {
        movementId: Number(cashMovement.id),
        customerId: Number(beforeSnapshot.customerId),
        customerCode: beforeSnapshot.customerCode,
        amount: cashAmount,
        currency: cashCurrency,
        accountId: updatedAccount.id,
        accountCode: updatedAccount.code,
      };
    }

    const finalizeResult = await new sqlDriver.Request(transaction)
      .input('finalizeInvoiceId', sql.BigInt, invoiceId)
      .input('finalizeEstimatedProfitTry', sql.Decimal(18, 4), estimatedProfitTry)
      .query(`
        UPDATE dbo.sales_invoices
        SET
          status = N'finalized',
          estimated_profit_try = @finalizeEstimatedProfitTry,
          finalized_at = SYSUTCDATETIME(),
          updated_at = SYSUTCDATETIME()
        WHERE id = @finalizeInvoiceId
          AND status = N'draft';
      `);

    if (Number(finalizeResult.rowsAffected?.[0] || 0) !== 1) {
      throw makeServiceError('SALES_FINALIZE_STATUS_CHANGED', 'Sales invoice status changed during finalize', 409);
    }

    const afterSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_invoice_finalized',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot: {
        ...afterSnapshot,
        warnings,
        autoCashCollection,
      },
      actor,
    });

    await transaction.commit();

    return toFinalizeResult(afterSnapshot, warnings);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function cancelSalesInvoice(id, payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('SALES_CANCEL_ID_INVALID', 'Sales invoice id is invalid');
  }

  const reason = normalizeCancelReason(payload.reason);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId, { lockHeader: true });

    if (!beforeSnapshot) {
      throw makeServiceError('SALES_CANCEL_NOT_FOUND', 'Sales invoice not found', 404);
    }

    if (beforeSnapshot.status !== 'FINALIZED') {
      throw makeServiceError('SALES_CANCEL_STATUS_INVALID', 'Only FINALIZED sales invoices can be cancelled', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Satış fişi iptal');

    if (!beforeSnapshot.items.length) {
      throw makeServiceError('SALES_CANCEL_ITEMS_REQUIRED', 'Sales invoice must contain at least one item', 400);
    }

    const warnings = [];
    let reversedStockTotal = 0;

    for (const item of beforeSnapshot.items) {
      const quantity = safeNumber(item.quantity);
      const amountTry = safeNumber(item.lineTotal) * safeNumber(beforeSnapshot.exchangeRate, 1);
      const averageCostTrySnapshot = safeNumber(item.averageCostTry ?? item.productAverageCostTry);

      reversedStockTotal += quantity;

      await new sqlDriver.Request(transaction)
        .input('cancelProductIdForStockUpdate', sql.BigInt, item.productId)
        .input('cancelQuantityForStockUpdate', sql.Decimal(18, 3), quantity)
        .query(`
          UPDATE dbo.products
          SET
            current_stock_qty = current_stock_qty + @cancelQuantityForStockUpdate,
            updated_at = SYSUTCDATETIME()
          WHERE id = @cancelProductIdForStockUpdate;
        `);

      await new sqlDriver.Request(transaction)
        .input('cancelMovementProductId', sql.BigInt, item.productId)
        .input('cancelMovementSourceId', sql.BigInt, invoiceId)
        .input('cancelMovementQuantityIn', sql.Decimal(18, 3), quantity)
        .input('cancelMovementQuantityNet', sql.Decimal(18, 3), quantity)
        .input('cancelMovementUnitCostTry', sql.Decimal(18, 4), averageCostTrySnapshot)
        .input('cancelMovementUnitPrice', sql.Decimal(18, 4), Number(item.unitPrice || 0))
        .input('cancelMovementCurrency', sql.NVarChar(3), item.currency)
        .input('cancelMovementAmountTry', sql.Decimal(18, 4), -amountTry)
        .input('cancelMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('cancelMovementCustomerId', sql.BigInt, beforeSnapshot.customerId)
        .input('cancelMovementCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
        .query(`
          INSERT INTO dbo.stock_movements (
            product_id,
            movement_type,
            source_type,
            source_id,
            quantity_in,
            quantity_out,
            quantity_net,
            unit_cost_try,
            average_cost_try_after,
            document_date,
            customer_id,
            created_at,
            created_by,
            unit_price,
            currency_code,
            amount_try
          )
          VALUES (
            @cancelMovementProductId,
            N'in',
            N'sales_invoice',
            @cancelMovementSourceId,
            @cancelMovementQuantityIn,
            0,
            @cancelMovementQuantityNet,
            @cancelMovementUnitCostTry,
            @cancelMovementUnitCostTry,
            @cancelMovementDocumentDate,
            @cancelMovementCustomerId,
            SYSUTCDATETIME(),
            @cancelMovementCreatedBy,
            @cancelMovementUnitPrice,
            @cancelMovementCurrency,
            @cancelMovementAmountTry
          );
        `);
    }

    const reversedCustomerAmount = Number(beforeSnapshot.grandTotal || 0);

    await new sqlDriver.Request(transaction)
      .input('cancelCustomerMovementCustomerId', sql.BigInt, beforeSnapshot.customerId)
      .input('cancelCustomerMovementInvoiceId', sql.BigInt, invoiceId)
      .input('cancelCustomerMovementAmount', sql.Decimal(18, 4), reversedCustomerAmount)
      .input('cancelCustomerMovementBalanceEffect', sql.Decimal(18, 4), -reversedCustomerAmount)
      .input('cancelCustomerMovementCurrency', sql.NVarChar(3), beforeSnapshot.documentCurrency)
      .input('cancelCustomerMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
      .input('cancelCustomerMovementCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.customer_movements (
          customer_id,
          sales_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_at,
          created_by
        )
        VALUES (
          @cancelCustomerMovementCustomerId,
          @cancelCustomerMovementInvoiceId,
          N'sales_invoice_cancel',
          @cancelCustomerMovementAmount,
          @cancelCustomerMovementCurrency,
          @cancelCustomerMovementBalanceEffect,
          @cancelCustomerMovementDocumentDate,
          SYSUTCDATETIME(),
          @cancelCustomerMovementCreatedBy
        );
      `);

    await new sqlDriver.Request(transaction)
      .input('cancelCustomerBalanceId', sql.BigInt, beforeSnapshot.customerId)
      .input('cancelCustomerBalanceEffect', sql.Decimal(18, 4), reversedCustomerAmount)
      .query(`
        UPDATE dbo.customers
        SET
          balance = balance - @cancelCustomerBalanceEffect,
          updated_at = SYSUTCDATETIME()
        WHERE id = @cancelCustomerBalanceId;
      `);

    const cancelResult = await new sqlDriver.Request(transaction)
      .input('cancelInvoiceId', sql.BigInt, invoiceId)
      .input('cancelReason', sql.NVarChar(500), reason)
      .input('cancelUpdatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.sales_invoices
        SET
          status = N'cancelled',
          cancelled_at = SYSUTCDATETIME(),
          cancel_reason = @cancelReason,
          updated_at = SYSUTCDATETIME(),
          updated_by = @cancelUpdatedBy
        WHERE id = @cancelInvoiceId
          AND status = N'finalized';
      `);

    if (Number(cancelResult.rowsAffected?.[0] || 0) !== 1) {
      throw makeServiceError('SALES_CANCEL_STATUS_INVALID', 'Sales invoice status changed during cancel', 409);
    }

    const afterSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_invoice_cancelled',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot: {
        ...afterSnapshot,
        reason,
        reversedStockTotal,
        reversedCustomerAmount,
        warnings,
      },
      actor,
    });

    await transaction.commit();

    return toFinalizeResult(afterSnapshot, warnings);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function getPurchaseDraft(id) {
  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('PURCHASE_DRAFT_ID_INVALID', 'Purchase draft id is invalid');
  }

  const pool = await getSqlPool();
  const snapshot = await getPurchaseSnapshot(pool.request(), invoiceId);

  if (!snapshot) {
    throw makeServiceError('PURCHASE_DRAFT_NOT_FOUND', 'Purchase draft not found', 404);
  }

  return snapshot;
}

export async function getPurchaseDraftsList(query) {
  const options = parseDraftListQuery(query);

  if (options.status === 'unsupported') {
    return {
      data: [],
      meta: buildListMeta({
        ...options,
        total: 0,
        source: 'sql-select-only',
        filters: {
          search: options.search || null,
          status: 'DRAFT',
          supplier: options.partySearch || null,
        },
      }),
    };
  }

  const pool = await getSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(160), toSearchPattern(options.search))
    .input('supplierSearch', sql.NVarChar(160), toSearchPattern(options.partySearch))
    .input('status', sql.NVarChar(20), options.status === 'all' ? null : options.status)
    .input('dateFrom', sql.Date, options.dateFrom)
    .input('dateTo', sql.Date, options.dateTo)
    .input('currency', sql.NVarChar(3), options.currency)
    .input('amountMin', sql.Decimal(18, 4), options.amountMin)
    .input('amountMax', sql.Decimal(18, 4), options.amountMax)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_purchase AS (
      SELECT
        pi.id,
        pi.document_no AS invoice_no,
        s.name AS supplier_name,
        pi.document_currency AS currency_code,
        pi.grand_total AS total_amount,
        CASE WHEN COALESCE(pi.description, N'') LIKE N'%TEST_ARCHIVED%' THEN N'archived_test' ELSE pi.status END AS status,
        pi.document_date,
        pi.created_at,
        pi.updated_at,
        item_counts.item_count
      FROM dbo.purchase_invoices pi
      LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS item_count
        FROM dbo.purchase_invoice_items pii
        WHERE pii.purchase_invoice_id = pi.id
      ) item_counts
      WHERE
        (
          (@status IS NULL AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
          OR (@status = N'archived_test' AND COALESCE(pi.description, N'') LIKE N'%TEST_ARCHIVED%')
          OR (@status IS NOT NULL AND @status <> N'archived_test' AND pi.status = @status AND COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%')
        )
        AND (@dateFrom IS NULL OR pi.document_date >= @dateFrom)
        AND (@dateTo IS NULL OR pi.document_date <= @dateTo)
        AND (@currency IS NULL OR pi.document_currency = @currency)
        AND (@amountMin IS NULL OR pi.grand_total >= @amountMin)
        AND (@amountMax IS NULL OR pi.grand_total <= @amountMax)
        AND (
          @search IS NULL
          OR ${sqlNormalizedLike('pi.document_no')}
          OR ${sqlNormalizedLike('s.name')}
          OR ${sqlNormalizedLike('s.supplier_code')}
          OR EXISTS (
            SELECT 1
            FROM dbo.purchase_invoice_items search_item
            WHERE search_item.purchase_invoice_id = pi.id
              AND (
                ${sqlNormalizedLike('search_item.stock_code_snapshot')}
                OR ${sqlNormalizedLike('search_item.barcode_snapshot')}
                OR ${sqlNormalizedLike('search_item.product_name_snapshot')}
              )
          )
        )
        AND (
          @supplierSearch IS NULL
          OR ${sqlNormalizedLike('s.name', '@supplierSearch')}
          OR ${sqlNormalizedLike('s.supplier_code', '@supplierSearch')}
        )
    ),
    numbered_purchase AS (
      SELECT
        fp.*,
        ROW_NUMBER() OVER (ORDER BY fp.created_at DESC, fp.id DESC) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_purchase fp
    )
    SELECT TOP (${options.limit}) np.*
    FROM numbered_purchase np
    WHERE np.row_number > @offset
    ORDER BY np.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toPurchaseListDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-select-only',
      filters: {
        search: options.search || null,
        status: options.status,
        supplier: options.partySearch || null,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        currency: options.currency,
        amountMin: options.amountMin,
        amountMax: options.amountMax,
      },
    }),
  };
}

export async function createPurchaseDraft(payload, actor = null) {
  assertMelisaWriteEnabled();

  const draft = normalizePurchasePayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), draft.documentDate, 'Alış fişi taslak kaydı');

    const supplierId = await ensureSupplier(sqlDriver, transaction, draft);
    await assertPurchaseItemsBelongToSupplier(sqlDriver, transaction, supplierId, draft.items);
    const insert = await new sqlDriver.Request(transaction)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('supplierId', sql.BigInt, supplierId)
      .input('supplierCurrency', sql.NVarChar(3), draft.supplierCurrency)
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('lineDiscountTotal', sql.Decimal(18, 4), draft.lineDiscountTotal)
      .input('invoiceDiscountRate', sql.Decimal(9, 4), draft.invoiceDiscountRate)
      .input('supplierDiscountRate', sql.Decimal(9, 4), draft.supplierDiscountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('stockCostEffectTry', sql.Decimal(18, 4), draft.stockCostEffectTry)
      .query(`
        INSERT INTO dbo.purchase_invoices (
          document_no,
          document_date,
          supplier_id,
          status,
          supplier_currency,
          document_currency,
          exchange_rate_snapshot,
          description,
          subtotal,
          line_discount_total,
          invoice_discount_rate,
          supplier_discount_rate,
          discount_total,
          grand_total,
          amount_try,
          stock_cost_effect_try,
          created_by,
          updated_by
        )
        OUTPUT INSERTED.id AS invoiceId
        VALUES (
          @documentNo,
          @documentDate,
          @supplierId,
          N'draft',
          @supplierCurrency,
          @documentCurrency,
          @exchangeRate,
          @description,
          @subtotal,
          @lineDiscountTotal,
          @invoiceDiscountRate,
          @supplierDiscountRate,
          @discountTotal,
          @grandTotal,
          @amountTry,
          @stockCostEffectTry,
          NULL,
          NULL
        );
      `);

    const invoiceId = Number(insert.recordset?.[0]?.invoiceId);

    for (const item of draft.items) {
      await insertPurchaseItem(sqlDriver, transaction, invoiceId, item);
    }

    const afterSnapshot = await getPurchaseSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'purchase_invoice_draft_created',
      entityType: 'purchase_invoice',
      entityId: invoiceId,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getPurchaseDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updatePurchaseDraft(id, payload, actor = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('PURCHASE_DRAFT_ID_INVALID', 'Purchase draft id is invalid');
  }

  const draft = normalizePurchasePayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getPurchaseFinalizeSnapshot(
      new sqlDriver.Request(transaction),
      invoiceId,
      { lockHeader: true },
    );

    if (!beforeSnapshot) {
      throw makeServiceError('PURCHASE_DRAFT_NOT_FOUND', 'Purchase draft not found', 404);
    }

    if (!['DRAFT', 'FINALIZED'].includes(beforeSnapshot.status)) {
      throw makeServiceError('PURCHASE_DRAFT_STATUS_INVALID', 'Only DRAFT or FINALIZED purchase invoices can be corrected', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Alış fişi düzeltme');
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), draft.documentDate, 'Alış fişi düzeltme');

    const supplierId = await ensureSupplier(sqlDriver, transaction, draft);
    await assertPurchaseItemsBelongToSupplier(sqlDriver, transaction, supplierId, draft.items);

    await new sqlDriver.Request(transaction)
      .input('invoiceId', sql.BigInt, invoiceId)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('supplierId', sql.BigInt, supplierId)
      .input('supplierCurrency', sql.NVarChar(3), draft.supplierCurrency)
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('lineDiscountTotal', sql.Decimal(18, 4), draft.lineDiscountTotal)
      .input('invoiceDiscountRate', sql.Decimal(9, 4), draft.invoiceDiscountRate)
      .input('supplierDiscountRate', sql.Decimal(9, 4), draft.supplierDiscountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('stockCostEffectTry', sql.Decimal(18, 4), draft.stockCostEffectTry)
      .query(`
        UPDATE dbo.purchase_invoices
        SET
          document_no = @documentNo,
          document_date = @documentDate,
          supplier_id = @supplierId,
          supplier_currency = @supplierCurrency,
          document_currency = @documentCurrency,
          exchange_rate_snapshot = @exchangeRate,
          description = @description,
          subtotal = @subtotal,
          line_discount_total = @lineDiscountTotal,
          invoice_discount_rate = @invoiceDiscountRate,
          supplier_discount_rate = @supplierDiscountRate,
          discount_total = @discountTotal,
          grand_total = @grandTotal,
          amount_try = @amountTry,
          stock_cost_effect_try = @stockCostEffectTry,
          updated_by = NULL,
          updated_at = SYSUTCDATETIME()
        WHERE id = @invoiceId
          AND status IN (N'draft', N'finalized');
      `);

    await updatePurchaseItems(sqlDriver, transaction, invoiceId, draft.items);

    if (beforeSnapshot.status === 'FINALIZED') {
      await replaceFinalizedPurchaseEffects(
        sqlDriver,
        transaction,
        invoiceId,
        beforeSnapshot,
        draft,
        supplierId,
        actor,
      );
    }

    const afterSnapshot = await getPurchaseSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: beforeSnapshot.status === 'FINALIZED' ? 'purchase_invoice_finalized_corrected' : 'purchase_invoice_draft_updated',
      entityType: 'purchase_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getPurchaseDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function finalizePurchaseInvoice(id, actor = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('PURCHASE_FINALIZE_ID_INVALID', 'Purchase invoice id is invalid');
  }

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId, { lockHeader: true });

    if (!beforeSnapshot) {
      throw makeServiceError('PURCHASE_FINALIZE_NOT_FOUND', 'Purchase invoice not found', 404);
    }

    if (beforeSnapshot.status !== 'DRAFT') {
      throw makeServiceError('PURCHASE_FINALIZE_STATUS_INVALID', 'Only DRAFT purchase invoices can be finalized', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Alış fişi kesinleştirme');

    if (!beforeSnapshot.supplierId || !beforeSnapshot.supplierName) {
      throw makeServiceError('PURCHASE_FINALIZE_SUPPLIER_INVALID', 'Purchase invoice supplier is missing', 400);
    }

    if (!beforeSnapshot.items.length) {
      throw makeServiceError('PURCHASE_FINALIZE_ITEMS_REQUIRED', 'Purchase invoice must contain at least one item', 400);
    }

    if (Number(beforeSnapshot.grandTotal || 0) < 0) {
      throw makeServiceError('PURCHASE_FINALIZE_TOTAL_INVALID', 'Purchase invoice total cannot be negative', 400);
    }

    const warnings = [];

    for (const item of beforeSnapshot.items) {
      const quantity = safeNumber(item.quantity);
      const currentStock = safeNumber(item.currentStockQty);
      const currentAverageCostTry = safeNumber(item.currentAverageCostTry);
      const lineTotalTry = purchaseLineCostTry(item, beforeSnapshot.exchangeRate);
      const unitCostTry = quantity > 0 ? lineTotalTry / quantity : 0;
      const nextStock = currentStock + quantity;
      const nextAverageCostTry = calculateWeightedAverageCostTry({
        currentStock,
        currentAverageCostTry,
        purchaseQuantity: quantity,
        purchaseAmountTry: lineTotalTry,
      });

      await new sqlDriver.Request(transaction)
        .input('purchaseProductIdForStockUpdate', sql.BigInt, item.productId)
        .input('purchaseQuantityForStockUpdate', sql.Decimal(18, 3), quantity)
        .input('purchaseAverageCostTryForUpdate', sql.Decimal(18, 4), nextAverageCostTry)
        .query(`
          UPDATE dbo.products
          SET
            current_stock_qty = current_stock_qty + @purchaseQuantityForStockUpdate,
            average_cost_try = @purchaseAverageCostTryForUpdate,
            updated_at = SYSUTCDATETIME()
          WHERE id = @purchaseProductIdForStockUpdate;
        `);

      await writeAuditLog(new sqlDriver.Request(transaction), {
        action: 'product_average_cost_updated',
        entityType: 'product',
        entityId: item.productId,
        beforeSnapshot: {
          productId: item.productId,
          purchaseInvoiceId: invoiceId,
          currentStock,
          averageCostTry: currentAverageCostTry,
        },
        afterSnapshot: {
          productId: item.productId,
          purchaseInvoiceId: invoiceId,
          quantity,
          purchaseAmountTry: lineTotalTry,
          unitCostTry,
          nextStock,
          averageCostTry: nextAverageCostTry,
        },
        actor,
      });

      await new sqlDriver.Request(transaction)
        .input('purchaseMovementProductId', sql.BigInt, item.productId)
        .input('purchaseMovementSourceId', sql.BigInt, invoiceId)
        .input('purchaseMovementQuantityIn', sql.Decimal(18, 3), quantity)
        .input('purchaseMovementQuantityNet', sql.Decimal(18, 3), quantity)
        .input('purchaseMovementUnitCostTry', sql.Decimal(18, 4), unitCostTry)
        .input('purchaseMovementAverageCostTry', sql.Decimal(18, 4), nextAverageCostTry)
        .input('purchaseMovementUnitPrice', sql.Decimal(18, 4), Number(item.purchasePrice || 0))
        .input('purchaseMovementCurrency', sql.NVarChar(3), item.currency)
        .input('purchaseMovementAmountTry', sql.Decimal(18, 4), lineTotalTry)
        .input('purchaseMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('purchaseMovementSupplierId', sql.BigInt, beforeSnapshot.supplierId)
        .query(`
          INSERT INTO dbo.stock_movements (
            product_id,
            movement_type,
            source_type,
            source_id,
            quantity_in,
            quantity_out,
            quantity_net,
            unit_cost_try,
            average_cost_try_after,
            document_date,
            supplier_id,
            created_at,
            created_by,
            unit_price,
            currency_code,
            amount_try
          )
          VALUES (
            @purchaseMovementProductId,
            N'in',
            N'purchase_invoice',
            @purchaseMovementSourceId,
            @purchaseMovementQuantityIn,
            0,
            @purchaseMovementQuantityNet,
            @purchaseMovementUnitCostTry,
            @purchaseMovementAverageCostTry,
            @purchaseMovementDocumentDate,
            @purchaseMovementSupplierId,
            SYSUTCDATETIME(),
            NULL,
            @purchaseMovementUnitPrice,
            @purchaseMovementCurrency,
            @purchaseMovementAmountTry
          );
        `);
    }

    await new sqlDriver.Request(transaction)
      .input('supplierMovementSupplierId', sql.BigInt, beforeSnapshot.supplierId)
      .input('supplierMovementInvoiceId', sql.BigInt, invoiceId)
      .input('supplierMovementAmount', sql.Decimal(18, 4), Number(beforeSnapshot.grandTotal || 0))
      .input('supplierMovementCurrency', sql.NVarChar(3), beforeSnapshot.documentCurrency)
      .input('supplierMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
      .query(`
        INSERT INTO dbo.supplier_movements (
          supplier_id,
          purchase_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_at,
          created_by
        )
        VALUES (
          @supplierMovementSupplierId,
          @supplierMovementInvoiceId,
          N'purchase_invoice',
          @supplierMovementAmount,
          @supplierMovementCurrency,
          @supplierMovementAmount,
          @supplierMovementDocumentDate,
          SYSUTCDATETIME(),
          NULL
        );
      `);

    await new sqlDriver.Request(transaction)
      .input('supplierBalanceId', sql.BigInt, beforeSnapshot.supplierId)
      .input('supplierBalanceEffect', sql.Decimal(18, 4), Number(beforeSnapshot.grandTotal || 0))
      .query(`
        UPDATE dbo.suppliers
        SET
          balance = balance + @supplierBalanceEffect,
          updated_at = SYSUTCDATETIME()
        WHERE id = @supplierBalanceId;
      `);

    const finalizeResult = await new sqlDriver.Request(transaction)
      .input('finalizePurchaseInvoiceId', sql.BigInt, invoiceId)
      .query(`
        UPDATE dbo.purchase_invoices
        SET
          status = N'finalized',
          finalized_at = SYSUTCDATETIME(),
          updated_at = SYSUTCDATETIME()
        WHERE id = @finalizePurchaseInvoiceId
          AND status = N'draft';
      `);

    if (Number(finalizeResult.rowsAffected?.[0] || 0) !== 1) {
      throw makeServiceError('PURCHASE_FINALIZE_STATUS_CHANGED', 'Purchase invoice status changed during finalize', 409);
    }

    const afterSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'purchase_invoice_finalized',
      entityType: 'purchase_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot: {
        ...afterSnapshot,
        warnings,
      },
      actor,
    });

    await transaction.commit();

    return toFinalizeResult(afterSnapshot, warnings);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function cancelPurchaseInvoice(id, payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('PURCHASE_CANCEL_ID_INVALID', 'Purchase invoice id is invalid');
  }

  const reason = normalizeCancelReason(payload.reason, 'PURCHASE_CANCEL_REASON_REQUIRED');
  const averageCostPolicy = {
    average_cost_cancel_policy: 'recalculate_from_purchase_stock_movements',
    reason: 'Purchase cancellation recalculates product average cost from net purchase stock movements for the affected product.',
  };
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId, { lockHeader: true });

    if (!beforeSnapshot) {
      throw makeServiceError('PURCHASE_CANCEL_NOT_FOUND', 'Purchase invoice not found', 404);
    }

    if (beforeSnapshot.status !== 'FINALIZED') {
      throw makeServiceError('PURCHASE_CANCEL_STATUS_INVALID', 'Only FINALIZED purchase invoices can be cancelled', 409);
    }

    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), beforeSnapshot.documentDate, 'Alış fişi iptal');

    if (!beforeSnapshot.items.length) {
      throw makeServiceError('PURCHASE_CANCEL_ITEMS_REQUIRED', 'Purchase invoice must contain at least one item', 400);
    }

    const warnings = [];
    let reversedStockTotal = 0;

    for (const item of beforeSnapshot.items) {
      const quantity = safeNumber(item.quantity);
      const currentStock = safeNumber(item.currentStockQty);
      const nextStock = currentStock - quantity;
      const lineTotalTry = purchaseLineCostTry(item, beforeSnapshot.exchangeRate);
      const currentAverageCostTry = safeNumber(item.currentAverageCostTry);

      reversedStockTotal += quantity;

      if (nextStock < 0) {
        warnings.push({
          code: 'NEGATIVE_STOCK_AFTER_PURCHASE_CANCEL',
          productId: item.productId,
          stockCode: item.stockCode,
          currentStock,
          quantity,
          projectedStock: nextStock,
        });
      }

      await new sqlDriver.Request(transaction)
        .input('cancelPurchaseProductIdForStockUpdate', sql.BigInt, item.productId)
        .input('cancelPurchaseQuantityForStockUpdate', sql.Decimal(18, 3), quantity)
        .query(`
          UPDATE dbo.products
          SET
            current_stock_qty = current_stock_qty - @cancelPurchaseQuantityForStockUpdate,
            updated_at = SYSUTCDATETIME()
          WHERE id = @cancelPurchaseProductIdForStockUpdate;
        `);

      const cancelMovementInsert = await new sqlDriver.Request(transaction)
        .input('cancelPurchaseMovementProductId', sql.BigInt, item.productId)
        .input('cancelPurchaseMovementSourceId', sql.BigInt, invoiceId)
        .input('cancelPurchaseMovementQuantityOut', sql.Decimal(18, 3), quantity)
        .input('cancelPurchaseMovementQuantityNet', sql.Decimal(18, 3), -quantity)
        .input('cancelPurchaseMovementUnitCostTry', sql.Decimal(18, 4), currentAverageCostTry)
        .input('cancelPurchaseMovementUnitPrice', sql.Decimal(18, 4), Number(item.purchasePrice || 0))
        .input('cancelPurchaseMovementCurrency', sql.NVarChar(3), item.currency)
        .input('cancelPurchaseMovementAmountTry', sql.Decimal(18, 4), -lineTotalTry)
        .input('cancelPurchaseMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
        .input('cancelPurchaseMovementSupplierId', sql.BigInt, beforeSnapshot.supplierId)
        .input('cancelPurchaseMovementCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
        .query(`
          INSERT INTO dbo.stock_movements (
            product_id,
            movement_type,
            source_type,
            source_id,
            quantity_in,
            quantity_out,
            quantity_net,
            unit_cost_try,
            average_cost_try_after,
            document_date,
            supplier_id,
            created_at,
            created_by,
            unit_price,
            currency_code,
            amount_try
          )
          OUTPUT INSERTED.id AS movementId
          VALUES (
            @cancelPurchaseMovementProductId,
            N'out',
            N'purchase_invoice',
            @cancelPurchaseMovementSourceId,
            0,
            @cancelPurchaseMovementQuantityOut,
            @cancelPurchaseMovementQuantityNet,
            @cancelPurchaseMovementUnitCostTry,
            @cancelPurchaseMovementUnitCostTry,
            @cancelPurchaseMovementDocumentDate,
            @cancelPurchaseMovementSupplierId,
            SYSUTCDATETIME(),
            @cancelPurchaseMovementCreatedBy,
            @cancelPurchaseMovementUnitPrice,
            @cancelPurchaseMovementCurrency,
            @cancelPurchaseMovementAmountTry
          );
        `);

      const recalculatedAverageCostTry = await recalculateProductAverageCostTry(
        sqlDriver,
        transaction,
        item.productId,
        actor,
      );
      const movementId = Number(cancelMovementInsert.recordset?.[0]?.movementId || 0);

      if (movementId > 0) {
        await new sqlDriver.Request(transaction)
          .input('cancelPurchaseMovementAverageAfterId', sql.BigInt, movementId)
          .input('cancelPurchaseMovementAverageAfterValue', sql.Decimal(18, 4), recalculatedAverageCostTry)
          .query(`
            UPDATE dbo.stock_movements
            SET average_cost_try_after = @cancelPurchaseMovementAverageAfterValue
            WHERE id = @cancelPurchaseMovementAverageAfterId;
          `);
      }
    }

    const reversedSupplierAmount = Number(beforeSnapshot.grandTotal || 0);

    await new sqlDriver.Request(transaction)
      .input('cancelSupplierMovementSupplierId', sql.BigInt, beforeSnapshot.supplierId)
      .input('cancelSupplierMovementInvoiceId', sql.BigInt, invoiceId)
      .input('cancelSupplierMovementAmount', sql.Decimal(18, 4), reversedSupplierAmount)
      .input('cancelSupplierMovementBalanceEffect', sql.Decimal(18, 4), -reversedSupplierAmount)
      .input('cancelSupplierMovementCurrency', sql.NVarChar(3), beforeSnapshot.documentCurrency)
      .input('cancelSupplierMovementDocumentDate', sql.Date, beforeSnapshot.documentDate)
      .input('cancelSupplierMovementCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.supplier_movements (
          supplier_id,
          purchase_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_at,
          created_by
        )
        VALUES (
          @cancelSupplierMovementSupplierId,
          @cancelSupplierMovementInvoiceId,
          N'purchase_invoice_cancel',
          @cancelSupplierMovementAmount,
          @cancelSupplierMovementCurrency,
          @cancelSupplierMovementBalanceEffect,
          @cancelSupplierMovementDocumentDate,
          SYSUTCDATETIME(),
          @cancelSupplierMovementCreatedBy
        );
      `);

    await new sqlDriver.Request(transaction)
      .input('cancelSupplierBalanceId', sql.BigInt, beforeSnapshot.supplierId)
      .input('cancelSupplierBalanceEffect', sql.Decimal(18, 4), reversedSupplierAmount)
      .query(`
        UPDATE dbo.suppliers
        SET
          balance = balance - @cancelSupplierBalanceEffect,
          updated_at = SYSUTCDATETIME()
        WHERE id = @cancelSupplierBalanceId;
      `);

    const cancelResult = await new sqlDriver.Request(transaction)
      .input('cancelPurchaseInvoiceId', sql.BigInt, invoiceId)
      .input('cancelPurchaseReason', sql.NVarChar(500), reason)
      .input('cancelPurchaseUpdatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.purchase_invoices
        SET
          status = N'cancelled',
          cancelled_at = SYSUTCDATETIME(),
          cancel_reason = @cancelPurchaseReason,
          updated_at = SYSUTCDATETIME(),
          updated_by = @cancelPurchaseUpdatedBy
        WHERE id = @cancelPurchaseInvoiceId
          AND status = N'finalized';
      `);

    if (Number(cancelResult.rowsAffected?.[0] || 0) !== 1) {
      throw makeServiceError('PURCHASE_CANCEL_STATUS_INVALID', 'Purchase invoice status changed during cancel', 409);
    }

    const afterSnapshot = await getPurchaseFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'purchase_invoice_cancelled',
      entityType: 'purchase_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot: {
        ...afterSnapshot,
        reason,
        reversedStockTotal,
        reversedSupplierAmount,
        averageCostPolicy,
        warnings,
      },
      actor,
    });

    await transaction.commit();

    return toFinalizeResult(afterSnapshot, warnings);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
