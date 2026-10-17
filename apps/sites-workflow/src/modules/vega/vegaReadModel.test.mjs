import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VEGA_SCOPE, canOpenVegaScreen, normalizePage, verifyDetail, sourceId, quantity, currency, priceRows } from './vegaReadModel.js';
const identity = { ...VEGA_SCOPE, entity: 'stock-card', sourceId: 12 };
const row = { identity, name: 'Örnek' };
const page = { data: [row], meta: { source: VEGA_SCOPE, pagination: { hasMore: true, nextCursor: 'opaque+/=12' } } };
test('Vega screens require the matching permission and exclude unconnected transaction screens', () => {
  assert.equal(canOpenVegaScreen('dashboard', []), true);
  assert.equal(canOpenVegaScreen('stock-list', ['customer.view']), false);
  assert.equal(canOpenVegaScreen('product-card', ['product.view']), true);
  assert.equal(canOpenVegaScreen('customer-list', ['customer.view']), true);
  assert.equal(canOpenVegaScreen('supplier-list', ['supplier.view']), false);
  assert.equal(canOpenVegaScreen('sales-invoice-list', ['sales.view']), false);
});
test('Vega lists preserve opaque cursors and never supply ERP ids or inferred totals', () => {
  const result = normalizePage(page, 'stock-card');
  assert.equal(result.rows[0].sourceId, '12');
  assert.equal(result.rows[0].id, undefined);
  assert.equal(result.meta.pagination.nextCursor, 'opaque+/=12');
  assert.equal(result.meta.total, undefined);
});
test('wrong company, record type, or response identity is rejected', () => {
  assert.throws(() => normalizePage({ ...page, meta: { ...page.meta, source: { ...VEGA_SCOPE, company: 'OTHER' } } }, 'stock-card'));
  assert.throws(() => normalizePage(page, 'account-card'));
  assert.throws(() => verifyDetail({ data: { product: row, stock: [], units: [], prices: [] }, meta: page.meta }, 'stock-card', 13));
  assert.throws(() => sourceId('12/../../accounts'));
  assert.throws(() => sourceId(0));
});
test('invalid pagination cannot silently repeat a page', () => {
  assert.throws(() => normalizePage(page, 'stock-card', { cursor: 'opaque+/=12' }));
  assert.throws(() => normalizePage({ ...page, meta: { ...page.meta, pagination: { hasMore: true } } }, 'stock-card'));
});
test('barcode matches retain distinct product identity without duplicating product cards', () => {
  const result = normalizePage({ ...page, data: [{ product: row, unit: {} }, { product: row, unit: {} }, { product: null, unit: {} }] }, 'stock-card', { barcode: true });
  assert.equal(result.rows.length, 1);
  assert.equal(result.unmatched, 1);
});
test('missing amounts and currencies stay unknown while recorded zero stays zero', () => {
  assert.equal(quantity(null), 'Bilinmiyor');
  assert.equal(quantity(''), 'Bilinmiyor');
  assert.equal(quantity('0.00000000'), '0');
  assert.equal(quantity('12345678901234567890.12345678'), '12.345.678.901.234.567.890,12345678');
  assert.equal(quantity('-0.00000001'), '-0,00000001');
  assert.equal(currency(1), 'Vega döviz kodu: 1');
  assert.equal(currency(null), 'Döviz belirtilmemiş');
  const rows = priceRows([{ BIRIMADI: 'SERİ', SATISFIYATI: '0', SPARABIRIMI: 1, SATISFIYATI1: '7', PB1: 'USD', SATISFIYATI2: null }]);
  assert.deepEqual(rows.map(r => [r.label, r.amount, r.currency]), [['Ana fiyat', '0', 1], ['Fiyat 1', '7', 'USD']]);
});

test('barcode results keep every matched unit on one product and reject a mismatched stock id', () => {
  const piece={IND:1,STOKNO:12,BIRIMADI:'ADET',BARCODE:'001234'};
  const pack={IND:2,STOKNO:12,BIRIMADI:'PAKET',BARCODE:'001234'};
  const result=normalizePage({...page,data:[{product:row,unit:piece},{product:row,unit:pack},{product:row,unit:piece}]},'stock-card',{barcode:true});
  assert.equal(result.rows.length,1);
  assert.deepEqual(result.rows[0].matchedUnits,[piece,pack]);
  assert.throws(()=>normalizePage({...page,data:[{product:row,unit:{...piece,STOKNO:13}}]},'stock-card',{barcode:true}),/eşleşmiyor/);
});
