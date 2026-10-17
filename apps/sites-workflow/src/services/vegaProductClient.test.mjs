import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVegaProductClient } from './vegaProductClient.js';

const response = (status, data) => ({ status, ok: status === 200, json: async () => status === 200 ? { success: true, data } : { success: false, error: { code: 'REJECTED' } } });
function fixture(responder, initial = {}) {
  const values = new Map(Object.entries(initial)), calls = [], events = [];
  const client = createVegaProductClient({ baseUrl: 'https://vega-api.melisababy.com', storage: { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }, onExpired: () => events.push('expired'), fetchImpl: async (url, options) => { const call = { url: String(url), ...options }; calls.push(call); return responder(call); } });
  return { client, values, calls, events };
}
test('product bridge never sends demo credentials or requests other ERP resources', async () => {
  const f = fixture(() => response(200, {}), { melisaErpAccessToken: 'DEMO', melisaVegaAccessToken: 'OTHER_SESSION' });
  await f.client.get('/health');
  assert.equal(f.calls[0].headers.Authorization, undefined);
  assert.equal(f.calls[0].credentials, 'omit');
  assert.equal(f.calls[0].redirect, 'error');
  for (const path of ['/api/products', '/api/vega-read/accounts', '/api/auth/local-passwordless-admin', '/api/vega-read/products/../accounts', 'https://other.example/health']) await assert.rejects(() => f.client.get(path), e => e.code === 'VEGA_READ_ONLY');
  assert.equal(f.calls.length, 1);
});
test('login uses the real ERP session and verifies permissions with me', async () => {
  const f = fixture(c => c.url.endsWith('/login') ? response(200, { accessToken: 'real-access', refreshToken: 'real-refresh' }) : response(200, { permissions: ['product.view'] }));
  const result = await f.client.login('operator', 'test-only');
  assert.equal(result.data.permissions[0], 'product.view');
  assert.equal(f.calls[0].method, 'POST');
  assert.equal(f.calls[0].headers.Authorization, undefined);
  assert.equal(f.calls[1].headers.Authorization, 'Bearer real-access');
  assert.equal(f.values.get('melisaErpAccessToken'), undefined);
});
test('opaque cursor survives URL encoding unchanged', async () => {
  const f = fixture(() => response(200, []));
  await f.client.get('/api/vega-read/products', { limit: 50, cursor: 'opaque+/=xyz' });
  assert.equal(new URL(f.calls[0].url).searchParams.get('cursor'), 'opaque+/=xyz');
});
test('expired access renews once; invalid refresh clears only product session', async () => {
  const initial = { melisaVegaProductsAccessToken: 'old', melisaVegaProductsRefreshToken: 'refresh', melisaErpAccessToken: 'demo' };
  const f = fixture(c => c.url.endsWith('/refresh') ? response(200, { accessToken: 'new' }) : response(c.headers.Authorization === 'Bearer new' ? 200 : 401, {}), initial);
  await f.client.get('/api/vega-read/products');
  assert.equal(f.calls.length, 3);
  assert.equal(f.values.get('melisaErpAccessToken'), 'demo');
  const rejected = fixture(() => response(401), initial);
  await assert.rejects(rejected.client.get('/api/vega-read/products'), e => e.status === 401);
  assert.equal(rejected.client.hasSession(), false);
  assert.equal(rejected.values.get('melisaErpAccessToken'), 'demo');
  assert.deepEqual(rejected.events, ['expired']);
});
test('tunnel outage preserves the session and is not converted to an empty list', async () => {
  const f = fixture(() => ({ status: 530, ok: false, json: async () => { throw Error('HTML'); } }), { melisaVegaProductsAccessToken: 'real' });
  await assert.rejects(f.client.get('/api/vega-read/products'), e => e.status === 530 && e.code === 'VEGA_GATEWAY_ERROR');
  assert.equal(f.client.hasSession(), true);
});
test('logout clears local credentials even while server logout is unavailable', async () => {
  const f = fixture(() => response(503), { melisaVegaProductsAccessToken: 'real', melisaVegaProductsRefreshToken: 'refresh' });
  const pending = f.client.logout();
  assert.equal(f.client.hasSession(), false);
  await assert.rejects(pending);
});
