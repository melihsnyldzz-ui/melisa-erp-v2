import sqlDriver from 'mssql';
import { getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

const VALID_CURRENCIES = new Set(['TRY', 'USD', 'EUR']);
const PAYMENT_METHODS = new Set(['cash', 'bank', 'card', 'other']);

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value, maxLength = 250) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeCurrency(value, fallback = 'TRY') {
  const currency = trimText(value, 3).toUpperCase() || fallback;
  if (!VALID_CURRENCIES.has(currency)) {
    throw makeServiceError('FINANCE_CURRENCY_INVALID', 'Currency must be TRY, USD or EUR');
  }
  return currency;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw makeServiceError('FINANCE_AMOUNT_INVALID', 'Amount must be greater than zero');
  }
  return Number(amount.toFixed(4));
}

function normalizePaymentMethod(value) {
  const method = trimText(value, 20).toLowerCase() || 'cash';
  if (!PAYMENT_METHODS.has(method)) {
    throw makeServiceError('FINANCE_PAYMENT_METHOD_INVALID', 'Payment method is invalid');
  }
  return method;
}

function normalizeDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
    return value.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function mapFinanceMovement(row) {
  return {
    id: row.id,
    partyType: row.party_type,
    partyId: row.party_id,
    partyCode: row.party_code,
    partyName: row.party_name,
    movementType: row.movement_type,
    documentNo: row.document_no || '-',
    amount: Number(row.amount || 0),
    currency: row.currency_code,
    balanceEffect: Number(row.balance_effect || 0),
    documentDate: row.document_date ? String(row.document_date).slice(0, 10) : null,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export async function getFinanceSummary() {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    SELECT
      COALESCE((SELECT SUM(balance) FROM dbo.customers WHERE is_deleted = 0 AND balance > 0), 0) AS customer_receivables,
      COALESCE((SELECT SUM(ABS(balance)) FROM dbo.customers WHERE is_deleted = 0 AND balance < 0), 0) AS customer_advances,
      COALESCE((SELECT SUM(balance) FROM dbo.suppliers WHERE is_deleted = 0 AND balance > 0), 0) AS supplier_payables,
      COALESCE((SELECT SUM(ABS(balance)) FROM dbo.suppliers WHERE is_deleted = 0 AND balance < 0), 0) AS supplier_advances,
      COALESCE((SELECT SUM(amount) FROM dbo.customer_movements WHERE movement_type = N'collection' AND document_date = CONVERT(date, SYSUTCDATETIME())), 0) AS today_collections,
      COALESCE((SELECT SUM(amount) FROM dbo.supplier_movements WHERE movement_type = N'payment' AND document_date = CONVERT(date, SYSUTCDATETIME())), 0) AS today_payments,
      COALESCE((SELECT COUNT_BIG(1) FROM dbo.customer_movements WHERE movement_type = N'collection'), 0) AS collection_count,
      COALESCE((SELECT COUNT_BIG(1) FROM dbo.supplier_movements WHERE movement_type = N'payment'), 0) AS payment_count;
  `);

  const row = result.recordset?.[0] || {};
  return {
    customerReceivables: Number(row.customer_receivables || 0),
    customerAdvances: Number(row.customer_advances || 0),
    supplierPayables: Number(row.supplier_payables || 0),
    supplierAdvances: Number(row.supplier_advances || 0),
    todayCollections: Number(row.today_collections || 0),
    todayPayments: Number(row.today_payments || 0),
    collectionCount: Number(row.collection_count || 0),
    paymentCount: Number(row.payment_count || 0),
  };
}

export async function getFinanceMovements(query = {}) {
  const search = trimText(query.search, 120);
  const partyType = trimText(query.partyType, 20).toLowerCase();
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 200);
  const pool = await getSqlPool();

  const result = await pool.request()
    .input('search', sqlDriver.NVarChar(120), search ? `%${search}%` : null)
    .input('partyType', sqlDriver.NVarChar(20), partyType || null)
    .query(`
      WITH finance_rows AS (
        SELECT
          cm.id,
          N'customer' AS party_type,
          cm.customer_id AS party_id,
          c.customer_code AS party_code,
          c.name AS party_name,
          cm.movement_type,
          COALESCE(si.document_no, CONCAT(N'TH-', cm.id)) AS document_no,
          cm.amount,
          cm.currency_code,
          cm.balance_effect,
          cm.document_date,
          cm.created_at,
          cm.created_by
        FROM dbo.customer_movements cm
        INNER JOIN dbo.customers c ON c.id = cm.customer_id
        LEFT JOIN dbo.sales_invoices si ON si.id = cm.sales_invoice_id
        WHERE cm.movement_type IN (N'collection', N'sales_invoice', N'sales_invoice_cancel')

        UNION ALL

        SELECT
          sm.id,
          N'supplier' AS party_type,
          sm.supplier_id AS party_id,
          s.supplier_code AS party_code,
          s.name AS party_name,
          sm.movement_type,
          COALESCE(pi.document_no, CONCAT(N'OD-', sm.id)) AS document_no,
          sm.amount,
          sm.currency_code,
          sm.balance_effect,
          sm.document_date,
          sm.created_at,
          sm.created_by
        FROM dbo.supplier_movements sm
        INNER JOIN dbo.suppliers s ON s.id = sm.supplier_id
        LEFT JOIN dbo.purchase_invoices pi ON pi.id = sm.purchase_invoice_id
        WHERE sm.movement_type IN (N'payment', N'purchase_invoice', N'purchase_invoice_cancel')
      )
      SELECT TOP (${limit}) *
      FROM finance_rows
      WHERE
        (@partyType IS NULL OR party_type = @partyType)
        AND (
          @search IS NULL
          OR party_code COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR party_name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR document_no COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
        )
      ORDER BY document_date DESC, created_at DESC, id DESC;
    `);

  return result.recordset.map(mapFinanceMovement);
}

export async function createCustomerCollection(payload, actor) {
  assertMelisaWriteEnabled();

  const customerId = Number(payload.customerId);
  const amount = normalizeAmount(payload.amount);
  const currency = normalizeCurrency(payload.currency);
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  const documentDate = normalizeDate(payload.documentDate);
  const description = trimText(payload.description || `Tahsilat - ${paymentMethod}`, 500);

  if (!Number.isInteger(customerId) || customerId < 1) {
    throw makeServiceError('FINANCE_CUSTOMER_INVALID', 'Customer is required');
  }

  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const request = new sqlDriver.Request(transaction);
    const customerResult = await request
      .input('customerId', sqlDriver.BigInt, customerId)
      .query(`
        SELECT TOP (1) id, customer_code, name, currency_code, balance
        FROM dbo.customers WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @customerId AND is_deleted = 0;
      `);
    const customer = customerResult.recordset?.[0];

    if (!customer) {
      throw makeServiceError('FINANCE_CUSTOMER_NOT_FOUND', 'Customer not found', 404);
    }

    const movementResult = await new sqlDriver.Request(transaction)
      .input('movementCustomerId', sqlDriver.BigInt, customerId)
      .input('movementType', sqlDriver.NVarChar(40), 'collection')
      .input('amount', sqlDriver.Decimal(18, 4), amount)
      .input('currency', sqlDriver.NVarChar(3), currency)
      .input('balanceEffect', sqlDriver.Decimal(18, 4), -amount)
      .input('documentDate', sqlDriver.Date, documentDate)
      .input('createdBy', sqlDriver.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.customer_movements (
          customer_id,
          sales_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_by
        )
        OUTPUT inserted.*
        VALUES (
          @movementCustomerId,
          NULL,
          @movementType,
          @amount,
          @currency,
          @balanceEffect,
          @documentDate,
          @createdBy
        );

        UPDATE dbo.customers
        SET balance = balance + @balanceEffect,
            updated_at = SYSUTCDATETIME()
        WHERE id = @movementCustomerId;
      `);

    const movement = movementResult.recordset?.[0];
    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'customer_collection_created',
      entityType: 'customer_movement',
      entityId: movement?.id,
      afterSnapshot: { customerId, amount, currency, paymentMethod, documentDate, description },
    });

    await transaction.commit();
    return {
      id: Number(movement.id),
      customerId,
      customerCode: customer.customer_code,
      customerName: customer.name,
      amount,
      currency,
      balanceEffect: -amount,
      documentDate,
      paymentMethod,
      description,
      message: 'Tahsilat kaydedildi',
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function createSupplierPayment(payload, actor) {
  assertMelisaWriteEnabled();

  const supplierId = Number(payload.supplierId);
  const amount = normalizeAmount(payload.amount);
  const currency = normalizeCurrency(payload.currency);
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  const documentDate = normalizeDate(payload.documentDate);
  const description = trimText(payload.description || `Odeme - ${paymentMethod}`, 500);

  if (!Number.isInteger(supplierId) || supplierId < 1) {
    throw makeServiceError('FINANCE_SUPPLIER_INVALID', 'Supplier is required');
  }

  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const supplierResult = await new sqlDriver.Request(transaction)
      .input('supplierId', sqlDriver.BigInt, supplierId)
      .query(`
        SELECT TOP (1) id, supplier_code, name, currency_code, balance
        FROM dbo.suppliers WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @supplierId AND is_deleted = 0;
      `);
    const supplier = supplierResult.recordset?.[0];

    if (!supplier) {
      throw makeServiceError('FINANCE_SUPPLIER_NOT_FOUND', 'Supplier not found', 404);
    }

    const movementResult = await new sqlDriver.Request(transaction)
      .input('movementSupplierId', sqlDriver.BigInt, supplierId)
      .input('movementType', sqlDriver.NVarChar(40), 'payment')
      .input('amount', sqlDriver.Decimal(18, 4), amount)
      .input('currency', sqlDriver.NVarChar(3), currency)
      .input('balanceEffect', sqlDriver.Decimal(18, 4), -amount)
      .input('documentDate', sqlDriver.Date, documentDate)
      .input('createdBy', sqlDriver.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.supplier_movements (
          supplier_id,
          purchase_invoice_id,
          movement_type,
          amount,
          currency_code,
          balance_effect,
          document_date,
          created_by
        )
        OUTPUT inserted.*
        VALUES (
          @movementSupplierId,
          NULL,
          @movementType,
          @amount,
          @currency,
          @balanceEffect,
          @documentDate,
          @createdBy
        );

        UPDATE dbo.suppliers
        SET balance = balance + @balanceEffect,
            updated_at = SYSUTCDATETIME()
        WHERE id = @movementSupplierId;
      `);

    const movement = movementResult.recordset?.[0];
    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'supplier_payment_created',
      entityType: 'supplier_movement',
      entityId: movement?.id,
      afterSnapshot: { supplierId, amount, currency, paymentMethod, documentDate, description },
    });

    await transaction.commit();
    return {
      id: Number(movement.id),
      supplierId,
      supplierCode: supplier.supplier_code,
      supplierName: supplier.name,
      amount,
      currency,
      balanceEffect: -amount,
      documentDate,
      paymentMethod,
      description,
      message: 'Odeme kaydedildi',
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
