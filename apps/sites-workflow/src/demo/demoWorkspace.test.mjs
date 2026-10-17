import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoSalesDraftsResponse, demoSalesDraftWriteResponse, demoSalesInvoiceResponse, demoPurchaseDraftsResponse, demoPurchaseInvoiceResponse } from './demoInvoices.js';
import { demoVegaCustomerMovementsResponse, demoVegaCustomersResponse, demoVegaProductsResponse, demoVegaSupplierMovementsResponse, demoVegaSupplierPurchaseIntelligenceResponse, demoVegaSuppliersResponse } from './demoVegaReadOnly.js';
import { demoProductsResponse, demoProductDetailResponse } from './demoProducts.js';
import { demoReadRequest, demoWorkspaceSummary, demoWorkspaceManagement, demoPeriodicAccounting } from './demoWorkspace.js';

test('invoice status, date, currency, search and pagination affect the same records', () => {
  for (const list of [demoSalesDraftsResponse, demoPurchaseDraftsResponse]) {
    assert.equal(list({ status: 'FINALIZED' }).meta.total, 0);
    assert.equal(list({ currency: 'EUR' }).data.length, 0);
    assert.equal(list({ dateFrom: '2026-06-01' }).data.length, 0);
    assert.equal(list({ dateTo: '2026-05-30' }).data.length, 0);
    assert.equal(list({ search: 'NO-SUCH-INVOICE' }).data.length, 0);
    const second = list({ page: 2, limit: 1 });
    assert.equal(second.data.length, 0); assert.equal(second.meta.total, 1); assert.equal(second.meta.outOfRange, true);
    assert.equal(list({ status: 'DRAFT', dateFrom: '2026-05-31', dateTo: '2026-05-31' }).data.length, 1);
  }
});
test('list and detail totals include discounts with currency-cent rounding', () => {
  const sales = demoSalesInvoiceResponse(301).data;
  assert.equal(sales.items[0].unitState, 'RECORDED'); assert.equal(sales.subtotal, 10170); assert.equal(sales.discountAmount, 711.9); assert.equal(sales.grandTotal, 9458.1);
  assert.equal(demoSalesDraftsResponse().data[0].totalAmount, sales.grandTotal);
  const purchase = demoPurchaseInvoiceResponse(401).data;
  assert.equal(purchase.subtotal, 17721.6); assert.equal(purchase.grandTotal, 16846.15);
  assert.equal(demoPurchaseDraftsResponse().data[0].totalAmount, purchase.grandTotal);
  assert.equal(purchase.items[0].unitPrice, 162); assert.equal(purchase.items[0].lineTotal, 9331.2);
});
test('unknown detail identity never silently returns another record; fixture data cannot be mutated', () => {
  for (const detail of [demoSalesInvoiceResponse, demoPurchaseInvoiceResponse, demoProductDetailResponse]) assert.throws(() => detail(999), { code: 'NOT_FOUND' });
  const response = demoSalesInvoiceResponse(301); response.data.items[0].quantity = 0;
  assert.equal(demoSalesInvoiceResponse(301).data.items[0].quantity, 18);
});
test('cash customer identity and synthetic party movement links stay consistent', () => {
  const saved = demoSalesDraftWriteResponse({ customerId: 211, items: [] });
  assert.equal(saved.data.customerName, 'Peşin TL');
  const customer = demoVegaCustomersResponse().data[0];
  const customerMovements = demoVegaCustomerMovementsResponse(customer.sourceId).data;
  assert.equal(customerMovements[0].sourceId, 'DEMO-SALES-001');
  const supplier = demoVegaSuppliersResponse().data[0];
  const supplierMovements = demoVegaSupplierMovementsResponse(supplier.sourceId).data;
  const purchaseIntelligence = demoVegaSupplierPurchaseIntelligenceResponse(supplier.sourceId).data;
  assert.equal(supplierMovements[0].sourceId, 'DEMO-PURCHASE-001');
  assert.equal(purchaseIntelligence.products[0].stockCode, 'DEMO-STK-001');
  assert.equal(purchaseIntelligence.summary.strongGenericModelMatchRate, 100);
  assert.equal(customerMovements[0].synthetic, true);
  assert.equal(supplierMovements[0].synthetic, true);
});
test('barcode search matches the displayed barcode and product pagination is real', () => {
  const found = demoProductsResponse({ search: '8690001005094' });
  assert.equal(found.data.length, 1); assert.equal(found.data[0].barcode, '8690001005094');
  assert.equal(found.data[0].supplierId, 503);
  assert.equal(found.data[0].unit, 'adet');
  assert.equal(demoProductsResponse({ page: 2, limit: 2 }).data.length, 1);
  assert.equal(demoVegaProductsResponse({ page: 2, limit: 2 }).data.length, 1);
  assert.equal(demoProductsResponse({ activeOnly: false }).meta.total, 4);
});
test('party filters, detail balances and receipt queue share their source identities', () => {
  const path = '/api/read-only-parties/customer';
  assert.equal(demoReadRequest(path, { status: 'ACTIVE' }).meta.total, 3);
  assert.equal(demoReadRequest(path, { status: 'PASSIVE' }).data[0].id, 204);
  assert.equal(demoReadRequest(path, { currency: 'TRY' }).meta.total, 0);
  const row = demoReadRequest(path, { search: 'Bucharest' }).data[0];
  assert.deepEqual(demoReadRequest(`${path}/${row.id}`).data.currentBalances, row.currentBalances);
  assert.throws(() => demoReadRequest(`${path}/${row.id}/movements`), { code: 'DEMO_DATASET_UNAVAILABLE' });
  const item = demoReadRequest('/api/operational-queue').data.groups[0].items[0];
  const receipt = demoReadRequest(`/api/inventory-receipts/${item.id}`, { source: item.source });
  assert.equal(receipt.data.status, item.status); assert.equal(receipt.meta.synthetic, true);
  assert.equal(demoReadRequest('/api/inventory-receipts', { status: 'approved' }).meta.total, 0);
  assert.throws(() => demoReadRequest('/api/inventory-receipts', { source: 'OTHER' }), { code: 'SOURCE_MISMATCH' });
});
test('summary counts match catalog; reporting excludes drafts and never adds currency balances together', () => {
  const summary = demoWorkspaceSummary();
  assert.equal(summary.totalProducts, 4); assert.equal(summary.activeProducts, 3); assert.equal(summary.recentDocuments.length, 2);
  const report = demoWorkspaceManagement().data;
  assert.equal(report.widgets.negativeStockCount, 1);
  assert.equal(report.widgets.customerBalances[0].currency, 'USD');
  assert.equal(report.widgets.todaySalesTry, 0);
  const period = demoPeriodicAccounting({ dateFrom: '2026-05-01', dateTo: '2026-06-01' }).data;
  assert.deepEqual(period.salesByCurrency, []); assert.equal(period.widgets.salesTry, 0);
  assert.equal(period.widgets.collections, undefined);
  assert.throws(() => demoPeriodicAccounting({ dateFrom: '2026-06-01', dateTo: '2026-05-01' }), { code: 'INVALID_DATE_RANGE' });
  assert.equal(demoReadRequest('/api/unimplemented'), null);
});
