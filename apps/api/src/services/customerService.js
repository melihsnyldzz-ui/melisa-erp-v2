import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

const ALLOWED_CUSTOMER_TYPES = new Set(['customer', 'wholesale', 'retail', 'mixed']);
export const CASH_CUSTOMER_DEFINITIONS = [
  { code: 'PESIN-TL', name: 'Pesin TL Musteri', currency: 'TRY' },
  { code: 'PESIN-USD', name: 'Pesin USD Musteri', currency: 'USD' },
  { code: 'PESIN-EUR', name: 'Pesin EUR Musteri', currency: 'EUR' },
];

const CASH_CUSTOMER_CODE_ALIASES = new Map([
  ['PESIN-TL', 'TRY'],
  ['PESIN-TRY', 'TRY'],
  ['PESIN-USD', 'USD'],
  ['PESIN-DOLAR', 'USD'],
  ['PESIN-EUR', 'EUR'],
  ['PESIN-EURO', 'EUR'],
]);

function toCustomerDto(row) {
  return {
    id: row.id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    phoneMasked: row.phone_raw || null,
    city: row.city,
    country: row.country,
    currency: row.currency_code,
    customerType: row.customer_type,
    balance: Number(row.balance || 0),
    isPassive: !row.is_active,
  };
}

function toCustomerDetailDto(row) {
  return {
    id: row.id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    phoneMasked: row.phone_raw || null,
    city: row.city,
    country: row.country,
    currency: row.currency_code,
    customerType: row.customer_type,
    balance: Number(row.balance || 0),
    isPassive: !row.is_active,
    lastTransactionDate: row.last_transaction_date || null,
    movements: row.movements || [],
    productTrace: row.productTrace || [],
  };
}

function toCustomerMovementDto(row) {
  return {
    id: row.id,
    date: row.document_date ? String(row.document_date).slice(0, 10) : null,
    type: row.movement_type,
    documentNo: row.document_no || '-',
    salesInvoiceId: row.sales_invoice_id || null,
    currency: row.currency_code,
    amount: Number(row.amount || 0),
    balanceEffect: Number(row.balance_effect || 0),
    status: row.invoice_status || 'kayit',
  };
}

function toCustomerProductTraceDto(row) {
  return {
    id: Number(row.id),
    salesInvoiceId: Number(row.sales_invoice_id),
    documentNo: row.document_no || '-',
    documentDate: row.document_date ? String(row.document_date).slice(0, 10) : null,
    invoiceStatus: row.invoice_status || '-',
    productId: Number(row.product_id),
    stockCode: row.stock_code_snapshot || '-',
    barcode: row.barcode_snapshot || '-',
    productName: row.product_name_snapshot || '-',
    quantity: Number(row.quantity || 0),
    currency: row.currency_code || 'TRY',
    unitPrice: Number(row.unit_price || 0),
    lineTotal: Number(row.line_total || 0),
    lineTotalTry: Number(row.line_total_try || 0),
    unitCostTry: Number(row.average_cost_try_snapshot || 0),
    grossProfitTry: row.gross_profit_try === null || row.gross_profit_try === undefined ? null : Number(row.gross_profit_try || 0),
    grossProfitRate: row.gross_profit_rate === null || row.gross_profit_rate === undefined ? null : Number(row.gross_profit_rate || 0),
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

function normalizeCurrency(value) {
  return trimText(value).toUpperCase();
}

function normalizeCustomerCode(value) {
  return trimText(value).toUpperCase().replace(/\s+/g, '-');
}

export function getCashCustomerCurrency(customerCode) {
  return CASH_CUSTOMER_CODE_ALIASES.get(normalizeCustomerCode(customerCode)) || null;
}

export function isCashCustomerCode(customerCode) {
  return Boolean(getCashCustomerCurrency(customerCode));
}

export async function ensureCashCustomers(poolArg = null) {
  const pool = poolArg || await getSqlPool();

  for (const customer of CASH_CUSTOMER_DEFINITIONS) {
    await pool.request()
      .input('cashCustomerCode', sql.NVarChar(80), customer.code)
      .input('cashCustomerName', sql.NVarChar(250), customer.name)
      .input('cashCustomerCurrency', sql.NVarChar(3), customer.currency)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM dbo.customers WITH (UPDLOCK, HOLDLOCK)
          WHERE customer_code = @cashCustomerCode
        )
        BEGIN
          INSERT INTO dbo.customers (
            customer_code,
            name,
            phone,
            city,
            country,
            currency_code,
            customer_type,
            balance,
            risk_limit,
            is_active,
            is_deleted,
            created_by,
            updated_by
          )
          VALUES (
            @cashCustomerCode,
            @cashCustomerName,
            N'',
            N'',
            N'Turkiye',
            @cashCustomerCurrency,
            N'retail',
            0,
            0,
            1,
            0,
            NULL,
            NULL
          );
        END
        ELSE
        BEGIN
          UPDATE dbo.customers
          SET
            name = @cashCustomerName,
            currency_code = @cashCustomerCurrency,
            customer_type = N'retail',
            is_active = 1,
            is_deleted = 0,
            updated_at = SYSUTCDATETIME()
          WHERE customer_code = @cashCustomerCode;
        END;
      `);
  }
}

function validateCustomerPayload(payload, { requirePhone }) {
  const customer = {
    customerCode: trimText(payload?.customerCode),
    customerName: trimText(payload?.customerName),
    phone: trimText(payload?.phone),
    city: trimText(payload?.city),
    country: trimText(payload?.country),
    currency: normalizeCurrency(payload?.currency),
    customerType: trimText(payload?.customerType).toLowerCase(),
  };

  const missingFields = [];

  if (!customer.customerCode) missingFields.push('customerCode');
  if (!customer.customerName) missingFields.push('customerName');
  if (requirePhone && !customer.phone) missingFields.push('phone');
  if (!customer.currency) missingFields.push('currency');
  if (!customer.customerType) missingFields.push('customerType');

  if (missingFields.length > 0) {
    throw makeServiceError(
      'CUSTOMER_VALIDATION_FAILED',
      `Required customer fields are missing: ${missingFields.join(', ')}`,
    );
  }

  if (!ALLOWED_CUSTOMER_TYPES.has(customer.customerType)) {
    throw makeServiceError('CUSTOMER_VALIDATION_FAILED', 'customerType is invalid');
  }

  return customer;
}

async function getCustomerSnapshot(request, id) {
  const result = await request
    .input('snapshotCustomerId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        id,
        customer_code AS customerCode,
        name AS customerName,
        phone,
        city,
        country,
        currency_code AS currency,
        customer_type AS customerType,
        balance,
        is_active AS isActive,
        updated_at AS updatedAt
      FROM dbo.customers
      WHERE id = @snapshotCustomerId
        AND is_deleted = 0;
    `);

  return result.recordset?.[0] || null;
}

async function assertCustomerDuplicates(request, customer, currentCustomerId = null) {
  const duplicate = await request
    .input('duplicateCustomerCode', sql.NVarChar(80), customer.customerCode)
    .input('duplicateCustomerId', sql.BigInt, currentCustomerId || 0)
    .query(`
      SELECT TOP (1) id
      FROM dbo.customers
      WHERE customer_code = @duplicateCustomerCode
        AND is_deleted = 0
        AND (@duplicateCustomerId = 0 OR id <> @duplicateCustomerId);
    `);

  if (duplicate.recordset?.[0]) {
    throw makeServiceError('CUSTOMER_CODE_DUPLICATE', 'Customer customerCode already exists', 409);
  }
}

export async function getCustomersList(query) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 500 });
  const pool = await getSqlPool();
  const searchPredicates = [
    'c.customer_code',
    'c.name',
    'c.phone',
    'c.city',
    'c.country',
    'c.customer_type',
  ].map((column) => sqlNormalizedLike(column)).join('\n          OR ');

  await ensureCashCustomers(pool);

  const request = pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('activeOnly', sql.Bit, options.activeOnly)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_customers AS (
      SELECT
        c.id,
        c.customer_code,
        c.name AS customer_name,
        c.phone AS phone_raw,
        c.city,
        c.country,
        c.currency_code,
        c.customer_type,
        c.balance,
        c.is_active,
        c.created_at
      FROM dbo.customers c
      WHERE
        c.is_deleted = 0
        AND (@activeOnly = 0 OR c.is_active = 1)
        AND (
          @search IS NULL
          OR ${searchPredicates}
        )
    ),
    numbered_customers AS (
      SELECT
        fc.id,
        fc.customer_code,
        fc.customer_name,
        fc.phone_raw,
        fc.city,
        fc.country,
        fc.currency_code,
        fc.customer_type,
        fc.balance,
        fc.is_active,
        fc.created_at,
        ROW_NUMBER() OVER (ORDER BY fc.id DESC) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_customers fc
    )
    SELECT
      TOP (${options.limit}) nc.*
    FROM numbered_customers nc
    WHERE nc.row_number > @offset
    ORDER BY nc.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toCustomerDto),
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

export async function getCustomerDetail(customerId) {
  const id = Number(customerId);

  if (!Number.isInteger(id) || id < 1) {
    const error = new Error('Customer id is invalid');
    error.code = 'CUSTOMER_ID_INVALID';
    error.statusCode = 400;
    throw error;
  }

  const pool = await getSqlPool();
  const request = pool.request()
    .input('id', sql.BigInt, id);

  const result = await request.query(`
    SELECT TOP (1)
      c.id,
      c.customer_code,
      c.name AS customer_name,
      c.phone AS phone_raw,
      c.city,
      c.country,
      c.currency_code,
      c.customer_type,
      c.balance,
      c.is_active,
      ls.last_transaction_date
    FROM dbo.customers c
    OUTER APPLY (
      SELECT MAX(si.document_date) AS last_transaction_date
      FROM dbo.sales_invoices si
      WHERE si.customer_id = c.id
        AND si.status IN (N'finalized', N'cancelled')
    ) ls
    WHERE c.id = @id
      AND c.is_deleted = 0;
  `);

  const row = result.recordset?.[0];

  if (!row) {
    const error = new Error('Customer not found');
    error.code = 'CUSTOMER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const movementsResult = await pool.request()
    .input('movementCustomerId', sql.BigInt, id)
    .query(`
      SELECT TOP (50)
        cm.id,
        cm.document_date,
        cm.movement_type,
        cm.sales_invoice_id,
        cm.amount,
        cm.currency_code,
        cm.balance_effect,
        si.document_no,
        si.status AS invoice_status
      FROM dbo.customer_movements cm
      LEFT JOIN dbo.sales_invoices si ON si.id = cm.sales_invoice_id
      WHERE cm.customer_id = @movementCustomerId
      ORDER BY cm.document_date DESC, cm.id DESC;
    `);

  const productTraceResult = await pool.request()
    .input('traceCustomerId', sql.BigInt, id)
    .query(`
      SELECT TOP (100)
        sii.id,
        sii.sales_invoice_id,
        si.document_no,
        si.document_date,
        si.status AS invoice_status,
        sii.product_id,
        sii.stock_code_snapshot,
        sii.barcode_snapshot,
        sii.product_name_snapshot,
        sii.quantity,
        sii.currency_code,
        sii.unit_price,
        sii.line_total,
        sii.line_total * COALESCE(si.exchange_rate_snapshot, 1) AS line_total_try,
        sii.average_cost_try_snapshot,
        sii.gross_profit_try,
        sii.gross_profit_rate
      FROM dbo.sales_invoice_items sii
      INNER JOIN dbo.sales_invoices si ON si.id = sii.sales_invoice_id
      WHERE si.customer_id = @traceCustomerId
        AND si.status IN (N'finalized', N'cancelled')
      ORDER BY si.document_date DESC, sii.id DESC;
    `);

  return toCustomerDetailDto({
    ...row,
    movements: (movementsResult.recordset || []).map(toCustomerMovementDto),
    productTrace: (productTraceResult.recordset || []).map(toCustomerProductTraceDto),
  });
}

export async function createCustomer(payload, actor = null) {
  assertMelisaWriteEnabled();

  const customer = validateCustomerPayload(payload, { requirePhone: true });
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    await assertCustomerDuplicates(new sqlDriver.Request(transaction), customer);

    const insertResult = await new sqlDriver.Request(transaction)
      .input('customerCode', sql.NVarChar(80), customer.customerCode)
      .input('customerName', sql.NVarChar(250), customer.customerName)
      .input('phone', sql.NVarChar(40), customer.phone)
      .input('city', sql.NVarChar(120), customer.city || null)
      .input('country', sql.NVarChar(120), customer.country || null)
      .input('currency', sql.NVarChar(3), customer.currency)
      .input('customerType', sql.NVarChar(40), customer.customerType)
      .query(`
        INSERT INTO dbo.customers (
          customer_code,
          name,
          phone,
          city,
          country,
          currency_code,
          customer_type,
          balance,
          risk_limit,
          is_active,
          is_deleted,
          created_by,
          updated_by
        )
        OUTPUT INSERTED.id AS customerId
        VALUES (
          @customerCode,
          @customerName,
          @phone,
          @city,
          @country,
          @currency,
          @customerType,
          0,
          0,
          1,
          0,
          NULL,
          NULL
        );
      `);

    const customerId = Number(insertResult.recordset?.[0]?.customerId);

    if (!Number.isInteger(customerId) || customerId < 1) {
      throw makeServiceError('CUSTOMER_CREATE_FAILED', 'Created customer id could not be read', 503);
    }
    const afterSnapshot = await getCustomerSnapshot(new sqlDriver.Request(transaction), customerId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'customer_created',
      entityType: 'customer',
      entityId: customerId,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getCustomerDetail(customerId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateCustomer(customerId, payload, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(customerId);

  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('CUSTOMER_ID_INVALID', 'Customer id is invalid');
  }

  const customer = validateCustomerPayload(payload, { requirePhone: false });
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getCustomerSnapshot(new sqlDriver.Request(transaction), id);

    if (!beforeSnapshot) {
      throw makeServiceError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
    }

    await assertCustomerDuplicates(new sqlDriver.Request(transaction), customer, id);

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('customerCode', sql.NVarChar(80), customer.customerCode)
      .input('customerName', sql.NVarChar(250), customer.customerName)
      .input('phone', sql.NVarChar(40), customer.phone || null)
      .input('city', sql.NVarChar(120), customer.city || null)
      .input('country', sql.NVarChar(120), customer.country || null)
      .input('currency', sql.NVarChar(3), customer.currency)
      .input('customerType', sql.NVarChar(40), customer.customerType)
      .query(`
        UPDATE dbo.customers
        SET
          customer_code = @customerCode,
          name = @customerName,
          phone = COALESCE(@phone, phone),
          city = @city,
          country = @country,
          currency_code = @currency,
          customer_type = @customerType,
          updated_by = NULL,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `);

    const afterSnapshot = await getCustomerSnapshot(new sqlDriver.Request(transaction), id);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'customer_updated',
      entityType: 'customer',
      entityId: id,
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getCustomerDetail(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function changeCustomerPassive(customerId, payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(customerId);

  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('CUSTOMER_ID_INVALID', 'Customer id is invalid');
  }

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getCustomerSnapshot(new sqlDriver.Request(transaction), id);

    if (!beforeSnapshot) {
      throw makeServiceError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
    }

    const currentIsPassive = !beforeSnapshot.isActive;
    const nextIsPassive = typeof payload.isPassive === 'boolean' ? payload.isPassive : !currentIsPassive;

    if (nextIsPassive === currentIsPassive) {
      await transaction.commit();
      return {
        data: await getCustomerDetail(id),
        auditWritten: false,
      };
    }

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('isActive', sql.Bit, !nextIsPassive)
      .input('passiveReason', sql.NVarChar(250), nextIsPassive ? 'SYSTEM passive toggle' : null)
      .query(`
        UPDATE dbo.customers
        SET
          is_active = @isActive,
          passive_at = CASE WHEN @isActive = 0 THEN SYSUTCDATETIME() ELSE NULL END,
          passive_reason = @passiveReason,
          updated_by = NULL,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `);

    const afterSnapshot = await getCustomerSnapshot(new sqlDriver.Request(transaction), id);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'customer_passive_changed',
      entityType: 'customer',
      entityId: id,
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return {
      data: await getCustomerDetail(id),
      auditWritten: true,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
