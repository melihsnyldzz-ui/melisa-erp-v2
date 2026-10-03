import assert from 'node:assert/strict';
import test from 'node:test';
import {
  markSalesTransactionOutcomeUnverified,
  prepareSalesInvoiceFinalization,
} from './invoiceDraftService.js';

test('sales finalization prerequisites use the supplied transaction and run once', async () => {
  const pool = { name: 'pool' };
  const transaction = { name: 'transaction' };
  const requests = [];
  class Request {
    constructor(boundTransaction) {
      this.transaction = boundTransaction;
      requests.push(this);
    }
  }
  const sqlDriver = { Request };
  const calls = [];
  const dependencies = {
    async ensureCashCustomersFn(receivedPool, context) {
      calls.push('cash-customers');
      assert.equal(receivedPool, pool);
      assert.equal(context.sqlDriver, sqlDriver);
      assert.equal(context.transaction, transaction);
    },
    async assertFinanceAccountSchemaFn(request) {
      calls.push('finance-schema');
      assert.equal(request.transaction, transaction);
    },
  };

  const context = { pool, sqlDriver, transaction };
  await prepareSalesInvoiceFinalization(context, dependencies);
  await prepareSalesInvoiceFinalization(context, dependencies);

  assert.deepEqual(calls, ['cash-customers', 'finance-schema']);
  assert.equal(requests.length, 1);
});

test('sales finalization preparation fails closed without an active transaction context', async () => {
  await assert.rejects(
    prepareSalesInvoiceFinalization(null),
    { code: 'SALES_TRANSACTION_CONTEXT_REQUIRED', statusCode: 500 },
  );
});

test('failed preparation is not cached as completed', async () => {
  const transaction = {};
  class Request {
    constructor(boundTransaction) {
      this.transaction = boundTransaction;
    }
  }
  let attempts = 0;
  const context = { pool: {}, sqlDriver: { Request }, transaction };
  const dependencies = {
    ensureCashCustomersFn: async () => {},
    assertFinanceAccountSchemaFn: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('schema unavailable');
    },
  };

  await assert.rejects(prepareSalesInvoiceFinalization(context, dependencies), /schema unavailable/);
  await assert.doesNotReject(prepareSalesInvoiceFinalization(context, dependencies));
  assert.equal(attempts, 2);
});

test('concurrent preparation calls share one in-flight prerequisite chain', async () => {
  const transaction = {};
  class Request {
    constructor(boundTransaction) {
      this.transaction = boundTransaction;
    }
  }
  let releasePreparation = () => {};
  const gate = new Promise((resolve) => {
    releasePreparation = () => resolve(undefined);
  });
  const calls = [];
  const context = { pool: {}, sqlDriver: { Request }, transaction };
  const dependencies = {
    ensureCashCustomersFn: async () => {
      calls.push('cash-customers');
      await gate;
    },
    assertFinanceAccountSchemaFn: async () => {
      calls.push('finance-schema');
    },
  };

  const first = prepareSalesInvoiceFinalization(context, dependencies);
  const second = prepareSalesInvoiceFinalization(context, dependencies);
  releasePreparation();
  await Promise.all([first, second]);

  assert.deepEqual(calls, ['cash-customers', 'finance-schema']);
});

test('a reused transaction object is prepared again through a new transaction context', async () => {
  const transaction = {};
  class Request {
    constructor(boundTransaction) {
      this.transaction = boundTransaction;
    }
  }
  let preparationCount = 0;
  const dependencies = {
    ensureCashCustomersFn: async () => {
      preparationCount += 1;
    },
    assertFinanceAccountSchemaFn: async () => {},
  };

  await prepareSalesInvoiceFinalization(
    { pool: {}, sqlDriver: { Request }, transaction },
    dependencies,
  );
  await prepareSalesInvoiceFinalization(
    { pool: {}, sqlDriver: { Request }, transaction },
    dependencies,
  );

  assert.equal(preparationCount, 2);
});

test('repeated boundary uncertainty preserves the first SQL failure code', () => {
  const error = Object.assign(new Error('commit failed'), { code: 'ECOMMIT' });

  markSalesTransactionOutcomeUnverified(error);
  markSalesTransactionOutcomeUnverified(error);

  assert.equal(error.code, 'SALES_INVOICE_OUTCOME_UNVERIFIED');
  assert.equal(error.originalCode, 'ECOMMIT');
  assert.equal(error.statusCode, 503);
});
