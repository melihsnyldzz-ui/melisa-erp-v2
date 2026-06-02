import { getCurrencyRates, upsertCurrencyRates } from '../services/currencyRateService.js';
import { fail, ok } from '../utils/response.js';

function rateError(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Currency rate operation failed',
  );
}

export async function getRates(req, res) {
  try {
    const data = await getCurrencyRates(req.query);
    return ok(res, data, {
      source: 'sql-currency-rates',
    });
  } catch (error) {
    return rateError(res, error, 'CURRENCY_RATES_SELECT_FAILED');
  }
}

export async function putRates(req, res) {
  try {
    const data = await upsertCurrencyRates(req.body, req.user);
    return ok(res, data, {
      source: 'sql-write',
      audit: 'currency_rates_updated',
    });
  } catch (error) {
    return rateError(res, error, 'CURRENCY_RATES_UPDATE_FAILED');
  }
}
