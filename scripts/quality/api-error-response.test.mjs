import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

// Run the real client with a fixed test configuration and in-memory fetch/storage.
// No Vite server, SQL, child processes or external HTTP are needed.
const clientUrl = new URL('../../apps/web-admin/src/services/apiClient.js', import.meta.url);
let source = fs.readFileSync(clientUrl, 'utf8');
const configImport = "import { API_BASE_URL, apiConfig } from '../config/apiConfig.js';";
assert.ok(source.includes(configImport));
source = source.replace(configImport, "const API_BASE_URL = 'http://commerce.invalid'; const apiConfig = {demoMode:false, localPasswordlessLogin:false};");
source = source.replace("'./authRetryPolicy.js'", JSON.stringify(new URL('../../apps/web-admin/src/services/authRetryPolicy.js', import.meta.url).href));
const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

async function scenario(payload, status, operation) {
  const previous = { fetch: globalThis.fetch, window: globalThis.window };
  const values = new Map([['melisaErpAccessToken', 'fixture-token']]);
  const events = [];
  let calls = 0;
  globalThis.window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
    dispatchEvent: event => events.push(event.type),
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'http://commerce.invalid/api/products');
    assert.equal(options.method, 'GET');
    calls += 1;
    return new Response(JSON.stringify(payload), {status, headers: {'Content-Type': 'application/json'}});
  };
  try {
    await operation({values, events});
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.window === undefined) delete globalThis.window;
    else globalThis.window = previous.window;
  }
}

test('missing error envelope retains HTTP status and a usable API error', async () => {
  await scenario({}, 503, async () => {
    await assert.rejects(client.get('/api/products'), error => error.code === 'API_ERROR' && error.status === 503);
  });
});
test('null unauthorized response clears the expired session without throwing a TypeError', async () => {
  await scenario(null, 401, async ({values, events}) => {
    await assert.rejects(client.get('/api/products'), error => error.code === 'API_ERROR' && error.status === 401);
    assert.equal(values.has('melisaErpAccessToken'), false);
    assert.deepEqual(events, ['melisa-auth-expired']);
  });
});
test('successful null/primitive/array payloads are classified as invalid envelopes', async () => {
  for (const payload of [null, 'invalid', 1, []]) {
    await scenario(payload, 200, async () => assert.rejects(client.get('/api/products'), {code: 'API_PARSE_ERROR'}));
  }
});
test('structured errors and valid product envelopes retain their original content', async () => {
  await scenario({success: false, error: {code: 'PRODUCT_VIEW_DENIED', message: 'Fixture denial'}, meta: {source:'fixture'}}, 403, async () => {
    await assert.rejects(client.get('/api/products'), error => error.code === 'PRODUCT_VIEW_DENIED' && error.message === 'Fixture denial' && error.meta.source === 'fixture');
  });
  const payload = {success: true, data: [{id: 'fixture-product'}]};
  await scenario(payload, 200, async () => assert.deepEqual(await client.get('/api/products'), payload));
});
