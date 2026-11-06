import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function loadClient(empty) {
  let source = await readFile(new URL('./apiClient.js', import.meta.url), 'utf8');
  source = source.replace("import { API_BASE_URL, apiConfig } from '../config/apiConfig.js';",
    'const API_BASE_URL="http://127.0.0.1:4294"; const apiConfig=' + JSON.stringify({emptyLocalInstallation: empty, demoMode: false, localPasswordlessLogin: false}) + ';');
  source = source.replace("'./authRetryPolicy.js'", JSON.stringify(new URL('./authRetryPolicy.js', import.meta.url).href));
  source = source.replace("'../config/emptyLocalInstallation.mjs'", JSON.stringify(new URL('../config/emptyLocalInstallation.mjs', import.meta.url).href));
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + '#' + (empty ? 'empty' : 'legacy'));
}

test('empty installation never adopts legacy tokens, renews them, or sends forbidden requests', async () => {
  const previousWindow = globalThis.window, previousFetch = globalThis.fetch;
  const values = new Map([['melisaErpAccessToken', 'fixture-legacy-access'], ['melisaErpRefreshToken', 'fixture-legacy-refresh']]);
  const calls = [];
  globalThis.window = {localStorage: {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)}};
  globalThis.fetch = async (url, options) => {
    calls.push({url: String(url), options});
    return {ok: true, status: 200, json: async () => ({success: true, data: []})};
  };
  try {
    const client = await loadClient(true);
    assert.equal(client.getStoredAccessToken(), null);
    assert.equal(client.getStoredRefreshToken(), null);
    assert.equal(await client.renewStoredSession(), false);
    assert.equal(calls.length, 0);
    client.storeAuthTokens({accessToken: 'fixture-empty-access', refreshToken: 'fixture-unexpected-refresh', localPasswordlessSession: true});
    assert.equal(client.getStoredAccessToken(), 'fixture-empty-access');
    assert.equal(client.getStoredRefreshToken(), null);
    await client.get('/api/products', {page: 1, limit: 50});
    assert.equal(calls[0].url, 'http://127.0.0.1:4294/api/products?page=1&limit=50');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture-empty-access');
    for (const path of ['/api/customers/cash/ensure', '/api/auth/refresh', '/api/sales-invoices']) await assert.rejects(client.post(path, {}), {code: 'EMPTY_LOCAL_READ_ONLY'});
    await assert.rejects(client.get('https://vega-api.melisababy.com/api/products'), {code: 'EMPTY_LOCAL_READ_ONLY'});
    await assert.rejects(client.download('/api/products', 'products.csv'), {code: 'EMPTY_LOCAL_READ_ONLY'});
    assert.equal(calls.length, 1);
    client.clearAuthTokens();
    assert.equal(client.getStoredAccessToken(), null);
    assert.equal(values.get('melisaErpAccessToken'), 'fixture-legacy-access');
    assert.equal(values.get('melisaErpRefreshToken'), 'fixture-legacy-refresh');
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test('legacy profile still reads its original session keys', async () => {
  const previousWindow = globalThis.window;
  const values = new Map([['melisaErpAccessToken', 'fixture-legacy-access'], ['melisaErpRefreshToken', 'fixture-legacy-refresh']]);
  globalThis.window = {localStorage: {getItem: key => values.get(key) ?? null}};
  try {
    const client = await loadClient(false);
    assert.equal(client.getStoredAccessToken(), 'fixture-legacy-access');
    assert.equal(client.getStoredRefreshToken(), 'fixture-legacy-refresh');
  } finally { globalThis.window = previousWindow; }
});
