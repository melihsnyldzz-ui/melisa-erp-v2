import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeProductIntelligenceQuery,
  summarizeCategories,
  toProductIntelligenceDto,
} from './vegaProductIntelligenceService.js';

test('product intelligence defaults to a bounded 90-day window', () => {
  const query = normalizeProductIntelligenceQuery({}, new Date('2026-08-25T12:00:00Z'));
  assert.equal(query.dateFrom, '2026-05-28');
  assert.equal(query.dateTo, '2026-08-25');
  assert.equal(query.windowDays, 90);
  assert.equal(query.limit, 20);
});

test('product intelligence caps result count and rejects oversized windows', () => {
  assert.equal(normalizeProductIntelligenceQuery({ limit: 999 }, new Date('2026-08-25T12:00:00Z')).limit, 50);
  assert.throws(
    () => normalizeProductIntelligenceQuery({ dateFrom: '2025-01-01', dateTo: '2026-08-25' }),
    { code: 'VEGA_PRODUCT_INTELLIGENCE_WINDOW_TOO_LARGE' },
  );
});

test('product intelligence DTO exposes sales facts without cost or customer data', () => {
  const product = toProductIntelligenceDto({
    source_id: 42,
    stock_code: 'TAKIM-42',
    product_name: 'Ornek Takim',
    category: 'TAKIM',
    gross_outbound_quantity: 120,
    sales_document_count: 8,
    stock_quantity: 30,
    reserved_quantity: 4,
    sale_price: 15,
    sale_currency: 'EUR',
    purchase_price: 2,
    customer_name: 'SECRET',
  }, '/uploads/vega-products/42.jpg');

  assert.equal(product.availableQuantity, 26);
  assert.equal(product.imageAvailable, true);
  assert.equal(product.grossOutboundQuantity, 120);
  assert.equal('purchasePrice' in product, false);
  assert.equal('customerName' in product, false);
});

test('category summaries are ordered by gross outbound quantity', () => {
  const summary = summarizeCategories([
    { category: 'TULUM', grossOutboundQuantity: 20, imageAvailable: false },
    { category: 'TAKIM', grossOutboundQuantity: 50, imageAvailable: true },
    { category: 'TAKIM', grossOutboundQuantity: 25, imageAvailable: false },
  ]);
  assert.deepEqual(summary[0], {
    category: 'TAKIM',
    productCount: 2,
    grossOutboundQuantity: 75,
    productsWithImages: 1,
  });
});
