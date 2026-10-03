import { currencyPreview } from '../../utils/currencyPreview.js';

const knownRejections = new Set([
  'FINANCE_AMOUNT_INVALID', 'FINANCE_CURRENCY_INVALID', 'FINANCE_PAYMENT_METHOD_INVALID',
  'FINANCE_CUSTOMER_INVALID', 'FINANCE_CUSTOMER_NOT_FOUND', 'FINANCE_SUPPLIER_INVALID', 'FINANCE_SUPPLIER_NOT_FOUND',
  'FINANCE_ACCOUNT_NOT_FOUND', 'FINANCE_ACCOUNT_CURRENCY_MISMATCH', 'DAILY_WEB_CURRENCY_UNSUPPORTED',
  'SQL_WRITE_DISABLED', 'SQL_WRITE_TARGET_INVALID',
  'ACCOUNTING_PERIOD_LOCKED',
]);
// These four 400 errors are emitted before any finance/account movement write.
const currencyValidationRejections = new Set([
  'CURRENCY_SETTLEMENT_INVALID', 'CURRENCY_SETTLEMENT_RATE_REQUIRED',
  'CURRENCY_SETTLEMENT_RATE_MISMATCH', 'CURRENCY_SETTLEMENT_OVERFLOW',
]);
const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const closeAmount = (actual, expected, tolerance = 0.00005) => typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) < tolerance;
const settlementFields = ['accountCurrency', 'accountAmount', 'exchangeRate', 'accountExchangeRate', 'amountTry'];
const hasSettlement = record => settlementFields.some(field => Object.hasOwn(record, field));
function validSettlement(record) {
  if (!settlementFields.every(field => Object.hasOwn(record, field))) return false;
  const preview = currencyPreview({ amount: record.amount, currency: record.currency, accountCurrency: record.accountCurrency,
    exchangeRate: record.exchangeRate, accountExchangeRate: record.accountExchangeRate });
  return preview.valid && closeAmount(record.accountAmount, preview.settlement.accountAmount)
    && closeAmount(record.amountTry, preview.settlement.amountTry);
}
function browserReviewId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function financeReviewKey(apiBaseUrl, userId) {
  return typeof apiBaseUrl === 'string' && apiBaseUrl && positiveId(userId)
    ? `melisa-finance-review-v1:${apiBaseUrl}:${userId}` : null;
}

export function readFinanceReview(storage, key) {
  if (!key) return { unavailable: true };
  let serialized;
  try {
    serialized = storage.getItem(key);
    if (serialized === null) return null;
    const record = JSON.parse(serialized);
    if (record?.version !== 1 || typeof record.id !== 'string' || !record.id
      || !['collection', 'payment'].includes(record.mode) || !positiveId(record.partyId)
      || typeof record.partyLabel !== 'string' || typeof record.documentDate !== 'string'
      || !Number.isFinite(record.amount) || record.amount <= 0 || !['TRY', 'USD', 'EUR'].includes(record.currency)
      || (hasSettlement(record) && !validSettlement(record))) {
      return { unreadable: true, serialized };
    }
    return { record, serialized };
  } catch {
    return serialized === undefined ? { unavailable: true } : { unreadable: true, serialized };
  }
}

export function clearFinanceReview(storage, key, review) {
  if (!key || review?.unavailable || typeof review?.serialized !== 'string'
    || storage.getItem(key) !== review.serialized) throw new Error('FINANCE_REVIEW_CHANGED');
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new Error('FINANCE_REVIEW_STORAGE_FAILED');
}

export function financeResponseMatches(response, record) {
  const data = response?.data;
  const baseMatches = response?.success !== false && data && positiveId(data.id)
    && Number(data[record.mode === 'collection' ? 'customerId' : 'supplierId']) === record.partyId
    && data.currency === record.currency && typeof data.amount === 'number' && typeof data.balanceEffect === 'number'
    && Number.isFinite(data.amount) && Number.isFinite(data.balanceEffect)
    && closeAmount(data.amount, record.amount);
  if (!baseMatches) return false;
  if (!hasSettlement(record)) return closeAmount(data.balanceEffect, -record.amount);
  return validSettlement(record) && data.settlementKnown !== false && data.accountCurrency === record.accountCurrency
    && closeAmount(data.accountAmount, record.accountAmount) && closeAmount(data.balanceEffect, -record.accountAmount)
    && closeAmount(data.exchangeRate, record.exchangeRate, 0.000000005)
    && closeAmount(data.accountExchangeRate, record.accountExchangeRate, 0.000000005)
    && closeAmount(data.amountTry, record.amountTry);
}

// This guards this browser's review state. It is not server-side idempotency.
// In particular, another device or simultaneous cross-tab writes need a server request key.
export async function submitFinanceForReview({ storage, key, details, send, onReview, createId = browserReviewId }) {
  const existing = readFinanceReview(storage, key);
  if (existing) { onReview(existing); return { status: 'blocked', review: existing }; }
  const record = { ...details, version: 1, id: createId(), startedAt: new Date().toISOString() };
  let review;
  try {
    const serialized = JSON.stringify(record);
    storage.setItem(key, serialized);
    review = readFinanceReview(storage, key);
    if (!review?.record || review.serialized !== serialized) throw new Error('FINANCE_REVIEW_STORAGE_FAILED');
  } catch {
    review = readFinanceReview(storage, key) || { unavailable: true };
    onReview(review);
    return { status: 'blocked', review };
  }
  onReview(review);
  let response;
  try { response = await send(); }
  catch (error) {
    if (([400, 403, 404, 409, 422].includes(error?.status) && knownRejections.has(error.code))
      || (error?.status === 400 && currencyValidationRejections.has(error.code))) {
      try { clearFinanceReview(storage, key, review); onReview(null); return { status: 'rejected', error }; }
      catch { return { status: 'rejected', error, review }; }
    }
    return { status: 'uncertain', error, review };
  }
  if (!financeResponseMatches(response, record)) return { status: 'uncertain', review };
  try { clearFinanceReview(storage, key, review); onReview(null); return { status: 'confirmed', response }; }
  catch { return { status: 'confirmed', response, review }; }
}
