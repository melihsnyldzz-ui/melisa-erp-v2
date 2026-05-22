import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { buildListMeta, maskPhone, parseListQuery } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

const ALLOWED_CUSTOMER_TYPES = new Set(['customer', 'wholesale', 'retail', 'mixed']);

function toCustomerDto(row) {
  return {
    id: row.id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    phoneMasked: maskPhone(row.phone_raw),
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
    phoneMasked: maskPhone(row.phone_raw),
    city: row.city,
    country: row.country,
    currency: row.currency_code,
    customerType: row.customer_type,
    balance: Number(row.balance || 0),
    isPassive: !row.is_active,
    lastTransactionDate: row.last_transaction_date || null,
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
      WHERE id = @snapshotCustomerId;
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
        AND (@duplicateCustomerId = 0 OR id <> @duplicateCustomerId);
    `);

  if (duplicate.recordset?.[0]) {
    throw makeServiceError('CUSTOMER_CODE_DUPLICATE', 'Customer customerCode already exists', 409);
  }
}

export async function getCustomersList(query) {
  const options = parseListQuery(query);
  const pool = await getSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(120), options.search ? `%${options.search}%` : null)
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
        (@activeOnly = 0 OR c.is_active = 1)
        AND (
          @search IS NULL
          OR c.customer_code COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.phone COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.city COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.country COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.customer_type COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
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
    WHERE c.id = @id;
  `);

  const row = result.recordset?.[0];

  if (!row) {
    const error = new Error('Customer not found');
    error.code = 'CUSTOMER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  return toCustomerDetailDto(row);
}

export async function createCustomer(payload) {
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
    });

    await transaction.commit();

    return getCustomerDetail(customerId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateCustomer(customerId, payload) {
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
    });

    await transaction.commit();

    return getCustomerDetail(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
