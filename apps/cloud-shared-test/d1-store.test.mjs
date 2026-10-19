import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStore, documentRevision as nodeRevision } from './store.mjs';
import { createD1Store, createD1Sessions, documentRevision, SCHEMA_MARKER } from './d1-store.mjs';
import { createWorker } from './worker.mjs';

// D1 contract backed by a fresh in-memory SQLite DB: real SQL, CAS and transactions.
class FakeD1 {
  db = new DatabaseSync(':memory:');
  updates = 0;
  sql = [];
  failUpdate = false;
  forceConflict = false;
  withSession(constraint) { assert.equal(constraint, 'first-primary'); return this; }
  prepare(sql) {
    this.sql.push(sql);
    const owner = this;
    const statement = (args = []) => ({
      bind(...values) { return statement(values); },
      async first() { return owner.db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: owner.db.prepare(sql).all(...args) }; },
      async run() {
        if (sql.startsWith('UPDATE synthetic_state')) {
          if (owner.failUpdate) throw new Error('synthetic write fault');
          owner.updates++;
          if (owner.forceConflict) return { meta: { changes: 0 } };
        }
        return { meta: { changes: Number(owner.db.prepare(sql).run(...args).changes) } };
      },
    });
    return statement();
  }
  async batch(statements) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const results = []; for (const s of statements) results.push(await s.run()); this.db.exec('COMMIT'); return results; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
const request = fields => ({ requestId: randomUUID(), ...fields });
const lines = qty3 => [{ productId: 101, qty3 }];
const rejects = (fn, code, status) => assert.rejects(fn, e => e.code === code && e.status === status);
const withoutTimes = snapshot => ({ ...snapshot, journal: snapshot.journal.map(({ createdAt, ...row }) => row) });

async function fixture(t) {
  const binding = new FakeD1();
  const store = await createD1Store(binding);
  t.after(() => binding.db.close());
  return { binding, store, actors: store.actors() };
}

test('D1 and SQLite produce identical revisions and complete domain/replay results', async t => {
  const { binding, store } = await fixture(t);
  const directory = mkdtempSync(join(tmpdir(), 'melisa-d1-parity-'));
  const node = createStore(join(directory, 'synthetic.sqlite'));
  t.after(() => { node.close(); rmSync(directory, { recursive: true }); });
  const both = async (method, actor, fields) => {
    const input = request(fields);
    const expected = node[method](node.actors()[actor], input);
    const actual = await store[method](store.actors()[actor], input);
    assert.deepEqual(actual, expected);
    assert.equal(actual.revision, documentRevision(actual));
    assert.equal(actual.revision, nodeRevision(actual));
    assert.deepEqual(await store[method](store.actors()[actor], input), { ...expected, replayed: true });
    assert.deepEqual(withoutTimes(await store.snapshot(store.actors()[1])), withoutTimes(node.snapshot(node.actors()[1])));
    return actual;
  };
  const count = await both('createCount', 0, { productId: 101, qty3: 1000, metadata: { note: 'Sentetik kabul — Türkçe 🧪' } });
  const edited = await both('updateCount', 0, { countId: count.id, lines: lines(4000), expectedRevision: count.revision });
  const submitted = await both('submitCount', 0, { countId: count.id, expectedRevision: edited.revision });
  await both('approveCount', 1, { countId: count.id, expectedRevision: submitted.revision });
  const order = await both('createOrder', 2, { customerId: 501, lines: lines(2000), metadata: { nested: [false, null, 'x'] }, transportHash: 'a'.repeat(64) });
  const sale = await both('createSale', 0, { orderId: order.id, metadata: { note: 'Sentetik satış' } });
  const finalized = await both('finalizeSale', 0, { saleId: sale.id, expectedRevision: sale.revision });
  await both('collectSale', 1, { saleId: sale.id, customerId: 501, amount4: 200000, expectedRevision: finalized.revision, metadata: { documentDate: '2026-10-19' } });
  for (const method of ['products','customers','suppliers','listCounts','getOrders','listSales']) {
    for (let actor=0;actor<4;actor++) assert.deepEqual(await store[method](store.actors()[actor]), node[method](node.actors()[actor]));
  }
  const reopened = await createD1Store(binding);
  assert.deepEqual(await reopened.snapshot(reopened.actors()[1]), await store.snapshot(store.actors()[1]));
});

test('invalid input, role, scope, metadata and changed fingerprints have no effects', async t => {
  const { store, actors: [p,m,c,o] } = await fixture(t);
  const before = await store.snapshot(m);
  for (const qty3 of [0, -1, .5, 1, 1001, NaN, Infinity, '1000', 1_000_000_001, Number.MAX_SAFE_INTEGER+1]) {
    await rejects(() => store.createOrder(c, request({ customerId: 501, lines: lines(qty3) })), 'INVALID_INPUT', 400);
  }
  await rejects(() => store.createOrder(c, request({ customerId: 502, lines: lines(1000) })), 'CUSTOMER_SCOPE', 403);
  await rejects(() => store.createOrder({ ...c }, request({ customerId: 501, lines: lines(1000) })), 'INVALID_ACTOR', 401);
  await rejects(() => store.createSale(c, request({ customerId: 501, lines: lines(1000) })), 'FORBIDDEN', 403);
  await rejects(() => store.approveCount(c, request({ countId: 1 })), 'FORBIDDEN', 403);
  await rejects(() => store.createOrder(c, request({ customerId: 501, lines: [...lines(1000), ...lines(1000)] })), 'INVALID_INPUT', 400);
  await rejects(() => store.createOrder(c, request({ customerId: 501, lines: [{ productId: 999, qty3: 1000 }] })), 'NOT_FOUND', 404);
  for (const metadata of [{ token: 'synthetic' }, { note: 'x'.repeat(16385) }]) await rejects(() => store.createCount(p, request({ productId: 101, qty3: 1000, metadata })), 'INVALID_INPUT', 400);
  await rejects(() => store.createOrder(c, Object.assign(Object.create(null), request({ customerId: 501, lines: lines(1000) }))), 'INVALID_INPUT', 400);
  await rejects(() => store.createCount(p, request({ productId: 101, qty3: 1000, metadata: { note: () => 'invalid' } })), 'INVALID_INPUT', 400);
  assert.deepEqual(await store.snapshot(m), before);
  const input = request({ customerId: 501, lines: lines(1000), metadata: { a: 1, b: 2 }, transportHash: 'a'.repeat(64) });
  const order = await store.createOrder(c,input);
  assert.deepEqual(await store.createOrder(c,{ transportHash: input.transportHash, metadata: { b: 2, a: 1 }, lines: [{ qty3: 1000, productId: 101 }], customerId: 501, requestId: input.requestId }), { ...order, replayed: true });
  for (const change of [{ transportHash: 'b'.repeat(64) }, { metadata: { a: 2 } }, { lines: lines(2000) }]) await rejects(() => store.createOrder(c,{ ...input, ...change }), 'REQUEST_CONFLICT', 409);
  await rejects(() => store.createOrder(p,input), 'REQUEST_CONFLICT', 409);
  await rejects(() => store.getOrder(o,order.id), 'CUSTOMER_SCOPE', 403);
  const sale = await store.createSale(p,request({orderId:order.id}));
  await rejects(() => store.createSale(p,request({orderId:order.id})), 'ORDER_ALREADY_LINKED',409);
  await rejects(() => store.finalizeSale(p,request({saleId:sale.id,expectedRevision:'0'.repeat(64)})), 'REVISION_CONFLICT',409);
  const finalized = await store.finalizeSale(p,request({saleId:sale.id,expectedRevision:sale.revision}));
  await rejects(() => store.collectSale(m,request({saleId:sale.id,customerId:502,amount4:1})), 'CUSTOMER_SCOPE',403);
  await rejects(() => store.collectSale(m,request({saleId:sale.id,customerId:501,amount4:250001})), 'OVERPAYMENT',409);
  await rejects(() => store.collectSale(p,request({saleId:sale.id,customerId:501,amount4:1})), 'FORBIDDEN',403);
  const collection = request({saleId:sale.id,customerId:501,amount4:1,expectedRevision:finalized.revision});
  const collected = await store.collectSale(m,collection);
  await rejects(() => store.collectSale(m,{...collection,requestId:randomUUID()}), 'REVISION_CONFLICT',409);
  assert.deepEqual(await store.collectSale(m,collection),{...collected,replayed:true});
  assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(store.actors()));
  store.close(); await rejects(() => store.products(p),'STORE_CLOSED',503);
});

test('CAS contention revalidates and concurrent replay has exactly one stock/balance/journal effect', async t => {
  const { binding, store, actors: [p,m] } = await fixture(t);
  const second = await createD1Store(binding);
  const sale = await store.createSale(p,request({customerId:501,lines:lines(2000)}));
  const input = request({saleId:sale.id,expectedRevision:sale.revision});
  const results = await Promise.all([store.finalizeSale(p,input),second.finalizeSale(second.actors()[0],input)]);
  assert.deepEqual(results.map(r=>r.replayed).sort(),[false,true]);
  assert.equal((await store.products(m))[0].stock3,8000);
  assert.equal((await store.customers(m))[0].balance4,500000);
  assert.equal((await store.snapshot(m)).journal.length,2);
  const collection = request({saleId:sale.id,customerId:501,amount4:200000});
  await Promise.all([store.collectSale(m,collection),second.collectSale(second.actors()[1],collection)]);
  assert.equal((await store.customers(m))[0].balance4,300000);
  const newRequests = Array.from({length:6},()=>store.createOrder(p,request({customerId:501,lines:lines(1000)})));
  const orders = await Promise.all(newRequests);
  assert.equal(new Set(orders.map(r=>r.id)).size,6);
  assert.equal((await store.snapshot(m)).journal.length,9);
  await rejects(()=>second.products(p),'INVALID_ACTOR',401);
});

test('domain failure, persistence failure and exhausted contention leave durable state untouched', async t => {
  const {binding,store,actors:[p,m]}=await fixture(t);
  const sale=await store.createSale(p,request({customerId:501,lines:[...lines(1000),{productId:102,qty3:9000}]}));
  const before=await store.snapshot(m);
  await rejects(()=>store.finalizeSale(p,request({saleId:sale.id})),'INSUFFICIENT_STOCK',409);
  assert.deepEqual(await store.snapshot(m),before);
  binding.failUpdate=true;
  await assert.rejects(()=>store.createCount(p,request({productId:101,qty3:1000})),/synthetic write fault/);
  assert.deepEqual(await store.snapshot(m),before);
  binding.failUpdate=false; binding.forceConflict=true;
  await rejects(()=>store.createCount(p,request({productId:101,qty3:1000})),'STORE_BUSY',409);
  binding.forceConflict=false;
  assert.deepEqual(await store.snapshot(m),before);
});

test('foreign, empty and mismarked schemas are rejected without reseeding; Cloudflare internal tables allowed', async t => {
  for (const setup of ["CREATE TABLE real_business(id INTEGER)","CREATE TABLE synthetic_state(id TEXT,marker TEXT,revision INTEGER,data TEXT)"]) {
    const binding=new FakeD1(); t.after(()=>binding.db.close()); binding.db.exec(setup);
    const before=binding.db.prepare("SELECT name,sql FROM sqlite_master ORDER BY name").all();
    await rejects(()=>createD1Store(binding),'FOREIGN_STORE',409);
    assert.deepEqual(binding.db.prepare("SELECT name,sql FROM sqlite_master ORDER BY name").all(),before);
  }
  const {binding}=await fixture(t);
  binding.db.exec("CREATE TABLE _cf_KV(key TEXT,value TEXT)");
  const reopened=await createD1Store(binding);
  assert.equal((await reopened.snapshot(reopened.actors()[1])).schemaMarker,SCHEMA_MARKER);
  binding.db.prepare('UPDATE synthetic_state SET marker=?').run('FOREIGN');
  const before=binding.db.prepare('SELECT * FROM synthetic_state').get();
  await rejects(()=>createD1Store(binding),'FOREIGN_STORE',409);
  assert.deepEqual(binding.db.prepare('SELECT * FROM synthetic_state').get(),before);
});

test('session persistence, expiry, deletion and bounded cleanup never modify business state', async t => {
  const {binding,store,actors:[,m]}=await fixture(t);
  const before=await store.snapshot(m);
  const sessions=await createD1Sessions(binding);
  const id='synthetic_session_opaque_id';
  const value={csrf:'synthetic_csrf',accessToken:'synthetic_ephemeral',actorId:15,expiresAt:Date.now()+60000};
  await sessions.set(id,value);
  const reopened=await createD1Sessions(binding);
  assert.deepEqual(await reopened.get(id),value);
  const copy=await reopened.get(id); copy.actorId=16;
  assert.equal((await sessions.get(id)).actorId,15);
  binding.db.prepare('UPDATE synthetic_sessions SET expiresAt=? WHERE id=?').run(Date.now()-1,id);
  assert.equal(await reopened.get(id),undefined);
  for(let i=0;i<40;i++) binding.db.prepare('INSERT INTO synthetic_sessions VALUES (?,?,?)').run(`expired_session_${i}`,'{}',Date.now()-1);
  await sessions.set(id,value);
  assert.equal(binding.db.prepare('SELECT count(*) AS n FROM synthetic_sessions WHERE expiresAt<=?').get(Date.now()).n,8);
  await reopened.delete(id);
  assert.equal(await sessions.get(id),undefined);
  await rejects(()=>sessions.set(id,{...value,expiresAt:Date.now()-1}),'INVALID_SESSION',400);
  assert.deepEqual(await store.snapshot(m),before);
});


test('schema-managed mode requires migrated tables and never performs runtime DDL', async t => {
  const binding = new FakeD1(); t.after(() => binding.db.close());
  await rejects(() => createD1Store(binding, { schemaManaged: true }), 'SCHEMA_NOT_READY', 503);
  await rejects(() => createD1Sessions(binding, { schemaManaged: true }), 'SCHEMA_NOT_READY', 503);
  assert.deepEqual(binding.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(), []);
  assert.ok(binding.sql.every(sql => !/^(?:CREATE|ALTER|DROP)\b/i.test(sql)));
  const migration = readFileSync(new URL('./migrations/0001_synthetic.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE)\b/i);
  binding.db.exec(migration);
  assert.equal(binding.db.prepare('SELECT count(*) AS n FROM synthetic_state').get().n, 0);
  binding.db.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT)');
  binding.sql.length = 0;
  const store = await createD1Store(binding, { schemaManaged: true });
  const [personnel, manager] = store.actors();
  const count = await store.createCount(personnel, request({ productId: 101, qty3: 1000 }));
  assert.equal(count.id, 1);
  const before = await store.snapshot(manager);
  const sessions = await createD1Sessions(binding, { schemaManaged: true });
  const id = 'managed_synthetic_session';
  const session = { actorId: 15, csrf: 'synthetic', accessToken: 'synthetic', expiresAt: Date.now()+60000 };
  await sessions.set(id, session);
  assert.deepEqual(await sessions.get(id), session);
  const reopened = await createD1Store(binding, { schemaManaged: true });
  assert.deepEqual(await reopened.snapshot(reopened.actors()[1]), before);
  assert.ok(binding.sql.every(sql => !/^(?:CREATE|ALTER|DROP)\b/i.test(sql)));
  binding.db.prepare('UPDATE synthetic_state SET marker=?').run('FOREIGN');
  const foreign = binding.db.prepare('SELECT * FROM synthetic_state').get();
  await rejects(() => createD1Store(binding, { schemaManaged: true }), 'FOREIGN_STORE', 409);
  assert.deepEqual(binding.db.prepare('SELECT * FROM synthetic_state').get(), foreign);
});

test('schema-managed mode rejects unsupported definitions without seeding', async t => {
  const binding = new FakeD1(); t.after(() => binding.db.close());
  binding.db.exec("CREATE TABLE synthetic_state(id TEXT PRIMARY KEY,marker TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL); CREATE TABLE synthetic_sessions(id TEXT PRIMARY KEY,value TEXT NOT NULL,expiresAt INTEGER NOT NULL)");
  await rejects(() => createD1Store(binding, { schemaManaged: true }), 'FOREIGN_STORE', 409);
  assert.equal(binding.db.prepare('SELECT count(*) AS n FROM synthetic_state').get().n, 0);
  assert.ok(binding.sql.every(sql => !/^(?:CREATE|ALTER|DROP)\b/i.test(sql)));
});


test('Worker HTTP with migrated D1 preserves opaque sessions and one-effect receiving/CRM/sale/collection across fresh handles', async t => {
  const binding = new FakeD1(); t.after(() => binding.db.close());
  binding.db.exec(readFileSync(new URL('./migrations/0001_synthetic.sql', import.meta.url), 'utf8'));
  const origin = 'https://synthetic-worker.invalid', prefix = '/api/cloud-test';
  const env = { DB: binding };
  const platform = { 'oai-authenticated-user-id': 'synthetic-owner-fixture' };
  assert.equal((await createWorker().fetch(new Request(origin + prefix + '/session'), env)).status, 401);
  assert.equal(binding.db.prepare('SELECT count(*) AS n FROM synthetic_state').get().n, 0, 'platform identity is required before opening the store');
  const browser = () => {
    const credentials = { cookie: null, csrf: null, bearer: null };
    return {
      credentials,
      async request(path, body, overrides = {}) {
        const headers = { ...platform,
          ...(credentials.cookie ? { cookie: credentials.cookie } : {}),
          ...(credentials.bearer ? { authorization: 'Bearer ' + credentials.bearer } : {}) };
        if (body !== undefined) Object.assign(headers, { origin, 'content-type': 'application/json', 'x-cloud-csrf': credentials.csrf ?? '' });
        for (const [name, value] of Object.entries(overrides)) { if (value === null) delete headers[name]; else headers[name] = value; }
        // Every request gets a new Worker, application, store and session adapter.
        const response = await createWorker().fetch(new Request(origin + prefix + path, { method: body === undefined ? 'GET' : 'POST', headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
        const cookie = response.headers.get('set-cookie');
        if (cookie) credentials.cookie = cookie.split(';')[0];
        return { status: response.status, headers: response.headers, body: await response.json() };
      },
      async ok(path, body) {
        const response = await this.request(path, body);
        assert.equal(response.status, 200, path);
        assert.equal(response.body.success, true, path);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        return response.body.data;
      },
      async login(actorId) {
        const initial = await this.request('/session');
        assert.equal(initial.status, 200);
        assert.match(initial.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Path=\/; Secure/);
        credentials.csrf = initial.body.data.csrfToken;
        const selected = await this.ok('/session', { actorId });
        assert.equal(selected.user.id, actorId);
        assert.match(selected.accessToken, /^[a-f0-9]{64}$/);
        assert.match(selected.csrfToken, /^[a-f0-9]{64}$/);
        assert.notEqual(selected.csrfToken, credentials.csrf);
        credentials.csrf = selected.csrfToken; credentials.bearer = selected.accessToken;
        const persisted = await this.ok('/session');
        assert.equal(persisted.user.id, actorId);
        assert.equal(persisted.csrfToken === credentials.csrf, true);
        assert.equal(persisted.accessToken === credentials.bearer, true);
        return this;
      },
    };
  };
  const personnel = await browser().login(15), manager = await browser().login(16), crm = await browser().login(17);
  const initial = await manager.ok('/snapshot');
  assert.equal(initial.products[0].stock3, 10000);
  assert.equal(initial.customers[0].balance4, 0);
  const countRequest = request({ note: 'Sentetik Worker kabulü', lines: [{ clientLineId: 'line-101', productId: '101', stockCode: 'SYN-101', barcode: '8690000000101',
    physicalQuantityExact3: '4.000', expectedQuantityExact3: null, issue: null, note: '' }] });
  for (const [path, body, overrides, status, code] of [
    ['/catalog', undefined, { authorization: null }, 401, 'SYNTHETIC_SESSION_REQUIRED'],
    ['/catalog', undefined, { authorization: 'Bearer ' + '0'.repeat(64) }, 401, 'SYNTHETIC_SESSION_REQUIRED'],
    ['/catalog', undefined, { cookie: null }, 401, 'SYNTHETIC_SESSION_REQUIRED'],
    ['/work-receiving/count-drafts', countRequest, { 'x-cloud-csrf': null }, 403, 'CSRF_REJECTED'],
    ['/work-receiving/count-drafts', countRequest, { 'x-cloud-csrf': '0'.repeat(64) }, 403, 'CSRF_REJECTED'],
    ['/work-receiving/count-drafts', countRequest, { origin: 'https://other.invalid' }, 403, 'CSRF_REJECTED'],
  ]) {
    const rejected = await personnel.request(path, body, overrides);
    assert.equal(rejected.status, status, path); assert.equal(rejected.body.error.code, code, path);
  }
  assert.deepEqual(await manager.ok('/snapshot'), initial);
  const count = await personnel.ok('/work-receiving/count-drafts', countRequest);
  assert.deepEqual(await personnel.ok('/work-receiving/count-drafts', countRequest), { ...count, replayed: true });
  const submitRequest = request({ expectedRevision: count.draft.revision });
  const submitted = await personnel.ok(`/work-receiving/count-drafts/${count.draft.id}/submit`, submitRequest);
  assert.equal(submitted.receipt.state, 'pending');
  assert.equal((await manager.ok('/snapshot')).products[0].stock3, 10000);
  const approvalRequest = request({});
  const approvalPath = `/work-receiving/receipts/${count.draft.id}/approve`;
  const approved = await manager.ok(approvalPath, approvalRequest);
  assert.equal(approved.receipt.state, 'accepted');
  assert.deepEqual(await manager.ok(approvalPath, approvalRequest), { ...approved, replayed: true });
  assert.equal((await manager.ok('/snapshot')).products[0].stock3, 14000);
  const match = await crm.ok('/erp/customers?conversationId=55&phone=9000000000501'), customer = match.entries[0];
  const draftRequest = request({ conversationId: 55, peer: customer.phone, customerId: customer.id,
    customerMatch: { phone: customer.phone, basis: 'exact-phone', revision: customer.revision, reason: null }, documentCurrency: 'TRY', exchangeRateExact8: '1.00000000',
    items: [{ productId: 101, stockCode: 'SYN-101', priceId: 101, unitSourceId: 1, tier: 1, currency: 'TRY', priceExact8: '25.00000000', priceSourceKey: 'cloud-synthetic:price:101', quantity: 2 }] });
  const order = await crm.ok('/erp/drafts', draftRequest);
  assert.equal(order.grandTotalExact4, '50.0000');
  assert.deepEqual(await crm.ok('/erp/drafts', draftRequest), order);
  assert.deepEqual(await crm.ok(`/erp/drafts/${draftRequest.requestId}`), order);
  for (const effect of ['stockEffect', 'ledgerEffect', 'collectionEffect', 'reservationEffect']) assert.equal(order[effect], false);
  const saleRequest = request({}), salePath = `/erp/orders/${order.id}/sale`;
  const sale = await personnel.ok(salePath, saleRequest);
  assert.deepEqual(await personnel.ok(salePath, saleRequest), sale);
  const draftState = await manager.ok('/snapshot');
  assert.equal(draftState.products[0].stock3, 14000); assert.equal(draftState.customers[0].balance4, 0);
  const finalizeRequest = request({ expectedRevision: sale.revision }), finalizePath = `/work-sales/drafts/${sale.id}/finalize`;
  const finalized = await personnel.ok(finalizePath, finalizeRequest);
  assert.equal(finalized.invoice.collections.outstandingExact4, '50.0000');
  assert.deepEqual(await personnel.ok(finalizePath, finalizeRequest), { ...finalized, replayed: true });
  const finalizedState = await manager.ok('/snapshot');
  assert.equal(finalizedState.products[0].stock3, 12000); assert.equal(finalizedState.customers[0].balance4, 500000);
  const selection = { invoiceId: sale.id, accountId: '701', amountExact4: '20.0000', documentDate: '2026-10-19' };
  const preview = await manager.ok('/work-collections/preview', selection);
  const collectionRequest = request({ ...selection, expectedRevision: preview.revision, previewHash: preview.previewHash });
  const collected = await manager.ok('/work-collections', collectionRequest);
  assert.equal(collected.invoice.collections.outstandingExact4, '30.0000');
  assert.equal(collected.invoice.customerBalanceExact4, '30.0000');
  const finalState = await manager.ok('/snapshot');
  assert.equal(finalState.products[0].stock3, 12000); assert.equal(finalState.customers[0].balance4, 300000);
  assert.equal(finalState.orders.length, 1); assert.equal(finalState.sales.length, 1);
  assert.equal(finalState.sales[0].collections.length, 1);
  assert.equal(finalState.journal.length, 7);
  assert.equal(new Set(finalState.journal.map(row => row.requestId)).size, 7);
  // A new browser facade reuses only the persisted cookie/CSRF/bearer, with no login.
  const resumed = browser(); Object.assign(resumed.credentials, manager.credentials);
  assert.deepEqual(await resumed.ok('/snapshot'), finalState);
  assert.deepEqual(await resumed.ok('/work-collections', collectionRequest), { ...collected, replayed: true });
  assert.deepEqual(await resumed.ok('/snapshot'), finalState);
  assert.ok(binding.sql.every(sql => !/^(?:CREATE|ALTER|DROP)\b/i.test(sql)), 'HTTP request handling must not run migration DDL');
});
