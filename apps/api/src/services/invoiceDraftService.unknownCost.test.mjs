import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSalesProfitSnapshot, resolveSalesUnitCostTry } from './invoiceDraftService.js';

test('unverified card purchase price does not become stock valuation or profit', () => {
  const cost = resolveSalesUnitCostTry({
    productAverageCostTry: null,
    averageCostTry: null,
    productPurchasePrice: 100,
    productPurchaseDiscountRate: 10,
    productCurrency: 'USD',
  }, 'USD', 48, new Map([['USD', 48]]));
  assert.equal(cost, null);
  assert.deepEqual(calculateSalesProfitSnapshot({ salesAmountTry: 500, averageCostTry: cost, quantity: 2 }), {
    grossProfitTry: null,
    grossProfitRate: null,
  });
});

test('verified positive average cost retains calculated profit', () => {
  const cost = resolveSalesUnitCostTry({ productAverageCostTry: 60, averageCostTry: null }, 'TRY', 1);
  assert.equal(cost, 60);
  assert.deepEqual(calculateSalesProfitSnapshot({ salesAmountTry: 200, averageCostTry: cost, quantity: 2 }), {
    grossProfitTry: 80,
    grossProfitRate: 0.4,
  });
});
