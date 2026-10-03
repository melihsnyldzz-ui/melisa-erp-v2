import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SafeTrustedConnectionPool,
  SafeTrustedTransaction,
  safeTrustedSqlDriver,
} from './safeTrustedSqlDriver.js';

function createTransaction({ boundaryError = null, releaseError = null } = {}) {
  const calls = [];
  const parent = {
    config: {},
    release(connection) {
      calls.push(['release', connection]);
      if (releaseError) throw releaseError;
    },
  };
  const transaction = new SafeTrustedTransaction(parent);
  const connection = { id: 'trusted-connection' };
  transaction._acquiredConnection = connection;
  transaction._acquiredConfig = {};
  transaction.executeBoundaryStatement = (statement, callback) => {
    calls.push(['query', statement]);
    callback(boundaryError);
  };
  return { calls, connection, transaction };
}

test('safe trusted driver exposes the patched transaction class', () => {
  assert.equal(safeTrustedSqlDriver.Transaction, SafeTrustedTransaction);
  assert.equal(safeTrustedSqlDriver.ConnectionPool, SafeTrustedConnectionPool);
  assert.equal(typeof safeTrustedSqlDriver.Request, 'function');
});

test('trusted pool transaction helper cannot bypass the patched transaction class', () => {
  const pool = new safeTrustedSqlDriver.ConnectionPool({
    connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=driver-test;Trusted_Connection=Yes',
  });

  assert.equal(pool.request() instanceof safeTrustedSqlDriver.Request, true);
  assert.equal(pool.transaction() instanceof SafeTrustedTransaction, true);
});

test('trusted commit propagates the driver error and releases the connection', async () => {
  const boundaryError = new Error('08S01 transport failure');
  const { calls, connection, transaction } = createTransaction({ boundaryError });
  let commitEvents = 0;
  transaction.on('commit', () => {
    commitEvents += 1;
  });

  await assert.rejects(transaction.commit(), /08S01 transport failure/);
  assert.deepEqual(calls, [['query', 'commit tran'], ['release', connection]]);
  assert.equal(connection.hasError, true);
  assert.equal(transaction._acquiredConnection, null);
  assert.equal(commitEvents, 0);
});

test('trusted rollback propagates the driver error and marks rollback requested', async () => {
  const boundaryError = new Error('08S01 rollback transport failure');
  const { calls, connection, transaction } = createTransaction({ boundaryError });
  let rollbackEvents = 0;
  transaction.on('rollback', () => {
    rollbackEvents += 1;
  });

  await assert.rejects(transaction.rollback(), /08S01 rollback transport failure/);
  assert.deepEqual(calls, [['query', 'rollback tran'], ['release', connection]]);
  assert.equal(connection.hasError, true);
  assert.equal(transaction._rollbackRequested, true);
  assert.equal(transaction._acquiredConnection, null);
  assert.equal(rollbackEvents, 0);
});

test('trusted commit and rollback resolve only after their SQL boundary succeeds', async () => {
  const committed = createTransaction();
  await assert.doesNotReject(committed.transaction.commit());
  assert.deepEqual(committed.calls.map((call) => call[1]), ['commit tran', committed.connection]);

  const rolledBack = createTransaction();
  await assert.doesNotReject(rolledBack.transaction.rollback());
  assert.deepEqual(rolledBack.calls.map((call) => call[1]), ['rollback tran', rolledBack.connection]);
});

test('connection release failure also rejects the transaction boundary', async () => {
  const releaseError = new Error('release failed');
  const { connection, transaction } = createTransaction({ releaseError });
  await assert.rejects(transaction.commit(), /release failed/);
  assert.equal(connection.hasError, true);
});

test('callback transaction APIs receive boundary failures without success events', async () => {
  for (const operation of ['commit', 'rollback']) {
    const boundaryError = new Error(`${operation} callback failure`);
    const { transaction } = createTransaction({ boundaryError });
    let successEvents = 0;
    transaction.on(operation, () => {
      successEvents += 1;
    });

    const receivedError = await new Promise((resolve) => {
      transaction[operation]((error) => resolve(error));
    });

    assert.match(receivedError.message, new RegExp(`${operation} callback failure`));
    assert.equal(successEvents, 0);
  }
});

test('rollback after an uncertain commit preserves the same primary boundary failure', async () => {
  const { calls, transaction } = createTransaction({ boundaryError: new Error('commit transport lost') });
  let commitFailure;
  try {
    await transaction.commit();
  } catch (error) {
    commitFailure = error;
  }

  await assert.rejects(
    transaction.rollback(),
    (error) => error instanceof Error && error === commitFailure && error.transactionOutcome === 'unverified',
  );
  assert.deepEqual(calls.map((call) => call[0]), ['query', 'release']);
});
