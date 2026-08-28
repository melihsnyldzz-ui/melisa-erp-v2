import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const sales = read('apps/web-admin/src/modules/sales/SalesInvoiceListScreen.jsx');
const purchase = read('apps/web-admin/src/modules/purchase/PurchaseInvoiceListScreen.jsx');
const advanced = read('apps/web-admin/src/modules/shared/InvoiceListAdvancedFilters.jsx');
const service = read('apps/api/src/services/invoiceDraftService.js');
const styles = read('apps/web-admin/src/styles/erp-modern.css');

const checks = [
  ['shared detailed search panel is used by both lists', sales.includes('<InvoiceListAdvancedFilters') && purchase.includes('<InvoiceListAdvancedFilters')],
  ['status date currency and amount criteria are available', ['status', 'dateFrom', 'dateTo', 'currency', 'amountMin', 'amountMax'].every((field) => advanced.includes(field))],
  ['sales adds employee and terminal criteria', sales.includes('onEmployeeChange={setEmployee}') && sales.includes('onTerminalChange={setTerminal}')],
  ['purchase list sends date and amount criteria', purchase.includes('dateFrom,') && purchase.includes('amountMin,') && purchase.includes('currency: currencyFilter')],
  ['database filters currency and amount range', service.includes('@currency IS NULL OR si.document_currency = @currency') && service.includes('@amountMin IS NULL OR pi.grand_total >= @amountMin')],
  ['product barcode and stock code search invoice lines', service.includes('search_item.stock_code_snapshot') && service.includes('search_item.barcode_snapshot') && service.includes('search_item.product_name_snapshot')],
  ['party code and name are searchable', service.includes('c.customer_code') && service.includes('s.supplier_code')],
  ['advanced search has responsive grid styling', styles.includes('.invoice-advanced-search-grid') && styles.includes('repeat(auto-fit, minmax(150px, 1fr))')],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} - Invoice advanced search / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
