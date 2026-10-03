import assert from 'node:assert/strict';
import test from 'node:test';
import { runTerminalSaleSubmissionTransaction } from './terminalSaleSubmissionTransaction.js';

function createTransaction(order, { commitError = null, rollbackError = null, onFinish = null } = {}) {
  return {
    async begin() {
      order.push('begin');
    },
    async commit() {
      order.push('commit');
      if (commitError) throw commitError;
      onFinish?.();
    },
    async rollback() {
      order.push('rollback');
      onFinish?.();
      if (rollbackError) throw rollbackError;
    },
  };
}

function createOperations(order, { ledger = null, failAt = null } = {}) {
  const step = async (name, value) => {
    order.push(name);
    if (failAt === name) {
      const error = new Error(`${name} failed`);
      error.code = `${name.toUpperCase()}_FAILED`;
      throw error;
    }
    return value;
  };

  return {
    assertSchema: () => step('schema'),
    acquireLock: () => step('lock'),
    readLedger: () => step('read-ledger', ledger),
    replay: () => step('replay', { duplicate: true }),
    assertNoLegacySale: () => step('legacy-check'),
    prepareNewSale: () => step('prepare', { draftPayload: {} }),
    reserveLedger: () => step('reserve', 77),
    createDraft: () => step('create', { id: 44 }),
    finalizeDraft: () => step('finalize', { id: 44, status: 'FINALIZED' }),
    writeSubmitAudit: () => step('audit'),
    completeLedger: () => step('complete'),
    toCreatedResult: () => {
      order.push('result');
      return { duplicate: false };
    },
  };
}

test('new terminal event executes every commercial step before one commit', async () => {
  const order = [];
  const result = await runTerminalSaleSubmissionTransaction({
    transaction: createTransaction(order),
    operations: createOperations(order),
  });

  assert.deepEqual(result, { duplicate: false });
  assert.deepEqual(order, [
    'begin',
    'schema',
    'lock',
    'read-ledger',
    'legacy-check',
    'prepare',
    'reserve',
    'create',
    'finalize',
    'audit',
    'complete',
    'commit',
    'result',
  ]);
});

test('same terminal event replay commits without running a second commercial step', async () => {
  const order = [];
  const result = await runTerminalSaleSubmissionTransaction({
    transaction: createTransaction(order),
    operations: createOperations(order, { ledger: { id: 77, status: 'synced' } }),
  });

  assert.deepEqual(result, { duplicate: true });
  assert.deepEqual(order, ['begin', 'schema', 'lock', 'read-ledger', 'replay', 'commit']);
});

test('every new-event failure rolls back and never commits', async () => {
  const failureSteps = [
    'schema',
    'lock',
    'read-ledger',
    'legacy-check',
    'prepare',
    'reserve',
    'create',
    'finalize',
    'audit',
    'complete',
  ];

  for (const failAt of failureSteps) {
    const order = [];
    await assert.rejects(
      runTerminalSaleSubmissionTransaction({
        transaction: createTransaction(order),
        operations: createOperations(order, { failAt }),
      }),
      { code: `${failAt.toUpperCase()}_FAILED` },
    );
    assert.equal(order.at(-1), 'rollback', failAt);
    assert.equal(order.includes('commit'), false, failAt);
  }
});

test('replay conflict rolls back before any create, finalize or audit operation', async () => {
  const order = [];
  await assert.rejects(
    runTerminalSaleSubmissionTransaction({
      transaction: createTransaction(order),
      operations: createOperations(order, {
        ledger: { id: 77, status: 'synced' },
        failAt: 'replay',
      }),
    }),
    { code: 'REPLAY_FAILED' },
  );

  assert.deepEqual(order, ['begin', 'schema', 'lock', 'read-ledger', 'replay', 'rollback']);
});

test('rollback failure preserves the primary error and marks outcome unverified', async () => {
  const order = [];
  const rollbackError = new Error('rollback failed');
  let caught;
  try {
    await runTerminalSaleSubmissionTransaction({
      transaction: createTransaction(order, { rollbackError }),
      operations: createOperations(order, { failAt: 'audit' }),
    });
  } catch (error) {
    caught = error;
  }

  assert.equal(caught.code, 'AUDIT_FAILED');
  assert.equal(caught.message, 'audit failed');
  assert.equal(caught.transactionOutcome, 'unverified');
  assert.equal(order.at(-1), 'rollback');
});

test('commit uncertainty preserves the commit error and attempts one rollback', async () => {
  const order = [];
  const commitError = new Error('commit response lost');
  commitError.code = 'COMMIT_UNCERTAIN';

  let caught;
  try {
    await runTerminalSaleSubmissionTransaction({
      transaction: createTransaction(order, { commitError }),
      operations: createOperations(order),
    });
  } catch (error) {
    caught = error;
  }

  assert.equal(caught, commitError);
  assert.equal(caught.transactionOutcome, 'unverified');
  assert.deepEqual(order.slice(-2), ['commit', 'rollback']);
});

function createMutex() {
  let locked = false;
  const waiters = [];
  return {
    async acquire() {
      if (!locked) {
        locked = true;
        return;
      }
      await new Promise((resolve) => waiters.push(resolve));
      locked = true;
    },
    release() {
      locked = false;
      waiters.shift()?.();
    },
  };
}

function createConcurrentHarness() {
  const mutex = createMutex();
  let ledger = null;
  let createCount = 0;
  let finalizeCount = 0;
  let auditCount = 0;

  function submission(fingerprint) {
    const order = [];
    const transaction = createTransaction(order, { onFinish: () => mutex.release() });
    const operations = createOperations(order);
    operations.acquireLock = async () => {
      order.push('lock');
      await mutex.acquire();
    };
    operations.readLedger = async () => {
      order.push('read-ledger');
      return ledger;
    };
    operations.replay = async (existing) => {
      order.push('replay');
      if (existing.fingerprint !== fingerprint) {
        const error = new Error('same event has different data');
        error.code = 'TERMINAL_SALE_IDEMPOTENCY_CONFLICT';
        throw error;
      }
      return { duplicate: true, invoiceId: existing.invoiceId };
    };
    operations.createDraft = async () => {
      order.push('create');
      createCount += 1;
      return { id: 44 };
    };
    operations.finalizeDraft = async () => {
      order.push('finalize');
      finalizeCount += 1;
      return { id: 44, status: 'FINALIZED' };
    };
    operations.writeSubmitAudit = async () => {
      order.push('audit');
      auditCount += 1;
    };
    operations.completeLedger = async () => {
      order.push('complete');
      ledger = { fingerprint, invoiceId: 44, status: 'synced' };
    };
    operations.toCreatedResult = () => ({ duplicate: false, invoiceId: 44 });
    return runTerminalSaleSubmissionTransaction({ transaction, operations });
  }

  return {
    submission,
    counts: () => ({ createCount, finalizeCount, auditCount }),
  };
}

test('concurrent same-payload submissions create, finalize and audit exactly once', async () => {
  const harness = createConcurrentHarness();
  const [first, second] = await Promise.all([
    harness.submission('a'.repeat(64)),
    harness.submission('a'.repeat(64)),
  ]);

  assert.deepEqual([first.duplicate, second.duplicate].sort(), [false, true]);
  assert.deepEqual(harness.counts(), { createCount: 1, finalizeCount: 1, auditCount: 1 });
});

test('concurrent different-payload submissions allow one write and conflict the other', async () => {
  const harness = createConcurrentHarness();
  const outcomes = await Promise.allSettled([
    harness.submission('a'.repeat(64)),
    harness.submission('b'.repeat(64)),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  const rejection = outcomes.find((outcome) => outcome.status === 'rejected');
  assert.equal(rejection.reason.code, 'TERMINAL_SALE_IDEMPOTENCY_CONFLICT');
  assert.deepEqual(harness.counts(), { createCount: 1, finalizeCount: 1, auditCount: 1 });
});
