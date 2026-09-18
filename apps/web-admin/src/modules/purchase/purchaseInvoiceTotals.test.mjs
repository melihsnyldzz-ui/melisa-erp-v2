import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPersistedPurchaseTotals } from './purchaseInvoiceTotals.js';

test('uses the finalized invoice snapshot instead of recalculating TRY lines as USD', () => {
  const totals = mapPersistedPurchaseTotals({
    documentCurrency: 'USD',
    exchangeRate: 48.5,
    subtotal: 1512,
    lineDiscountTotal: 0,
    invoiceDiscountRate: 0,
    supplierDiscountRate: 0,
    discountTotal: 302.4,
    grandTotal: 1209.6,
    amountTry: 58665.6,
    stockCostEffectTry: 0,
  }, [{ quantity: 216, currency: 'TRY', purchasePrice: 339.5 }]);

  assert.equal(216 * 339.5, 73332);
  assert.equal(totals.currency, 'USD');
  assert.equal(totals.subtotal, 1512);
  assert.equal(totals.totalDiscount, 302.4);
  assert.equal(totals.grandTotal, 1209.6);
  assert.equal(totals.tryEquivalent, 58665.6);
  assert.equal(totals.stockCostEffect, 0);
  assert.equal(totals.totalQuantity, 216);
});

test('keeps persisted zero values and derives only display counts from items', () => {
  const totals = mapPersistedPurchaseTotals({
    documentCurrency: 'TRY',
    exchangeRate: 1,
    subtotal: 100,
    lineDiscountTotal: 0,
    invoiceDiscountRate: 0,
    supplierDiscountRate: 0,
    discountTotal: 0,
    grandTotal: 100,
    amountTry: 100,
    stockCostEffectTry: 0,
  }, [{ quantity: 2 }, { quantity: 3 }]);

  assert.equal(totals.grandTotal, 100);
  assert.equal(totals.stockCostEffect, 0);
  assert.equal(totals.lineCount, 2);
  assert.equal(totals.totalQuantity, 5);
});
