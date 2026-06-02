import { get, put } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';

const fallbackRates = {
  date: new Date().toISOString().slice(0, 10),
  rates: [
    { currency: 'TRY', rateToTry: 1, source: 'system', defined: true },
    { currency: 'USD', rateToTry: 1, source: 'demo-fallback', defined: false },
    { currency: 'EUR', rateToTry: 1, source: 'demo-fallback', defined: false },
  ],
};

export async function fetchCurrencyRates(params = {}) {
  if (apiConfig.demoMode) {
    return { success: true, data: fallbackRates, meta: { source: 'demo' } };
  }

  return get('/api/currency-rates', params);
}

export async function updateCurrencyRates(payload) {
  if (apiConfig.demoMode) {
    return {
      success: true,
      data: {
        date: payload.date || fallbackRates.date,
        rates: [
          fallbackRates.rates[0],
          { currency: 'USD', rateToTry: Number(payload.rates?.USD || 1), source: 'demo', defined: true },
          { currency: 'EUR', rateToTry: Number(payload.rates?.EUR || 1), source: 'demo', defined: true },
        ],
      },
      meta: { source: 'demo' },
    };
  }

  return put('/api/currency-rates', payload);
}

export function rateValueForCurrency(rateData, currency) {
  if (currency === 'TRY') {
    return 1;
  }

  const rate = rateData?.rates?.find((item) => item.currency === currency);
  if (!rate?.defined) {
    return null;
  }

  const value = Number(rate.rateToTry);
  return Number.isFinite(value) && value > 0 ? value : null;
}
