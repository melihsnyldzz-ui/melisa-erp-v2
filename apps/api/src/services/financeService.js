import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import { assertAccountingPeriodOpen } from './periodLockService.js';

const VALID_CURRENCIES = new Set(['TRY', 'USD', 'EUR']);
const PAYMENT_METHODS = new Set(['cash', 'bank', 'card', 'other']);
const ACCOUNT_TYPES = new Set(['cash', 'bank', 'card', 'other']);
const MOVEMENT_TYPES = new Set([
  'collection',
  'payment',
  'sales_invoice',
  'sales_invoice_cancel',
  'purchase_invoice',
  'purchase_invoice_cancel',
]);

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

function normalizeAccountType(value, fallback = 'cash') {
  const type = trimText(value, 20).toLowerCase() || fallback;
  if (!ACCOUNT_TYPES.has(type)) {
    throw makeServiceError('FINANCE_ACCOUNT_TYPE_INVALID', 'Account type is invalid');
  }
  return type;
}

function paymentMethodToAccountType(paymentMethod) {
  if (paymentMethod === 'bank') return 'bank';
  if (paymentMethod === 'card') return 'card';
  if (paymentMethod === 'other') return 'other';
  return 'cash';
}

function standardFinanceAccountCode(accountType, currency) {
  const codePrefixMap = {
    cash: 'KASA',
    bank: 'BANKA',
    card: 'POS',
    other: 'DIGER',
  };
  return `${codePrefixMap[accountType] || String(accountType || '').toUpperCase()}-${currency || 'TRY'}`;
}

function normalizeDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
    return value.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeOptionalDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
    return value.slice(0, 10);
  }
  return null;
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

function mapFinanceAccount(row) {
  return {
    id: Number(row.id),
    code: row.account_code,
    name: row.account_name,
    type: row.account_type,
    currency: row.currency_code,
    openingBalance: Number(row.opening_balance || 0),
    currentBalance: Number(row.current_balance || 0),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureFinanceAccountTables(pool) {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.finance_accounts', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.finance_accounts (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_finance_accounts PRIMARY KEY,
        account_code NVARCHAR(40) NOT NULL CONSTRAINT UQ_finance_accounts_code UNIQUE,
        account_name NVARCHAR(160) NOT NULL,
        account_type NVARCHAR(20) NOT NULL,
        currency_code NVARCHAR(3) NOT NULL,
        opening_balance DECIMAL(18,4) NOT NULL CONSTRAINT DF_finance_accounts_opening DEFAULT (0),
        current_balance DECIMAL(18,4) NOT NULL CONSTRAINT DF_finance_accounts_current DEFAULT (0),
        is_active BIT NOT NULL CONSTRAINT DF_finance_accounts_active DEFAULT (1),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_finance_accounts_created DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NULL
      );
    END;

    IF OBJECT_ID(N'dbo.finance_account_movements', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.finance_account_movements (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_finance_account_movements PRIMARY KEY,
        account_id BIGINT NOT NULL,
        source_type NVARCHAR(30) NOT NULL,
        party_type NVARCHAR(20) NOT NULL,
        party_movement_id BIGINT NOT NULL,
        direction NVARCHAR(10) NOT NULL,
        amount DECIMAL(18,4) NOT NULL,
        currency_code NVARCHAR(3) NOT NULL,
        payment_method NVARCHAR(20) NOT NULL,
        document_no NVARCHAR(60) NULL,
        document_date DATE NOT NULL,
        description NVARCHAR(500) NULL,
        created_by BIGINT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_finance_account_movements_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_finance_account_movements_account FOREIGN KEY (account_id) REFERENCES dbo.finance_accounts(id),
        CONSTRAINT UQ_finance_account_source UNIQUE (source_type, party_type, party_movement_id)
      );
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.finance_accounts)
    BEGIN
      INSERT INTO dbo.finance_accounts (account_code, account_name, account_type, currency_code)
      VALUES
        (N'KASA-TRY', N'TRY Ana Kasa', N'cash', N'TRY'),
        (N'BANKA-TRY', N'TRY Banka Hesabi', N'bank', N'TRY'),
        (N'POS-TRY', N'TRY POS / Kart Hesabi', N'card', N'TRY');
    END;
  `);
}

async function getOrCreateDefaultFinanceAccount(request, sqlDriver, { accountType, currency }) {
  const code = standardFinanceAccountCode(accountType, currency);
  const nameMap = {
    cash: `${currency} Ana Kasa`,
    bank: `${currency} Banka Hesabi`,
    card: `${currency} POS / Kart Hesabi`,
    other: `${currency} Diger Finans Hesabi`,
  };

  const existing = await request
    .input(`defaultAccountCode${accountType}${currency}`, sqlDriver.NVarChar(40), code)
    .query(`
      SELECT TOP (1) *
      FROM dbo.finance_accounts WITH (UPDLOCK, HOLDLOCK)
      WHERE account_code = @defaultAccountCode${accountType}${currency};
    `);

  if (existing.recordset?.[0]) {
    return mapFinanceAccount(existing.recordset[0]);
  }

  const inserted = await request
    .input(`newAccountCode${accountType}${currency}`, sqlDriver.NVarChar(40), code)
    .input(`newAccountName${accountType}${currency}`, sqlDriver.NVarChar(160), nameMap[accountType] || code)
    .input(`newAccountType${accountType}${currency}`, sqlDriver.NVarChar(20), accountType)
    .input(`newAccountCurrency${accountType}${currency}`, sqlDriver.NVarChar(3), currency)
    .query(`
      INSERT INTO dbo.finance_accounts (account_code, account_name, account_type, currency_code)
      OUTPUT inserted.*
      VALUES (
        @newAccountCode${accountType}${currency},
        @newAccountName${accountType}${currency},
        @newAccountType${accountType}${currency},
        @newAccountCurrency${accountType}${currency}
      );
    `);

  return mapFinanceAccount(inserted.recordset[0]);
}

async function resolveFinanceAccount(transaction, sqlDriver, payload) {
  const accountId = Number(payload.accountId);
  const accountType = paymentMethodToAccountType(payload.paymentMethod);
  const currency = payload.currency;

  if (Number.isInteger(accountId) && accountId > 0) {
    const result = await new sqlDriver.Request(transaction)
      .input('financeAccountId', sqlDriver.BigInt, accountId)
      .query(`
        SELECT TOP (1) *
        FROM dbo.finance_accounts WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @financeAccountId AND is_active = 1;
      `);
    const account = result.recordset?.[0];

    if (!account) {
      throw makeServiceError('FINANCE_ACCOUNT_NOT_FOUND', 'Finance account not found', 404);
    }

    if (account.currency_code !== currency) {
      throw makeServiceError('FINANCE_ACCOUNT_CURRENCY_MISMATCH', 'Finance account currency must match transaction currency');
    }

    return mapFinanceAccount(account);
  }

  return getOrCreateDefaultFinanceAccount(new sqlDriver.Request(transaction), sqlDriver, { accountType, currency });
}

async function writeFinanceAccountMovement(transaction, sqlDriver, payload) {
  const direction = payload.sourceType === 'payment' ? 'out' : 'in';
  const balanceEffect = direction === 'out' ? -payload.amount : payload.amount;

  await new sqlDriver.Request(transaction)
    .input('accountMovementAccountId', sqlDriver.BigInt, payload.account.id)
    .input('accountMovementSourceType', sqlDriver.NVarChar(30), payload.sourceType)
    .input('accountMovementPartyType', sqlDriver.NVarChar(20), payload.partyType)
    .input('accountMovementPartyMovementId', sqlDriver.BigInt, payload.partyMovementId)
    .input('accountMovementDirection', sqlDriver.NVarChar(10), direction)
    .input('accountMovementAmount', sqlDriver.Decimal(18, 4), payload.amount)
    .input('accountMovementCurrency', sqlDriver.NVarChar(3), payload.currency)
    .input('accountMovementPaymentMethod', sqlDriver.NVarChar(20), payload.paymentMethod)
    .input('accountMovementDocumentNo', sqlDriver.NVarChar(60), payload.documentNo)
    .input('accountMovementDocumentDate', sqlDriver.Date, payload.documentDate)
    .input('accountMovementDescription', sqlDriver.NVarChar(500), payload.description || null)
    .input('accountMovementCreatedBy', sqlDriver.BigInt, payload.actor?.id ? Number(payload.actor.id) : null)
    .input('accountBalanceEffect', sqlDriver.Decimal(18, 4), balanceEffect)
    .query(`
      INSERT INTO dbo.finance_account_movements (
        account_id,
        source_type,
        party_type,
        party_movement_id,
        direction,
        amount,
        currency_code,
        payment_method,
        document_no,
        document_date,
        description,
        created_by
      )
      VALUES (
        @accountMovementAccountId,
        @accountMovementSourceType,
        @accountMovementPartyType,
        @accountMovementPartyMovementId,
        @accountMovementDirection,
        @accountMovementAmount,
        @accountMovementCurrency,
        @accountMovementPaymentMethod,
        @accountMovementDocumentNo,
        @accountMovementDocumentDate,
        @accountMovementDescription,
        @accountMovementCreatedBy
      );

      UPDATE dbo.finance_accounts
      SET current_balance = current_balance + @accountBalanceEffect,
          updated_at = SYSUTCDATETIME()
      WHERE id = @accountMovementAccountId;
    `);

  const accountResult = await new sqlDriver.Request(transaction)
    .input('updatedFinanceAccountId', sqlDriver.BigInt, payload.account.id)
    .query(`
      SELECT TOP (1) *
      FROM dbo.finance_accounts
      WHERE id = @updatedFinanceAccountId;
    `);

  return mapFinanceAccount(accountResult.recordset?.[0] || payload.account);
}

function mapFinanceMovement(row) {
  const partyType = row.party_type;
  const invoiceId = row.sales_invoice_id || row.purchase_invoice_id || null;
  const targetScreen = row.sales_invoice_id
    ? 'sales-invoice'
    : row.purchase_invoice_id
      ? 'purchase-invoice'
      : partyType === 'supplier'
        ? 'supplier-card'
        : 'customer-card';
  const targetPayload = row.sales_invoice_id
    ? { salesDraftId: row.sales_invoice_id, invoiceNo: row.document_no || '-' }
    : row.purchase_invoice_id
      ? { purchaseDraftId: row.purchase_invoice_id, invoiceNo: row.document_no || '-' }
      : partyType === 'supplier'
        ? { supplierId: row.party_id, supplierCode: row.party_code }
        : { customerId: row.party_id, customerCode: row.party_code };

  return {
    id: row.id,
    partyType,
    partyId: row.party_id,
    partyCode: row.party_code,
    partyName: row.party_name,
    movementType: row.movement_type,
    salesInvoiceId: row.sales_invoice_id || null,
    purchaseInvoiceId: row.purchase_invoice_id || null,
    targetScreen,
    targetId: invoiceId || row.party_id,
    targetPayload,
    documentNo: row.document_no || '-',
    accountId: row.account_id ? Number(row.account_id) : null,
    accountCode: row.account_code || null,
    accountName: row.account_name || null,
    accountType: row.account_type || null,
    paymentMethod: row.payment_method || null,
    amount: Number(row.amount || 0),
    currency: row.currency_code,
    balanceEffect: Number(row.balance_effect || 0),
    documentDate: formatSqlDate(row.document_date),
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function accountingLabel(type) {
  const labels = {
    sales_invoice: 'Satış fişi',
    sales_invoice_cancel: 'Satış iptal',
    purchase_invoice: 'Alış fişi',
    purchase_invoice_cancel: 'Alış iptal',
    collection: 'Tahsilat',
    payment: 'Ödeme',
  };

  return labels[type] || type || '-';
}

function partyAccountName(row) {
  return row.partyType === 'supplier'
    ? `320 Tedarikçi Cari - ${row.partyCode || row.partyName || ''}`.trim()
    : `120 Müşteri Cari - ${row.partyCode || row.partyName || ''}`.trim();
}

function fallbackCounterAccount(row) {
  if (row.movementType === 'sales_invoice') return '600 Yurtiçi Satışlar';
  if (row.movementType === 'sales_invoice_cancel') return '610 Satış İadeleri / İptal';
  if (row.movementType === 'purchase_invoice') return '153 Ticari Mallar / Alış';
  if (row.movementType === 'purchase_invoice_cancel') return '153 Ticari Mallar İptal';
  if (row.movementType === 'collection') return row.accountName ? `${row.accountCode || ''} ${row.accountName}`.trim() : '100/102 Kasa-Banka';
  if (row.movementType === 'payment') return row.accountName ? `${row.accountCode || ''} ${row.accountName}`.trim() : '100/102 Kasa-Banka';
  return 'Muhasebe karşı hesabı';
}

function makeJournalLine(row, lineNo, accountName, debit, credit, note) {
  return {
    id: `${row.partyType}-${row.id}-${row.movementType}-${lineNo}`,
    movementId: row.id,
    lineNo,
    documentDate: row.documentDate,
    documentNo: row.documentNo,
    movementType: row.movementType,
    movementLabel: accountingLabel(row.movementType),
    partyType: row.partyType,
    partyId: row.partyId,
    partyCode: row.partyCode,
    partyName: row.partyName,
    accountName,
    debit: Number(debit || 0),
    credit: Number(credit || 0),
    currency: row.currency,
    amount: Number(row.amount || 0),
    note,
    targetScreen: row.targetScreen,
    targetId: row.targetId,
    targetPayload: row.targetPayload,
    createdAt: row.createdAt,
  };
}

function buildJournalLines(row) {
  const amount = Math.abs(Number(row.amount || row.balanceEffect || 0));
  const partyAccount = partyAccountName(row);
  const counterAccount = fallbackCounterAccount(row);

  if (row.movementType === 'sales_invoice') {
    return [
      makeJournalLine(row, 1, partyAccount, amount, 0, 'Müşteri satıştan borçlandı'),
      makeJournalLine(row, 2, counterAccount, 0, amount, 'Satış geliri / fiş karşılığı'),
    ];
  }

  if (row.movementType === 'sales_invoice_cancel') {
    return [
      makeJournalLine(row, 1, counterAccount, amount, 0, 'Satış iptal ters kayıt'),
      makeJournalLine(row, 2, partyAccount, 0, amount, 'Müşteri borcu iptal edildi'),
    ];
  }

  if (row.movementType === 'purchase_invoice') {
    return [
      makeJournalLine(row, 1, counterAccount, amount, 0, 'Stok/alış girişi'),
      makeJournalLine(row, 2, partyAccount, 0, amount, 'Tedarikçi alacaklandı'),
    ];
  }

  if (row.movementType === 'purchase_invoice_cancel') {
    return [
      makeJournalLine(row, 1, partyAccount, amount, 0, 'Tedarikçi borcu iptal edildi'),
      makeJournalLine(row, 2, counterAccount, 0, amount, 'Alış/stok iptal ters kayıt'),
    ];
  }

  if (row.movementType === 'collection') {
    return [
      makeJournalLine(row, 1, counterAccount, amount, 0, 'Kasa/banka tahsilat girişi'),
      makeJournalLine(row, 2, partyAccount, 0, amount, 'Müşteri borcu tahsil edildi'),
    ];
  }

  if (row.movementType === 'payment') {
    return [
      makeJournalLine(row, 1, partyAccount, amount, 0, 'Tedarikçiye ödeme ile borç azaldı'),
      makeJournalLine(row, 2, counterAccount, 0, amount, 'Kasa/banka ödeme çıkışı'),
    ];
  }

  return [makeJournalLine(row, 1, partyAccount, amount, 0, 'Tanımsız muhasebe izi')];
}

export async function getFinanceSummary() {
  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);
  const result = await pool.request().query(`
    SELECT
      COALESCE((
        SELECT SUM(balance)
        FROM dbo.customers
        WHERE is_deleted = 0 AND balance > 0
          AND customer_code NOT LIKE N'QA-%'
          AND customer_code NOT LIKE N'CUS-QA-%'
          AND customer_code NOT LIKE N'AKIS-%'
          AND customer_code NOT LIKE N'TEST%'
          AND customer_code NOT LIKE N'IMP-%'
      ), 0) AS customer_receivables,
      COALESCE((
        SELECT SUM(ABS(balance))
        FROM dbo.customers
        WHERE is_deleted = 0 AND balance < 0
          AND customer_code NOT LIKE N'QA-%'
          AND customer_code NOT LIKE N'CUS-QA-%'
          AND customer_code NOT LIKE N'AKIS-%'
          AND customer_code NOT LIKE N'TEST%'
          AND customer_code NOT LIKE N'IMP-%'
      ), 0) AS customer_advances,
      COALESCE((
        SELECT SUM(balance)
        FROM dbo.suppliers
        WHERE is_deleted = 0 AND balance > 0
          AND supplier_code NOT LIKE N'QA-%'
          AND supplier_code NOT LIKE N'SUP-QA-%'
          AND supplier_code NOT LIKE N'AKIS-%'
          AND supplier_code NOT LIKE N'TEST%'
          AND supplier_code NOT LIKE N'DRAFT-%'
          AND supplier_code NOT LIKE N'IMP-%'
      ), 0) AS supplier_payables,
      COALESCE((
        SELECT SUM(ABS(balance))
        FROM dbo.suppliers
        WHERE is_deleted = 0 AND balance < 0
          AND supplier_code NOT LIKE N'QA-%'
          AND supplier_code NOT LIKE N'SUP-QA-%'
          AND supplier_code NOT LIKE N'AKIS-%'
          AND supplier_code NOT LIKE N'TEST%'
          AND supplier_code NOT LIKE N'DRAFT-%'
          AND supplier_code NOT LIKE N'IMP-%'
      ), 0) AS supplier_advances,
      COALESCE((
        SELECT SUM(cm.amount)
        FROM dbo.customer_movements cm
        INNER JOIN dbo.customers c ON c.id = cm.customer_id
        WHERE cm.movement_type = N'collection'
          AND cm.document_date = CONVERT(date, SYSUTCDATETIME())
          AND c.customer_code NOT LIKE N'QA-%'
          AND c.customer_code NOT LIKE N'CUS-QA-%'
          AND c.customer_code NOT LIKE N'AKIS-%'
          AND c.customer_code NOT LIKE N'TEST%'
          AND c.customer_code NOT LIKE N'IMP-%'
      ), 0) AS today_collections,
      COALESCE((
        SELECT SUM(sm.amount)
        FROM dbo.supplier_movements sm
        INNER JOIN dbo.suppliers s ON s.id = sm.supplier_id
        WHERE sm.movement_type = N'payment'
          AND sm.document_date = CONVERT(date, SYSUTCDATETIME())
          AND s.supplier_code NOT LIKE N'QA-%'
          AND s.supplier_code NOT LIKE N'SUP-QA-%'
          AND s.supplier_code NOT LIKE N'AKIS-%'
          AND s.supplier_code NOT LIKE N'TEST%'
          AND s.supplier_code NOT LIKE N'DRAFT-%'
          AND s.supplier_code NOT LIKE N'IMP-%'
      ), 0) AS today_payments,
      COALESCE((
        SELECT COUNT_BIG(1)
        FROM dbo.customer_movements cm
        INNER JOIN dbo.customers c ON c.id = cm.customer_id
        WHERE cm.movement_type = N'collection'
          AND c.customer_code NOT LIKE N'QA-%'
          AND c.customer_code NOT LIKE N'CUS-QA-%'
          AND c.customer_code NOT LIKE N'AKIS-%'
          AND c.customer_code NOT LIKE N'TEST%'
          AND c.customer_code NOT LIKE N'IMP-%'
      ), 0) AS collection_count,
      COALESCE((
        SELECT COUNT_BIG(1)
        FROM dbo.supplier_movements sm
        INNER JOIN dbo.suppliers s ON s.id = sm.supplier_id
        WHERE sm.movement_type = N'payment'
          AND s.supplier_code NOT LIKE N'QA-%'
          AND s.supplier_code NOT LIKE N'SUP-QA-%'
          AND s.supplier_code NOT LIKE N'AKIS-%'
          AND s.supplier_code NOT LIKE N'TEST%'
          AND s.supplier_code NOT LIKE N'DRAFT-%'
          AND s.supplier_code NOT LIKE N'IMP-%'
      ), 0) AS payment_count,
      COALESCE((SELECT SUM(current_balance) FROM dbo.finance_accounts WHERE is_active = 1 AND currency_code = N'TRY'), 0) AS finance_try_balance;
  `);
  const breakdownResult = await pool.request().query(`
    SELECT N'customerReceivables' AS metric, currency_code, SUM(balance) AS amount
    FROM dbo.customers
    WHERE is_deleted = 0 AND balance > 0
      AND customer_code NOT LIKE N'QA-%'
          AND customer_code NOT LIKE N'CUS-QA-%'
      AND customer_code NOT LIKE N'AKIS-%'
      AND customer_code NOT LIKE N'TEST%'
      AND customer_code NOT LIKE N'IMP-%'
    GROUP BY currency_code
    UNION ALL
    SELECT N'customerAdvances' AS metric, currency_code, SUM(ABS(balance)) AS amount
    FROM dbo.customers
    WHERE is_deleted = 0 AND balance < 0
      AND customer_code NOT LIKE N'QA-%'
          AND customer_code NOT LIKE N'CUS-QA-%'
      AND customer_code NOT LIKE N'AKIS-%'
      AND customer_code NOT LIKE N'TEST%'
      AND customer_code NOT LIKE N'IMP-%'
    GROUP BY currency_code
    UNION ALL
    SELECT N'supplierPayables' AS metric, currency_code, SUM(balance) AS amount
    FROM dbo.suppliers
    WHERE is_deleted = 0 AND balance > 0
      AND supplier_code NOT LIKE N'QA-%'
          AND supplier_code NOT LIKE N'SUP-QA-%'
      AND supplier_code NOT LIKE N'AKIS-%'
      AND supplier_code NOT LIKE N'TEST%'
      AND supplier_code NOT LIKE N'DRAFT-%'
      AND supplier_code NOT LIKE N'IMP-%'
    GROUP BY currency_code
    UNION ALL
    SELECT N'supplierAdvances' AS metric, currency_code, SUM(ABS(balance)) AS amount
    FROM dbo.suppliers
    WHERE is_deleted = 0 AND balance < 0
      AND supplier_code NOT LIKE N'QA-%'
          AND supplier_code NOT LIKE N'SUP-QA-%'
      AND supplier_code NOT LIKE N'AKIS-%'
      AND supplier_code NOT LIKE N'TEST%'
      AND supplier_code NOT LIKE N'DRAFT-%'
      AND supplier_code NOT LIKE N'IMP-%'
    GROUP BY currency_code
    UNION ALL
    SELECT N'todayCollections' AS metric, cm.currency_code, SUM(cm.amount) AS amount
    FROM dbo.customer_movements cm
    INNER JOIN dbo.customers c ON c.id = cm.customer_id
    WHERE cm.movement_type = N'collection'
      AND cm.document_date = CONVERT(date, SYSUTCDATETIME())
      AND c.customer_code NOT LIKE N'QA-%'
          AND c.customer_code NOT LIKE N'CUS-QA-%'
      AND c.customer_code NOT LIKE N'AKIS-%'
      AND c.customer_code NOT LIKE N'TEST%'
      AND c.customer_code NOT LIKE N'IMP-%'
    GROUP BY cm.currency_code
    UNION ALL
    SELECT N'todayPayments' AS metric, sm.currency_code, SUM(sm.amount) AS amount
    FROM dbo.supplier_movements sm
    INNER JOIN dbo.suppliers s ON s.id = sm.supplier_id
    WHERE sm.movement_type = N'payment'
      AND sm.document_date = CONVERT(date, SYSUTCDATETIME())
      AND s.supplier_code NOT LIKE N'QA-%'
          AND s.supplier_code NOT LIKE N'SUP-QA-%'
      AND s.supplier_code NOT LIKE N'AKIS-%'
      AND s.supplier_code NOT LIKE N'TEST%'
      AND s.supplier_code NOT LIKE N'DRAFT-%'
      AND s.supplier_code NOT LIKE N'IMP-%'
    GROUP BY sm.currency_code
    UNION ALL
    SELECT N'financeBalances' AS metric, currency_code, SUM(current_balance) AS amount
    FROM dbo.finance_accounts
    WHERE is_active = 1
    GROUP BY currency_code;
  `);

  const row = result.recordset?.[0] || {};
  const currencySummary = (breakdownResult.recordset || []).reduce((summary, item) => {
    const metric = item.metric;
    const currency = item.currency_code || 'TRY';
    summary[metric] = summary[metric] || {};
    summary[metric][currency] = Number(item.amount || 0);
    return summary;
  }, {});
  return {
    customerReceivables: Number(row.customer_receivables || 0),
    customerAdvances: Number(row.customer_advances || 0),
    supplierPayables: Number(row.supplier_payables || 0),
    supplierAdvances: Number(row.supplier_advances || 0),
    todayCollections: Number(row.today_collections || 0),
    todayPayments: Number(row.today_payments || 0),
    collectionCount: Number(row.collection_count || 0),
    paymentCount: Number(row.payment_count || 0),
    financeTryBalance: Number(row.finance_try_balance || 0),
    currencySummary,
  };
}

export async function getFinanceAccounts(query = {}) {
  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);
  const includePassive = ['1', 'true', true].includes(query.includePassive);
  const result = await pool.request()
    .input('includePassiveAccounts', sql.Bit, includePassive ? 1 : 0)
    .query(`
      SELECT *
      FROM dbo.finance_accounts
      WHERE (@includePassiveAccounts = 1 OR is_active = 1)
      ORDER BY is_active DESC, account_type ASC, currency_code ASC, account_code ASC;
    `);

  return result.recordset.map(mapFinanceAccount);
}

export async function createFinanceAccount(payload, actor) {
  assertMelisaWriteEnabled();
  const code = trimText(payload.code || payload.accountCode, 40).toUpperCase();
  const name = trimText(payload.name || payload.accountName, 160);
  const type = normalizeAccountType(payload.type || payload.accountType);
  const currency = normalizeCurrency(payload.currency);
  const openingBalance = Number(payload.openingBalance || 0);

  if (!code || !name) {
    throw makeServiceError('FINANCE_ACCOUNT_REQUIRED', 'Account code and name are required');
  }

  if (!Number.isFinite(openingBalance)) {
    throw makeServiceError('FINANCE_ACCOUNT_OPENING_INVALID', 'Opening balance is invalid');
  }

  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);
  const result = await pool.request()
    .input('newFinanceAccountCode', sql.NVarChar(40), code)
    .input('newFinanceAccountName', sql.NVarChar(160), name)
    .input('newFinanceAccountType', sql.NVarChar(20), type)
    .input('newFinanceAccountCurrency', sql.NVarChar(3), currency)
    .input('newFinanceAccountOpening', sql.Decimal(18, 4), openingBalance)
    .query(`
      INSERT INTO dbo.finance_accounts (
        account_code,
        account_name,
        account_type,
        currency_code,
        opening_balance,
        current_balance
      )
      OUTPUT inserted.*
      VALUES (
        @newFinanceAccountCode,
        @newFinanceAccountName,
        @newFinanceAccountType,
        @newFinanceAccountCurrency,
        @newFinanceAccountOpening,
        @newFinanceAccountOpening
      );
    `);

  const account = mapFinanceAccount(result.recordset[0]);
  await writeAuditLog(pool.request(), {
    actor,
    action: 'finance_account_created',
    entityType: 'finance_account',
    entityId: account.id,
    afterSnapshot: account,
  });

  return account;
}

export async function updateFinanceAccount(accountId, payload, actor) {
  assertMelisaWriteEnabled();
  const id = Number(accountId);
  const name = trimText(payload.name || payload.accountName, 160);
  const isActive = payload.isActive === undefined ? null : Boolean(payload.isActive);

  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('FINANCE_ACCOUNT_ID_INVALID', 'Account id is invalid');
  }

  if (!name && isActive === null) {
    throw makeServiceError('FINANCE_ACCOUNT_UPDATE_EMPTY', 'No account change supplied');
  }

  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);
  const result = await pool.request()
    .input('updateFinanceAccountId', sql.BigInt, id)
    .input('updateFinanceAccountName', sql.NVarChar(160), name || null)
    .input('updateFinanceAccountActive', sql.Bit, isActive === null ? null : isActive ? 1 : 0)
    .query(`
      UPDATE dbo.finance_accounts
      SET account_name = COALESCE(@updateFinanceAccountName, account_name),
          is_active = COALESCE(@updateFinanceAccountActive, is_active),
          updated_at = SYSUTCDATETIME()
      OUTPUT inserted.*
      WHERE id = @updateFinanceAccountId;
    `);

  const row = result.recordset?.[0];
  if (!row) {
    throw makeServiceError('FINANCE_ACCOUNT_NOT_FOUND', 'Finance account not found', 404);
  }

  const account = mapFinanceAccount(row);
  await writeAuditLog(pool.request(), {
    actor,
    action: 'finance_account_updated',
    entityType: 'finance_account',
    entityId: account.id,
    afterSnapshot: account,
  });

  return account;
}

function mapFinanceAccountCleanupRow(row) {
  const account = mapFinanceAccount(row);
  const movementCount = Number(row.movement_count || 0);
  const expectedCode = standardFinanceAccountCode(account.type, account.currency);
  const isStandardCode = account.code === expectedCode;
  const safeToDeactivate = Boolean(
    account.isActive
    && !isStandardCode
    && movementCount === 0
    && Number(account.currentBalance || 0) === 0
  );

  return {
    ...account,
    movementCount,
    expectedCode,
    isStandardCode,
    safeToDeactivate,
    canStandardize: Boolean(account.isActive && !isStandardCode),
    cleanupReason: safeToDeactivate
      ? 'Standart dışı, hareket yok, bakiye sıfır'
      : isStandardCode
        ? 'Standart hesap korunur'
        : movementCount > 0
          ? 'Hareket bağlı olduğu için korunur'
          : Number(account.currentBalance || 0) !== 0
            ? 'Bakiye sıfır olmadığı için korunur'
            : 'Temizlik adayı değil',
  };
}

export async function getFinanceAccountCleanupPreview() {
  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);
  const result = await pool.request().query(`
    SELECT
      fa.*,
      COUNT(fam.id) AS movement_count
    FROM dbo.finance_accounts fa
    LEFT JOIN dbo.finance_account_movements fam ON fam.account_id = fa.id
    GROUP BY
      fa.id,
      fa.account_code,
      fa.account_name,
      fa.account_type,
      fa.currency_code,
      fa.opening_balance,
      fa.current_balance,
      fa.is_active,
      fa.created_at,
      fa.updated_at
    ORDER BY fa.account_type ASC, fa.currency_code ASC, fa.is_active DESC, fa.account_code ASC;
  `);

  const accounts = result.recordset.map(mapFinanceAccountCleanupRow);
  const groups = Object.values(accounts.reduce((grouped, account) => {
    const key = `${account.type}-${account.currency}`;
    grouped[key] = grouped[key] || {
      key,
      type: account.type,
      currency: account.currency,
      expectedCode: account.expectedCode,
      activeCount: 0,
      duplicateCount: 0,
      safeCandidateCount: 0,
      accounts: [],
    };
    grouped[key].accounts.push(account);
    if (account.isActive) grouped[key].activeCount += 1;
    if (account.safeToDeactivate) grouped[key].safeCandidateCount += 1;
    return grouped;
  }, {})).map((group) => ({
    ...group,
    duplicateCount: Math.max(group.activeCount - 1, 0),
  }));

  return {
    groups,
    accounts,
    summary: {
      accountCount: accounts.length,
      activeDuplicateGroups: groups.filter((group) => group.duplicateCount > 0).length,
      activeDuplicateCount: groups.reduce((sum, group) => sum + group.duplicateCount, 0),
      safeCandidateCount: accounts.filter((account) => account.safeToDeactivate).length,
      standardizationCandidateCount: accounts.filter((account) => account.canStandardize).length,
    },
  };
}

export async function applyFinanceAccountCleanup(actor) {
  assertMelisaWriteEnabled();
  const preview = await getFinanceAccountCleanupPreview();
  const candidateIds = preview.accounts
    .filter((account) => account.safeToDeactivate)
    .map((account) => Number(account.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (candidateIds.length === 0) {
    return {
      ...preview,
      deactivatedCount: 0,
      deactivatedAccounts: [],
      message: 'Pasife alınacak güvenli finans hesabı yok',
    };
  }

  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);
  const request = pool.request();
  candidateIds.forEach((id, index) => {
    request.input(`cleanupFinanceAccountId${index}`, sql.BigInt, id);
  });
  const idParams = candidateIds.map((_, index) => `@cleanupFinanceAccountId${index}`).join(', ');
  const result = await request.query(`
    UPDATE dbo.finance_accounts
    SET is_active = 0,
        updated_at = SYSUTCDATETIME()
    OUTPUT inserted.*
    WHERE id IN (${idParams})
      AND is_active = 1
      AND current_balance = 0
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.finance_account_movements fam
        WHERE fam.account_id = dbo.finance_accounts.id
      );
  `);

  const deactivatedAccounts = result.recordset.map(mapFinanceAccount);
  await writeAuditLog(pool.request(), {
    actor,
    action: 'finance_accounts_cleanup_applied',
    entityType: 'finance_account',
    entityId: deactivatedAccounts[0]?.id || null,
    afterSnapshot: {
      deactivatedCount: deactivatedAccounts.length,
      deactivatedAccounts,
    },
  });

  const nextPreview = await getFinanceAccountCleanupPreview();
  return {
    ...nextPreview,
    deactivatedCount: deactivatedAccounts.length,
    deactivatedAccounts,
    message: `${deactivatedAccounts.length} güvenli finans hesabı pasife alındı`,
  };
}

export async function applyFinanceAccountStandardization(actor) {
  assertMelisaWriteEnabled();
  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const sourceResult = await new sqlDriver.Request(transaction).query(`
      SELECT
        fa.*,
        COUNT(fam.id) AS movement_count
      FROM dbo.finance_accounts fa WITH (UPDLOCK, HOLDLOCK)
      LEFT JOIN dbo.finance_account_movements fam ON fam.account_id = fa.id
      WHERE fa.is_active = 1
      GROUP BY
        fa.id,
        fa.account_code,
        fa.account_name,
        fa.account_type,
        fa.currency_code,
        fa.opening_balance,
        fa.current_balance,
        fa.is_active,
        fa.created_at,
        fa.updated_at
      ORDER BY fa.account_type ASC, fa.currency_code ASC, fa.account_code ASC;
    `);

    const sources = sourceResult.recordset
      .map(mapFinanceAccountCleanupRow)
      .filter((account) => account.canStandardize);
    const transferredAccounts = [];

    for (const source of sources) {
      const target = await getOrCreateDefaultFinanceAccount(new sqlDriver.Request(transaction), sqlDriver, {
        accountType: source.type,
        currency: source.currency,
      });

      if (!target?.id || Number(target.id) === Number(source.id)) {
        continue;
      }

      await new sqlDriver.Request(transaction)
        .input('standardizeSourceAccountId', sqlDriver.BigInt, Number(source.id))
        .input('standardizeTargetAccountId', sqlDriver.BigInt, Number(target.id))
        .input('standardizeOpeningBalance', sqlDriver.Decimal(18, 4), Number(source.openingBalance || 0))
        .input('standardizeCurrentBalance', sqlDriver.Decimal(18, 4), Number(source.currentBalance || 0))
        .query(`
          UPDATE dbo.finance_account_movements
          SET account_id = @standardizeTargetAccountId
          WHERE account_id = @standardizeSourceAccountId;

          UPDATE dbo.finance_accounts
          SET opening_balance = opening_balance + @standardizeOpeningBalance,
              current_balance = current_balance + @standardizeCurrentBalance,
              is_active = 1,
              updated_at = SYSUTCDATETIME()
          WHERE id = @standardizeTargetAccountId;

          UPDATE dbo.finance_accounts
          SET opening_balance = 0,
              current_balance = 0,
              is_active = 0,
              updated_at = SYSUTCDATETIME()
          WHERE id = @standardizeSourceAccountId;
        `);

      transferredAccounts.push({
        sourceAccountId: source.id,
        sourceCode: source.code,
        targetAccountId: target.id,
        targetCode: target.code,
        movementCount: source.movementCount,
        transferredBalance: source.currentBalance,
        currency: source.currency,
      });
    }

    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'finance_accounts_standardized',
      entityType: 'finance_account',
      entityId: transferredAccounts[0]?.sourceAccountId || null,
      afterSnapshot: {
        transferredCount: transferredAccounts.length,
        transferredAccounts,
      },
    });

    await transaction.commit();
    const nextPreview = await getFinanceAccountCleanupPreview();
    return {
      ...nextPreview,
      transferredCount: transferredAccounts.length,
      transferredAccounts,
      message: `${transferredAccounts.length} finans hesabı standart hesaba aktarıldı`,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function getFinanceMovements(query = {}) {
  const search = trimText(query.search, 120);
  const partyType = trimText(query.partyType, 20).toLowerCase();
  const movementType = trimText(query.movementType, 40).toLowerCase();
  const accountType = trimText(query.accountType, 20).toLowerCase();
  const paymentMethod = trimText(query.paymentMethod, 20).toLowerCase();
  const currency = trimText(query.currency, 3).toUpperCase();
  const accountId = Number(query.accountId || 0);
  const dateFrom = normalizeOptionalDate(query.dateFrom);
  const dateTo = normalizeOptionalDate(query.dateTo);
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 200);
  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);

  if (partyType && !['customer', 'supplier'].includes(partyType)) {
    throw makeServiceError('FINANCE_PARTY_TYPE_INVALID', 'partyType must be customer or supplier');
  }

  if (movementType && !MOVEMENT_TYPES.has(movementType)) {
    throw makeServiceError('FINANCE_MOVEMENT_TYPE_INVALID', 'movementType is invalid');
  }

  if (accountType && !ACCOUNT_TYPES.has(accountType)) {
    throw makeServiceError('FINANCE_ACCOUNT_TYPE_INVALID', 'accountType is invalid');
  }

  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) {
    throw makeServiceError('FINANCE_PAYMENT_METHOD_INVALID', 'paymentMethod is invalid');
  }

  if (currency && !VALID_CURRENCIES.has(currency)) {
    throw makeServiceError('FINANCE_CURRENCY_INVALID', 'Currency must be TRY, USD or EUR');
  }

  const result = await pool.request()
    .input('search', sql.NVarChar(120), search ? `%${search}%` : null)
    .input('partyType', sql.NVarChar(20), partyType || null)
    .input('movementType', sql.NVarChar(40), movementType || null)
    .input('accountId', sql.BigInt, Number.isInteger(accountId) && accountId > 0 ? accountId : null)
    .input('accountType', sql.NVarChar(20), accountType || null)
    .input('paymentMethod', sql.NVarChar(20), paymentMethod || null)
    .input('currency', sql.NVarChar(3), currency || null)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .query(`
      WITH finance_rows AS (
        SELECT
          cm.id,
          N'customer' AS party_type,
          cm.customer_id AS party_id,
          c.customer_code AS party_code,
          c.name AS party_name,
          cm.movement_type,
          cm.sales_invoice_id,
          CAST(NULL AS bigint) AS purchase_invoice_id,
          COALESCE(si.document_no, CONCAT(N'TH-', cm.id)) AS document_no,
          cm.amount,
          cm.currency_code,
          cm.balance_effect,
          cm.document_date,
          cm.created_at,
          cm.created_by,
          fam.account_id,
          fa.account_code,
          fa.account_name,
          fa.account_type,
          fam.payment_method
        FROM dbo.customer_movements cm
        INNER JOIN dbo.customers c ON c.id = cm.customer_id
        LEFT JOIN dbo.sales_invoices si ON si.id = cm.sales_invoice_id
        LEFT JOIN dbo.finance_account_movements fam ON fam.source_type = N'collection' AND fam.party_type = N'customer' AND fam.party_movement_id = cm.id
        LEFT JOIN dbo.finance_accounts fa ON fa.id = fam.account_id
        WHERE cm.movement_type IN (N'collection', N'sales_invoice', N'sales_invoice_cancel')
          AND NOT (
            c.customer_code LIKE N'QA-%'
            OR c.customer_code LIKE N'CUS-QA-%'
            OR c.customer_code LIKE N'AKIS-%'
            OR c.customer_code LIKE N'TEST%'
            OR c.customer_code LIKE N'IMP-%'
            OR c.name LIKE N'QA %'
            OR c.name LIKE N'AKIS %'
            OR c.name LIKE N'TEST %'
            OR c.name LIKE N'Import Test%'
          )
          AND (
            cm.sales_invoice_id IS NULL
            OR (
              LOWER(ISNULL(si.status, N'')) <> N'archived_test'
              AND ISNULL(si.document_no, N'') NOT LIKE N'QA-%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'S-QA-%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'QAS-%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'AKIS-%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'TEST%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'DBG%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'ERP_%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'S-TST-%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'SDR-%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'SF-FIN-TEST-%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'SAVG-%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'SNEG-%'
              AND ISNULL(si.document_no, N'') NOT LIKE N'TERM-TEST%'
              AND COALESCE(si.description, N'') NOT LIKE N'%QA E2E%'
            )
          )

        UNION ALL

        SELECT
          sm.id,
          N'supplier' AS party_type,
          sm.supplier_id AS party_id,
          s.supplier_code AS party_code,
          s.name AS party_name,
          sm.movement_type,
          CAST(NULL AS bigint) AS sales_invoice_id,
          sm.purchase_invoice_id,
          COALESCE(pi.document_no, CONCAT(N'OD-', sm.id)) AS document_no,
          sm.amount,
          sm.currency_code,
          sm.balance_effect,
          sm.document_date,
          sm.created_at,
          sm.created_by,
          fam.account_id,
          fa.account_code,
          fa.account_name,
          fa.account_type,
          fam.payment_method
        FROM dbo.supplier_movements sm
        INNER JOIN dbo.suppliers s ON s.id = sm.supplier_id
        LEFT JOIN dbo.purchase_invoices pi ON pi.id = sm.purchase_invoice_id
        LEFT JOIN dbo.finance_account_movements fam ON fam.source_type = N'payment' AND fam.party_type = N'supplier' AND fam.party_movement_id = sm.id
        LEFT JOIN dbo.finance_accounts fa ON fa.id = fam.account_id
        WHERE sm.movement_type IN (N'payment', N'purchase_invoice', N'purchase_invoice_cancel')
          AND NOT (
            s.supplier_code LIKE N'QA-%'
            OR s.supplier_code LIKE N'SUP-QA-%'
            OR s.supplier_code LIKE N'AKIS-%'
            OR s.supplier_code LIKE N'TEST%'
            OR s.supplier_code LIKE N'DRAFT-%'
            OR s.supplier_code LIKE N'IMP-%'
            OR s.name LIKE N'QA %'
            OR s.name LIKE N'AKIS %'
            OR s.name LIKE N'TEST %'
            OR s.name LIKE N'%Draft Supplier%'
          )
          AND (
            sm.purchase_invoice_id IS NULL
            OR (
              LOWER(ISNULL(pi.status, N'')) <> N'archived_test'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'QA-%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'P-QA-%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'QAP-%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'AKIS-%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'TEST%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'DBG%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'ERP_%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'P-TST-%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'PAVG-%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'PDR-%'
              AND ISNULL(pi.document_no, N'') NOT LIKE N'AF-FIN-TEST-%'
              AND COALESCE(pi.description, N'') NOT LIKE N'%QA E2E%'
            )
          )
      )
      SELECT TOP (${limit}) *
      FROM finance_rows
      WHERE
        (@partyType IS NULL OR party_type = @partyType)
        AND (@movementType IS NULL OR movement_type = @movementType)
        AND (@accountId IS NULL OR account_id = @accountId)
        AND (@accountType IS NULL OR account_type = @accountType)
        AND (@paymentMethod IS NULL OR payment_method = @paymentMethod)
        AND (@currency IS NULL OR currency_code = @currency)
        AND (@dateFrom IS NULL OR document_date >= @dateFrom)
        AND (@dateTo IS NULL OR document_date <= @dateTo)
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

export async function getFinanceJournal(query = {}) {
  const movements = await getFinanceMovements({
    ...query,
    limit: Math.min(Math.max(Number(query.limit || 150), 1), 300),
  });
  const lines = movements.flatMap(buildJournalLines);
  const summary = lines.reduce((total, line) => ({
    debit: total.debit + Number(line.debit || 0),
    credit: total.credit + Number(line.credit || 0),
    lineCount: total.lineCount + 1,
    movementCount: movements.length,
  }), {
    debit: 0,
    credit: 0,
    lineCount: 0,
    movementCount: movements.length,
  });

  return {
    rows: lines,
    summary: {
      ...summary,
      difference: Number((summary.debit - summary.credit).toFixed(4)),
      balanced: Math.abs(summary.debit - summary.credit) < 0.0001,
    },
    filters: {
      search: trimText(query.search, 120) || null,
      partyType: trimText(query.partyType, 20).toLowerCase() || null,
      movementType: trimText(query.movementType, 40).toLowerCase() || null,
      dateFrom: normalizeOptionalDate(query.dateFrom),
      dateTo: normalizeOptionalDate(query.dateTo),
    },
  };
}

function makeControlCheck({ id, title, status, severity, metric, message, actionScreen = null }) {
  return { id, title, status, severity, metric, message, actionScreen };
}

function makeFixedDocumentNo(kind, row) {
  const prefix = kind === 'purchase' ? 'AF' : 'SF';
  const rawDate = row.document_date ? new Date(row.document_date) : new Date();
  const stamp = Number.isNaN(rawDate.getTime())
    ? new Date().toISOString().slice(0, 10).replaceAll('-', '')
    : [
      rawDate.getUTCFullYear(),
      String(rawDate.getUTCMonth() + 1).padStart(2, '0'),
      String(rawDate.getUTCDate()).padStart(2, '0'),
    ].join('');
  return `${prefix}-${stamp}-${String(Number(row.id || 0)).padStart(6, '0')}`;
}

function mapDocumentNumberFixRow(kind, row) {
  return {
    kind,
    id: Number(row.id),
    oldDocumentNo: row.document_no || 'Taslak',
    newDocumentNo: makeFixedDocumentNo(kind, row),
    documentDate: row.document_date,
    partyName: row.party_name || '-',
    currency: row.currency_code || 'TRY',
    totalAmount: Number(row.grand_total || 0),
  };
}

async function getDocumentNumberFixRows(request = null) {
  const pool = request ? null : await getSqlPool();
  const queryRequest = request || pool.request();
  const result = await queryRequest.query(`
    SELECT
      N'sales' AS kind,
      si.id,
      si.document_no,
      si.document_date,
      c.name AS party_name,
      si.customer_currency AS currency_code,
      si.grand_total
    FROM dbo.sales_invoices si
    LEFT JOIN dbo.customers c ON c.id = si.customer_id
    WHERE LOWER(ISNULL(si.status, N'')) = N'finalized'
      AND (si.document_no IS NULL OR LTRIM(RTRIM(si.document_no)) = N'' OR si.document_no = N'Taslak')

    UNION ALL

    SELECT
      N'purchase' AS kind,
      pi.id,
      pi.document_no,
      pi.document_date,
      s.name AS party_name,
      pi.supplier_currency AS currency_code,
      pi.grand_total
    FROM dbo.purchase_invoices pi
    LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
    WHERE LOWER(ISNULL(pi.status, N'')) = N'finalized'
      AND (pi.document_no IS NULL OR LTRIM(RTRIM(pi.document_no)) = N'' OR pi.document_no = N'Taslak')
    ORDER BY kind, document_date, id;
  `);

  return result.recordset.map((row) => mapDocumentNumberFixRow(row.kind, row));
}

export async function getDocumentNumberFixPreview() {
  const rows = await getDocumentNumberFixRows();
  const salesCount = rows.filter((row) => row.kind === 'sales').length;
  const purchaseCount = rows.filter((row) => row.kind === 'purchase').length;

  return {
    rows,
    summary: {
      totalCount: rows.length,
      salesCount,
      purchaseCount,
      canApply: rows.length > 0,
    },
    rules: [
      'Sadece kesinlesmis ve belge numarasi bos/Taslak olan fisler duzeltilir.',
      'Taslak fislere, stok hareketlerine, cari hareketlere ve yevmiyeye dokunulmaz.',
      'Yeni belge no fis tarihi ve kayit id ile tekil uretilir.',
    ],
  };
}

export async function applyDocumentNumberFix(actor) {
  assertMelisaWriteEnabled();

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const rows = await getDocumentNumberFixRows(new sqlDriver.Request(transaction));
    const appliedRows = [];

    for (const row of rows) {
      const tableName = row.kind === 'purchase' ? 'purchase_invoices' : 'sales_invoices';
      await new sqlDriver.Request(transaction)
        .input('invoiceId', sqlDriver.BigInt, row.id)
        .input('documentNo', sqlDriver.NVarChar(60), row.newDocumentNo)
        .query(`
          UPDATE dbo.${tableName}
          SET document_no = @documentNo,
              updated_at = SYSUTCDATETIME()
          WHERE id = @invoiceId
            AND LOWER(ISNULL(status, N'')) = N'finalized'
            AND (document_no IS NULL OR LTRIM(RTRIM(document_no)) = N'' OR document_no = N'Taslak');
        `);
      appliedRows.push(row);
    }

    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'invoice_document_numbers_fixed',
      entityType: 'invoice_maintenance',
      entityId: appliedRows[0]?.id || null,
      afterSnapshot: {
        fixedCount: appliedRows.length,
        rows: appliedRows,
      },
    });

    await transaction.commit();
    const nextPreview = await getDocumentNumberFixPreview();
    return {
      ...nextPreview,
      fixedCount: appliedRows.length,
      fixedRows: appliedRows,
      message: `${appliedRows.length} kesin fis belge numarasi duzeltildi`,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function getAccountingControlDashboard() {
  const [financeSummary, journal, accountPreview] = await Promise.all([
    getFinanceSummary(),
    getFinanceJournal({ limit: 200 }),
    getFinanceAccountCleanupPreview(),
  ]);
  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);
  const issueResult = await pool.request().query(`
    WITH issue_rows AS (
      SELECT
        N'negative_finance_account' AS issue_type,
        fa.id AS entity_id,
        fa.account_code AS entity_code,
        fa.account_name AS entity_name,
        fa.account_type AS entity_group,
        fa.currency_code AS currency_code,
        fa.current_balance AS amount,
        N'Kasa/banka hesabı negatif bakiyede' AS message
      FROM dbo.finance_accounts fa
      WHERE fa.is_active = 1 AND fa.current_balance < 0

      UNION ALL

      SELECT
        N'passive_account_has_movement' AS issue_type,
        fa.id AS entity_id,
        fa.account_code AS entity_code,
        fa.account_name AS entity_name,
        fa.account_type AS entity_group,
        fa.currency_code AS currency_code,
        COUNT_BIG(fam.id) AS amount,
        N'Pasif hesapta hareket izi var' AS message
      FROM dbo.finance_accounts fa
      INNER JOIN dbo.finance_account_movements fam ON fam.account_id = fa.id
      WHERE fa.is_active = 0
      GROUP BY fa.id, fa.account_code, fa.account_name, fa.account_type, fa.currency_code

      UNION ALL

      SELECT
        N'finalized_sales_draft_no' AS issue_type,
        si.id AS entity_id,
        COALESCE(si.document_no, N'-') AS entity_code,
        COALESCE(c.name, N'-') AS entity_name,
        N'sales' AS entity_group,
        si.customer_currency AS currency_code,
        si.grand_total AS amount,
        N'Kesinleşmiş satış fişinde belge no Taslak görünüyor' AS message
      FROM dbo.sales_invoices si
      LEFT JOIN dbo.customers c ON c.id = si.customer_id
      WHERE LOWER(ISNULL(si.status, N'')) = N'finalized'
        AND (si.document_no IS NULL OR si.document_no = N'' OR si.document_no = N'Taslak')

      UNION ALL

      SELECT
        N'finalized_purchase_draft_no' AS issue_type,
        pi.id AS entity_id,
        COALESCE(pi.document_no, N'-') AS entity_code,
        COALESCE(s.name, N'-') AS entity_name,
        N'purchase' AS entity_group,
        pi.supplier_currency AS currency_code,
        pi.grand_total AS amount,
        N'Kesinleşmiş alış fişinde belge no Taslak görünüyor' AS message
      FROM dbo.purchase_invoices pi
      LEFT JOIN dbo.suppliers s ON s.id = pi.supplier_id
      WHERE LOWER(ISNULL(pi.status, N'')) = N'finalized'
        AND (pi.document_no IS NULL OR pi.document_no = N'' OR pi.document_no = N'Taslak')
    )
    SELECT TOP (80) *
    FROM issue_rows
    ORDER BY
      CASE issue_type
        WHEN N'negative_finance_account' THEN 1
        WHEN N'finalized_sales_draft_no' THEN 2
        WHEN N'finalized_purchase_draft_no' THEN 3
        ELSE 4
      END,
      amount ASC;
  `);

  const issues = issueResult.recordset.map((row) => ({
    type: row.issue_type,
    entityId: Number(row.entity_id),
    entityCode: row.entity_code,
    entityName: row.entity_name,
    group: row.entity_group,
    currency: row.currency_code,
    amount: Number(row.amount || 0),
    message: row.message,
    severity: row.issue_type === 'passive_account_has_movement' ? 'warning' : 'danger',
    actionScreen: row.issue_type.includes('sales')
      ? 'sales-invoice'
      : row.issue_type.includes('purchase')
        ? 'purchase-invoice'
        : 'cash-bank-ledger',
    actionPayload: row.issue_type.includes('sales')
      ? { salesDraftId: Number(row.entity_id), invoiceNo: row.entity_code }
      : row.issue_type.includes('purchase')
        ? { purchaseDraftId: Number(row.entity_id), invoiceNo: row.entity_code }
        : { accountId: Number(row.entity_id) },
  }));

  const dangerCount = issues.filter((issue) => issue.severity === 'danger').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length
    + Number(accountPreview.summary.activeDuplicateCount || 0)
    + Number(accountPreview.summary.standardizationCandidateCount || 0);
  const checks = [
    makeControlCheck({
      id: 'journal_balance',
      title: 'Borç / Alacak Dengesi',
      status: journal.summary.balanced ? 'OK' : 'RISK',
      severity: journal.summary.balanced ? 'success' : 'danger',
      metric: journal.summary.balanced ? 'Dengeli' : `Fark ${journal.summary.difference}`,
      message: journal.summary.balanced ? 'Yevmiye borç ve alacak toplamı dengeli.' : 'Yevmiye borç/alacak toplamında fark var.',
      actionScreen: 'accounting-journal',
    }),
    makeControlCheck({
      id: 'negative_finance',
      title: 'Negatif Kasa / Banka',
      status: issues.some((issue) => issue.type === 'negative_finance_account') ? 'RISK' : 'OK',
      severity: issues.some((issue) => issue.type === 'negative_finance_account') ? 'danger' : 'success',
      metric: `${issues.filter((issue) => issue.type === 'negative_finance_account').length} hesap`,
      message: 'Aktif kasa/banka hesaplarında negatif bakiye kontrolü.',
      actionScreen: 'cash-bank-ledger',
    }),
    makeControlCheck({
      id: 'finance_accounts_standard',
      title: 'Finans Hesap Standardı',
      status: accountPreview.summary.activeDuplicateCount || accountPreview.summary.standardizationCandidateCount ? 'WARN' : 'OK',
      severity: accountPreview.summary.activeDuplicateCount || accountPreview.summary.standardizationCandidateCount ? 'warning' : 'success',
      metric: `${accountPreview.summary.activeDuplicateCount || 0} mükerrer / ${accountPreview.summary.standardizationCandidateCount || 0} aktarım adayı`,
      message: 'KASA/BANKA/POS hesap standardı ve mükerrer aktif hesap kontrolü.',
      actionScreen: 'cash-bank-ledger',
    }),
    makeControlCheck({
      id: 'draft_document_no',
      title: 'Kesin Fiş Belge No',
      status: issues.some((issue) => issue.type === 'finalized_sales_draft_no' || issue.type === 'finalized_purchase_draft_no') ? 'RISK' : 'OK',
      severity: issues.some((issue) => issue.type === 'finalized_sales_draft_no' || issue.type === 'finalized_purchase_draft_no') ? 'danger' : 'success',
      metric: `${issues.filter((issue) => issue.type === 'finalized_sales_draft_no' || issue.type === 'finalized_purchase_draft_no').length} fiş`,
      message: 'Kesinleşmiş fişlerde Taslak belge no kalmaması gerekir.',
      actionScreen: 'sales-invoice-list',
    }),
  ];

  const totalRisk = dangerCount + warningCount;
  return {
    summary: {
      status: dangerCount > 0 ? 'RISK' : warningCount > 0 ? 'WARN' : 'OK',
      healthScore: Math.max(0, 100 - dangerCount * 12 - warningCount * 5),
      dangerCount,
      warningCount,
      issueCount: issues.length,
      journalBalanced: journal.summary.balanced,
      journalDifference: journal.summary.difference,
      financeTryBalance: financeSummary.financeTryBalance,
      activeDuplicateCount: accountPreview.summary.activeDuplicateCount,
      standardizationCandidateCount: accountPreview.summary.standardizationCandidateCount,
      totalRisk,
    },
    checks,
    issues,
    financeSummary,
    journalSummary: journal.summary,
    accountCleanupSummary: accountPreview.summary,
  };
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
  await ensureFinanceAccountTables(pool);
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), documentDate, 'Tahsilat kaydı');

    const account = await resolveFinanceAccount(transaction, sqlDriver, {
      accountId: payload.accountId,
      paymentMethod,
      currency,
    });

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
    const updatedAccount = await writeFinanceAccountMovement(transaction, sqlDriver, {
      account,
      sourceType: 'collection',
      partyType: 'customer',
      partyMovementId: movement.id,
      amount,
      currency,
      paymentMethod,
      documentNo: `TH-${movement.id}`,
      documentDate,
      description,
      actor,
    });

    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'customer_collection_created',
      entityType: 'customer_movement',
      entityId: movement?.id,
      afterSnapshot: { customerId, amount, currency, paymentMethod, documentDate, description, accountId: account.id },
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
      account: updatedAccount,
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
  const description = trimText(payload.description || `Ödeme - ${paymentMethod}`, 500);

  if (!Number.isInteger(supplierId) || supplierId < 1) {
    throw makeServiceError('FINANCE_SUPPLIER_INVALID', 'Supplier is required');
  }

  const pool = await getSqlPool();
  await ensureFinanceAccountTables(pool);
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), documentDate, 'Ödeme kaydı');

    const account = await resolveFinanceAccount(transaction, sqlDriver, {
      accountId: payload.accountId,
      paymentMethod,
      currency,
    });

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
    const updatedAccount = await writeFinanceAccountMovement(transaction, sqlDriver, {
      account,
      sourceType: 'payment',
      partyType: 'supplier',
      partyMovementId: movement.id,
      amount,
      currency,
      paymentMethod,
      documentNo: `OD-${movement.id}`,
      documentDate,
      description,
      actor,
    });

    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'supplier_payment_created',
      entityType: 'supplier_movement',
      entityId: movement?.id,
      afterSnapshot: { supplierId, amount, currency, paymentMethod, documentDate, description, accountId: account.id },
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
      account: updatedAccount,
      documentDate,
      paymentMethod,
      description,
      message: 'Ödeme kaydedildi',
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
