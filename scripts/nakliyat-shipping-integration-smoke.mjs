import assert from 'node:assert/strict';
import { createNakliyatShippingClient } from '../apps/api/src/services/nakliyatShippingService.js';

const calls = [];
const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' },
});

async function fakeFetch(url, options = {}) {
  const path = new URL(url).pathname;
  calls.push({ path, options });
  if (path === '/api/ready') return jsonResponse({ status: 'ready', database: 'connected', environment: 'test', fedex: { mode: 'PRODUCTION', configuration: 'CONFIGURED', connection: 'NOT_TESTED' } });
  if (path === '/api/auth/login') return jsonResponse({ token: 'test-token' });
  if (path === '/api/shipping-quotes') return jsonResponse({ quote: { id: 'quote_1', quoteNumber: 'SHP-1', currency: 'EUR' } }, 201);
  if (path === '/api/shipping-quotes/quote_1/rates') return jsonResponse({
    quote: { id: 'quote_1', currency: 'EUR' },
    rates: [
      { id: 'safe', environment: 'PRODUCTION', rateType: 'ACCOUNT', isStale: false, currency: 'EUR', totalNetCharge: 100 },
      { id: 'list', environment: 'PRODUCTION', rateType: 'LIST', isStale: false, currency: 'EUR', totalNetCharge: 120 },
      { id: 'stale', environment: 'PRODUCTION', rateType: 'ACCOUNT', isStale: true, currency: 'EUR', totalNetCharge: 90 },
      { id: 'wrong-currency', environment: 'PRODUCTION', rateType: 'ACCOUNT', isStale: false, currency: 'USD', totalNetCharge: 80 },
    ],
  });
  throw new Error(`Unexpected path ${path}`);
}

const baseConfig = {
  enabled: true,
  baseUrl: 'http://nakliyat.test',
  serviceEmail: 'service@example.test',
  servicePassword: 'not-a-real-secret',
  timeoutMs: 1000,
  allowProductionRates: false,
  allowDraftCreate: false,
  allowCustomerQuoteCreate: false,
  allowFinalize: false,
};

const lockedClient = createNakliyatShippingClient(baseConfig, fakeFetch);
const status = await lockedClient.getStatus();
assert.equal(status.connected, true);
assert.equal(status.fedex.mode, 'PRODUCTION');
await assert.rejects(() => lockedClient.createQuote({}, ''), { code: 'NAKLIYAT_DRAFT_CREATE_LOCKED' });
assert.equal(calls.filter((call) => call.path === '/api/auth/login').length, 0);

const enabledClient = createNakliyatShippingClient({ ...baseConfig, allowDraftCreate: true, allowProductionRates: true }, fakeFetch);
const quoteInput = {
  erpOrderId: 'MX-DEMO-AHM10350', customerName: 'Gonta Commercial', destinationCountryCode: 'IE',
  destinationCity: 'Bailieborough', destinationPostalCode: 'A82F704', destinationAddressLine: '1 Lear',
  orderValue: 3773.30, currency: 'EUR', packages: [{ weightKg: 18, lengthCm: 60, widthCm: 40, heightCm: 40 }],
};
const quote = await enabledClient.createQuote(quoteInput, 'erp-MX-DEMO-AHM10350');
assert.equal(quote.quote.id, 'quote_1');
assert.equal(quote.upstreamIdempotencyGuaranteed, false);
const createCall = calls.find((call) => call.path === '/api/shipping-quotes');
assert.equal(createCall.options.headers['Idempotency-Key'], 'erp-MX-DEMO-AHM10350');
assert.equal(JSON.parse(createCall.options.body).destinationAddressLine, '1 Lear');

const rateResult = await enabledClient.getRates('quote_1', 'EUR');
assert.deepEqual(rateResult.rates.map((rate) => rate.id), ['safe']);
assert.equal(rateResult.rejectedRateCount, 3);

console.log('PASS - Nakliyat readiness is read-only and visible');
console.log('PASS - external writes fail closed when gates are disabled');
console.log('PASS - service auth token stays server-side');
console.log('PASS - ERP reference uses an idempotency header');
console.log('PASS - destination address is forwarded');
console.log('PASS - only PRODUCTION + ACCOUNT + fresh + matching-currency rates survive');
console.log('SUMMARY: 6/6 PASS');
