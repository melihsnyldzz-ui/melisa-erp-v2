import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSupplierPurchaseIntelligence,
  calculatePurchasePriceFacts,
  stockCodeStartsWithModel,
} from './vegaSupplierPurchaseIntelligenceService.js';

test('stock code matching requires a model boundary', () => {
  assert.equal(stockCodeStartsWithModel('4089 MY MİO', '4089'), true);
  assert.equal(stockCodeStartsWithModel('4089-MY MİO', '4089'), true);
  assert.equal(stockCodeStartsWithModel('40895 DONİNO', '4089'), false);
});

test('effective discount is derived from gross and net amounts when Vega discount fields are empty', () => {
  const facts = calculatePurchasePriceFacts({
    quantity: 16,
    headerCurrency: '$',
    headerExchangeRate: 47.2,
    grossUnitPriceTry: 469.64,
    netLineTotalTry: 6762.816,
    discountRate1: 0,
    discountRate2: 0,
    discountRate3: 0,
    discountRate4: 0,
    discountRate5: 0,
    discountRate6: 0,
  });

  assert.equal(facts.currency, 'USD');
  assert.equal(facts.grossUnitPrice, 9.95);
  assert.equal(facts.netUnitPrice, 8.955);
  assert.equal(facts.effectiveDiscountRate, 10);
  assert.equal(facts.declaredCombinedDiscountRate, 0);
  assert.equal(facts.discountSource, 'gross-net-derived');
});

test('supplier brand context resolves a generic purchase line to one product', () => {
  const result = buildSupplierPurchaseIntelligence({
    supplier: {
      sourceId: 349,
      supplierCode: 'MY MİO BABY',
      supplierName: 'MY MİO BABY',
    },
    lines: [
      {
        headerSourceId: 996,
        lineSourceId: 1,
        documentNo: 'A0000881',
        documentDate: '2026-08-21',
        headerCurrency: '$',
        headerExchangeRate: 47.2,
        stockSourceId: 1122,
        stockCode: 'URUN',
        modelCode: '4556',
        quantity: 16,
        grossUnitPriceTry: 469.64,
        netLineTotalTry: 6762.816,
      },
    ],
    products: [
      { sourceId: 10, stockCode: '4556 MY MİO', productName: 'Elbise', brand: 'MY MİO' },
      { sourceId: 11, stockCode: '4556 LEYLEK', productName: 'Takım', brand: 'LEYLEK' },
      { sourceId: 12, stockCode: '45560 DONİNO', productName: 'Tulum', brand: 'DONİNO' },
    ],
  });

  assert.equal(result.brandContext.selectedBrand, 'MY MİO');
  assert.equal(result.summary.contextMatchedLineCount, 1);
  assert.equal(result.summary.strongGenericModelMatchRate, 100);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].stockCode, '4556 MY MİO');
  assert.equal(result.products[0].lastEffectiveDiscountRate, 10);
});

test('general expense values are ignored instead of linked to products', () => {
  const result = buildSupplierPurchaseIntelligence({
    supplier: { sourceId: 1, supplierCode: 'TEST', supplierName: 'TEST' },
    lines: [
      {
        headerSourceId: 1,
        lineSourceId: 2,
        documentNo: 'A1',
        documentDate: '2026-08-01',
        headerCurrency: 'TL',
        headerExchangeRate: 1,
        stockSourceId: 1122,
        stockCode: 'URUN',
        modelCode: 'KDV',
        quantity: 1,
        grossUnitPriceTry: 100,
        netLineTotalTry: 100,
      },
    ],
    products: [],
  });

  assert.equal(result.summary.ignoredLineCount, 1);
  assert.equal(result.summary.matchedProductCount, 0);
  assert.equal(result.review[0].method, 'blocked-general-value');
});
