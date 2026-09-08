import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertFinanceAccountSchema,
  FINANCE_ACCOUNT_SCHEMA_CHECK_SQL,
} from './financeSchemaGuard.js';

function makePool(recordset) {
  const queries = [];
  return {
    queries,
    request() {
      return {
        async query(statement) {
          queries.push(statement);
          return { recordset };
        },
      };
    },
  };
}

test('finance schema guard uses one metadata-only SELECT', async () => {
  const pool = makePool([{
    finance_accounts: 101,
    finance_account_movements: 102,
  }]);

  await assertFinanceAccountSchema(pool);

  assert.deepEqual(pool.queries, [FINANCE_ACCOUNT_SCHEMA_CHECK_SQL]);
  assert.match(FINANCE_ACCOUNT_SCHEMA_CHECK_SQL, /^\s*SELECT\b/i);
  assert.doesNotMatch(
    FINANCE_ACCOUNT_SCHEMA_CHECK_SQL,
    /\b(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE|MERGE|EXEC(?:UTE)?)\b/i,
  );
});

test('finance schema guard fails closed when a required table is missing', async () => {
  const pool = makePool([{
    finance_accounts: 101,
    finance_account_movements: null,
  }]);

  await assert.rejects(
    assertFinanceAccountSchema(pool),
    (error) => (
      error instanceof Error && error.code === 'FINANCE_ACCOUNT_SCHEMA_MISSING'
      && error?.statusCode === 503
      && error?.message.includes('0012_multi_currency_cash_sessions.sql')
    ),
  );
});

test('finance schema guard fails closed on an empty metadata result', async () => {
  const pool = makePool([]);

  await assert.rejects(
    assertFinanceAccountSchema(pool),
    { code: 'FINANCE_ACCOUNT_SCHEMA_MISSING', statusCode: 503 },
  );
});

test('finance schema guard accepts a transaction-bound request without opening another connection', async () => {
  const queries = [];
  const request = {
    async query(statement) {
      queries.push(statement);
      return {
        recordset: [{ finance_accounts: 101, finance_account_movements: 102 }],
      };
    },
  };

  await assertFinanceAccountSchema(request);

  assert.deepEqual(queries, [FINANCE_ACCOUNT_SCHEMA_CHECK_SQL]);
});
