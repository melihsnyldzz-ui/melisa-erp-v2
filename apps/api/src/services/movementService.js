import sql from 'mssql';
import { getSqlPool } from '../config/database.js';
import { buildListMeta, parseListQuery } from './queryHelpers.js';

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
  return {
    id: row.id,
    productId: row.product_id,
    stockCode: row.stock_code,
    productName: row.product_name,
    movementType: row.movement_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
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
    createdAt: row.created_at,
  };
}

function mapCustomerMovement(row) {
  return {
    partyType: 'customer',
    id: row.id,
    customerId: row.customer_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    salesInvoiceId: row.sales_invoice_id,
    documentNo: row.document_no || '-',
    invoiceStatus: row.invoice_status || '-',
    movementType: row.movement_type,
    amount: Number(row.amount || 0),
    currency: row.currency_code,
    balanceEffect: Number(row.balance_effect || 0),
    documentDate: formatSqlDate(row.document_date),
    createdAt: row.created_at,
  };
}

function mapSupplierMovement(row) {
  return {
    partyType: 'supplier',
    id: row.id,
    supplierId: row.supplier_id,
    supplierCode: row.supplier_code,
    supplierName: row.supplier_name,
    purchaseInvoiceId: row.purchase_invoice_id,
    documentNo: row.document_no || '-',
    invoiceStatus: row.invoice_status || '-',
    movementType: row.movement_type,
    amount: Number(row.amount || 0),
    currency: row.currency_code,
    balanceEffect: Number(row.balance_effect || 0),
    documentDate: formatSqlDate(row.document_date),
    createdAt: row.created_at,
  };
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
    ...buildDateFilter('sm', dateFrom, dateTo),
    productId > 0 ? 'sm.product_id = @productId' : '',
    options.search ? `(
      p.stock_code COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
      OR p.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
      OR EXISTS (
        SELECT 1
        FROM dbo.product_barcodes pb
        WHERE pb.product_id = p.id
          AND pb.is_active = 1
          AND pb.barcode COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
      )
      OR c.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
      OR s.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
    )` : '',
    movementType ? 'sm.movement_type = @movementType' : '',
    sourceType ? 'sm.source_type = @sourceType' : '',
  ].filter(Boolean);

  const result = await pool.request()
    .input('search', sql.NVarChar(120), options.search ? `%${options.search}%` : null)
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

export async function getCustomerMovementsList(query = {}) {
  const options = parseListQuery(query);
  const dateFrom = normalizeDate(query.dateFrom);
  const dateTo = normalizeDate(query.dateTo);
  const customerId = Number(query.customerId || 0);
  const pool = await getSqlPool();
  const filters = [
    ...buildDateFilter('cm', dateFrom, dateTo),
    customerId > 0 ? 'cm.customer_id = @customerId' : '',
    options.search ? `(
      c.customer_code COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
      OR c.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
      OR si.document_no COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
    )` : '',
  ].filter(Boolean);

  const result = await pool.request()
    .input('search', sql.NVarChar(120), options.search ? `%${options.search}%` : null)
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
  const totals = rows.reduce((summary, row) => {
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

  return {
    rows,
    totals: Object.entries(totals).map(([currency, values]) => ({
      currency,
      debit: values.debit,
      credit: values.credit,
      balance: values.balance,
    })),
    meta: movementResult.meta,
  };
}

export async function getSupplierMovementsList(query = {}) {
  const options = parseListQuery(query);
  const dateFrom = normalizeDate(query.dateFrom);
  const dateTo = normalizeDate(query.dateTo);
  const supplierId = Number(query.supplierId || 0);
  const pool = await getSqlPool();
  const filters = [
    ...buildDateFilter('sm', dateFrom, dateTo),
    supplierId > 0 ? 'sm.supplier_id = @supplierId' : '',
    options.search ? `(
      s.supplier_code COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
      OR s.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
      OR pi.document_no COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
    )` : '',
  ].filter(Boolean);

  const result = await pool.request()
    .input('search', sql.NVarChar(120), options.search ? `%${options.search}%` : null)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .input('supplierId', sql.BigInt, supplierId > 0 ? supplierId : null)
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH filtered AS (
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
          sm.document_date,
          sm.created_at
        FROM dbo.supplier_movements sm
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
  const totals = rows.reduce((summary, row) => {
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

  return {
    rows,
    totals: Object.entries(totals).map(([currency, values]) => ({
      currency,
      debit: values.debit,
      credit: values.credit,
      balance: values.balance,
    })),
    meta: movementResult.meta,
  };
}
