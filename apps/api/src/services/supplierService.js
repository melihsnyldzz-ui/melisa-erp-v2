import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { buildListMeta, parseListQuery } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

function toSupplierDto(row) {
  return {
    id: row.id,
    supplierCode: row.supplier_code,
    supplierName: row.supplier_name,
    phoneMasked: row.phone_raw || null,
    city: row.city,
    country: row.country,
    currency: row.currency_code,
    balance: Number(row.balance || 0),
    purchaseDiscountRate: Number(row.purchase_discount_rate || 0),
    purchaseCount: Number(row.purchase_count || 0),
    lastPurchaseDate: row.last_purchase_date || null,
    isPassive: !row.is_active,
  };
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

function toSupplierMovementDto(row) {
  return {
    id: row.id,
    date: formatSqlDate(row.document_date),
    type: row.movement_type,
    documentNo: row.document_no || '-',
    purchaseInvoiceId: row.purchase_invoice_id || null,
    currency: row.currency_code,
    amount: Number(row.amount || 0),
    balanceEffect: Number(row.balance_effect || 0),
    status: row.invoice_status || 'kayit',
    createdAt: row.created_at,
  };
}

function toSupplierProductTraceDto(row) {
  return {
    id: Number(row.id),
    purchaseInvoiceId: Number(row.purchase_invoice_id),
    documentNo: row.document_no || '-',
    documentDate: formatSqlDate(row.document_date),
    invoiceStatus: row.invoice_status || '-',
    productId: Number(row.product_id),
    stockCode: row.stock_code_snapshot || '-',
    barcode: row.barcode_snapshot || '-',
    productName: row.product_name_snapshot || '-',
    quantity: Number(row.quantity || 0),
    currency: row.currency_code || 'TRY',
    purchasePrice: Number(row.purchase_price || 0),
    lineDiscountRate: Number(row.line_discount_rate || 0),
    lineTotal: Number(row.line_total || 0),
    lineTotalTry: Number(row.line_total_try || 0),
    netUnitCostTry: Number(row.quantity || 0) > 0 ? Number(row.line_total_try || 0) / Number(row.quantity || 0) : 0,
  };
}

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDiscountRate(value, fieldName) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw makeServiceError('SUPPLIER_VALIDATION_FAILED', `${fieldName} must be between 0 and 100`);
  }

  return number;
}

function validateSupplierPayload(payload = {}) {
  const supplier = {
    supplierCode: trimText(payload.supplierCode),
    supplierName: trimText(payload.supplierName),
    phone: trimText(payload.phone),
    city: trimText(payload.city),
    country: trimText(payload.country),
    currency: trimText(payload.currency || 'TRY').toUpperCase(),
    purchaseDiscountRate: parseDiscountRate(payload.purchaseDiscountRate ?? 0, 'purchaseDiscountRate'),
  };

  const missingFields = [];
  if (!supplier.supplierCode) missingFields.push('supplierCode');
  if (!supplier.supplierName) missingFields.push('supplierName');
  if (!supplier.currency) missingFields.push('currency');

  if (missingFields.length > 0) {
    throw makeServiceError('SUPPLIER_VALIDATION_FAILED', `Required supplier fields are missing: ${missingFields.join(', ')}`);
  }

  return supplier;
}

async function assertSupplierDuplicates(request, supplier, currentSupplierId = null) {
  const result = await request
    .input('duplicateSupplierCode', sql.NVarChar(80), supplier.supplierCode)
    .input('duplicateSupplierId', sql.BigInt, currentSupplierId || 0)
    .query(`
      SELECT TOP (1) id
      FROM dbo.suppliers
      WHERE supplier_code = @duplicateSupplierCode
        AND is_deleted = 0
        AND (@duplicateSupplierId = 0 OR id <> @duplicateSupplierId);
    `);

  if (result.recordset?.[0]) {
    throw makeServiceError('SUPPLIER_CODE_DUPLICATE', 'Supplier supplierCode already exists', 409);
  }
}

async function getSupplierSnapshot(request, id) {
  const result = await request
    .input('snapshotSupplierId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        id,
        supplier_code AS supplierCode,
        name AS supplierName,
        phone,
        city,
        country,
        currency_code AS currency,
        purchase_discount_rate AS purchaseDiscountRate,
        balance,
        is_active AS isActive,
        updated_at AS updatedAt
      FROM dbo.suppliers
      WHERE id = @snapshotSupplierId
        AND is_deleted = 0;
    `);

  return result.recordset?.[0] || null;
}

export async function getSuppliersList(query) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 300 });
  const pool = await getSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(120), options.search ? `%${options.search}%` : null)
    .input('activeOnly', sql.Bit, options.activeOnly)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_suppliers AS (
      SELECT
        s.id,
        s.supplier_code,
        s.name AS supplier_name,
        s.phone AS phone_raw,
        s.city,
        s.country,
        s.currency_code,
        s.balance,
        s.purchase_discount_rate,
        purchase_summary.purchase_count,
        purchase_summary.last_purchase_date,
        s.is_active,
        s.created_at
      FROM dbo.suppliers s
      OUTER APPLY (
        SELECT
          COUNT_BIG(1) AS purchase_count,
          MAX(pi.document_date) AS last_purchase_date
        FROM dbo.purchase_invoices pi
        WHERE pi.supplier_id = s.id
          AND pi.status = N'finalized'
      ) purchase_summary
      WHERE
        s.is_deleted = 0
        AND (@activeOnly = 0 OR s.is_active = 1)
        AND (
          @search IS NULL
          OR s.supplier_code COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR s.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR s.phone COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR s.city COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR s.country COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
        )
    ),
    numbered_suppliers AS (
      SELECT
        fs.id,
        fs.supplier_code,
        fs.supplier_name,
        fs.phone_raw,
        fs.city,
        fs.country,
        fs.currency_code,
        fs.balance,
        fs.purchase_discount_rate,
        fs.purchase_count,
        fs.last_purchase_date,
        fs.is_active,
        fs.created_at,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE WHEN fs.supplier_name IS NULL OR LTRIM(RTRIM(fs.supplier_name)) = N'' THEN 1 ELSE 0 END,
            fs.supplier_name COLLATE Latin1_General_CI_AI ASC,
            fs.supplier_code COLLATE Latin1_General_CI_AI ASC,
            fs.id ASC
        ) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_suppliers fs
    )
    SELECT
      TOP (${options.limit}) ns.*
    FROM numbered_suppliers ns
    WHERE ns.row_number > @offset
    ORDER BY ns.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toSupplierDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-select-only',
      filters: {
        search: options.search || null,
        activeOnly: options.activeOnly,
      },
      maxLimit: options.maxLimit,
    }),
  };
}

export async function getSupplierDetail(supplierId) {
  const id = Number(supplierId);

  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('SUPPLIER_ID_INVALID', 'Supplier id is invalid');
  }

  const pool = await getSqlPool();
  const request = pool.request()
    .input('id', sql.BigInt, id);

  const result = await request.query(`
    SELECT TOP (1)
      s.id,
      s.supplier_code,
      s.name AS supplier_name,
      s.phone AS phone_raw,
      s.city,
      s.country,
      s.currency_code,
      s.balance,
      s.purchase_discount_rate,
      purchase_summary.purchase_count,
      purchase_summary.last_purchase_date,
      s.is_active
    FROM dbo.suppliers s
    OUTER APPLY (
      SELECT
        COUNT_BIG(1) AS purchase_count,
        MAX(pi.document_date) AS last_purchase_date
      FROM dbo.purchase_invoices pi
      WHERE pi.supplier_id = s.id
        AND pi.status = N'finalized'
    ) purchase_summary
    WHERE s.id = @id
      AND s.is_deleted = 0;
  `);

  const supplier = result.recordset?.[0];

  if (!supplier) {
    throw makeServiceError('SUPPLIER_NOT_FOUND', 'Supplier not found', 404);
  }

  const movementsResult = await pool.request()
    .input('movementSupplierId', sql.BigInt, id)
    .query(`
      SELECT TOP (80)
        sm.id,
        sm.purchase_invoice_id,
        sm.movement_type,
        COALESCE(pi.document_no, CONCAT(N'OD-', sm.id)) AS document_no,
        sm.amount,
        sm.currency_code,
        sm.balance_effect,
        sm.document_date,
        sm.created_at,
        pi.status AS invoice_status
      FROM dbo.supplier_movements sm
      LEFT JOIN dbo.purchase_invoices pi ON pi.id = sm.purchase_invoice_id
      WHERE sm.supplier_id = @movementSupplierId
      ORDER BY sm.document_date DESC, sm.created_at DESC, sm.id DESC;
    `);

  const productTraceResult = await pool.request()
    .input('traceSupplierId', sql.BigInt, id)
    .query(`
      SELECT TOP (100)
        pii.id,
        pii.purchase_invoice_id,
        pi.document_no,
        pi.document_date,
        pi.status AS invoice_status,
        pii.product_id,
        pii.stock_code_snapshot,
        pii.barcode_snapshot,
        pii.product_name_snapshot,
        pii.quantity,
        pii.currency_code,
        pii.purchase_price,
        pii.line_discount_rate,
        pii.line_total,
        CASE
          WHEN COALESCE(pii.line_total_try, 0) > 0
            AND (
              COALESCE(pi.exchange_rate_snapshot, 1) <= 1
              OR COALESCE(pii.line_total_try, 0) > pii.line_total * 1.0001
            )
            THEN pii.line_total_try
          ELSE pii.line_total * COALESCE(pi.exchange_rate_snapshot, 1)
        END AS line_total_try
      FROM dbo.purchase_invoice_items pii
      INNER JOIN dbo.purchase_invoices pi ON pi.id = pii.purchase_invoice_id
      WHERE pi.supplier_id = @traceSupplierId
        AND pi.status IN (N'finalized', N'cancelled')
      ORDER BY pi.document_date DESC, pii.id DESC;
    `);

  return {
    ...toSupplierDto(supplier),
    movements: (movementsResult.recordset || []).map(toSupplierMovementDto),
    productTrace: (productTraceResult.recordset || []).map(toSupplierProductTraceDto),
  };
}

export async function createSupplier(payload, actor = null) {
  assertMelisaWriteEnabled();

  const supplier = validateSupplierPayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    await assertSupplierDuplicates(new sqlDriver.Request(transaction), supplier);

    const result = await new sqlDriver.Request(transaction)
      .input('supplierCode', sql.NVarChar(80), supplier.supplierCode)
      .input('supplierName', sql.NVarChar(250), supplier.supplierName)
      .input('phone', sql.NVarChar(40), supplier.phone || null)
      .input('city', sql.NVarChar(120), supplier.city || null)
      .input('country', sql.NVarChar(120), supplier.country || null)
      .input('currency', sql.NVarChar(3), supplier.currency)
      .input('purchaseDiscountRate', sql.Decimal(9, 4), supplier.purchaseDiscountRate)
      .query(`
        INSERT INTO dbo.suppliers (
          supplier_code,
          name,
          phone,
          city,
          country,
          currency_code,
          purchase_discount_rate,
          balance,
          is_active,
          is_deleted
        )
        OUTPUT INSERTED.id AS supplierId
        VALUES (
          @supplierCode,
          @supplierName,
          @phone,
          @city,
          @country,
          @currency,
          @purchaseDiscountRate,
          0,
          1,
          0
        );
      `);

    const supplierId = Number(result.recordset?.[0]?.supplierId);
    const afterSnapshot = await getSupplierSnapshot(new sqlDriver.Request(transaction), supplierId);
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'supplier_created',
      entityType: 'supplier',
      entityId: supplierId,
      afterSnapshot,
      actor,
    });

    await transaction.commit();
    return getSupplierDetail(supplierId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateSupplier(supplierId, payload, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(supplierId);
  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('SUPPLIER_ID_INVALID', 'Supplier id is invalid');
  }

  const supplier = validateSupplierPayload(payload);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getSupplierSnapshot(new sqlDriver.Request(transaction), id);
    if (!beforeSnapshot) {
      throw makeServiceError('SUPPLIER_NOT_FOUND', 'Supplier not found', 404);
    }

    await assertSupplierDuplicates(new sqlDriver.Request(transaction), supplier, id);

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('supplierCode', sql.NVarChar(80), supplier.supplierCode)
      .input('supplierName', sql.NVarChar(250), supplier.supplierName)
      .input('phone', sql.NVarChar(40), supplier.phone || null)
      .input('city', sql.NVarChar(120), supplier.city || null)
      .input('country', sql.NVarChar(120), supplier.country || null)
      .input('currency', sql.NVarChar(3), supplier.currency)
      .input('purchaseDiscountRate', sql.Decimal(9, 4), supplier.purchaseDiscountRate)
      .query(`
        UPDATE dbo.suppliers
        SET
          supplier_code = @supplierCode,
          name = @supplierName,
          phone = @phone,
          city = @city,
          country = @country,
          currency_code = @currency,
          purchase_discount_rate = @purchaseDiscountRate,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id
          AND is_deleted = 0;
      `);

    const afterSnapshot = await getSupplierSnapshot(new sqlDriver.Request(transaction), id);
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'supplier_updated',
      entityType: 'supplier',
      entityId: id,
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();
    return getSupplierDetail(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
