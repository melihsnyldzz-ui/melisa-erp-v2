import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from '../../node_modules/typescript/lib/typescript.js';
import React from '../../apps/web-admin/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../apps/web-admin/node_modules/react-dom/server.node.js';

function loadComponent(file, name) {
  const source = fs.readFileSync(new URL(`../../apps/web-admin/src/modules/${file}`, import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(javascript, { exports, require(id) {
    if (id === 'react') return React;
    if (id === 'lucide-react') return new Proxy({}, { get: () => () => null });
    throw new Error(`Unexpected render dependency ${id}`);
  } });
  return exports[name];
}
const Purchase = loadComponent('purchase/PurchaseInvoiceItemsTable.jsx', 'PurchaseInvoiceItemsTable');
const Sale = loadComponent('sales/SalesInvoiceItemsTable.jsx', 'SalesInvoiceItemsTable');
const item = { id: 1, productId: 1, stockCode: 'LAB', productName: 'Lab product', barcode: '000', quantity: 10,
  purchasePrice: 12, unitPrice: 30, lineDiscountRate: 0, currency: 'TRY', stockEffect: '+10 taslak', stockState: 'Stok: 10' };
for (const [status, expected] of [['DRAFT', '+10 taslak'], ['FINALIZED', '+10 kesinleşti'], ['CANCELLED', 'İptal ile geri alındı']]) {
  test(`purchase ${status} renders status-derived stock effect despite old draft snapshot`, () => {
    const html = renderToStaticMarkup(React.createElement(Purchase, { status, items: [item], isReadonly: status !== 'DRAFT' }));
    assert.ok(html.includes(expected));
    if (status !== 'DRAFT') assert.ok(!html.includes('+10 taslak'));
  });
}
test('historical sales stock snapshot is not presented as current inventory', () => {
  const html = renderToStaticMarkup(React.createElement(Sale, { items: [item], isReadonly: true, showProfitColumns: true }));
  assert.ok(html.includes('Fiş kaydındaki stok: 10'));
});
