import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from './worker.mjs';
const origin = 'https://synthetic.example.invalid';
test('private Worker keeps platform access required and serves ERP/CRM/terminal entry aliases', async () => {
  const worker = createWorker(new Map([
    ['/erp/cloud.html', { bytes: new TextEncoder().encode('ERP actual controllers'), type: 'text/html' }],
    ['/crm/cloud.html', { bytes: new TextEncoder().encode('CRM actual catalog/dialog'), type: 'text/html' }],
  ]), { reportError: () => {} });
  const response = await worker.fetch(new Request(origin + '/'), {});
  assert.equal(response.status, 401);
  for (const path of ['/', '/erp/', '/terminal/', '/crm/']) {
    const res = await worker.fetch(new Request(origin + path, { headers: { 'oai-authenticated-user-id': 'synthetic-owner-fixture' } }), {});
    assert.equal(res.status, 200, path);
    assert.equal(await res.text(), path === '/crm/' ? 'CRM actual catalog/dialog' : 'ERP actual controllers');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  }
  assert.equal((await worker.fetch(new Request(origin + '/api/cloud-test/session', { headers: { 'oai-authenticated-user-id': 'synthetic-owner-fixture' } }), {})).status, 503);
});

test('initialization failures emit only bounded stage/code telemetry and a correlated safe JSON error', async () => {
  const records = [], worker = createWorker(new Map(), { reportError: record => records.push(record) });
  const request = () => new Request(origin + '/api/cloud-test/session?private=synthetic-do-not-log', { headers: {
    'oai-authenticated-user-id': 'synthetic-do-not-log', cookie: 'synthetic-do-not-log', authorization: 'synthetic-do-not-log' } });
  const sensitive = Object.assign(Error('SQL/credential/body synthetic-do-not-log'), { code: 'RAW_DRIVER_CODE', cloudStage: 'synthetic-do-not-log' });
  const bindings = [
    [{}, 'D1_BINDING', 'INVALID_BINDING'],
    [{ DB: { prepare() {}, withSession() { throw Error('synthetic-do-not-log'); } } }, 'D1_BINDING', 'D1_OPERATION_FAILED'],
    [{ DB: { prepare() { throw Error('synthetic-do-not-log'); } } }, 'D1_TABLES_READ', 'D1_OPERATION_FAILED'],
    [{ DB: { prepare() {}, withSession() { throw sensitive; } } }, 'STORE_INITIALIZE', 'D1_OPERATION_FAILED'],
    [{ DB: { prepare() { throw sensitive; } } }, 'STORE_INITIALIZE', 'D1_OPERATION_FAILED'],
    [{ DB: { prepare() { return { all: async () => ({ results: [
      { name: 'synthetic_state', sql: 'CREATE TABLE synthetic_state(id TEXT)' },
      { name: 'synthetic_sessions', sql: 'CREATE TABLE synthetic_sessions(id TEXT)' },
    ] }) }; } } }, 'D1_STATE_SCHEMA', 'FOREIGN_STORE'],
  ];
  for (const [binding, stage, code] of bindings) {
    const response = await worker.fetch(request(), binding), body = await response.json();
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(body.success, false); assert.equal(body.error.code, 'CLOUD_TEST_UNAVAILABLE');
    assert.match(body.error.diagnosticId, /^[a-f0-9-]{36}$/);
    assert.deepEqual(records.at(-1), { event: 'MELISA_CLOUD_TEST_FAILURE', diagnosticId: body.error.diagnosticId, stage, code });
    assert.doesNotMatch(JSON.stringify([body, records]), /synthetic-do-not-log|RAW_DRIVER_CODE|CREATE TABLE|credential|SQL/);
  }
  const unavailableLogger = createWorker(new Map(), { reportError() { throw sensitive; } });
  assert.equal((await unavailableLogger.fetch(request(), {})).status, 503);
  const before = records.length;
  assert.equal((await worker.fetch(new Request(origin + '/api/cloud-test/session'), {})).status, 401);
  assert.equal(records.length, before, 'unauthenticated callers cannot probe initialization');
});
