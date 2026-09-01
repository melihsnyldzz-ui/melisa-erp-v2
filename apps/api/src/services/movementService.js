import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import { assertAccountingPeriodOpen } from './periodLockService.js';

function normalizeDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))
    ? value.slice(0, 10)
    : null;
}

function formatSqlDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
}

function mapStockMovement(row) {
  const targetScreen = row.source_type === 'sales_invoice'
    ? 'sales-invoice'
    : row.source_type === 'purchase_invoice'
      ? 'purchase-invoice'
      : 'product-card';
  const targetPayload = row.source_type === 'sales_invoice'
    ? { salesDraftId: row.source_id, invoiceNo: row.source_document_no || '-' }
    : row.source_type === 'purchase_invoice'
      ? { purchaseDraftId: row.source_id, invoiceNo: row.source_document_no || '-' }
      : { productId: row.product_id, stockCode: row.stock_code };
  const partyTargetScreen = row.customer_id
    ? 'customer-card'
    : row.supplier_id
      ? 'supplier-card'
      : null;
  const partyTargetPayload = row.customer_id
    ? { customerId: Number(row.customer_id) }
    : row.supplier_id
      ? { supplierId: Number(row.supplier_id) }
      : null;

  return {
    id: row.id,
    productId: row.product_id,
    stockCode: row.stock_code,
    productName: row.product_name,
    movementType: row.movement_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    targetScreen,
    targetId: row.source_id || row.product_id,
    targetPayload,
    sourceDocumentNo: row.source_document_no || '-',
    quantityIn: Number(row.quantity_in || 0),
    quantityOut: Number(row.quantity_out || 0),
    quantityNet: Number(row.quantity_net || 0),
    unitCostTry: Number(row.unit_cost_try || 0),
    averageCostTryAfter: Number(row.average_cost_try_after || 0),
    unitPrice: row.unit_price === null || row.unit_price === undefined ? null : Number(row.unit_price || 0),
    currency: row.currency_code || null,
    amountTry: row.amount_try === null || row.amount_try === undefined ? null : Number(row.amount_try || 0),
    documentDate: formatSqlDate(row.document_date),
    customerId: row.customer_id ? Number(row.customer_id) : null,
    customerName: row.customer_name || null,
    supplierId: row.supplier_id ? Number(row.supplier_id) : null,
    supplierName: row.supplier_name || null,
    partyTargetScreen,
    partyTargetPayload,
    createdAt: row.created_at,
  };
}

function makeMovementError(code, message, statusCode = 400, meta = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.meta = meta;
  return error;
}

function parseCountQuantity(value, fieldName) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw makeMovementError('STOCK_COUNT_VALIDATION_FAILED', `${fieldName} must be a non-negative number`);
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw makeMovementError('STOCK_COUNT_VALIDATION_FAILED', `${fieldName} must be a non-negative number`);
  }

  return Math.round(number * 1000) / 1000;
}

function trimText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function mapCustomerMovement(row) {
  const invoiceStatus = row.invoice_status || '-';
  const movementType = row.movement_type;
  const isCancelled = invoiceStatus === 'cancelled' || movementType === 'sales_invoice_cancel';
  const targetScreen = row.sales_invoice_id
    ? 'sales-invoice'
    : movementType === 'collection'
      ? 'collections-overview'
      : null;
  const targetPayload = row.sales_invoice_id
    ? { salesDraftId: row.sales_invoice_id, invoiceNo: row.document_no || '-' }
    : movementType === 'collection'
      ? { mode: 'collection', movementId: row.id, customerId: row.customer_id }
      : null;

  return {
    partyType: 'customer',
    id: row.id,
    customerId: row.customer_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    salesInvoiceId: row.sales_invoice_id,
    targetScreen,
    targetId: row.sales_invoice_id || row.id || null,
    targetPayload,
    documentKind: 'sales_invoice',
    documentNo: row.document_no || '-',
    invoiceStatus,
    movementType,
    isCancelled,
    amount: Number(row.amount || 0),
    currency: row.currency_code,
    balanceEffect: Number(row.balance_effect || 0),
    documentDate: formatSqlDate(row.document_date),
    createdAt: row.created_at,
  };
}

function mapSupplierMovement(row) {
  const invoiceStatus = row.invoice_status || '-';
  const movementType = row.movement_type;
  const isCancelled = invoiceStatus === 'cancelled' || movementType === 'purchase_invoice_cancel';
  const targetScreen = row.purchase_invoice_id
    ? 'purchase-invoice'
    : movementType === 'payment'
      ? 'collections-overview'
      : null;
  const targetPayload = row.purchase_invoice_id
    ? { purchaseDraftId: row.purchase_invoice_id, invoiceNo: row.document_no || '-' }
    : movementType === 'payment'
      ? { mode: 'payment', movementId: row.id, supplierId: row.supplier_id }
      : null;

  return {
    partyType: 'supplier',
    id: row.id,
    supplierId: row.supplier_id,
    supplierCode: row.supplier_code,
    supplierName: row.supplier_name,
    purchaseInvoiceId: row.purchase_invoice_id,
    targetScreen,
    targetId: row.purchase_invoice_id || row.id || null,
    targetPayload,
    documentKind: 'purchase_invoice',
    documentNo: row.document_no || '-',
    invoiceStatus,
    movementType,
    isCancelled,
    amount: Number(row.amount || 0),
    currency: row.currency_code,
    balanceEffect: Number(row.balance_effect || 0),
    runningBalance: Number(row.running_balance || 0),
    documentDate: formatSqlDate(row.document_date),
    createdAt: row.created_at,
  };
}

function isCancelledLedgerMovement(row) {
  return row.invoiceStatus === 'cancelled'
    || row.movementType === 'sales_invoice_cancel'
    || row.movementType === 'purchase_invoice_cancel';
}

function summarizeLedgerRows(rows, { excludeCancelled = false } = {}) {
  return rows.reduce((summary, row) => {
    if (excludeCancelled && isCancelledLedgerMovement(row)) {
      return summary;
    }

    const currency = row.currency || 'TRY';
    if (!summary[currency]) {
      summary[currency] = { debit: 0, credit: 0, balance: 0 };
    }

    if (row.balanceEffect >= 0) {
      summary[currency].debit += row.balanceEffect;
    } else {
      summary[currency].credit += Math.abs(row.balanceEffect);
    }

    summary[currency].balance += row.balanceEffect;
    return summary;
  }, {});
}

function summaryMapToRows(summary) {
  return Object.entries(summary).map(([currency, values]) => ({
    currency,
    debit: values.debit,
    credit: values.credit,
    balance: values.balance,
  }));
}

function buildDateFilter(alias, dateFrom, dateTo) {
  const clauses = [];
  if (dateFrom) clauses.push(`${alias}.document_date >= @dateFrom`);
  if (dateTo) clauses.push(`${alias}.document_date <= @dateTo`);
  return clauses;
}

export async function getStockMovementsList(query = {}) {
  const options = parseListQuery(query);
  const dateFrom = normalizeDate(query.dateFrom);
  const dateTo = normalizeDate(query.dateTo);
  const movementType = typeof query.movementType === 'string' ? query.movementType.trim().toLowerCase() : '';
  const sourceType = typeof query.sourceType === 'string' ? query.sourceType.trim().toLowerCase() : '';
  const productId = Number(query.productId || 0);
  const pool = await getSqlPool();
  const filters = [
    `(si.id IS NULL OR COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%')`,
    `(pi.id IS NULL OR COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%')`,
    ...buildDateFilter('sm', dateFrom, dateTo),
    productId > 0 ? 'sm.product_id = @productId' : '',
    options.search ? `(
      ${sqlNormalizedLike('p.stock_code')}
      OR ${sqlNormalizedLike('p.name')}
      OR EXISTS (
        SELECT 1
        FROM dbo.product_barcodes pb
        WHERE pb.product_id = p.id
          AND pb.is_active = 1
          AND ${sqlNormalizedLike('pb.barcode')}
      )
      OR ${sqlNormalizedLike('c.name')}
      OR ${sqlNormalizedLike('s.name')}
    )` : '',
    movementType ? 'sm.movement_type = @movementType' : '',
    sourceType ? 'sm.source_type = @sourceType' : '',
  ].filter(Boolean);

  const result = await pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .input('movementType', sql.NVarChar(30), movementType || null)
    .input('sourceType', sql.NVarChar(40), sourceType || null)
    .input('productId', sql.BigInt, productId > 0 ? productId : null)
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH filtered AS (
        SELECT
          sm.id,
          sm.product_id,
          p.stock_code,
          p.name AS product_name,
          sm.movement_type,
          sm.source_type,
          sm.source_id,
          COALESCE(si.document_no, pi.document_no) AS source_document_no,
          sm.quantity_in,
          sm.quantity_out,
          sm.quantity_net,
          sm.unit_cost_try,
          sm.average_cost_try_after,
          sm.unit_price,
          sm.currency_code,
          sm.amount_try,
          sm.document_date,
          c.id AS customer_id,
          c.name AS customer_name,
          s.id AS supplier_id,
          s.name AS supplier_name,
          sm.created_at
        FROM dbo.stock_movements sm
        INNER JOIN dbo.products p ON p.id = sm.product_id
        LEFT JOIN dbo.customers c ON c.id = sm.customer_id
        LEFT JOIN dbo.suppliers s ON s.id = sm.supplier_id
        LEFT JOIN dbo.sales_invoices si ON si.id = sm.source_id AND sm.source_type = N'sales_invoice'
        LEFT JOIN dbo.purchase_invoices pi ON pi.id = sm.source_id AND sm.source_type = N'purchase_invoice'
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ),
      numbered AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY document_date DESC, id DESC) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM filtered
      )
      SELECT TOP (${options.limit}) *
      FROM numbered
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  return {
    data: rows.map(mapStockMovement),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-stock-movements',
      filters: { search: options.search || null, dateFrom, dateTo, movementType: movementType || null, sourceType: sourceType || null, productId: productId || null },
    }),
  };
}

function mapStockValuation(row) {
  const stockQuantity = Number(row.stock_quantity || 0);
  const averageCostTry = Number(row.average_cost_try || 0);
  const salePrice = Number(row.sale_price || 0);
  const saleRateToTry = Number(row.sale_rate_to_try || 1);
  const stockValueTry = stockQuantity * averageCostTry;
  const potentialSaleValueTry = stockQuantity * salePrice * saleRateToTry;
  const potentialGrossProfitTry = potentialSaleValueTry - stockValueTry;

  return {
    productId: row.id,
    stockCode: row.stock_code,
    barcode: row.barcode || null,
    productName: row.product_name,
    brand: row.brand || '',
    currency: row.currency_code || 'TRY',
    stockQuantity,
    averageCostTry,
    salePrice,
    saleRateToTry,
    stockValueTry,
    potentialSaleValueTry,
    potentialGrossProfitTry,
    profitMargin: potentialSaleValueTry > 0 ? potentialGrossProfitTry / potentialSaleValueTry : 0,
    lowStock: stockQuantity <= 5,
    negativeStock: stockQuantity < 0,
  };
}

export async function getStockValuationReport(query = {}) {
  const options = parseListQuery(query);
  const lowStockOnly = String(query.lowStockOnly || 'false').toLowerCase() === 'true';
  const valuedOnly = String(query.valuedOnly || 'false').toLowerCase() === 'true';
  const pool = await getSqlPool();
  const filters = [
    'p.is_deleted = 0',
    options.search ? `(
      ${sqlNormalizedLike('p.stock_code')}
      OR ${sqlNormalizedLike('p.name')}
      OR ${sqlNormalizedLike('p.brand')}
      OR EXISTS (
        SELECT 1
        FROM dbo.product_barcodes pb2
        WHERE pb2.product_id = p.id
          AND pb2.is_active = 1
          AND ${sqlNormalizedLike('pb2.barcode')}
      )
    )` : '',
    lowStockOnly ? 'p.current_stock_qty <= 5' : '',
    valuedOnly ? '(p.current_stock_qty * COALESCE(p.average_cost_try, 0)) <> 0' : '',
  ].filter(Boolean);

  const result = await pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH latest_rates AS (
        SELECT currency_code, rate_to_try
        FROM (
          SELECT
            currency_code,
            rate_to_try,
            ROW_NUMBER() OVER (PARTITION BY currency_code ORDER BY rate_date DESC, id DESC) AS row_number
          FROM dbo.currency_rates
          WHERE currency_code IN (N'USD', N'EUR')
        ) ranked_rates
        WHERE row_number = 1
      ),
      valuation AS (
        SELECT
          p.id,
          p.stock_code,
          pb.barcode,
          p.name AS product_name,
          p.brand,
          p.currency_code,
          p.current_stock_qty AS stock_quantity,
          COALESCE(p.average_cost_try, 0) AS average_cost_try,
          COALESCE(p.sales_price, 0) AS sale_price,
          CASE
            WHEN p.currency_code = N'TRY' THEN 1
            ELSE COALESCE(lr.rate_to_try, 1)
          END AS sale_rate_to_try
        FROM dbo.products p
        LEFT JOIN latest_rates lr ON lr.currency_code = p.currency_code
        OUTER APPLY (
          SELECT TOP (1) b.barcode
          FROM dbo.product_barcodes b
          WHERE b.product_id = p.id
            AND b.is_active = 1
          ORDER BY b.is_primary DESC, b.id ASC
        ) pb
        WHERE ${filters.join(' AND ')}
      ),
      numbered AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY stock_quantity DESC, id DESC) AS row_number,
          COUNT_BIG(1) OVER () AS total_count,
          SUM(stock_quantity) OVER () AS total_stock_quantity,
          SUM(stock_quantity * average_cost_try) OVER () AS total_stock_value_try,
          SUM(stock_quantity * sale_price * sale_rate_to_try) OVER () AS total_potential_sale_value_try,
          SUM((stock_quantity * sale_price * sale_rate_to_try) - (stock_quantity * average_cost_try)) OVER () AS total_potential_gross_profit_try,
          SUM(CASE WHEN stock_quantity <= 5 THEN 1 ELSE 0 END) OVER () AS low_stock_count,
          SUM(CASE WHEN stock_quantity < 0 THEN 1 ELSE 0 END) OVER () AS negative_stock_count
        FROM valuation
      )
      SELECT TOP (${options.limit}) *
      FROM numbered
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  const first = rows[0] || {};

  const summary = {
    totalProductCount: total,
    totalStockQuantity: Number(first.total_stock_quantity || 0),
    totalStockValueTry: Number(first.total_stock_value_try || 0),
    totalPotentialSaleValueTry: Number(first.total_potential_sale_value_try || 0),
    totalPotentialGrossProfitTry: Number(first.total_potential_gross_profit_try || 0),
    lowStockCount: Number(first.low_stock_count || 0),
    negativeStockCount: Number(first.negative_stock_count || 0),
  };
  const listMeta = buildListMeta({
    ...options,
    total,
    source: 'sql-stock-valuation',
    filters: {
      search: options.search || null,
      lowStockOnly,
      valuedOnly,
    },
  });

  return {
    data: rows.map(mapStockValuation),
    meta: {
      ...listMeta,
      summary,
    },
  };
}

export async function getCustomerMovementsList(query = {}) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 500 });
  const dateFrom = normalizeDate(query.dateFrom);
  const dateTo = normalizeDate(query.dateTo);
  const customerId = Number(query.customerId || 0);
  const pool = await getSqlPool();
  const filters = [
    `(si.id IS NULL OR COALESCE(si.description, N'') NOT LIKE N'%TEST_ARCHIVED%')`,
    ...buildDateFilter('cm', dateFrom, dateTo),
    customerId > 0 ? 'cm.customer_id = @customerId' : '',
    options.search ? `(
      ${sqlNormalizedLike('c.customer_code')}
      OR ${sqlNormalizedLike('c.name')}
      OR ${sqlNormalizedLike('si.document_no')}
    )` : '',
  ].filter(Boolean);

  const result = await pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .input('customerId', sql.Int, customerId > 0 ? customerId : null)
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH filtered AS (
        SELECT
          cm.id,
          cm.customer_id,
          c.customer_code,
          c.name AS customer_name,
          cm.sales_invoice_id,
          si.document_no,
          si.status AS invoice_status,
          cm.movement_type,
          cm.amount,
          cm.currency_code,
          cm.balance_effect,
          cm.document_date,
          cm.created_at
        FROM dbo.customer_movements cm
        INNER JOIN dbo.customers c ON c.id = cm.customer_id
        LEFT JOIN dbo.sales_invoices si ON si.id = cm.sales_invoice_id
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ),
      numbered AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY document_date DESC, id DESC) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM filtered
      )
      SELECT TOP (${options.limit}) *
      FROM numbered
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  return {
    data: rows.map(mapCustomerMovement),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-customer-movements',
      filters: { search: options.search || null, dateFrom, dateTo, customerId: customerId > 0 ? customerId : null },
    }),
  };
}

export async function getCustomerStatement(query = {}) {
  const movementResult = await getCustomerMovementsList({
    ...query,
    limit: query.limit || 100,
  });
  const rows = movementResult.data;
  const regularTotals = summarizeLedgerRows(rows, { excludeCancelled: true });
  const cancelledTotals = summarizeLedgerRows(rows.filter(isCancelledLedgerMovement));

  return {
    rows,
    totals: summaryMapToRows(regularTotals),
    cancelledTotals: summaryMapToRows(cancelledTotals),
    meta: movementResult.meta,
  };
}

export async function getSupplierMovementsList(query = {}) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 500 });
  const dateFrom = normalizeDate(query.dateFrom);
  const dateTo = normalizeDate(query.dateTo);
  const supplierId = Number(query.supplierId || 0);
  const pool = await getSqlPool();
  const filters = [
    `(pi.id IS NULL OR COALESCE(pi.description, N'') NOT LIKE N'%TEST_ARCHIVED%')`,
    ...buildDateFilter('sm', dateFrom, dateTo),
    supplierId > 0 ? 'sm.supplier_id = @supplierId' : '',
    options.search ? `(
      ${sqlNormalizedLike('s.supplier_code')}
      OR ${sqlNormalizedLike('s.name')}
      OR ${sqlNormalizedLike('pi.document_no')}
    )` : '',
  ].filter(Boolean);

  const result = await pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .input('supplierId', sql.BigInt, supplierId > 0 ? supplierId : null)
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH movement_balances AS (
        SELECT
          sm.*,
          SUM(sm.balance_effect) OVER (
            PARTITION BY sm.supplier_id
            ORDER BY sm.document_date DESC, sm.id DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
          ) AS newer_balance_effect
        FROM dbo.supplier_movements sm
      ),
      filtered AS (
        SELECT
          sm.id,
          sm.supplier_id,
          s.supplier_code,
          s.name AS supplier_name,
          sm.purchase_invoice_id,
          COALESCE(pi.document_no, CONCAT(N'OD-', sm.id)) AS document_no,
          pi.status AS invoice_status,
          sm.movement_type,
          sm.amount,
          sm.currency_code,
          sm.balance_effect,
          s.balance - COALESCE(sm.newer_balance_effect, 0) AS running_balance,
          sm.document_date,
          sm.created_at
        FROM movement_balances sm
        INNER JOIN dbo.suppliers s ON s.id = sm.supplier_id
        LEFT JOIN dbo.purchase_invoices pi ON pi.id = sm.purchase_invoice_id
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ),
      numbered AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY document_date DESC, id DESC) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM filtered
      )
      SELECT TOP (${options.limit}) *
      FROM numbered
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  return {
    data: rows.map(mapSupplierMovement),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-supplier-movements',
      filters: { search: options.search || null, dateFrom, dateTo, supplierId: supplierId > 0 ? supplierId : null },
    }),
  };
}

export async function getSupplierStatement(query = {}) {
  const movementResult = await getSupplierMovementsList({
    ...query,
    limit: query.limit || 100,
  });
  const rows = movementResult.data;
  const regularTotals = summarizeLedgerRows(rows, { excludeCancelled: true });
  const cancelledTotals = summarizeLedgerRows(rows.filter(isCancelledLedgerMovement));

  return {
    rows,
    totals: summaryMapToRows(regularTotals),
    cancelledTotals: summaryMapToRows(cancelledTotals),
    meta: movementResult.meta,
  };
}

export async function applyStockCountAdjustment(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const productId = Number(payload.productId || 0);
  const expectedCurrentQuantity = parseCountQuantity(payload.expectedCurrentQuantity, 'expectedCurrentQuantity');
  const countedQuantity = parseCountQuantity(payload.countedQuantity, 'countedQuantity');
  const note = trimText(payload.note, 500);
  const documentDate = normalizeDate(payload.documentDate) || todaySqlDate();

  if (!Number.isInteger(productId) || productId <= 0) {
    throw makeMovementError('STOCK_COUNT_PRODUCT_REQUIRED', 'productId is required');
  }
  if (!note) {
    throw makeMovementError('STOCK_COUNT_REASON_REQUIRED', 'Stock count adjustment reason is required');
  }

  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), documentDate, 'Stok sayım düzeltmesi');

    const productResult = await new sqlDriver.Request(transaction)
      .input('countProductId', sqlDriver.BigInt, productId)
      .query(`
        SELECT TOP (1)
          id,
          stock_code,
          name,
          currency_code,
          current_stock_qty,
          average_cost_try
        FROM dbo.products WITH (UPDLOCK, ROWLOCK)
        WHERE id = @countProductId
          AND is_deleted = 0;
      `);

    const product = productResult.recordset?.[0];

    if (!product) {
      throw makeMovementError('STOCK_COUNT_PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    const currentQuantity = Math.round(Number(product.current_stock_qty || 0) * 1000) / 1000;
    if (currentQuantity !== expectedCurrentQuantity) {
      throw makeMovementError(
        'STOCK_COUNT_STALE',
        'Stock quantity changed after the count screen was opened',
        409,
        { expectedCurrentQuantity, currentQuantity },
      );
    }
    const difference = Math.round((countedQuantity - currentQuantity) * 1000) / 1000;
    const averageCostTry = Number(product.average_cost_try || 0);

    if (difference === 0) {
      await transaction.commit();
      return {
        productId,
        stockCode: product.stock_code,
        productName: product.name,
        currentQuantity,
        countedQuantity,
        difference,
        movementCreated: false,
        message: 'Stok zaten sayılan miktar ile aynı.',
      };
    }

    const quantityIn = difference > 0 ? difference : 0;
    const quantityOut = difference < 0 ? Math.abs(difference) : 0;
    const amountTry = Math.abs(difference) * averageCostTry;
    const movementType = difference > 0 ? 'in' : 'out';

    await new sqlDriver.Request(transaction)
      .input('updateProductId', sqlDriver.BigInt, productId)
      .input('countedQuantity', sqlDriver.Decimal(18, 3), countedQuantity)
      .query(`
        UPDATE dbo.products
        SET
          current_stock_qty = @countedQuantity,
          updated_at = SYSUTCDATETIME()
        WHERE id = @updateProductId;
      `);

    const movementResult = await new sqlDriver.Request(transaction)
      .input('movementProductId', sqlDriver.BigInt, productId)
      .input('movementType', sqlDriver.NVarChar(30), movementType)
      .input('movementQuantityIn', sqlDriver.Decimal(18, 3), quantityIn)
      .input('movementQuantityOut', sqlDriver.Decimal(18, 3), quantityOut)
      .input('movementQuantityNet', sqlDriver.Decimal(18, 3), difference)
      .input('movementUnitCostTry', sqlDriver.Decimal(18, 4), averageCostTry)
      .input('movementDocumentDate', sqlDriver.Date, documentDate)
      .input('movementCreatedBy', sqlDriver.BigInt, actor?.id ? Number(actor.id) : null)
      .input('movementCurrency', sqlDriver.NVarChar(3), product.currency_code || 'TRY')
      .input('movementAmountTry', sqlDriver.Decimal(18, 4), amountTry)
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
          created_at,
          created_by,
          unit_price,
          currency_code,
          amount_try
        )
        OUTPUT INSERTED.id
        VALUES (
          @movementProductId,
          @movementType,
          N'adjustment',
          NULL,
          @movementQuantityIn,
          @movementQuantityOut,
          @movementQuantityNet,
          @movementUnitCostTry,
          @movementUnitCostTry,
          @movementDocumentDate,
          SYSUTCDATETIME(),
          @movementCreatedBy,
          0,
          @movementCurrency,
          @movementAmountTry
        );
      `);

    const movementId = Number(movementResult.recordset?.[0]?.id || 0);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'stock_count_adjustment_applied',
      entityType: 'product',
      entityId: productId,
      beforeSnapshot: {
        stockQuantity: currentQuantity,
      },
      afterSnapshot: {
        stockQuantity: countedQuantity,
        difference,
        movementId,
        note,
      },
      actor,
    });

    await transaction.commit();

    return {
      productId,
      stockCode: product.stock_code,
      productName: product.name,
      currentQuantity,
      countedQuantity,
      difference,
      quantityIn,
      quantityOut,
      averageCostTry,
      amountTry,
      movementId,
      movementCreated: true,
      message: difference > 0 ? 'Sayım fazlası stok giriş hareketi yazıldı.' : 'Sayım eksiği stok çıkış hareketi yazıldı.',
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function todaySqlDate() {
  return new Date().toISOString().slice(0, 10);
}
