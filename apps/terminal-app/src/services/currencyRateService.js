import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './apiClient';

const currencyRatesKey = 'terminalCurrencyRates';

function normalizeCurrency(value) {
  const currency = String(value || 'TRY').trim().toUpperCase();
  return ['TRY', 'USD', 'EUR'].includes(currency) ? currency : 'TRY';
}

function normalizeRateRow(row) {
  const currency = normalizeCurrency(row?.currency);
  return {
    currency,
    rateToTry: currency === 'TRY' ? 1 : Number(row?.rateToTry || row?.rate_to_try || 1),
    rateDate: row?.rateDate || row?.rate_date || null,
    source: row?.source || (currency === 'TRY' ? 'system' : 'unknown'),
    defined: currency === 'TRY' || Boolean(row?.defined),
  };
}

function fallbackRates() {
  return {
    date: new Date().toISOString().slice(0, 10),
    source: 'fallback',
    rates: [
      { currency: 'TRY', rateToTry: 1, rateDate: null, source: 'system', defined: true },
      { currency: 'USD', rateToTry: 1, rateDate: null, source: 'fallback', defined: false },
      { currency: 'EUR', rateToTry: 1, rateDate: null, source: 'fallback', defined: false },
    ],
  };
}

function normalizeRatePayload(payload, source = 'api') {
  const data = payload?.data || payload || {};
  const rows = Array.isArray(data.rates) ? data.rates : [];
  const normalizedRows = rows.map(normalizeRateRow);
  const currencies = new Set(normalizedRows.map((row) => row.currency));

  for (const row of fallbackRates().rates) {
    if (!currencies.has(row.currency)) {
      normalizedRows.push(row);
    }
  }

  return {
    date: data.date || new Date().toISOString().slice(0, 10),
    source,
    rates: normalizedRows,
  };
}

async function readCachedRates() {
  const raw = await AsyncStorage.getItem(currencyRatesKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getRateToTry(rateSet, currency) {
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === 'TRY') return 1;

  const row = (rateSet?.rates || []).find((entry) => entry.currency === normalizedCurrency);
  return Number(row?.rateToTry || 1);
}

export function getRateRow(rateSet, currency) {
  const normalizedCurrency = normalizeCurrency(currency);
  return (rateSet?.rates || []).find((entry) => entry.currency === normalizedCurrency)
    || fallbackRates().rates.find((entry) => entry.currency === normalizedCurrency);
}

export async function getCachedCurrencyRates() {
  return readCachedRates() || fallbackRates();
}

export async function fetchCurrencyRates({ token } = {}) {
  try {
    const response = await apiRequest('/currency-rates', { token, timeoutMs: 8000 });
    const normalized = normalizeRatePayload(response, 'api');
    await AsyncStorage.setItem(currencyRatesKey, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    const cached = await readCachedRates();
    if (cached) {
      return {
        ...cached,
        source: 'cache',
        warning: error.message || 'Kur API uzerinden okunamadi',
      };
    }

    return {
      ...fallbackRates(),
      warning: error.message || 'Kur API uzerinden okunamadi',
    };
  }
}
