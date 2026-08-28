import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductProfitability } from './vegaProductProfitabilityService.js';

const product = {
  sourceId: 10,
  stockCode: '4607 MY MİO',
  productName: 'Takım',
  brand: 'MY MİO',
};

function build({ purchaseEvents = [], salesEvents = [], dateFrom = '2026-01-01', dateTo = '2026-12-31' }) {
  return buildProductProfitability({
    products: [product],
    purchaseEvents,
    salesEvents,
    dateFrom,
    dateTo,
    limit: 100,
    purchaseAudit: {
      lineCount: purchaseEvents.length,
      eligibleLineCount: purchaseEvents.length,
      matchedLineCount: purchaseEvents.length,
    },
  });
}

test('moving weighted average uses remaining stock before the next purchase', () => {
  const result = build({
    purchaseEvents: [
      { type: 'purchase', date: '2026-01-01', productSourceId: 10, quantity: 10, grossCostTry: 1000, netCostTry: 1000 },
      { type: 'purchase', date: '2026-01-03', productSourceId: 10, quantity: 10, grossCostTry: 2000, netCostTry: 2000 },
    ],
    salesEvents: [
      { type: 'sale', date: '2026-01-02', productSourceId: 10, quantity: 3, grossAmountTry: 600, netAmountTry: 540, lineCount: 1, documentCount: 1 },
      { type: 'sale', date: '2026-01-04', productSourceId: 10, quantity: 4, grossAmountTry: 1000, netAmountTry: 900, lineCount: 1, documentCount: 1 },
    ],
  });

  const row = result.products[0];
  assert.equal(row.costCoverageRate, 100);
  assert.equal(row.confidence, 'strong');
  assert.equal(row.salesDiscountTry, 160);
  assert.equal(row.costOfGoodsSoldTry, 935.29);
  assert.equal(row.grossProfitTry, 504.71);
  assert.equal(row.averageCostTry, 158.8235);
});

test('sales before the first matched purchase remain uncosted and visible', () => {
  const result = build({
    purchaseEvents: [
      { type: 'purchase', date: '2026-02-01', productSourceId: 10, quantity: 10, grossCostTry: 1000, netCostTry: 900 },
    ],
    salesEvents: [
      { type: 'sale', date: '2026-01-10', productSourceId: 10, quantity: 2, grossAmountTry: 400, netAmountTry: 360, lineCount: 1, documentCount: 1 },
    ],
  });

  const row = result.products[0];
  assert.equal(row.netSalesTry, 360);
  assert.equal(row.uncostedNetSalesTry, 360);
  assert.equal(row.costOfGoodsSoldTry, 0);
  assert.equal(row.costCoverageRate, 0);
  assert.equal(row.confidence, 'incomplete');
  assert.match(row.warnings.join(' '), /İlk eşleşen alıştan önce satış/);
});

test('sales returns reverse revenue and cost at the return-date weighted cost', () => {
  const result = build({
    purchaseEvents: [
      { type: 'purchase', date: '2026-01-01', productSourceId: 10, quantity: 20, grossCostTry: 2200, netCostTry: 2000 },
    ],
    salesEvents: [
      { type: 'sale', date: '2026-01-02', productSourceId: 10, quantity: 10, grossAmountTry: 2000, netAmountTry: 1800, lineCount: 1, documentCount: 1 },
      { type: 'sales_return', date: '2026-01-03', productSourceId: 10, quantity: 2, grossAmountTry: 400, netAmountTry: 360, lineCount: 1, documentCount: 1 },
    ],
  });

  const row = result.products[0];
  assert.equal(row.netSoldQuantity, 8);
  assert.equal(row.netSalesTry, 1440);
  assert.equal(row.costOfGoodsSoldTry, 800);
  assert.equal(row.grossProfitTry, 640);
  assert.equal(row.purchaseDiscountRate, 9.09);
  assert.match(row.warnings.join(' '), /Satış iadesi/);
});

test('summary separates total net sales from the costed portion', () => {
  const result = build({
    salesEvents: [
      { type: 'sale', date: '2026-01-02', productSourceId: 10, quantity: 5, grossAmountTry: 1000, netAmountTry: 900, lineCount: 1, documentCount: 1 },
    ],
  });

  assert.equal(result.summary.netSalesTry, 900);
  assert.equal(result.summary.costedNetSalesTry, 0);
  assert.equal(result.summary.uncostedNetSalesTry, 900);
  assert.equal(result.summary.salesCostCoverageRate, 0);
});
