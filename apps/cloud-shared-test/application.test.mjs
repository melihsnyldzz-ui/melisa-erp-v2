import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from './application.mjs';
import { createStore } from './store.mjs';

const origin = 'https://melisa-synthetic.invalid';
const prefix = '/api/cloud-test';
const documentDate = '2026-10-19';
const requestBody = body => ({ requestId: randomUUID(), ...body });

function browser(app) {
  const credentials = { cookie: null, csrf: null, bearer: null };
  return {
    credentials,
    async request(path, body, overrides = {}) {
      const headers = { ...(credentials.cookie ? { cookie: credentials.cookie } : {}), ...(credentials.bearer ? { authorization: 'Bearer ' + credentials.bearer } : {}) };
      if (body !== undefined) Object.assign(headers, { origin, 'content-type': 'application/json', 'x-cloud-csrf': credentials.csrf ?? '' });
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null) delete headers[key]; else headers[key] = value;
      }
      const response = await app(new Request(origin + prefix + path, { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
      const cookie = response.headers.get('set-cookie');
      if (cookie) credentials.cookie = cookie.split(';')[0];
      return { status: response.status, headers: response.headers, body: await response.json() };
    },
    async login(actorId) {
      const initial = await this.request('/session');
      assert.equal(initial.status, 200);
      assert.match(initial.headers.get('set-cookie') ?? '', /HttpOnly; SameSite=Strict; Path=\/; Secure/);
      credentials.csrf = initial.body.data.csrfToken;
      const selected = await this.request('/session', { actorId });
      assert.equal(selected.status, 200);
      assert.equal(selected.body.data.user.id, actorId);
      assert.match(selected.body.data.accessToken, /^[a-f0-9]{64}$/);
      assert.match(selected.body.data.csrfToken, /^[a-f0-9]{64}$/);
      assert.notEqual(selected.body.data.csrfToken, credentials.csrf);
      credentials.csrf = selected.body.data.csrfToken;
      credentials.bearer = selected.body.data.accessToken;
      return this;
    },
    async ok(path, body) {
      const response = await this.request(path, body);
      assert.equal(response.status, 200, `${path}: ${JSON.stringify(response.body)}`);
      assert.equal(response.body.success, true);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return response.body.data;
    },
    async rejected(path, body, status, code, overrides) {
      const response = await this.request(path, body, overrides);
      assert.equal(response.status, status, `${path}: ${JSON.stringify(response.body)}`);
      assert.deepEqual(response.body, { success: false, error: { code, message: 'Sentetik TEST işlemi reddedildi.' } });
    },
  };
}

async function fixture(t) {
  const path = join(mkdtempSync(join(tmpdir(), 'melisa-cloud-synthetic-http-')), 'synthetic.sqlite');
  const store = createStore(path), app = createApplication({ store });
  t.after(() => store.close());
  const personnel = await browser(app).login(15), manager = await browser(app).login(16), crm = await browser(app).login(17), other = await browser(app).login(18);
  return { path, store, app, personnel, manager, crm, other };
}

const countBody = () => requestBody({ note: 'Sentetik ürün kabulü', lines: [{ clientLineId: 'line-101', productId: '101', stockCode: 'SYN-101', barcode: '8690000000101', physicalQuantityExact3: '4.000', expectedQuantityExact3: null, issue: null, note: '' }] });
test('HTTP rejects duplicate receiving client line identity without poisoning the saved context', async t => {
  const f = await fixture(t), before = await f.manager.ok('/snapshot'), body = countBody();
  body.lines.push({ ...body.lines[0], productId: '102', stockCode: 'SYN-102', barcode: '8690000000102' });
  await f.personnel.rejected('/work-receiving/count-drafts', body, 400, 'INVALID_COUNT');
  for (const identity of [undefined, null, 1, ['line-101']]) {
    const malformed = countBody(); malformed.lines[0].clientLineId = identity;
    await f.personnel.rejected('/work-receiving/count-drafts', malformed, 400, 'INVALID_COUNT_LINE');
  }
  assert.deepEqual(await f.manager.ok('/snapshot'), before);
});
async function crmBody(crm, quantity = 2) {
  const match = await crm.ok('/erp/customers?conversationId=55&phone=9000000000501');
  const customer = match.entries[0];
  return requestBody({ conversationId: 55, peer: customer.phone, customerId: customer.id, customerMatch: { phone: customer.phone, basis: 'exact-phone', revision: customer.revision, reason: null }, documentCurrency: 'TRY', exchangeRateExact8: '1.00000000',
    items: [{ productId: 101, stockCode: 'SYN-101', priceId: 101, unitSourceId: 1, tier: 1, currency: 'TRY', priceExact8: '25.00000000', priceSourceKey: 'cloud-synthetic:price:101', quantity }] });
}
async function crmSale(f) {
  const draftRequest = await crmBody(f.crm);
  const order = await f.crm.ok('/erp/drafts', draftRequest);
  const bridgeRequest = requestBody({});
  const sale = await f.personnel.ok(`/erp/orders/${order.id}/sale`, bridgeRequest);
  return { draftRequest, order, bridgeRequest, sale };
}
async function finalizedSale(f) {
  const result = await crmSale(f);
  const finalizeRequest = requestBody({ expectedRevision: result.sale.revision });
  const finalized = await f.personnel.ok(`/work-sales/drafts/${result.sale.id}/finalize`, finalizeRequest);
  return { ...result, finalizeRequest, finalized };
}
async function collection(f, invoiceId, amountExact4 = '20.0000') {
  const selection = { invoiceId, accountId: '701', amountExact4, documentDate };
  const preview = await f.manager.ok('/work-collections/preview', selection);
  const body = requestBody({ ...selection, expectedRevision: preview.revision, previewHash: preview.previewHash });
  const result = await f.manager.ok('/work-collections', body);
  return { body, result };
}

test('HTTP full receiving/CRM/sale/collection flow replays once and persists after new application + SQLite reopen', async t => {
  const f = await fixture(t);
  const initial = await f.manager.ok('/snapshot');
  assert.equal(initial.products[0].stock3, 10000);
  assert.equal(initial.customers[0].balance4, 0);
  const createRequest = countBody();
  const created = await f.personnel.ok('/work-receiving/count-drafts', createRequest);
  const createdReplay = await f.personnel.ok('/work-receiving/count-drafts', createRequest);
  assert.deepEqual(createdReplay, { ...created, replayed: true });
  assert.equal((await f.manager.ok('/snapshot')).products[0].stock3, 10000);
  const submitPath = `/work-receiving/count-drafts/${created.draft.id}/submit`;
  const submitRequest = requestBody({ expectedRevision: created.draft.revision });
  const submitted = await f.personnel.ok(submitPath, submitRequest);
  assert.deepEqual(await f.personnel.ok(submitPath, submitRequest), { ...submitted, replayed: true });
  assert.equal((await f.manager.ok('/snapshot')).products[0].stock3, 10000);
  const approvePath = `/work-receiving/receipts/${created.draft.id}/approve`, approveRequest = requestBody({});
  const approved = await f.manager.ok(approvePath, approveRequest);
  assert.equal(approved.receipt.state, 'accepted');
  assert.deepEqual(await f.manager.ok(approvePath, approveRequest), { ...approved, replayed: true });
  await f.manager.rejected(approvePath, requestBody({}), 409, 'ALREADY_APPROVED');
  await f.personnel.rejected(approvePath, approveRequest, 403, 'FORBIDDEN');
  assert.equal((await f.manager.ok('/snapshot')).products[0].stock3, 14000);
  const { draftRequest, order, bridgeRequest, sale } = await crmSale(f);
  assert.equal(order.grandTotalExact4, '50.0000');
  for (const key of ['stockEffect', 'ledgerEffect', 'collectionEffect', 'reservationEffect']) assert.equal(order[key], false);
  assert.deepEqual(await f.crm.ok('/erp/drafts', draftRequest), order);
  assert.deepEqual(await f.crm.ok(`/erp/drafts/${draftRequest.requestId}`), order);
  assert.deepEqual(await f.crm.ok('/erp/drafts'), [order]);
  const draftState = await f.manager.ok('/snapshot');
  assert.equal(draftState.products[0].stock3, 14000);
  assert.equal(draftState.customers[0].balance4, 0);
  assert.equal(draftState.orders.length, 1);
  assert.equal(draftState.sales.length, 1);
  assert.equal(sale.status, 'draft');
  assert.deepEqual(await f.personnel.ok(`/erp/orders/${order.id}/sale`, bridgeRequest), sale);
  await f.personnel.rejected(`/erp/orders/${order.id}/sale`, requestBody({}), 409, 'ORDER_ALREADY_LINKED');
  const finalizePath = `/work-sales/drafts/${sale.id}/finalize`, finalizeRequest = requestBody({ expectedRevision: sale.revision });
  const finalized = await f.personnel.ok(finalizePath, finalizeRequest);
  assert.equal(finalized.invoice.collections.outstandingExact4, '50.0000');
  assert.deepEqual(await f.personnel.ok(finalizePath, finalizeRequest), { ...finalized, replayed: true });
  await f.personnel.rejected(finalizePath, requestBody({ expectedRevision: finalized.invoice.revision }), 409, 'ALREADY_FINALIZED');
  await f.manager.rejected(finalizePath, finalizeRequest, 403, 'FORBIDDEN');
  const finalizedState = await f.manager.ok('/snapshot');
  assert.equal(finalizedState.products[0].stock3, 12000);
  assert.equal(finalizedState.customers[0].balance4, 500000);
  const collected = await collection(f, sale.id);
  assert.equal(collected.result.invoice.collections.outstandingExact4, '30.0000');
  assert.equal(collected.result.invoice.customerBalanceExact4, '30.0000');
  assert.deepEqual(await f.manager.ok('/work-collections', collected.body), { ...collected.result, replayed: true });
  const finalState = await f.manager.ok('/snapshot');
  assert.equal(finalState.products[0].stock3, 12000);
  assert.equal(finalState.customers[0].balance4, 300000);
  assert.equal(finalState.sales[0].collections.length, 1);
  assert.equal(finalState.journal.length, 7);
  assert.equal(new Set(finalState.journal.map(j => j.requestId)).size, 7);
  f.store.close();
  const reopened = createStore(f.path);
  t.after(() => reopened.close());
  const app2 = createApplication({ store: reopened });
  const staleBrowser = browser(app2);
  Object.assign(staleBrowser.credentials, f.manager.credentials);
  await staleBrowser.rejected('/snapshot', undefined, 401, 'SYNTHETIC_SESSION_REQUIRED');
  const manager2 = await browser(app2).login(16);
  assert.deepEqual(await manager2.ok('/snapshot'), finalState);
  assert.equal((await manager2.ok('/work-sales/invoices')).data[0].collections.outstandingExact4, '30.0000');
  const replay = await manager2.ok('/work-collections', collected.body);
  assert.equal(replay.replayed, true);
  assert.deepEqual(await manager2.ok('/snapshot'), finalState);
});

test('HTTP cookie, opaque bearer, same origin and CSRF are all required for writes', async t => {
  const f = await fixture(t), anonymous = browser(f.app);
  await anonymous.rejected('/catalog', undefined, 401, 'SYNTHETIC_SESSION_REQUIRED');
  const before = await f.manager.ok('/snapshot');
  await f.personnel.rejected('/work-receiving/count-drafts', countBody(), 403, 'CSRF_REJECTED', { 'x-cloud-csrf': null });
  await f.personnel.rejected('/work-receiving/count-drafts', countBody(), 403, 'CSRF_REJECTED', { 'x-cloud-csrf': '0'.repeat(64) });
  await f.personnel.rejected('/work-receiving/count-drafts', countBody(), 403, 'CSRF_REJECTED', { origin: 'https://other.invalid' });
  await f.personnel.rejected('/work-receiving/count-drafts', countBody(), 403, 'CSRF_REJECTED', { origin: null });
  await f.personnel.rejected('/catalog', undefined, 401, 'SYNTHETIC_SESSION_REQUIRED', { authorization: null });
  await f.personnel.rejected('/catalog', undefined, 401, 'SYNTHETIC_SESSION_REQUIRED', { authorization: 'Bearer ' + '0'.repeat(64) });
  await f.personnel.rejected('/catalog', undefined, 401, 'SYNTHETIC_SESSION_REQUIRED', { authorization: 'Bearer ' + f.manager.credentials.bearer });
  await f.personnel.rejected('/catalog', undefined, 401, 'SYNTHETIC_SESSION_REQUIRED', { cookie: null });
  assert.deepEqual(await f.manager.ok('/snapshot'), before);
});

test('HTTP role and assigned-customer isolation rejects cross-staff sales, CRM reads and writes', async t => {
  const f = await fixture(t);
  const { order, sale } = await crmSale(f);
  const before = await f.manager.ok('/snapshot');
  await f.crm.rejected('/work-receiving/context', undefined, 403, 'FORBIDDEN');
  await f.crm.rejected('/work-sales/context', undefined, 403, 'FORBIDDEN');
  await f.manager.rejected('/work-receiving/count-drafts', countBody(), 403, 'FORBIDDEN');
  await f.personnel.rejected('/work-receiving/receipts/1/approve', requestBody({}), 403, 'FORBIDDEN');
  await f.other.rejected(`/erp/orders/${order.id}/sale`, requestBody({}), 403, 'CUSTOMER_SCOPE');
  await f.other.rejected(`/work-sales/invoices/${sale.id}`, undefined, 403, 'CUSTOMER_SCOPE');
  await f.crm.rejected('/erp/customers?conversationId=56&phone=9000000000502', undefined, 403, 'CUSTOMER_SCOPE');
  const request = await crmBody(f.crm);
  await f.other.rejected('/erp/drafts', request, 403, 'CUSTOMER_SCOPE');
  await f.crm.rejected('/erp/drafts', { ...request, customerId: '502' }, 403, 'CUSTOMER_SCOPE');
  assert.deepEqual(await f.other.ok('/erp/drafts'), []);
  await f.other.rejected(`/erp/drafts/${request.requestId}`, undefined, 404, 'NOT_FOUND');
  await f.personnel.rejected('/work-collections/preview', { invoiceId: sale.id, accountId: '701', amountExact4: '20.0000', documentDate }, 403, 'FORBIDDEN');
  assert.deepEqual(await f.manager.ok('/snapshot'), before);
});

test('HTTP price mismatch, count UUID conflict and stale revisions leave business state unchanged', async t => {
  const f = await fixture(t);
  const request = await crmBody(f.crm);
  const initial = await f.manager.ok('/snapshot');
  await f.crm.rejected('/erp/drafts', { ...request, items: [{ ...request.items[0], priceExact8: '1.00000000' }] }, 400, 'DRAFT_PRICE_MISMATCH');
  assert.deepEqual(await f.manager.ok('/snapshot'), initial);
  const countRequest = countBody();
  const count = await f.personnel.ok('/work-receiving/count-drafts', countRequest);
  const before = await f.manager.ok('/snapshot');
  await f.personnel.rejected('/work-receiving/count-drafts', { ...countRequest, note: 'Changed payload' }, 409, 'REQUEST_CONFLICT');
  await f.personnel.rejected('/work-receiving/count-drafts', { ...countBody(), requestId: 'not-a-uuid' }, 400, 'INVALID_REQUEST_ID');
  await f.personnel.rejected(`/work-receiving/count-drafts/${count.draft.id}/submit`, requestBody({ expectedRevision: '0'.repeat(64) }), 409, 'REVISION_CONFLICT');
  assert.deepEqual(await f.manager.ok('/snapshot'), before);
  const { sale } = await crmSale(f);
  const beforeFinalize = await f.manager.ok('/snapshot');
  await f.personnel.rejected(`/work-sales/drafts/${sale.id}/finalize`, requestBody({ expectedRevision: '0'.repeat(64) }), 409, 'REVISION_CONFLICT');
  assert.deepEqual(await f.manager.ok('/snapshot'), beforeFinalize);
  const selection = { customerId: '501', documentDate, currency: 'TRY', items: [{ productId: '101', quoteId: 'wrong-price', quantityExact3: '2.000' }] };
  await f.personnel.rejected('/work-sales/preview', selection, 400, 'INVALID_PRICE');
  const preview = await f.personnel.ok('/work-sales/preview', { ...selection, items: [{ ...selection.items[0], quoteId: 'quote-101' }] });
  await f.personnel.rejected('/work-sales/drafts', requestBody({ ...preview.selection, previewHash: preview.previewHash, expectedRevision: '0'.repeat(64) }), 409, 'PREVIEW_MISMATCH');
  assert.deepEqual(await f.manager.ok('/snapshot'), beforeFinalize);
});

test('HTTP collection preview rejects overpayment and new requests with stale revisions; original request replays', async t => {
  const f = await fixture(t), { sale } = await finalizedSale(f);
  const before = await f.manager.ok('/snapshot');
  await f.manager.rejected('/work-collections/preview', { invoiceId: sale.id, accountId: '701', amountExact4: '50.0001', documentDate }, 409, 'OVERPAYMENT');
  assert.deepEqual(await f.manager.ok('/snapshot'), before);
  const collected = await collection(f, sale.id);
  const after = await f.manager.ok('/snapshot');
  await f.manager.rejected('/work-collections', { ...collected.body, requestId: randomUUID() }, 409, 'REVISION_CONFLICT');
  await f.manager.rejected('/work-collections', { ...collected.body, amountExact4: '21.0000' }, 409, 'PREVIEW_MISMATCH');
  assert.equal((await f.manager.ok('/work-collections', collected.body)).replayed, true);
  assert.deepEqual(await f.manager.ok('/snapshot'), after);
});

test('equal-amount collections on the same date return the current request collection ID, including replay', async t => {
  const f = await fixture(t), { sale } = await finalizedSale(f);
  const first = await collection(f, sale.id, '10.0000');
  const second = await collection(f, sale.id, '10.0000');
  assert.equal(first.result.collection.id, '1');
  assert.equal(second.result.invoice.collections.items.length, 2);
  assert.equal(second.result.invoice.collections.outstandingExact4, '30.0000');
  const replayedSecond = await f.manager.ok('/work-collections', second.body);
  assert.equal(replayedSecond.replayed, true);
  const replayedFirst = await f.manager.ok('/work-collections', first.body);
  assert.equal(replayedFirst.replayed, true);
  assert.equal(replayedFirst.collection.id, '1');
  const snapshot = await f.manager.ok('/snapshot');
  assert.equal(snapshot.sales[0].collections.length, 2);
  assert.equal(snapshot.customers[0].balance4, 300000);
  assert.equal(snapshot.journal.length, 5);
  assert.equal(second.result.collection.id, '2', 'second UUID must identify the second collection, despite matching amount and date');
  assert.equal(replayedSecond.collection.id, '2');
});
