import { calculateCurrencySettlement } from '../../../../packages/shared/src/currencySettlement.mjs';

export function positiveRate(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function storedRate(currency, value) {
  return currency === 'TRY' ? 1 : positiveRate(value);
}

export function definedCurrencyRate(data, currency) {
  if (currency === 'TRY') return 1;
  const row = data?.rates?.find((item) => item.currency === currency);
  return row?.defined === true ? positiveRate(row.rateToTry) : null;
}

export function currencyPreview({ amount, currency, accountCurrency, exchangeRate, accountExchangeRate }) {
  try {
    const settlement = calculateCurrencySettlement({
      documentAmount: amount,
      documentCurrency: currency,
      accountCurrency,
      documentRateToTry: exchangeRate,
      accountRateToTry: accountExchangeRate,
    });
    return { valid: true, settlement, error: '' };
  } catch (error) {
    return { valid: false, settlement: null, error: error.message || 'Cari ve işlem kurlarını kontrol edin.' };
  }
}

// Unknown historical cross-currency effects stay unknown; never label them with the cash currency.
export function financeAccountEffect(row) {
  if (row?.settlementKnown === false || typeof row?.balanceEffect !== 'number' || !Number.isFinite(row.balanceEffect)) return null;
  const currency = row.accountCurrency || row.currency;
  return ['TRY', 'USD', 'EUR'].includes(currency) ? { amount: row.balanceEffect, currency } : null;
}
