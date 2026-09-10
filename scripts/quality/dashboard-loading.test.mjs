import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAccountingKpis } from '../../apps/web-admin/src/modules/dashboard/dashboardMetrics.js';

test('accounting cards render while the summary or recent invoice arrays are absent', () => {
  for (const summary of [{}, { accounting: {} }, { accounting: null }]) {
    const cards = buildAccountingKpis(summary);
    assert.equal(cards.find(card => card.screenId === 'sales-invoice-list' && card.label === 'Son satış fişleri').value, 'Veri yok');
    assert.equal(cards.find(card => card.screenId === 'purchase-invoice-list').value, 'Veri yok');
  }
});
test('accounting cards retain actual invoice counts and collection values', () => {
  const cards = buildAccountingKpis({ accounting: { recentSalesInvoices: [{}, {}], recentPurchaseInvoices: [{}], todayCollectionsTry: 1234 } });
  assert.equal(cards.find(card => card.label === 'Son satış fişleri').value, '2');
  assert.equal(cards.find(card => card.label === 'Son alış fişleri').value, '1');
  assert.match(cards.find(card => card.label === 'Günlük tahsilat').value, /1\.234/);
});

