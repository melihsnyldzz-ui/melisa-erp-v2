import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createStore, documentRevision, SCHEMA_MARKER } from './store.mjs';

const input = fields => ({ requestId: randomUUID(), ...fields });
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'melisa-cloud-synthetic-store-'));
  const path = join(directory, 'synthetic.sqlite');
  const store = createStore(path);
  const [personnel, manager, crm, other] = store.actors();
  return { path, directory, store, personnel, manager, crm, other };
};
const errorCode = (fn, code, status) => assert.throws(fn, e => e.code === code && e.status === status);
const saleDraft = f => f.store.createSale(f.personnel, input({ customerId: 501, lines: [{ productId: 101, qty3: 2000 }] }));

test('complete synthetic receiving → CRM draft → sale → collection persists on reopen', () => {
  const f = fixture();
  const count = f.store.createCount(f.personnel, input({ supplierId: 601, lines: [{ productId: 101, qty3: 4000 }] }));
  assert.equal(f.store.products(f.manager)[0].stock3, 10000);
  f.store.submitCount(f.personnel, input({ countId: count.id }));
  f.store.approveCount(f.manager, input({ countId: count.id }));
  assert.equal(f.store.products(f.manager)[0].stock3, 14000);
  const orderRequest = input({ customerId: 501, lines: [{ productId: 101, qty3: 2000 }] });
  const order = f.store.createOrder(f.crm, orderRequest);
  assert.equal(order.total4, 500000);
  assert.equal(f.store.products(f.manager)[0].stock3, 14000);
  assert.equal(f.store.customers(f.manager)[0].balance4, 0);
  assert.deepEqual(f.store.getOrders(f.crm), [Object.fromEntries(Object.entries(order).filter(([key]) => key !== 'replayed'))]);
  const sale = f.store.createSale(f.personnel, input({ orderId: order.id }));
  assert.equal(f.store.products(f.manager)[0].stock3, 14000);
  assert.equal(f.store.customers(f.manager)[0].balance4, 0);
  const finalized = f.store.finalizeSale(f.personnel, input({ saleId: sale.id }));
  assert.equal(finalized.outstanding4, 500000);
  assert.equal(f.store.products(f.manager)[0].stock3, 12000);
  const collectionRequest = input({ saleId: sale.id, customerId: 501, amount4: 200000 });
  const collected = f.store.collectSale(f.manager, collectionRequest);
  assert.equal(collected.collected4, 200000);
  assert.equal(collected.outstanding4, 300000);
  assert.equal(f.store.customers(f.manager)[0].balance4, 300000);
  const before = f.store.snapshot(f.manager);
  assert.equal(before.schemaMarker, SCHEMA_MARKER);
  assert.equal(before.journal.length, 7);
  f.store.close();
  const reopened = createStore(f.path);
  const [p, m, c] = reopened.actors();
  assert.deepEqual(reopened.snapshot(m), before);
  assert.deepEqual(reopened.createOrder(c, orderRequest), { ...order, replayed: true });
  assert.deepEqual(reopened.collectSale(m, collectionRequest), { ...collected, replayed: true });
  assert.equal(reopened.getSale(p, sale.id).outstanding4, 300000);
  reopened.close();
});

test('canonical body replay and request conflicts never repeat effects', () => {
  const f = fixture();
  const request = input({ customerId: 501, lines: [{ productId: 101, qty3: 2000 }] });
  const order = f.store.createOrder(f.crm, request);
  const reordered = { lines: [{ qty3: 2000, productId: 101 }], customerId: 501, requestId: request.requestId };
  assert.deepEqual(f.store.createOrder(f.crm, reordered), { ...order, replayed: true });
  errorCode(() => f.store.createOrder(f.crm, { ...request, lines: [{ productId: 101, qty3: 3000 }] }), 'REQUEST_CONFLICT', 409);
  errorCode(() => f.store.createOrder(f.personnel, request), 'REQUEST_CONFLICT', 409);
  const sale = f.store.createSale(f.personnel, input({ orderId: order.id }));
  errorCode(() => f.store.createSale(f.personnel, input({ orderId: order.id })), 'ORDER_ALREADY_LINKED', 409);
  const finalizeRequest = input({ saleId: sale.id });
  const result = f.store.finalizeSale(f.personnel, finalizeRequest);
  const stock = f.store.products(f.personnel)[0].stock3;
  assert.deepEqual(f.store.finalizeSale(f.personnel, finalizeRequest), { ...result, replayed: true });
  errorCode(() => f.store.finalizeSale(f.personnel, input({ saleId: sale.id })), 'ALREADY_FINALIZED', 409);
  errorCode(() => f.store.finalizeSale(f.personnel, { requestId: request.requestId, saleId: sale.id }), 'REQUEST_CONFLICT', 409);
  assert.equal(f.store.products(f.personnel)[0].stock3, stock);
  const count = f.store.createCount(f.personnel, input({ productId: 102, qty3: 1000 }));
  f.store.submitCount(f.personnel, input({ countId: count.id }));
  const approvalRequest = input({ countId: count.id });
  const approval = f.store.approveCount(f.manager, approvalRequest);
  assert.deepEqual(f.store.approveCount(f.manager, approvalRequest), { ...approval, replayed: true });
  errorCode(() => f.store.approveCount(f.manager, input({ countId: count.id })), 'ALREADY_APPROVED', 409);
  assert.equal(f.store.products(f.manager)[1].stock3, 9000);
  f.store.close();
});

test('exact actor capabilities, roles and customer scope are checked before replay', () => {
  const f = fixture();
  const sale = saleDraft(f);
  const request = input({ saleId: sale.id });
  f.store.finalizeSale(f.personnel, request);
  errorCode(() => f.store.finalizeSale(f.crm, request), 'FORBIDDEN', 403);
  errorCode(() => f.store.finalizeSale({ ...f.personnel }, request), 'INVALID_ACTOR', 401);
  errorCode(() => f.store.collectSale(f.personnel, input({ saleId: sale.id, customerId: 501, amount4: 1 })), 'FORBIDDEN', 403);
  errorCode(() => f.store.approveCount(f.crm, input({ countId: 1 })), 'FORBIDDEN', 403);
  errorCode(() => f.store.createSale(f.crm, input({ customerId: 501, lines: [{ productId: 101, qty3: 1000 }] })), 'FORBIDDEN', 403);
  errorCode(() => f.store.createOrder(f.crm, input({ customerId: 502, lines: [{ productId: 101, qty3: 1000 }] })), 'CUSTOMER_SCOPE', 403);
  errorCode(() => f.store.getSale(f.other, sale.id), 'CUSTOMER_SCOPE', 403);
  const order = f.store.createOrder(f.crm, input({ customerId: 501, lines: [{ productId: 101, qty3: 1000 }] }));
  errorCode(() => f.store.getOrder(f.other, order.id), 'CUSTOMER_SCOPE', 403);
  errorCode(() => f.store.createSale(f.other, input({ orderId: order.id })), 'CUSTOMER_SCOPE', 403);
  assert.deepEqual(f.store.getOrders(f.other), []);
  assert.deepEqual(f.store.listSales(f.other), []);
  assert.deepEqual(f.store.customers(f.crm).map(c => c.id), [501]);
  const before = f.store.snapshot(f.manager);
  errorCode(() => f.store.collectSale(f.manager, input({ saleId: sale.id, customerId: 502, amount4: 1 })), 'CUSTOMER_SCOPE', 403);
  assert.deepEqual(f.store.snapshot(f.manager), before);
  assert.ok(Object.isFrozen(f.personnel));
  assert.ok(Object.isFrozen(f.store.actors()));
  f.store.close();
});

test('invalid quantities, unsafe integers, duplicates, unknown products and overpayments have no effects', () => {
  const f = fixture();
  const before = f.store.snapshot(f.manager);
  for (const qty3 of [0, -1, 0.5, 1, 1001, NaN, Infinity, '1000', 1_000_000_001, Number.MAX_SAFE_INTEGER + 1]) {
    errorCode(() => f.store.createOrder(f.crm, input({ customerId: 501, lines: [{ productId: 101, qty3 }] })), 'INVALID_INPUT', 400);
  }
  errorCode(() => f.store.createOrder(f.crm, input({ customerId: 501, lines: [{ productId: 101, qty3: 1000 }, { productId: 101, qty3: 1000 }] })), 'INVALID_INPUT', 400);
  errorCode(() => f.store.createOrder(f.crm, input({ customerId: 501, lines: [{ productId: 999, qty3: 1000 }] })), 'NOT_FOUND', 404);
  errorCode(() => f.store.createOrder(f.crm, { customerId: 501, lines: [] }), 'INVALID_REQUEST_ID', 400);
  errorCode(() => f.store.createOrder(f.crm, input({ customerId: 501, lines: [{ productId: 101, qty3: 1000 }], role: 'manager' })), 'INVALID_INPUT', 400);
  assert.deepEqual(f.store.snapshot(f.manager), before);
  const sale = saleDraft(f);
  errorCode(() => f.store.collectSale(f.manager, input({ saleId: sale.id, customerId: 501, amount4: 1 })), 'NOT_FINALIZED', 409);
  f.store.finalizeSale(f.personnel, input({ saleId: sale.id }));
  const finalized = f.store.snapshot(f.manager);
  for (const amount4 of [0, -1, 0.1, Number.MAX_SAFE_INTEGER + 1]) {
    errorCode(() => f.store.collectSale(f.manager, input({ saleId: sale.id, customerId: 501, amount4 })), 'INVALID_INPUT', 400);
  }
  errorCode(() => f.store.collectSale(f.manager, input({ saleId: sale.id, customerId: 501, amount4: 500001 })), 'OVERPAYMENT', 409);
  assert.deepEqual(f.store.snapshot(f.manager), finalized);
  f.store.close();
});

test('failed multi-line finalization rolls back the earlier stock update and creates no journal record', () => {
  const f = fixture();
  const sale = f.store.createSale(f.personnel, input({ customerId: 501, lines: [{ productId: 101, qty3: 1000 }, { productId: 102, qty3: 9000 }] }));
  const before = f.store.snapshot(f.manager);
  const request = input({ saleId: sale.id });
  errorCode(() => f.store.finalizeSale(f.personnel, request), 'INSUFFICIENT_STOCK', 409);
  assert.deepEqual(f.store.snapshot(f.manager), before);
  const count = f.store.createCount(f.personnel, input({ lines: [{ productId: 101, qty3: 1000 }, { productId: 102, qty3: 1000 }] }));
  f.store.submitCount(f.personnel, input({ countId: count.id }));
  f.store.approveCount(f.manager, input({ countId: count.id }));
  assert.equal(f.store.finalizeSale(f.personnel, request).replayed, false);
  assert.equal(f.store.products(f.manager)[1].stock3, 0);
  f.store.close();
});

test('journal insertion failure atomically rolls back all business effects', () => {
  const f = fixture();
  const sale = saleDraft(f);
  const before = f.store.snapshot(f.manager);
  const probe = new DatabaseSync(f.path);
  // Test-only fault in this newly created synthetic DB; no application fault/reset API.
  probe.exec("CREATE TRIGGER synthetic_test_journal_failure BEFORE INSERT ON journal BEGIN SELECT RAISE(ABORT, 'test journal failure'); END");
  assert.throws(() => f.store.finalizeSale(f.personnel, input({ saleId: sale.id })), /test journal failure/);
  assert.deepEqual(f.store.snapshot(f.manager), before);
  probe.close();
  f.store.close();
});

test('foreign, empty, mismarked and symlink files are rejected without changing their contents', () => {
  const directory = mkdtempSync(join(tmpdir(), 'melisa-cloud-synthetic-foreign-'));
  const empty = join(directory, 'empty.sqlite');
  writeFileSync(empty, '');
  errorCode(() => createStore(empty), 'FOREIGN_STORE', 409);
  assert.equal(readFileSync(empty).length, 0);
  const foreign = join(directory, 'foreign.sqlite');
  const db = new DatabaseSync(foreign);
  db.exec('CREATE TABLE metadata(marker TEXT); INSERT INTO metadata VALUES (\'REAL_FOREIGN_SCHEMA\')');
  db.close();
  const original = readFileSync(foreign);
  errorCode(() => createStore(foreign), 'FOREIGN_STORE', 409);
  assert.deepEqual(readFileSync(foreign), original);
  const f = fixture();
  f.store.close();
  const wrong = new DatabaseSync(f.path);
  wrong.exec("UPDATE metadata SET marker='FOREIGN'");
  wrong.close();
  const mismarked = readFileSync(f.path);
  errorCode(() => createStore(f.path), 'FOREIGN_STORE', 409);
  assert.deepEqual(readFileSync(f.path), mismarked);
  const link = join(directory, 'link.sqlite');
  symlinkSync(foreign, link);
  errorCode(() => createStore(link), 'FOREIGN_STORE', 409);
  assert.deepEqual(readFileSync(foreign), original);
  errorCode(() => createStore(':memory:'), 'INVALID_PATH', 400);
});

test('concurrent handles share committed stock and idempotency; closing revokes actor capability', () => {
  const f = fixture();
  const other = createStore(f.path);
  const [p2, m2] = other.actors();
  const sale = saleDraft(f);
  const request = input({ saleId: sale.id });
  f.store.finalizeSale(f.personnel, request);
  assert.equal(other.finalizeSale(p2, request).replayed, true);
  assert.equal(other.products(m2)[0].stock3, 8000);
  errorCode(() => other.products(f.personnel), 'INVALID_ACTOR', 401);
  const row = other.getSale(m2, sale.id);
  row.lines[0].qty3 = 999999;
  assert.equal(other.getSale(m2, sale.id).lines[0].qty3, 2000);
  f.store.close();
  errorCode(() => f.store.products(f.personnel), 'STORE_CLOSED', 503);
  other.close();
});

test('count revision, edit and submit transitions preserve stock; replay precedes revision check', () => {
  const f = fixture();
  const count = f.store.createCount(f.personnel, input({ productId: 101, qty3: 1000, metadata: { note: 'Sentetik kabul' } }));
  assert.equal(count.revision, documentRevision(count));
  errorCode(() => f.store.approveCount(f.manager, input({ countId: count.id })), 'NOT_SUBMITTED', 409);
  const updateRequest = input({ countId: count.id, lines: [{ productId: 101, qty3: 4000 }], expectedRevision: count.revision });
  const updated = f.store.updateCount(f.personnel, updateRequest);
  assert.notEqual(updated.revision, count.revision);
  assert.equal(updated.metadata.note, 'Sentetik kabul');
  assert.deepEqual(f.store.updateCount(f.personnel, updateRequest), { ...updated, replayed: true });
  errorCode(() => f.store.updateCount(f.personnel, { ...updateRequest, requestId: randomUUID() }), 'REVISION_CONFLICT', 409);
  errorCode(() => f.store.updateCount(f.other, input({ countId: count.id, lines: [{ productId: 101, qty3: 4000 }] })), 'FORBIDDEN', 403);
  const submitRequest = input({ countId: count.id, expectedRevision: updated.revision });
  const submitted = f.store.submitCount(f.personnel, submitRequest);
  assert.equal(submitted.status, 'SUBMITTED');
  assert.equal(f.store.products(f.manager)[0].stock3, 10000);
  assert.deepEqual(f.store.submitCount(f.personnel, submitRequest), { ...submitted, replayed: true });
  errorCode(() => f.store.updateCount(f.personnel, input({ countId: count.id, lines: [{ productId: 101, qty3: 1000 }] })), 'NOT_DRAFT', 409);
  f.store.approveCount(f.manager, input({ countId: count.id, expectedRevision: submitted.revision }));
  assert.equal(f.store.products(f.manager)[0].stock3, 14000);
  f.store.close();
});

test('transport changes conflict and sale/collection revisions guard new commands while allowing original replay', () => {
  const f = fixture();
  const orderRequest = input({ customerId: 501, lines: [{ productId: 101, qty3: 2000 }], transportHash: 'a'.repeat(64), metadata: { request: { customer_id: 501 } } });
  const order = f.store.createOrder(f.crm, orderRequest);
  errorCode(() => f.store.createOrder(f.crm, { ...orderRequest, transportHash: 'b'.repeat(64) }), 'REQUEST_CONFLICT', 409);
  assert.deepEqual(f.store.getOrder(f.crm, order.id).metadata, orderRequest.metadata);
  const sale = f.store.createSale(f.personnel, input({ orderId: order.id, metadata: { documentDate: '2026-10-19' } }));
  errorCode(() => f.store.finalizeSale(f.personnel, input({ saleId: sale.id, expectedRevision: '0'.repeat(64) })), 'REVISION_CONFLICT', 409);
  const finalizeRequest = input({ saleId: sale.id, expectedRevision: sale.revision });
  const finalized = f.store.finalizeSale(f.personnel, finalizeRequest);
  assert.deepEqual(f.store.finalizeSale(f.personnel, finalizeRequest), { ...finalized, replayed: true });
  const collectionRequest = input({ saleId: sale.id, customerId: 501, amount4: 200000, expectedRevision: finalized.revision, metadata: { documentDate: '2026-10-19' } });
  const collected = f.store.collectSale(f.manager, collectionRequest);
  assert.deepEqual(f.store.collectSale(f.manager, collectionRequest), { ...collected, replayed: true });
  errorCode(() => f.store.collectSale(f.manager, { ...collectionRequest, requestId: randomUUID() }), 'REVISION_CONFLICT', 409);
  assert.equal(collected.collections[0].metadata.documentDate, '2026-10-19');
  errorCode(() => f.store.createCount(f.personnel, input({ productId: 101, qty3: 1000, metadata: { token: 'synthetic-value' } })), 'INVALID_INPUT', 400);
  errorCode(() => f.store.createCount(f.personnel, input({ productId: 101, qty3: 1000, metadata: { note: 'x'.repeat(16385) } })), 'INVALID_INPUT', 400);
  f.store.close();
});
