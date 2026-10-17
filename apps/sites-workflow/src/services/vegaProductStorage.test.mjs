import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVegaProductStorage } from './vegaProductStorage.js';
import { createVegaProductClient } from './vegaProductClient.js';

const access = 'melisaVegaProductsAccessToken', refresh = 'melisaVegaProductsRefreshToken';
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test('existing product session survives a new tab without importing demo credentials', async () => {
  const persistent = storage({ melisaErpAccessToken: 'demo' });
  const previousTab = storage({ [access]: 'valid', [refresh]: 'refresh' });
  createVegaProductStorage(persistent, previousTab);
  assert.equal(previousTab.getItem(access), null);
  const calls = [];
  const client = createVegaProductClient({ baseUrl: 'https://vega-api.melisababy.com', storage: createVegaProductStorage(persistent, storage()), fetchImpl: async (url, options) => {
    calls.push({ url: String(url), ...options });
    return { ok: true, status: 200, json: async () => ({ success: true, data: { permissions: ['product.view'] } }) };
  } });
  assert.equal(client.hasSession(), true);
  await client.get('/api/auth/me');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.Authorization, 'Bearer valid');
  assert.equal(calls[0].method, 'GET');
  client.clearSession();
  assert.equal(createVegaProductStorage(persistent, storage()).getItem(access), null);
  assert.equal(persistent.getItem('melisaErpAccessToken'), 'demo');
});
test('an old tab cannot overwrite the current persistent session', () => {
  const persistent = storage({ [access]: 'new', [refresh]: 'new-refresh' });
  const old = storage({ [access]: 'old', [refresh]: 'old-refresh' });
  const saved = createVegaProductStorage(persistent, old);
  assert.equal(saved.getItem(access), 'new');
  assert.equal(saved.getItem(refresh), 'new-refresh');
  assert.equal(old.getItem(refresh), null);
});
test('blocked storage keeps the existing tab session usable and explicit logout clears it', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  const saved = createVegaProductStorage(blocked, storage({ [access]: 'valid', [refresh]: 'refresh' }));
  assert.equal(saved.getItem(refresh), 'refresh');
  saved.setItem(access, 'renewed');
  assert.equal(saved.getItem(access), 'renewed');
  saved.removeItem(access);
  assert.equal(saved.getItem(access), null);
});
test('simultaneous expired sessions in two tabs rotate the refresh token only once', async () => {
  const persistent = storage({ [access]: 'old', [refresh]: 'refresh' });
  let queue = Promise.resolve(), refreshCalls = 0;
  const locks = { request(_name, action) { const task = queue.then(action); queue = task.catch(() => {}); return task; } };
  const fetchImpl = async (url, options) => {
    if (String(url).endsWith('/refresh')) {
      refreshCalls++;
      return { ok: true, status: 200, json: async () => ({ success: true, data: { accessToken: 'new', refreshToken: 'rotated' } }) };
    }
    const ok = options.headers.Authorization === 'Bearer new';
    return { ok, status: ok ? 200 : 401, json: async () => ({ success: ok, data: {} }) };
  };
  const client = () => createVegaProductClient({ baseUrl: 'https://vega-api.melisababy.com', storage: createVegaProductStorage(persistent, storage()), locks, fetchImpl });
  await Promise.all([client().get('/api/auth/me'), client().get('/api/auth/me')]);
  assert.equal(refreshCalls, 1);
  assert.equal(persistent.getItem(refresh), 'rotated');
});
