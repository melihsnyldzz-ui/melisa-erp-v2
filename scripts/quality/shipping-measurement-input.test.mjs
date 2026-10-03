import assert from 'node:assert/strict';
import test from 'node:test';
import { createNakliyatShippingClient } from '../../apps/api/src/services/nakliyatShippingService.js';

const valid = { erpOrderId: 'FIXTURE-ONLY', customerName: 'TEST ONLY', destinationCountryCode: 'DE', destinationCity: 'Berlin', destinationPostalCode: '10115', orderValue: 100, currency: 'EUR', packages: [{ weightKg: 14, lengthCm: 60, widthCm: 40, heightCm: 40 }] };
function setup() {
  const calls = [];
  const client = createNakliyatShippingClient({ enabled: true, allowDraftCreate: true, baseUrl: 'http://fixture.invalid', serviceEmail: 'test@example.invalid', servicePassword: 'fixture-only', timeoutMs: 1000 }, async (url, options) => {
    calls.push({ url, options });
    const payload = new URL(url).pathname === '/api/auth/login' ? { token: 'fixture-token' } : { quote: { id: 'fixture-quote' } };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return { client, calls };
}

test('ERP bridge rejects invalid parcel types and bounds before authentication or upstream writes', async () => {
  const { client, calls } = setup();
  for (const parcel of [null, true, [], { ...valid.packages[0], weightKg: true }, { ...valid.packages[0], lengthCm: [60] }, { ...valid.packages[0], widthCm: '0x10' }, { ...valid.packages[0], heightCm: 0 }, { ...valid.packages[0], heightCm: 301 }, { ...valid.packages[0], weightKg: 1001 }]) {
    await assert.rejects(client.createQuote({ ...valid, packages: [parcel] }), { code: 'NAKLIYAT_PACKAGE_INVALID', statusCode: 400 });
  }
  await assert.rejects(client.createQuote(null), { code: 'NAKLIYAT_QUOTE_INVALID', statusCode: 400 });
  assert.equal(calls.length, 0);
});

test('ERP bridge preserves independently entered decimal parcel measurements and their units', async () => {
  const { client, calls } = setup();
  await client.createQuote({ ...valid, packages: [{ weightKg: '14.25', lengthCm: '60', widthCm: '40', heightCm: '40' }, { weightKg: 9, lengthCm: 30, widthCm: 20, heightCm: 10 }] });
  const request = calls.find(call => new URL(call.url).pathname === '/api/shipping-quotes');
  assert.deepEqual(JSON.parse(request.options.body).packages, [{ weightKg: 14.25, lengthCm: 60, widthCm: 40, heightCm: 40 }, { weightKg: 9, lengthCm: 30, widthCm: 20, heightCm: 10 }]);
  assert.equal(request.options.headers['Idempotency-Key'], 'erp-FIXTURE-ONLY');
});
