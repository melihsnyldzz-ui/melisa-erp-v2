import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createProductBrainNotifier } from './productBrainNotifier.mjs';

// All SQL, audit, image writes and notifier transport in this file are fixtures.
// Run with --experimental-test-module-mocks. No business connection is opened.
let fixture;
const trace = (stage) => {
  fixture.trace.push(stage);
  if (fixture.failAt === stage) throw new Error(`FIXTURE_${stage.toUpperCase()}_FAILURE`);
};
class Request {
  input() { return this; }
  async query(query) {
    if (query.includes('OBJECT_ID')) {
      trace('schema');
      return { recordset: [{ is_ready: 1 }] };
    }
    if (query.includes('INSERT')) {
      trace('insert');
      return { recordset: [{ id: 101 }] };
    }
    trace('update');
    return { recordset: [{ id: 100, file_path: '/fixture/old.jpg' }], rowsAffected: [1] };
  }
}
class Transaction {
  async begin() { trace('begin'); }
  async commit() { trace('commit'); }
  async rollback() { trace('rollback'); }
}

mock.module('../config/database.js', {
  namedExports: {
    getSqlDriver: () => ({ Transaction, Request, BigInt: 'fixture', NVarChar: () => 'fixture' }),
    getSqlPool: async () => ({ request: () => new Request() }),
  },
});
mock.module('./auditService.js', { namedExports: { writeAuditLog: async () => trace('audit') } });
mock.module('./writeGuardService.js', { namedExports: { assertMelisaWriteEnabled: () => trace('guard') } });
mock.module('node:fs/promises', {
  namedExports: {
    mkdir: async () => trace('mkdir'),
    writeFile: async () => trace('writeFile'),
    rename: async () => trace('rename'),
    unlink: async () => trace('unlink'),
  },
});
mock.module('./productBrainNotifier.mjs', {
  namedExports: { notifyProductBrain: (sourceId) => { trace('notify'); fixture.notify(sourceId); } },
});
const { saveVegaProductImage, removeVegaProductImage } = await import('./vegaProductImageService.js');

function resetFixture({ failAt, send } = {}) {
  fixture = { failAt, trace: [], notifications: [], warnings: [] };
  fixture.notify = createProductBrainNotifier({
    environment: { PB_NOTIFIER_ENABLED: 'true', PB_EVENT_KEY_PATH: 'fixture' },
    readKeyFile: async () => 'ab'.repeat(32),
    send: send || (async (_url, options) => {
      fixture.notifications.push(JSON.parse(options.body));
      return { ok: true };
    }),
    warn: (message) => fixture.warnings.push(message),
  });
}
const save = (payload = { filePath: '/fixture/new.jpg' }) =>
  saveVegaProductImage(42, payload, { id: 7 }, { stockCode: 'FIXTURE-42', productName: 'Fixture' });

test('new upload fixture notifies strictly after audit and successful commit', async () => {
  resetFixture();
  const result = await save({ fileBase64: 'ZmFrZS1pbWFnZQ==', mimeType: 'image/png', fileName: 'fixture.png' });
  assert.equal(result.sourceId, 42);
  assert.deepEqual(fixture.trace.filter((stage) => stage !== 'rename'), ['guard', 'schema', 'mkdir', 'writeFile', 'begin', 'update', 'insert', 'audit', 'commit', 'notify']);
  await setImmediate();
  assert.equal(fixture.notifications.length, 1);
  assert.equal(fixture.notifications[0].sourceId, '42');
});

test('replacement at the same address and repeated save each invalidate the source', async () => {
  resetFixture();
  await save();
  await save();
  await setImmediate();
  assert.equal(fixture.notifications.length, 2);
  assert.notEqual(fixture.notifications[0].eventId, fixture.notifications[1].eventId);
  assert.deepEqual(fixture.notifications.map((entry) => entry.sourceId), ['42', '42']);
});

test('remove notifies only after its image update and audit commit', async () => {
  resetFixture();
  const result = await removeVegaProductImage(42, { id: 7 });
  assert.deepEqual(result, { sourceId: 42, removed: 1 });
  assert.deepEqual(fixture.trace, ['guard', 'schema', 'begin', 'update', 'audit', 'commit', 'notify']);
  await setImmediate();
  assert.equal(fixture.notifications.length, 1);
});

for (const operation of ['save', 'remove']) {
  for (const failAt of ['guard', 'schema', 'begin', 'update', 'audit', 'commit', ...(operation === 'save' ? ['insert'] : [])]) {
    test(`${operation} ${failAt} failure never sends an image notification`, async () => {
      resetFixture({ failAt });
      await assert.rejects(operation === 'save' ? save() : removeVegaProductImage(42), new RegExp(`FIXTURE_${failAt.toUpperCase()}_FAILURE`));
      await setImmediate();
      assert.equal(fixture.notifications.length, 0);
      assert.equal(fixture.trace.includes('notify'), false);
      if (['update', 'insert', 'audit', 'commit'].includes(failAt)) assert.equal(fixture.trace.at(-1), 'rollback');
    });
  }

  test(`${operation} finishes while notification is pending and survives notifier failure`, async () => {
    let rejectSend;
    resetFixture({ send: () => new Promise((_resolve, reject) => { rejectSend = reject; }) });
    const result = await Promise.race([
      operation === 'save' ? save() : removeVegaProductImage(42),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('Upload waited for notifier')), 250).unref()),
    ]);
    assert.equal(result.sourceId, 42);
    await setImmediate();
    assert.equal(typeof rejectSend, 'function');
    rejectSend(new Error('FIXTURE_NOTIFIER_DOWN'));
    await setImmediate();
    assert.deepEqual(fixture.warnings, ['PRODUCT_BRAIN_HINT_DEFERRED_TO_RECONCILIATION']);
    assert.equal(fixture.trace.includes('rollback'), false);
  });
}
