import { getSqlDriver } from '../config/database.js';
import { calculateCurrencySettlement } from './currencySettlement.mjs';

const TABLES = Object.freeze({ sales: 'sales_invoices', purchase: 'purchase_invoices', customer: 'customer_movements', supplier: 'supplier_movements' });
const required = (table) => ['account_currency', 'account_amount', 'account_exchange_rate_snapshot', ...(['customer_movements', 'supplier_movements'].includes(table) ? ['document_exchange_rate_snapshot', 'amount_try'] : [])];
const error = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
function tableFor(kind) { if (!Object.hasOwn(TABLES, kind)) throw error('CURRENCY_SNAPSHOT_KIND_INVALID', 'Geçersiz cari snapshot türü.', 400); return TABLES[kind]; }

export async function hasCurrencySnapshotSchema(request, kind) {
  const table = tableFor(kind);
  const result = await request.query(`SELECT CASE WHEN ${required(table).map((column) => `COL_LENGTH(N'dbo.${table}', N'${column}') IS NOT NULL`).join(' AND ')} THEN 1 ELSE 0 END AS currency_snapshot_ready;`);
  return result.recordset?.[0]?.currency_snapshot_ready === 1;
}

export async function assertCurrencySnapshotSchema(request, kind) {
  if (!await hasCurrencySnapshotSchema(request, kind)) throw error('CURRENCY_SNAPSHOT_SCHEMA_REQUIRED', 'Çapraz döviz kur/tutar kayıtları için 0019 kaynak geçişinin ayrıca onaylanıp kurulması gerekir.', 503);
}

export async function assertPartyCurrencyUnchanged(request, kind, id, nextCurrency) {
  if (!['customer', 'supplier'].includes(kind)) throw error('CURRENCY_SNAPSHOT_KIND_INVALID', 'Cari türü geçersiz.', 400);
  const sql = getSqlDriver();
  const table = kind === 'customer' ? 'customers' : 'suppliers';
  const row = (await request.input('fixedCurrencyPartyId', sql.BigInt, id).query(`SELECT currency_code FROM dbo.${table} WITH(UPDLOCK,HOLDLOCK) WHERE id=@fixedCurrencyPartyId AND is_deleted=0;`)).recordset?.[0];
  if (!row || row.currency_code !== nextCurrency) throw error('PARTY_CURRENCY_IMMUTABLE', 'Cari kartının para birimi sabittir. Başka dövizle işlem fiş üzerinde iki kur ile yapılır.');
}

export async function resolveCurrencySettlement(request, input) {
  const rates = { TRY: 1 };
  for (const [code, value] of [[input.documentCurrency, input.documentRateToTry], [input.accountCurrency, input.accountRateToTry]]) {
    if (code === 'TRY' && value != null && value !== '' && Number(value) !== 1) throw error('CURRENCY_SETTLEMENT_INVALID', 'TRY kuru 1 olmalıdır.', 400);
  }
  const missingDocument = input.documentCurrency !== 'TRY' && (input.documentRateToTry == null || input.documentRateToTry === '');
  const missingAccount = input.accountCurrency !== 'TRY' && input.accountCurrency !== input.documentCurrency && (input.accountRateToTry == null || input.accountRateToTry === '');
  if (missingDocument || missingAccount) {
    const sql = getSqlDriver();
    const result = await request.input('settlementRateDate', sql.Date, input.documentDate).query(`
      WITH dated_rates AS (
        SELECT currency_code, rate_to_try, ROW_NUMBER() OVER (PARTITION BY currency_code ORDER BY rate_date DESC, id DESC) AS row_number
        FROM dbo.currency_rates WHERE rate_date <= @settlementRateDate AND currency_code IN (N'USD', N'EUR')
      ) SELECT currency_code, rate_to_try FROM dated_rates WHERE row_number = 1;
    `);
    for (const row of result.recordset || []) rates[row.currency_code] = Number(row.rate_to_try);
  }
  const documentRate = input.documentCurrency === 'TRY' ? 1 : missingDocument ? rates[input.documentCurrency] : input.documentRateToTry;
  const accountRate = input.accountCurrency === 'TRY' ? 1 : input.accountCurrency === input.documentCurrency
    ? (input.accountRateToTry == null || input.accountRateToTry === '' ? documentRate : input.accountRateToTry)
    : missingAccount ? rates[input.accountCurrency] : input.accountRateToTry;
  if (!Number.isFinite(Number(documentRate)) || Number(documentRate) <= 0 || !Number.isFinite(Number(accountRate)) || Number(accountRate) <= 0) {
    throw error('CURRENCY_SETTLEMENT_RATE_REQUIRED', 'İşlem tarihinde geçerli kur eksik. İşlem ve cari dövizinin TRY kurunu girin.', 400);
  }
  return calculateCurrencySettlement({ ...input, documentRateToTry: documentRate, accountRateToTry: accountRate });
}

export async function readInvoiceCurrencySnapshot(request, kind, id) {
  const table = tableFor(kind);
  if (!['sales', 'purchase'].includes(kind)) throw error('CURRENCY_SNAPSHOT_KIND_INVALID', 'Fiş türü geçersiz.', 400);
  if (!await hasCurrencySnapshotSchema(request, kind)) return { accountCurrency: null, accountAmount: null, accountExchangeRate: null };
  const sql = getSqlDriver();
  const row = (await request.input('currencySnapshotInvoiceId', sql.BigInt, id).query(`SELECT account_currency, account_amount, account_exchange_rate_snapshot FROM dbo.${table} WHERE id = @currencySnapshotInvoiceId;`)).recordset?.[0];
  return { accountCurrency: row?.account_currency || null, accountAmount: row?.account_amount == null ? null : Number(row.account_amount), accountExchangeRate: row?.account_exchange_rate_snapshot == null ? null : Number(row.account_exchange_rate_snapshot) };
}

export async function writeInvoiceCurrencySnapshot(request, kind, id, snapshot) {
  const table = tableFor(kind);
  if (!['sales', 'purchase'].includes(kind)) throw error('CURRENCY_SNAPSHOT_KIND_INVALID', 'Fiş türü geçersiz.', 400);
  const sql = getSqlDriver();
  await request.input('currencyInvoiceId', sql.BigInt, id)
    .input('currencyAccountCode', sql.NVarChar(3), snapshot.accountCurrency)
    .input('currencyAccountAmount', sql.Decimal(18, 4), snapshot.accountAmount)
    .input('currencyAccountRate', sql.Decimal(18, 8), snapshot.accountRateToTry)
    .query(`UPDATE dbo.${table} SET account_currency=@currencyAccountCode, account_amount=@currencyAccountAmount, account_exchange_rate_snapshot=@currencyAccountRate WHERE id=@currencyInvoiceId;`);
}

export async function writeMovementCurrencySnapshot(request, kind, id, snapshot, balanceEffect) {
  const table = tableFor(kind);
  if (!['customer', 'supplier'].includes(kind)) throw error('CURRENCY_SNAPSHOT_KIND_INVALID', 'Cari hareket türü geçersiz.', 400);
  const sql = getSqlDriver();
  await request.input('currencyMovementId', sql.BigInt, id)
    .input('currencyAccountCode', sql.NVarChar(3), snapshot.accountCurrency)
    .input('currencyAccountAmount', sql.Decimal(18, 4), snapshot.accountAmount)
    .input('currencyDocumentRate', sql.Decimal(18, 8), snapshot.documentRateToTry)
    .input('currencyAccountRate', sql.Decimal(18, 8), snapshot.accountRateToTry)
    .input('currencyAmountTry', sql.Decimal(18, 4), snapshot.amountTry)
    .input('currencyBalanceEffect', sql.Decimal(18, 4), balanceEffect)
    .query(`UPDATE dbo.${table} SET account_currency=@currencyAccountCode, account_amount=@currencyAccountAmount, document_exchange_rate_snapshot=@currencyDocumentRate,
      account_exchange_rate_snapshot=@currencyAccountRate, amount_try=@currencyAmountTry, balance_effect=@currencyBalanceEffect WHERE id=@currencyMovementId;`);
}

export async function hasMovementReturnSchema(request, kind) {
  if (!['customer', 'supplier'].includes(kind)) throw error('CURRENCY_SNAPSHOT_KIND_INVALID', 'Cari hareket türü geçersiz.', 400);
  return (await request.query(`SELECT CASE WHEN COL_LENGTH(N'dbo.${tableFor(kind)}',N'invoice_return_id') IS NOT NULL THEN 1 ELSE 0 END AS return_ready;`)).recordset?.[0]?.return_ready === 1;
}

export function movementCurrencyColumns(alias, ready, returnReady = false) {
  const currencyColumns = ready ? `${alias}.account_currency, ${alias}.account_amount, ${alias}.document_exchange_rate_snapshot, ${alias}.account_exchange_rate_snapshot, ${alias}.amount_try`
    : 'CAST(NULL AS nvarchar(3)) AS account_currency, CAST(NULL AS decimal(18,4)) AS account_amount, CAST(NULL AS decimal(18,8)) AS document_exchange_rate_snapshot, CAST(NULL AS decimal(18,8)) AS account_exchange_rate_snapshot, CAST(NULL AS decimal(18,4)) AS amount_try';
  return `${currencyColumns}, ${returnReady ? `${alias}.invoice_return_id` : 'CAST(NULL AS bigint) AS invoice_return_id'}`;
}

export function movementCurrencyDto(row, currentCurrency) {
  const legacySameCurrency = row.currency_code === currentCurrency;
  const accountCurrency = row.account_currency || (legacySameCurrency ? currentCurrency : null);
  const known = Boolean(accountCurrency) && (row.account_amount != null || legacySameCurrency);
  return {
    invoiceReturnId: row.invoice_return_id == null ? null : Number(row.invoice_return_id),
    ...(['sales_return', 'sales_return_cancel', 'purchase_return', 'purchase_return_cancel'].includes(row.movement_type) ? {
      targetScreen: row.invoice_return_id == null ? null : row.movement_type.startsWith('sales_') ? 'sales-invoice-list' : 'purchase-invoice-list',
      targetId: row.invoice_return_id == null ? null : Number(row.invoice_return_id),
      targetPayload: row.invoice_return_id == null ? null : { returnId: Number(row.invoice_return_id) },
      documentKind: 'invoice_return',
      documentNo: row.invoice_return_id == null ? '-' : `IADE-${row.invoice_return_id}`,
    } : {}),
    accountCurrency,
    accountAmount: row.account_amount == null ? (legacySameCurrency && row.amount != null ? Number(row.amount) : null) : Number(row.account_amount),
    accountExchangeRate: row.account_exchange_rate_snapshot == null ? null : Number(row.account_exchange_rate_snapshot),
    exchangeRate: row.document_exchange_rate_snapshot == null ? null : Number(row.document_exchange_rate_snapshot),
    amountTry: row.amount_try == null ? (row.currency_code === 'TRY' && row.amount != null ? Number(row.amount) : null) : Number(row.amount_try),
    balanceEffect: known && row.balance_effect != null ? Number(row.balance_effect) : null,
    settlementKnown: known,
  };
}
