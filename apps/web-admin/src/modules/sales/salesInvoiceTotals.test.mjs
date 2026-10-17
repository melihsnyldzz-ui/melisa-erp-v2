import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPersistedSalesTotals } from './salesInvoiceTotals.js';

test('uses the persisted EUR document snapshot instead of recalculating converted lines', () => {
  const totals = mapPersistedSalesTotals({
    documentCurrency: 'EUR', exchangeRate: 55.7, subtotal: 1411.3494,
    discountRate: 0, discountTotal: 0, grandTotal: 1411.3494, amountTry: 78612.16,
  }, [{ quantity: 20 }, { quantity: 26 }]);

  assert.equal(totals.currency, 'EUR');
  assert.equal(totals.exchangeRate, 55.7);
  assert.equal(totals.subtotal, 1411.3494);
  assert.equal(totals.grandTotal, 1411.3494);
  assert.equal(totals.tryEquivalent, 78612.16);
  assert.equal(totals.lineCount, 2);
  assert.equal(totals.totalQuantity, 46);
});

test('keeps a persisted discount amount even when the header rate is zero', () => {
  const totals = mapPersistedSalesTotals({
    documentCurrency: 'EUR', exchangeRate: 55.7, subtotal: 954.618,
    discountRate: 0, discountTotal: 29.62, grandTotal: 924.998, amountTry: 51522.39,
  }, [{ quantity: 1 }]);

  assert.equal(totals.discountRate, 0);
  assert.equal(totals.discountAmount, 29.62);
  assert.equal(totals.grandTotal, 924.998);
  assert.equal(totals.tryEquivalent, 51522.39);
});

test('normalizes TRY exchange rate without changing persisted totals', () => {
  const totals = mapPersistedSalesTotals({
    documentCurrency: 'TRY', exchangeRate: null, subtotal: 92627.4,
    discountRate: 0, discountTotal: 0, grandTotal: 92627.4, amountTry: 92627.4,
  }, [{ quantity: 18 }]);

  assert.equal(totals.exchangeRate, 1);
  assert.equal(totals.grandTotal, 92627.4);
  assert.equal(totals.tryEquivalent, 92627.4);
});
