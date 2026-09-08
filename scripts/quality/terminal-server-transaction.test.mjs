import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import * as idempotency from '../../apps/api/src/services/terminalSaleIdempotency.js';
import { runTerminalSaleSubmissionTransaction } from '../../apps/api/src/services/terminalSaleSubmissionTransaction.js';

const source = await readFile(new URL('../../apps/api/src/services/terminalService.js', import.meta.url), 'utf8');
const payload = () => ({ clientEventId: 'TEST-TX-01', terminalCode: 'TEST-DEVICE', customerId: 7,
  documentNumber: 'TEST-SALE', documentCurrency: 'TRY', exchangeRate: 1,
  items: [ { productId: 9, barcode: 'TEST9', quantity: 1, unitPrice: 10, currency: 'TRY' },
    { productId: 2, barcode: 'TEST2', quantity: 2, unitPrice: 10, currency: 'TRY' } ] });
const actor = { id: 5 };

// Runs the complete production submit handler and idempotency/orchestration code.
// SQL transport and invoice persistence are doubles: this proves binding and
// failure behavior, not SQL Server lock or rollback semantics.
async function harness(options = {}) {
  const calls = [];
  const durable = { ledger: null, invoice: null };
  const context = vm.createContext({ Error, Map, Set, Date, console });
  let tx;
  let tail = Promise.resolve();
  const check = name => {
    calls.push(name);
    if (options.failAt === name) throw Object.assign(new Error(`${name} failed`), { code: 'TEST_FAILURE' });
  };
  const pool = { request() { throw new Error('Query escaped the submission transaction'); } };
  class Transaction {
    constructor(receivedPool) { assert.equal(receivedPool, pool); tx = this; }
    async begin() { check('begin'); this.active = true; }
    async lock() {
      const predecessor = tail;
      tail = new Promise(resolve => { this.release = resolve; });
      await predecessor;
      this.data = structuredClone(durable);
    }
    async commit() {
      check('commit');
      Object.assign(durable, structuredClone(this.data));
      this.active = false;
      this.release?.();
      if (options.loseCommitReply) throw Object.assign(new Error('commit response lost'), { code: 'ECOMMIT' });
    }
    async rollback() { check('rollback'); this.active = false; this.release?.(); }
  }
  class Request {
    constructor(bound) { assert.ok(bound instanceof Transaction && bound.active); this.bound = bound; this.params = {}; }
    input(name, _type, value) { this.params[name] = value; return this; }
    async query(sql) {
      assert.ok(this.bound.active);
      const p = this.params;
      let rows = [];
      if (sql.includes('sys.sp_getapplock')) { check('lock'); await this.bound.lock(); rows = [{ lock_result: 0 }]; }
      else if (sql.includes('sys.indexes')) { check('schema'); rows = [{ is_ready: options.schemaMissing ? 0 : 1 }]; }
      else if (sql.includes('FROM dbo.terminal_sync_queue')) { check('read-ledger'); rows = this.bound.data.ledger ? [this.bound.data.ledger] : []; }
      else if (sql.includes('FROM dbo.sales_invoices si')) { check('legacy'); rows = options.legacy ? [{ id: 31 }] : []; }
      else if (sql.includes('FROM dbo.customers')) { check('customer'); rows = [{ id: 7, currency: 'TRY', isActive: true }]; }
      else if (sql.includes("OBJECT_ID(N'dbo.employees'")) { check('personnel-schema'); rows = [{ is_ready: 1, restrictions_ready: 1 }]; }
      else if (sql.includes('FROM dbo.terminal_devices')) { check('device'); rows = [{ terminal_device_id: 3, device_code: 'TEST-DEVICE', device_name: 'Test', device_is_active: 1,
        employee_id: 4, employee_code: 'TEST-EMP', employee_name: 'Test', employee_is_active: 1, can_terminal_sale: 1, can_change_sale_price: 0 }]; }
      else if (sql.includes('FROM dbo.products')) { check(`product-${p.lockedProductId}`); rows = [{ id: p.lockedProductId, stockCode: `TEST${p.lockedProductId}`, productName: 'Test',
        currency: 'TRY', salePrice: 10, averageCostTry: 2, isActive: true, barcode: `TEST${p.lockedProductId}` }]; }
      else if (sql.includes('FROM dbo.currency_rates')) { check('rates'); }
      else if (sql.includes('INSERT INTO dbo.terminal_sync_queue')) {
        check('reserve'); this.bound.data.ledger = { id: 11, terminalDeviceId: p.terminalLedgerDeviceId, userId: p.terminalLedgerUserId,
          eventType: 'invoice_created', payloadJson: p.terminalLedgerPayloadJson, status: 'processing', targetEntity: 'sales_invoice' }; rows = [{ ledgerId: 11 }];
      } else if (sql.includes('UPDATE dbo.terminal_sync_queue')) {
        check('complete'); Object.assign(this.bound.data.ledger, { status: 'synced', targetEntityId: p.terminalLedgerInvoiceId, payloadJson: p.terminalLedgerCompletedPayloadJson });
      } else throw new Error(`Unrecognized SQL in isolated double: ${sql.slice(0, 80)}`);
      return { recordset: rows, rowsAffected: [1] };
    }
  }
  const driver = { Transaction, Request, BigInt: 'bigint', NVarChar: size => size };
  const assertContext = c => { assert.equal(c.pool, pool); assert.equal(c.sqlDriver, driver); assert.ok(c.transaction.active); };
  const dependencies = {
    'mssql': { default: driver },
    '../config/database.js': { getSqlPool: async () => { check('pool'); return pool; }, getSqlDriver: () => driver },
    './writeGuardService.js': { assertMelisaWriteEnabled: () => { check('write-guard'); if (options.readOnly) throw Object.assign(new Error('disabled'), { code: 'SQL_WRITE_DISABLED' }); } },
    './terminalSaleIdempotency.js': idempotency,
    './terminalSaleSubmissionTransaction.js': { runTerminalSaleSubmissionTransaction },
    './customerService.js': { getCustomersList: () => { throw new Error('Unrelated customer read'); } },
    './vegaProductClientService.js': { getVegaProductsListFromWorker: () => { throw new Error('Vega access forbidden in submit'); } },
    './vegaProductImageService.js': { getVegaProductImageMap: () => { throw new Error('Vega access forbidden in submit'); } },
    './auditService.js': { writeAuditLog: async (request, record) => { assert.ok(request instanceof Request); check('audit'); assert.equal(record.afterSnapshot.terminalSyncLedgerId, 11); } },
    './invoiceDraftService.js': {
      prepareSalesInvoiceFinalization: async c => { assertContext(c); check('prepare'); },
      createSalesDraft: async (draft, a, c) => { assertContext(c); assert.equal(a, actor); check('create');
        c.transaction.data.invoice = { ...draft, id: 21, status: 'DRAFT', grandTotal: 30, terminalCode: 'TEST-DEVICE', terminalName: 'Test', employeeCode: 'TEST-EMP', employeeName: 'Test' };
        return c.transaction.data.invoice; },
      finalizeSalesInvoice: async (id, a, c) => { assertContext(c); assert.equal(a, actor); assert.equal(id, 21); check('finalize'); c.transaction.data.invoice.status = 'FINALIZED'; return c.transaction.data.invoice; },
      getSalesDraft: async (id, c) => { assertContext(c); assert.equal(id, 21); check('replay-invoice'); return c.transaction.data.invoice; },
    },
  };
  const module = new vm.SourceTextModule(source, { context });
  await module.link(specifier => {
    const exports = dependencies[specifier];
    if (!exports) throw new Error(`Unreviewed dependency: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { calls, durable, submit: module.namespace.submitTerminalSale, transaction: () => tx };
}

test('actual submit binds reads, draft, finalize, audit and ledger to one transaction; replay skips writes', async () => {
  const h = await harness();
  const first = await h.submit(payload(), actor);
  assert.equal(first.invoiceId, 21);
  assert.equal(first.duplicate, false);
  assert.deepEqual(h.calls, ['write-guard', 'pool', 'begin', 'schema', 'lock', 'read-ledger', 'legacy', 'prepare', 'customer',
    'personnel-schema', 'device', 'product-2', 'product-9', 'rates', 'reserve', 'create', 'finalize', 'audit', 'complete', 'commit']);
  h.calls.length = 0;
  const replay = await h.submit(payload(), actor);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.invoiceId, first.invoiceId);
  assert.deepEqual(h.calls, ['write-guard', 'pool', 'begin', 'schema', 'lock', 'read-ledger', 'replay-invoice', 'commit']);
});

test('actual submit rolls back every failure after reservation without leaving durable records', async () => {
  for (const failAt of ['create', 'finalize', 'audit', 'complete', 'commit']) {
    const h = await harness({ failAt });
    await assert.rejects(h.submit(payload(), actor), { code: failAt === 'commit' ? 'TERMINAL_SALE_OUTCOME_UNVERIFIED' : 'TEST_FAILURE' });
    assert.deepEqual(h.durable, { ledger: null, invoice: null });
    assert.equal(h.calls.at(-1), 'rollback');
  }
});

test('actual submit returns manual review when the commit reply is lost', async () => {
  const h = await harness({ loseCommitReply: true });
  await assert.rejects(h.submit(payload(), actor), { code: 'TERMINAL_SALE_OUTCOME_UNVERIFIED', originalCode: 'ECOMMIT', statusCode: 503 });
  assert.equal(h.durable.invoice.status, 'FINALIZED');
  assert.equal(h.durable.ledger.status, 'synced');
});

test('reused event with changed commercial payload or another owner cannot write again', async () => {
  const h = await harness();
  await h.submit(payload(), actor);
  const before = structuredClone(h.durable);
  h.calls.length = 0;
  await assert.rejects(h.submit({ ...payload(), customerId: 8 }, actor), { code: 'TERMINAL_SALE_IDEMPOTENCY_CONFLICT' });
  await assert.rejects(h.submit(payload(), { id: 6 }), { code: 'TERMINAL_SALE_IDEMPOTENCY_OWNER_MISMATCH' });
  assert.deepEqual(h.durable, before);
  assert.equal(h.calls.includes('prepare'), false);
});

test('missing schema and legacy events fail before commercial preparation', async () => {
  for (const [option, code] of [['schemaMissing', 'TERMINAL_SALE_IDEMPOTENCY_SCHEMA_MISSING'], ['legacy', 'TERMINAL_SALE_IDEMPOTENCY_LEGACY_UNVERIFIED']]) {
    const h = await harness({ [option]: true });
    await assert.rejects(h.submit(payload(), actor), { code });
    assert.equal(h.calls.includes('prepare'), false);
    assert.deepEqual(h.durable, { ledger: null, invoice: null });
  }
});

test('Vega-marked items and disabled writes stop before opening a SQL transaction', async () => {
  for (const item of [{ ...payload().items[0], productSource: 'vega' }, { ...payload().items[0], productId: 'vega-9' }]) {
    const h = await harness();
    await assert.rejects(h.submit({ ...payload(), items: [item] }, actor), { code: 'TERMINAL_VEGA_SALE_WRITE_DISABLED' });
    assert.deepEqual(h.calls, []);
  }
  const h = await harness({ readOnly: true });
  await assert.rejects(h.submit(payload(), actor), { code: 'SQL_WRITE_DISABLED' });
  assert.deepEqual(h.calls, ['write-guard']);
});

test('simultaneous actual submissions with the same identity create one invoice', async () => {
  const h = await harness();
  const results = await Promise.all([h.submit(payload(), actor), h.submit(payload(), actor)]);
  assert.deepEqual(results.map(r => r.duplicate).sort(), [false, true]);
  assert.equal(h.calls.filter(c => c === 'create').length, 1);
  assert.equal(h.calls.filter(c => c === 'finalize').length, 1);
  assert.equal(h.calls.filter(c => c === 'audit').length, 1);
});
