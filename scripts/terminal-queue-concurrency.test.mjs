import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const queueSource = await readFile(
  resolve(repoRoot, 'apps/terminal-app/src/services/queueService.js'),
  'utf8',
);

function baseEvent(overrides = {}) {
  return {
    clientEventId: 'TERM-01-event-1',
    deviceName: 'Test Terminal',
    terminalCode: 'TERM-01',
    eventType: 'terminal_sale',
    payload: { customerId: 7, items: [{ productId: 3, quantity: 1, unitPrice: 10 }] },
    status: 'pending',
    retryCount: 0,
    clientCreatedAt: '2026-09-01T00:00:00.000Z',
    lastAttemptAt: null,
    nextRetryAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

async function loadQueueService(
  initialQueue = [],
  submitImplementation = async () => ({ data: { duplicate: false } }),
  { storageWriteError = null } = {},
) {
  const context = vm.createContext({ console, Date, Error, JSON, Map, Math, Promise, Set, String });
  let storedQueue = typeof initialQueue === 'string' ? initialQueue : JSON.stringify(initialQueue);
  let submit = submitImplementation;

  const asyncStorageModule = new vm.SyntheticModule(['default'], function initialize() {
    this.setExport('default', {
      async getItem() {
        return storedQueue;
      },
      async setItem(_key, value) {
        if (storageWriteError) throw storageWriteError;
        storedQueue = value;
      },
    });
  }, { context });
  const configModule = new vm.SyntheticModule(['terminalConfig'], function initialize() {
    this.setExport('terminalConfig', { terminalCode: 'TERM-01', deviceName: 'Test Terminal' });
  }, { context });
  const salesModule = new vm.SyntheticModule(['submitTerminalSale'], function initialize() {
    this.setExport('submitTerminalSale', (...args) => submit(...args));
  }, { context });
  const queueModule = new vm.SourceTextModule(queueSource, {
    context,
    identifier: 'queueService.js',
  });

  await queueModule.link(async (specifier) => {
    if (specifier === '@react-native-async-storage/async-storage') return asyncStorageModule;
    if (specifier === '../config/env') return configModule;
    if (specifier === './terminalSalesService') return salesModule;
    throw new Error(`Unexpected import: ${specifier}`);
  });
  await queueModule.evaluate();

  return {
    service: queueModule.namespace,
    queue: () => JSON.parse(storedQueue),
    rawQueue: () => storedQueue,
    setSubmit(nextSubmit) {
      submit = nextSubmit;
    },
  };
}

test('manual-review events cannot be edited, deleted or sent', async () => {
  let submitCount = 0;
  const harness = await loadQueueService([
    baseEvent({
      status: 'failed',
      lastErrorCode: 'TERMINAL_SALE_OUTCOME_UNVERIFIED',
    }),
  ], async () => {
    submitCount += 1;
    return { data: { duplicate: false } };
  });

  for (const operation of [
    () => harness.service.updateQueueEventPayload('TERM-01-event-1', { changed: true }),
    () => harness.service.removeQueueEvent('TERM-01-event-1'),
    () => harness.service.syncTerminalSaleEvent('TERM-01-event-1', { token: 'opaque-test-token' }),
  ]) {
    await assert.rejects(operation(), { code: 'TERMINAL_SALE_MANUAL_REVIEW_REQUIRED' });
  }

  assert.equal(submitCount, 0);
  assert.equal(harness.queue()[0].lastErrorCode, 'TERMINAL_SALE_OUTCOME_UNVERIFIED');
});

test('concurrent sends for one event call the API once and reuse the verified result', async () => {
  let submitCount = 0;
  let releaseSubmit;
  const submitGate = new Promise((resolveGate) => {
    releaseSubmit = resolveGate;
  });
  const harness = await loadQueueService([baseEvent()], async () => {
    submitCount += 1;
    await submitGate;
    return { data: { duplicate: false, invoiceId: 44 } };
  });

  const first = harness.service.syncTerminalSaleEvent('TERM-01-event-1', { token: 'opaque-test-token' });
  const second = harness.service.syncTerminalSaleEvent('TERM-01-event-1', { token: 'opaque-test-token' });
  await new Promise((resolveTick) => setImmediate(resolveTick));
  releaseSubmit();
  const results = await Promise.all([first, second]);

  assert.equal(submitCount, 1);
  assert.deepEqual(results.map((result) => result.duplicate), [false, true]);
  assert.equal(harness.queue()[0].status, 'synced');
  assert.equal(harness.queue()[0].serverResponse.invoiceId, 44);
});

test('manual-review and synced states cannot be downgraded by later failures', async () => {
  const manual = await loadQueueService([baseEvent()]);
  await Promise.all([
    manual.service.markQueueFailed('TERM-01-event-1', {
      code: 'TERMINAL_SALE_OUTCOME_UNVERIFIED',
      message: 'outcome unknown',
    }),
    manual.service.markQueueFailed('TERM-01-event-1', {
      code: 'NETWORK_BUSY',
      message: 'network busy',
    }),
  ]);
  assert.equal(manual.queue()[0].lastErrorCode, 'TERMINAL_SALE_OUTCOME_UNVERIFIED');

  const synced = await loadQueueService([baseEvent({ status: 'synced', serverResponse: { invoiceId: 44 } })]);
  await synced.service.markQueueFailed('TERM-01-event-1', {
    code: 'NETWORK_BUSY',
    message: 'late failure',
  });
  assert.equal(synced.queue()[0].status, 'synced');
  assert.equal(synced.queue()[0].serverResponse.invoiceId, 44);
});

test('edit and delete wait for an in-flight send and cannot alter its verified result', async () => {
  let releaseSubmit;
  const submitGate = new Promise((resolveGate) => {
    releaseSubmit = resolveGate;
  });
  const harness = await loadQueueService([baseEvent()], async () => {
    await submitGate;
    return { data: { duplicate: false, invoiceId: 44 } };
  });

  const sending = harness.service.syncTerminalSaleEvent('TERM-01-event-1', { token: 'opaque-test-token' });
  await new Promise((resolveTick) => setImmediate(resolveTick));
  const editing = harness.service.updateQueueEventPayload('TERM-01-event-1', { changed: true });
  const deleting = harness.service.removeQueueEvent('TERM-01-event-1');
  releaseSubmit();

  await assert.doesNotReject(sending);
  await assert.rejects(editing, { code: 'QUEUE_EVENT_ALREADY_SYNCED' });
  await assert.rejects(deleting, { code: 'QUEUE_EVENT_ALREADY_SYNCED' });
  assert.equal(harness.queue().length, 1);
  assert.equal(harness.queue()[0].payload.customerId, 7);
  assert.equal(harness.queue()[0].status, 'synced');
});

test('manual review cannot be cleared by a generic local success marker', async () => {
  const harness = await loadQueueService([
    baseEvent({ status: 'failed', lastErrorCode: 'TERMINAL_SALE_IDEMPOTENCY_CONFLICT' }),
  ]);

  await harness.service.markQueueSynced('TERM-01-event-1', { invoiceId: 44 });
  assert.equal(harness.queue()[0].status, 'failed');
  assert.equal(harness.queue()[0].lastErrorCode, 'TERMINAL_SALE_IDEMPOTENCY_CONFLICT');
  assert.equal(harness.queue()[0].serverResponse, undefined);
});

test('an explicit event id is created once and updates the same unsent queue record', async () => {
  const harness = await loadQueueService();

  await harness.service.persistTerminalSaleEvent('TERM-01-stable-event', { customerId: 7 });
  await harness.service.persistTerminalSaleEvent('TERM-01-stable-event', { customerId: 8 });

  assert.equal(harness.queue().length, 1);
  assert.equal(harness.queue()[0].clientEventId, 'TERM-01-stable-event');
  assert.equal(harness.queue()[0].payload.customerId, 8);
});

test('corrupt queue storage fails closed and preserves the raw pending evidence', async () => {
  const corruptRaw = '{not-valid-json';
  const harness = await loadQueueService(corruptRaw);

  await assert.rejects(harness.service.getPendingQueue(), {
    code: 'TERMINAL_QUEUE_STORAGE_CORRUPT',
  });
  await assert.rejects(
    harness.service.persistTerminalSaleEvent('TERM-01-new-event', { customerId: 7 }),
    { code: 'TERMINAL_QUEUE_STORAGE_CORRUPT' },
  );
  assert.equal(harness.rawQueue(), corruptRaw);
});

test('invalid queue record shape also fails closed without overwriting evidence', async () => {
  const invalidRaw = JSON.stringify([{ status: 'pending', payload: {} }]);
  const harness = await loadQueueService(invalidRaw);

  await assert.rejects(harness.service.getPendingQueue(), {
    code: 'TERMINAL_QUEUE_STORAGE_CORRUPT',
  });
  assert.equal(harness.rawQueue(), invalidRaw);
});

test('a present but empty storage value is corrupt rather than an empty queue', async () => {
  const harness = await loadQueueService('');

  await assert.rejects(harness.service.getPendingQueue(), {
    code: 'TERMINAL_QUEUE_STORAGE_CORRUPT',
  });
  assert.equal(harness.rawQueue(), '');
});

test('queue write failure rejects without replacing the previously stored queue', async () => {
  const existing = [baseEvent()];
  const harness = await loadQueueService(existing, undefined, {
    storageWriteError: new Error('storage unavailable'),
  });

  await assert.rejects(
    harness.service.persistTerminalSaleEvent('TERM-01-second-event', { customerId: 8 }),
    /storage unavailable/,
  );
  assert.deepEqual(harness.queue(), existing);
});

test('local manual-review guard code is classified for the operator UI', async () => {
  const harness = await loadQueueService();
  assert.equal(
    harness.service.isTerminalSaleManualReviewErrorCode('TERMINAL_SALE_MANUAL_REVIEW_REQUIRED'),
    true,
  );
});

test('parallel writes for different event identities do not lose any queued sale', async () => {
  const harness = await loadQueueService();
  await Promise.all(Array.from({length: 25}, (_, i) =>
    harness.service.persistTerminalSaleEvent(`TERM-01-parallel-${i}`, {customerId: i + 1})));
  assert.equal(harness.queue().length, 25);
  assert.equal(new Set(harness.queue().map(event => event.clientEventId)).size, 25);
});

test('duplicate event identities are preserved as corruption rather than ambiguously sent', async () => {
  const raw = JSON.stringify([baseEvent(), baseEvent({payload: {customerId: 99}})]);
  let submits = 0;
  const harness = await loadQueueService(raw, async () => {submits++;});
  await assert.rejects(harness.service.syncTerminalSaleEvent('TERM-01-event-1'), {code:'TERMINAL_QUEUE_STORAGE_CORRUPT'});
  assert.equal(submits, 0);
  assert.equal(harness.rawQueue(), raw);
});

test('manual-review error cannot be bypassed by a pending status', async () => {
  let submits = 0;
  const harness = await loadQueueService([baseEvent({status:'pending',lastErrorCode:'TERMINAL_SALE_OUTCOME_UNVERIFIED'})], async () => {submits++;});
  await assert.rejects(harness.service.syncTerminalSaleEvent('TERM-01-event-1'), {code:'TERMINAL_SALE_MANUAL_REVIEW_REQUIRED'});
  assert.equal(submits,0);
});

test('success envelope without a valid invoice identity is retained for manual review', async () => {
  for (const data of [null, {}, {invoiceId:0}, {invoiceId:'wrong'}]) {
    const harness=await loadQueueService([baseEvent()], async () => ({data}));
    await assert.rejects(harness.service.syncTerminalSaleEvent('TERM-01-event-1'), {code:'TERMINAL_SALE_OUTCOME_UNVERIFIED'});
    assert.equal(harness.queue()[0].status,'failed');
    assert.equal(harness.queue()[0].lastErrorCode,'TERMINAL_SALE_OUTCOME_UNVERIFIED');
    await assert.rejects(harness.service.removeQueueEvent('TERM-01-event-1'), {code:'TERMINAL_SALE_MANUAL_REVIEW_REQUIRED'});
  }
});
