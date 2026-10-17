import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { buildApiUrl } from './apiUrl.js';
import { shouldRetryWithRenewedSession } from './authRetryPolicy.js';
function makeClient(responder, initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [], events = [], module = { exports: {} };
  const code = transformSync(readFileSync(new URL('./apiClient.js', import.meta.url), 'utf8'), { format: 'cjs', define: { 'import.meta.env.VITE_TEST_READ_ONLY': '"true"' } }).code;
  vm.runInNewContext(code, { module, exports: module.exports, URL, DOMException, AbortSignal, CustomEvent: class { constructor(type) { this.type = type; } },
    window: { location: { origin: 'https://site.example' }, dispatchEvent: e => events.push(e.type), localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) } },
    fetch: async (url, options) => { const call = { url: String(url), ...options }; calls.push(call); return responder(call); },
    require: spec => ({ './apiUrl.js': { buildApiUrl }, '../demo/demoWorkspace.js': {}, '../config/apiConfig.js': { API_BASE_URL: 'https://vega-api.melisababy.com', apiConfig: { vegaBridgeMode: true, demoMode: false, localPasswordlessLogin: false } }, './authRetryPolicy.js': { shouldRetryWithRenewedSession } })[spec],
  });
  return { api: module.exports, calls, values, events };
}
const response = (status, data = {}) => ({ status, ok: status === 200, json: async () => status === 200 ? { success: true, data } : { success: false, error: { code: 'AUTH_TOKEN_INVALID', message: 'Expired' } } });
test('bridge cannot send demo tokens, ERP write calls, local-passwordless login, or downloads', async () => {
  const c = makeClient(() => response(200), { melisaErpAccessToken: 'OLD-DEMO-TOKEN' });
  await c.api.get('/health');
  assert.equal(c.calls[0].headers.Authorization, undefined);
  for (const action of [() => c.api.post('/api/products', {}), () => c.api.post('/api/auth/local-passwordless-admin'), () => c.api.get('/api/dashboard/summary'), () => c.api.download('/api/export', 'x')]) await assert.rejects(action, e => e.code === 'VEGA_READ_ONLY');
  assert.equal(c.calls.length, 1);
});
test('bridge session stores refresh token and renews once despite TEST read-only UI flag', async () => {
  const c = makeClient(call => {
    if (call.url.endsWith('/api/auth/refresh')) return response(200, { accessToken: 'renewed' });
    return call.headers.Authorization === 'Bearer renewed' ? response(200, { permissions: ['product.view'] }) : response(401);
  });
  c.api.storeAuthTokens({ accessToken: 'expired', refreshToken: 'kept-refresh' });
  assert.equal(c.values.get('melisaVegaRefreshToken'), 'kept-refresh');
  const result = await c.api.get('/api/auth/me');
  assert.equal(result.data.permissions[0], 'product.view');
  assert.equal(c.calls.filter(call => call.url.endsWith('/api/auth/refresh')).length, 1);
  assert.equal(c.values.get('melisaVegaAccessToken'), 'renewed');
  assert.equal(c.values.get('melisaErpAccessToken'), undefined);
});
test('failed bridge renewal clears only the bridge session and emits expiry', async () => {
  const c = makeClient(() => response(401), { melisaVegaAccessToken: 'expired', melisaVegaRefreshToken: 'invalid', melisaErpAccessToken: 'separate' });
  await assert.rejects(() => c.api.get('/api/vega-read/products'), e => e.status === 401);
  assert.equal(c.calls.length, 2);
  assert.equal(c.values.has('melisaVegaAccessToken'), false);
  assert.equal(c.values.has('melisaVegaRefreshToken'), false);
  assert.equal(c.values.get('melisaErpAccessToken'), 'separate');
  assert.deepEqual(c.events, ['melisa-auth-expired']);
});
test('gateway HTML error preserves status and has a useful connection message', async () => {
  const c = makeClient(() => ({ status: 403, ok: false, json: async () => { throw new Error('HTML'); } }));
  await assert.rejects(() => c.api.get('/health'), e => e.status === 403 && e.message.includes('erişim kuralı'));
});

test('temporary refresh failures preserve tokens and recover on the next request', async () => {
  for (const failure of [
    () => { throw new TypeError('Failed to fetch'); },
    () => response(503),
    () => response(429),
    () => ({ status: 403, ok: false, json: async () => { throw Error('gateway HTML'); } }),
    () => ({ status: 200, ok: true, json: async () => { throw Error('truncated JSON'); } }),
    () => response(200, {}),
  ]) {
    let unavailable = true;
    const c = makeClient(call => {
      if (call.url.endsWith('/api/auth/refresh')) return unavailable ? failure() : response(200, { accessToken: 'renewed' });
      return call.headers.Authorization === 'Bearer renewed' ? response(200, { name: 'Test' }) : response(401);
    }, { melisaVegaAccessToken: 'expired', melisaVegaRefreshToken: 'valid-refresh' });
    await assert.rejects(c.api.get('/api/auth/me'), e => e.code === 'AUTH_REFRESH_UNAVAILABLE');
    assert.equal(c.values.get('melisaVegaRefreshToken'), 'valid-refresh');
    assert.equal(c.values.get('melisaVegaAccessToken'), 'expired');
    assert.deepEqual(c.events, []);
    unavailable = false;
    assert.equal((await c.api.get('/api/auth/me')).data.name, 'Test');
  }
});

test('concurrent expired requests share one renewal and all retain the session on outage', async () => {
  const c = makeClient(call => call.url.endsWith('/api/auth/refresh') ? response(503) : response(401),
    { melisaVegaAccessToken: 'expired', melisaVegaRefreshToken: 'valid-refresh' });
  const results = await Promise.allSettled([c.api.get('/api/auth/me'), c.api.get('/api/vega-read/products')]);
  assert.ok(results.every(r => r.status === 'rejected' && r.reason.code === 'AUTH_REFRESH_UNAVAILABLE'));
  assert.equal(c.calls.filter(call => call.url.endsWith('/api/auth/refresh')).length, 1);
  assert.equal(c.values.get('melisaVegaRefreshToken'), 'valid-refresh');
  assert.deepEqual(c.events, []);
});

test('cancelled response bodies remain cancellation errors', async () => {
  const c = makeClient(() => ({ status: 200, ok: true, json: async () => { throw new DOMException('Cancelled', 'AbortError'); } }));
  await assert.rejects(c.api.get('/api/vega-read/products'), e => e.name === 'AbortError');
});
