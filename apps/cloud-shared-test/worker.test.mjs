import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from './worker.mjs';
const origin = 'https://synthetic.example.invalid';
test('private Worker keeps platform access required and serves ERP/CRM/terminal entry aliases', async () => {
  const worker = createWorker(new Map([
    ['/erp/cloud.html', { bytes: new TextEncoder().encode('ERP actual controllers'), type: 'text/html' }],
    ['/crm/cloud.html', { bytes: new TextEncoder().encode('CRM actual catalog/dialog'), type: 'text/html' }],
  ]));
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
