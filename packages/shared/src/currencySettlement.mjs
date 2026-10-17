const CURRENCIES = new Set(['TRY', 'USD', 'EUR']);
const MONEY_SCALE = 10000n;
const RATE_SCALE = 100000000n;
const SAFE_UNITS = BigInt(Number.MAX_SAFE_INTEGER);
const fail = (code, message, statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };

function scaled(value, digits, label) {
  if (typeof value !== 'string' && typeof value !== 'number') fail('CURRENCY_SETTLEMENT_INVALID', `${label} gerekli.`);
  if (typeof value === 'number' && !Number.isFinite(value)) fail('CURRENCY_SETTLEMENT_INVALID', `${label} geçersiz.`);
  const text = typeof value === 'number' ? value.toFixed(digits) : value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match || (match[2]?.length || 0) > digits) fail('CURRENCY_SETTLEMENT_INVALID', `${label} en fazla ${digits} ondalık içermelidir.`);
  const units = BigInt(match[1]) * (10n ** BigInt(digits)) + BigInt((match[2] || '').padEnd(digits, '0') || '0');
  if (units > SAFE_UNITS) fail('CURRENCY_SETTLEMENT_OVERFLOW', `${label} güvenli hesaplama sınırını aşıyor.`);
  return units;
}
const divideRounded = (numerator, denominator) => (numerator + denominator / 2n) / denominator;
function money(units) {
  if (units > SAFE_UNITS) fail('CURRENCY_SETTLEMENT_OVERFLOW', 'Döviz karşılığı güvenli hesaplama sınırını aşıyor.');
  return Number(units) / Number(MONEY_SCALE);
}
function currency(value) {
  if (!CURRENCIES.has(value)) fail('CURRENCY_SETTLEMENT_INVALID', 'Para birimi TRY, USD veya EUR olmalıdır.');
  return value;
}
function rate(value, code, label) {
  if (code === 'TRY') {
    if (value != null && Number(value) !== 1) fail('CURRENCY_SETTLEMENT_INVALID', 'TRY kuru 1 olmalıdır.');
    return RATE_SCALE;
  }
  const result = scaled(value, 8, label);
  if (result <= 0n) fail('CURRENCY_SETTLEMENT_RATE_REQUIRED', `${label} sıfırdan büyük olmalıdır.`);
  return result;
}

// Positive amounts only. The movement caller supplies the business sign separately.
export function calculateCurrencySettlement({ documentAmount, documentCurrency, accountCurrency, documentRateToTry, accountRateToTry }) {
  currency(documentCurrency); currency(accountCurrency);
  const amount = scaled(documentAmount, 4, 'İşlem tutarı');
  const documentRate = rate(documentRateToTry, documentCurrency, 'İşlem kuru');
  const accountRate = documentCurrency === accountCurrency && accountRateToTry == null
    ? documentRate : rate(accountRateToTry, accountCurrency, 'Cari kuru');
  if (documentCurrency === accountCurrency && documentRate !== accountRate) fail('CURRENCY_SETTLEMENT_RATE_MISMATCH', 'Aynı döviz için iki farklı kur kullanılamaz.');
  return {
    documentAmount: money(amount), documentCurrency, accountCurrency,
    documentRateToTry: Number(documentRate) / Number(RATE_SCALE),
    accountRateToTry: Number(accountRate) / Number(RATE_SCALE),
    accountAmount: money(divideRounded(amount * documentRate, accountRate)),
    amountTry: money(divideRounded(amount * documentRate, RATE_SCALE)),
  };
}

export function settlementFromInvoice(snapshot) {
  const documentCurrency = snapshot.documentCurrency;
  const accountCurrency = snapshot.accountCurrency || snapshot.customerCurrency || snapshot.supplierCurrency;
  const crossCurrency = documentCurrency !== accountCurrency;
  if (crossCurrency && (snapshot.accountAmount == null || snapshot.accountExchangeRate == null || !snapshot.accountCurrency)) {
    fail('CURRENCY_SNAPSHOT_REQUIRED', 'Eski çapraz döviz fişinin cari kur/tutar kaydı eksik. Tahmin edilerek işlem yapılamaz.', 409);
  }
  const result = calculateCurrencySettlement({
    documentAmount: snapshot.grandTotal, documentCurrency, accountCurrency,
    documentRateToTry: snapshot.exchangeRate,
    accountRateToTry: snapshot.accountExchangeRate ?? (crossCurrency ? undefined : snapshot.exchangeRate),
  });
  if (snapshot.accountAmount != null && Math.abs(result.accountAmount - Number(snapshot.accountAmount)) > 0.00011) {
    fail('CURRENCY_SNAPSHOT_INCONSISTENT', 'Fişin kayıtlı cari tutarı kur snapshotı ile uyuşmuyor.', 409);
  }
  return { ...result, accountAmount: snapshot.accountAmount == null ? result.accountAmount : Number(snapshot.accountAmount) };
}

export function recalculateInvoiceSettlement(snapshot, documentAmount) {
  const original = settlementFromInvoice(snapshot);
  return calculateCurrencySettlement({ ...original, documentAmount });
}
