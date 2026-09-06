import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

let queries = [];
const rows = [{
  source_id: 42, stock_code: 'FIXTURE-42', product_name: 'Fixture',
  sale_currency: null, purchase_currency: 'USD', sale_price: 15,
  stock_quantity: 8, reserved_quantity: null, total_count: 1,
}];
class Request {
  input() { return this; }
  async query(query) { queries.push(query); return { recordset: rows }; }
}
const driver = { Request, NVarChar: () => 'fixture', Bit: 'fixture', Date: 'fixture', BigInt: 'fixture', Int: 'fixture' };
mock.module('mssql', { defaultExport: driver });
mock.module('mssql/tedious.js', { defaultExport: driver });
mock.module('../config/vegaDatabase.js', { namedExports: { getVegaSqlPool: async () => ({ request: () => new Request() }) } });
mock.module('../config/env.js', { namedExports: { env: { vega: { companyCode: 'F0102', periodCode: 'D0007', year: 2026 } } } });
mock.module('./vegaProductImageService.js', { namedExports: { getVegaProductImageMap: async () => new Map() } });
const { getVegaProductsList } = await import('./vegaProductService.js');
const { getVegaProductIntelligence } = await import('./vegaProductIntelligenceService.js');

test('normal Vega source identity read selects actual sale unit and preserves reservation absence', async () => {
  queries = [];
  const response = await getVegaProductsList({ sourceId: '42' });
  assert.equal(response.data[0].currency, null);
  assert.equal(response.data[0].currencyTrustState, 'UNAVAILABLE');
  assert.equal(response.data[0].reservedQuantity, null);
  assert.match(queries[0], /u\.PB1 AS sale_currency/);
  assert.match(queries[0], /s\.REZERV AS reserved_quantity/);
  assert.match(queries[0], /ELSE s\.KALAN/);
  assert.match(queries[0], /unit_row\.VARSAYILAN/);
  assert.match(queries[0], /unit_row\.ANABIRIM/);
  assert.match(queries[0], /@sourceId IS NULL OR s\.IND = @sourceId/);
  assert.doesNotMatch(queries[0], /sales_by_product|movement\.TARIH/);
});

test('Product Intelligence reads PB1 with no fabricated reservation or sale currency', async () => {
  queries = [];
  const response = await getVegaProductIntelligence({});
  assert.equal(response.data.products[0].currency, null);
  assert.equal(response.data.products[0].currencyTrustState, 'UNAVAILABLE');
  assert.equal(response.data.products[0].reservedQuantity, null);
  assert.equal(response.data.products[0].availableQuantity, null);
  assert.match(queries[0], /unit\.PB1 AS sale_currency/);
  assert.match(queries[0], /product\.REZERV AS reserved_quantity/);
  assert.doesNotMatch(queries[0], /ISNULL\(product\.REZERV/);
  assert.equal(response.meta.writePerformed, false);
});
