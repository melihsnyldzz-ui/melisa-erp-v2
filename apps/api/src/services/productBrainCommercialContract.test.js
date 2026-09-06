import assert from 'node:assert/strict';
import test from 'node:test';
import { explicitInventoryQuantity, explicitSaleCurrency } from './explicitSaleCurrency.mjs';
import { toVegaProductDto } from './vegaProductService.js';
import { toProductIntelligenceDto } from './vegaProductIntelligenceService.js';

const fixture = {
  source_id: 42, stock_code: 'FIXTURE-42', product_name: 'Fixture',
  stock_quantity: 12, reserved_quantity: 3, sale_price: 15,
  purchase_price_local: 200, purchase_price_foreign: 5,
};

for (const [raw, currency] of [
  ['EUR', 'EUR'], [' € ', 'EUR'], ['eur', 'EUR'],
  ['USD', 'USD'], ['$', 'USD'], ['US$', 'USD'], [' usd ', 'USD'],
  ['TRY', 'TRY'], ['TL', 'TRY'], ['₺', 'TRY'], ['try', 'TRY'],
]) {
  test(`sale-unit currency ${raw} is normalized with explicit provenance`, () => {
    const expected = { currency, currencyTrustState: 'TRUSTED', currencySource: 'ERP_SALE_UNIT' };
    assert.deepEqual(explicitSaleCurrency(raw), expected);
    for (const map of [toVegaProductDto, toProductIntelligenceDto]) {
      const dto = map({ ...fixture, sale_currency: raw, purchase_currency: 'USD' });
      for (const [key, value] of Object.entries(expected)) assert.equal(dto[key], value);
    }
  });
}

for (const raw of [null, undefined, '', ' ', 'LL', 'GBP', 1, true, {}]) {
  test(`absent/unsupported sale currency ${JSON.stringify(raw)} never inherits purchase currency`, () => {
    for (const map of [toVegaProductDto, toProductIntelligenceDto]) {
      const dto = map({ ...fixture, sale_currency: raw, purchase_currency: 'USD' });
      assert.equal(dto.currency, null);
      assert.equal(dto.currencyTrustState, 'UNAVAILABLE');
      assert.equal(dto.currencySource, null);
      assert.equal(dto.salePrice, 15);
    }
  });
}

test('separating sales currency preserves internal purchase price normalization', () => {
  for (const [sale, purchase, expectedCurrency, expectedPrice] of [
    ['', 'USD', 'USD', 5], ['EUR', '', 'EUR', 5], ['', '', 'TRY', 200],
    ['USD', 'TL', 'TRY', 200], ['BAD', '€', 'EUR', 5],
  ]) {
    const dto = toVegaProductDto({ ...fixture, sale_currency: sale, purchase_currency: purchase });
    assert.equal(dto.purchaseCurrency, expectedCurrency);
    assert.equal(dto.purchasePrice, expectedPrice);
  }
});

test('missing or invalid inventory remains unknown in both read models', () => {
  for (const raw of [null, undefined, '', ' ', NaN, Infinity, 'invalid', true, {}]) {
    assert.equal(explicitInventoryQuantity(raw), null);
    for (const field of ['stock_quantity', 'reserved_quantity']) {
      const row = { ...fixture, [field]: raw };
      const expectedField = field === 'stock_quantity' ? 'stockQuantity' : 'reservedQuantity';
      assert.equal(toVegaProductDto(row)[expectedField], null);
      assert.equal(toProductIntelligenceDto(row)[expectedField], null);
      assert.equal(toProductIntelligenceDto(row).availableQuantity, null);
    }
  }
});

test('known zero and negative stock/reservations remain visible for fail-closed callers', () => {
  for (const [stock, reserved, available] of [[0, 0, 0], [-2, 0, -2], [3, 5, -2], [3, -2, 5]]) {
    for (const map of [toVegaProductDto, toProductIntelligenceDto]) {
      const dto = map({ ...fixture, stock_quantity: stock, reserved_quantity: reserved });
      assert.equal(dto.stockQuantity, stock);
      assert.equal(dto.reservedQuantity, reserved);
    }
    assert.equal(toProductIntelligenceDto({ ...fixture, stock_quantity: stock, reserved_quantity: reserved }).availableQuantity, available);
  }
});
