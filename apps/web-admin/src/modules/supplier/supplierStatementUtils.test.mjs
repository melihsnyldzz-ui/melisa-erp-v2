import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupplier360, summarizeRows } from './supplierStatementUtils.js';

function freezeDate(t) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-16T12:00:00Z') });
}
function row(id, overrides = {}) {
  return { id, supplierId: 7, supplierCode: 'SYN-7', supplierName: 'Synthetic supplier',
    documentDate: '2026-10-16', movementType: 'payment', currency: 'TRY',
    accountCurrency: 'TRY', balanceEffect: 25, settlementKnown: true, ...overrides };
}
function summary(rows) {
  return buildSupplier360(rows, rows, [], summarizeRows(rows));
}

test('unknown payment amounts do not make period counts depend on row order', t => {
  freezeDate(t);
  const unknown = row(1, { balanceEffect: null, settlementKnown: false });
  const known = row(2);
  for (const rows of [[unknown, known], [known, unknown]]) {
    const result = summary(rows);
    assert.equal(result.movementCount, 2);
    for (const period of [result.last30, result.last90]) {
      assert.equal(period.paymentCount, 2);
      assert.equal(period.paymentTotal, null);
      assert.equal(period.currencyTotals[0].paymentTotal, null);
      assert.equal(period.currencyTotals[0].unknown, true);
    }
    assert.equal(result.balance, null);
    assert.equal(result.paymentTotal, null);
  }
});

test('all supported movement types count unknown amounts without treating them as zero', t => {
  freezeDate(t);
  for (const [movementType, countKey] of [
    ['payment', 'paymentCount'], ['purchase_invoice', 'goodsCount'], ['purchase_return', 'returnCount'],
  ]) {
    const result = summary([row(1, { movementType, settlementKnown: false }), row(2, { movementType })]);
    for (const period of [result.last30, result.last90]) {
      assert.equal(period[countKey], 2);
      assert.equal(period.paymentTotal, null);
      assert.equal(period.goodsTotal, null);
      assert.equal(period.returnTotal, null);
    }
  }
});

test('unknown amounts do not suppress later counts of other movement types', t => {
  freezeDate(t);
  const rows = [row(1, { movementType: 'purchase_invoice', balanceEffect: null }),
    row(2), row(3, { movementType: 'purchase_return' })];
  for (const ordered of [rows, [...rows].reverse()]) {
    const result = summary(ordered);
    assert.deepEqual([result.last30.paymentCount, result.last30.goodsCount, result.last30.returnCount], [1, 1, 1]);
    assert.deepEqual(result.currencyTotals.map(({ currency, balance, purchaseTotal, paymentTotal, returnTotal }) =>
      ({ currency, balance, purchaseTotal, paymentTotal, returnTotal })), [
      { currency: 'TRY', balance: null, purchaseTotal: null, paymentTotal: null, returnTotal: null },
    ]);
  }
});

test('mixed currencies keep separate monetary totals while counting every payment', t => {
  freezeDate(t);
  const result = summary([row(1, { balanceEffect: null }),
    row(2, { currency: 'USD', accountCurrency: 'USD', balanceEffect: 30 }),
    row(3, { currency: 'USD', accountCurrency: 'USD', balanceEffect: 5 })]);
  assert.equal(result.last30.paymentCount, 3);
  assert.equal(result.last90.paymentCount, 3);
  assert.equal(result.last30.paymentTotal, null);
  assert.equal(result.balance, null);
  assert.equal(result.currency, null);
  assert.equal(result.currencyTotals.find(total => total.currency === 'TRY').paymentTotal, null);
  assert.equal(result.currencyTotals.find(total => total.currency === 'USD').paymentTotal, 35);
});

test('existing period filters still exclude older or undated rows from period counts', t => {
  freezeDate(t);
  const result = summary([row(1, { balanceEffect: null }), row(2, { documentDate: '2026-09-01' }),
    row(3, { documentDate: '2026-01-01' }), row(4, { documentDate: null })]);
  assert.equal(result.movementCount, 4);
  assert.equal(result.last30.paymentCount, 1);
  assert.equal(result.last90.paymentCount, 2);
  assert.equal(result.last30.paymentTotal, null);
  assert.equal(result.last90.paymentTotal, null);
});

test('known monetary totals and counts are preserved', t => {
  freezeDate(t);
  const result = summary([row(1, { balanceEffect: 20 }),
    row(2, { movementType: 'purchase_invoice', balanceEffect: -100 }),
    row(3, { movementType: 'purchase_return', balanceEffect: 10 })]);
  for (const period of [result.last30, result.last90]) {
    assert.deepEqual([period.paymentCount, period.goodsCount, period.returnCount], [1, 1, 1]);
    assert.deepEqual([period.paymentTotal, period.goodsTotal, period.returnTotal], [20, 100, 10]);
  }
  assert.equal(result.balance, -70);
  assert.equal(result.currency, 'TRY');
});

test('empty lists and unrecognized movement types do not invent supported counts', t => {
  freezeDate(t);
  for (const rows of [[], [row(1, { movementType: 'other', balanceEffect: null })]]) {
    const result = summary(rows);
    assert.deepEqual([result.last30.paymentCount, result.last30.goodsCount, result.last30.returnCount], [0, 0, 0]);
  }
});
