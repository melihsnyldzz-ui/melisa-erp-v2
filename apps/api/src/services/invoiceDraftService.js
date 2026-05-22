import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { buildListMeta, parseListQuery } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
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

  return {
    ...options,
    status: status === 'DRAFT' ? 'draft' : 'unsupported',
    partySearch,
  };
}

function toSalesListDto(row) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    customerName: row.customer_name || '-',
    currency: row.currency_code,
    totalAmount: Number(row.total_amount || 0),
    status: String(row.status || '').toUpperCase(),
    itemCount: Number(row.item_count || 0),
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
  const subtotal = items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.purchasePrice || 0), 0);
  const lineDiscountTotal = items.reduce((total, item) => {
    const gross = Number(item.quantity || 0) * Number(item.purchasePrice || 0);
    return total + gross * (Number(item.lineDiscountRate || 0) / 100);
  }, 0);
  const afterLineDiscounts = subtotal - lineDiscountTotal;
  const invoiceDiscountTotal = afterLineDiscounts * (invoiceDiscountRate / 100);
  const afterInvoiceDiscount = afterLineDiscounts - invoiceDiscountTotal;
  const supplierDiscountTotal = afterInvoiceDiscount * (supplierDiscountRate / 100);
  const grandTotal = afterInvoiceDiscount - supplierDiscountTotal;

  if (!payload.supplierId && !trimText(payload.supplierName)) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'supplierId or supplierName is required');
  }

  if (items.length < 1) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'At least one product line is required');
  }

  if (grandTotal < 0) {
    throw makeServiceError('DRAFT_INVOICE_VALIDATION_FAILED', 'grandTotal cannot be negative');
  }

  return {
    documentNo: trimText(payload.documentNo) || createDocumentNo('PDR'),
    documentDate: normalizeDate(payload.documentDate),
    supplierId: payload.supplierId ? Number(payload.supplierId) : null,
    supplierName: trimText(payload.supplierName),
    supplierCurrency: normalizeCurrency(payload.supplierCurrency),
    documentCurrency: normalizeCurrency(payload.documentCurrency),
    exchangeRate: numberValue(payload.exchangeRate ?? 1, 'exchangeRate', { min: 0, allowZero: false }),
    description: trimText(payload.description),
    subtotal,
    lineDiscountTotal,
    invoiceDiscountRate,
    supplierDiscountRate,
    discountTotal: lineDiscountTotal + invoiceDiscountTotal + supplierDiscountTotal,
    grandTotal,
    amountTry: grandTotal * Number(payload.exchangeRate ?? 1),
    stockCostEffectTry: grandTotal,
    items: items.map((item, index) => normalizePurchaseItem(item, index)),
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
  const header = await request
    .input('salesSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        si.id,
        si.document_no AS documentNo,
        si.document_date AS documentDate,
        si.customer_id AS customerId,
        c.name AS customerName,
        si.status,
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
        id,
        product_id AS productId,
        stock_code_snapshot AS stockCode,
        barcode_snapshot AS barcode,
        product_name_snapshot AS productName,
        quantity,
        currency_code AS currency,
        unit_price AS unitPrice,
        line_total AS lineTotal,
        average_cost_try_snapshot AS averageCostTry,
        stock_status_snapshot AS stockStatus,
        note
      FROM dbo.sales_invoice_items
      WHERE sales_invoice_id = @salesItemsSnapshotId
      ORDER BY id ASC;
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

async function getSalesFinalizeSnapshot(request, id) {
  const header = await request
    .input('finalizeSnapshotId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        si.id,
        si.document_no AS documentNo,
        si.document_date AS documentDate,
        si.customer_id AS customerId,
        c.name AS customerName,
        c.is_active AS customerIsActive,
        si.status,
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
      FROM dbo.sales_invoices si
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
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
        sii.stock_code_snapshot AS stockCode,
        sii.barcode_snapshot AS barcode,
        sii.product_name_snapshot AS productName,
        sii.quantity,
        sii.currency_code AS currency,
        sii.unit_price AS unitPrice,
        sii.line_total AS lineTotal,
        sii.average_cost_try_snapshot AS averageCostTry,
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
  const request = pool.request()
    .input('search', sql.NVarChar(160), options.search ? `%${options.search}%` : null)
    .input('customerSearch', sql.NVarChar(160), options.partySearch ? `%${options.partySearch}%` : null)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_sales AS (
      SELECT
        si.id,
        si.document_no AS invoice_no,
        c.name AS customer_name,
        si.document_currency AS currency_code,
        si.grand_total AS total_amount,
        si.status,
        si.created_at,
        si.updated_at,
        item_counts.item_count
      FROM dbo.sales_invoices si
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS item_count
        FROM dbo.sales_invoice_items sii
        WHERE sii.sales_invoice_id = si.id
      ) item_counts
      WHERE
        si.status = N'draft'
        AND (
          @search IS NULL
          OR si.document_no COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
        )
        AND (
          @customerSearch IS NULL
          OR c.name COLLATE Latin1_General_CI_AI LIKE @customerSearch COLLATE Latin1_General_CI_AI
        )
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
        status: 'DRAFT',
        customer: options.partySearch || null,
      },
    }),
  };
}

export async function createSalesDraft(payload) {
  assertMelisaWriteEnabled();

  const draft = normalizeSalesPayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const insert = await new sqlDriver.Request(transaction)
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
        INSERT INTO dbo.sales_invoices (
          document_no,
          document_date,
          customer_id,
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
    });

    await transaction.commit();

    return getSalesDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateSalesDraft(id, payload) {
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
    const beforeSnapshot = await getSalesSnapshot(new sqlDriver.Request(transaction), invoiceId);

    if (!beforeSnapshot) {
      throw makeServiceError('SALES_DRAFT_NOT_FOUND', 'Sales draft not found', 404);
    }

    if (beforeSnapshot.status !== 'DRAFT') {
      throw makeServiceError('SALES_DRAFT_STATUS_INVALID', 'Only DRAFT sales invoices can be updated', 409);
    }

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
          AND status = N'draft';
      `);

    await updateSalesItems(sqlDriver, transaction, invoiceId, draft.items);

    const afterSnapshot = await getSalesSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_invoice_draft_updated',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot,
    });

    await transaction.commit();

    return getSalesDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function finalizeSalesInvoice(id) {
  assertMelisaWriteEnabled();

  const invoiceId = Number(id);

  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    throw makeServiceError('SALES_FINALIZE_ID_INVALID', 'Sales invoice id is invalid');
  }

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    if (!beforeSnapshot) {
      throw makeServiceError('SALES_FINALIZE_NOT_FOUND', 'Sales invoice not found', 404);
    }

    if (beforeSnapshot.status !== 'DRAFT') {
      throw makeServiceError('SALES_FINALIZE_STATUS_INVALID', 'Only DRAFT sales invoices can be finalized', 409);
    }

    if (!beforeSnapshot.customerId || !beforeSnapshot.customerName) {
      throw makeServiceError('SALES_FINALIZE_CUSTOMER_INVALID', 'Sales invoice customer is missing', 400);
    }

    if (!beforeSnapshot.items.length) {
      throw makeServiceError('SALES_FINALIZE_ITEMS_REQUIRED', 'Sales invoice must contain at least one item', 400);
    }

    if (Number(beforeSnapshot.grandTotal || 0) < 0) {
      throw makeServiceError('SALES_FINALIZE_TOTAL_INVALID', 'Sales invoice total cannot be negative', 400);
    }

    const warnings = [];

    for (const item of beforeSnapshot.items) {
      const quantity = Number(item.quantity || 0);
      const currentStock = Number(item.currentStockQty || 0);
      const nextStock = currentStock - quantity;
      const amountTry = Number(item.lineTotal || 0) * Number(beforeSnapshot.exchangeRate || 1);

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
            0,
            0,
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

    await new sqlDriver.Request(transaction)
      .input('finalizeInvoiceId', sql.BigInt, invoiceId)
      .query(`
        UPDATE dbo.sales_invoices
        SET
          status = N'finalized',
          finalized_at = SYSUTCDATETIME(),
          updated_at = SYSUTCDATETIME()
        WHERE id = @finalizeInvoiceId
          AND status = N'draft';
      `);

    const afterSnapshot = await getSalesFinalizeSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'sales_invoice_finalized',
      entityType: 'sales_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot: {
        ...afterSnapshot,
        warnings,
      },
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
    .input('search', sql.NVarChar(160), options.search ? `%${options.search}%` : null)
    .input('supplierSearch', sql.NVarChar(160), options.partySearch ? `%${options.partySearch}%` : null)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_purchase AS (
      SELECT
        pi.id,
        pi.document_no AS invoice_no,
        s.name AS supplier_name,
        pi.document_currency AS currency_code,
        pi.grand_total AS total_amount,
        pi.status,
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
        pi.status = N'draft'
        AND (
          @search IS NULL
          OR pi.document_no COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR s.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
        )
        AND (
          @supplierSearch IS NULL
          OR s.name COLLATE Latin1_General_CI_AI LIKE @supplierSearch COLLATE Latin1_General_CI_AI
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
        status: 'DRAFT',
        supplier: options.partySearch || null,
      },
    }),
  };
}

export async function createPurchaseDraft(payload) {
  assertMelisaWriteEnabled();

  const draft = normalizePurchasePayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const supplierId = await ensureSupplier(sqlDriver, transaction, draft);
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
    });

    await transaction.commit();

    return getPurchaseDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updatePurchaseDraft(id, payload) {
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
    const beforeSnapshot = await getPurchaseSnapshot(new sqlDriver.Request(transaction), invoiceId);

    if (!beforeSnapshot) {
      throw makeServiceError('PURCHASE_DRAFT_NOT_FOUND', 'Purchase draft not found', 404);
    }

    if (beforeSnapshot.status !== 'DRAFT') {
      throw makeServiceError('PURCHASE_DRAFT_STATUS_INVALID', 'Only DRAFT purchase invoices can be updated', 409);
    }

    const supplierId = await ensureSupplier(sqlDriver, transaction, draft);

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
          AND status = N'draft';
      `);

    await updatePurchaseItems(sqlDriver, transaction, invoiceId, draft.items);

    const afterSnapshot = await getPurchaseSnapshot(new sqlDriver.Request(transaction), invoiceId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'purchase_invoice_draft_updated',
      entityType: 'purchase_invoice',
      entityId: invoiceId,
      beforeSnapshot,
      afterSnapshot,
    });

    await transaction.commit();

    return getPurchaseDraft(invoiceId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
