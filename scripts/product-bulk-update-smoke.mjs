import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const routes = read('apps/api/src/routes/productRoutes.js');
const service = read('apps/api/src/services/productService.js');
const dialog = read('apps/web-admin/src/modules/stock/BulkProductUpdateDialog.jsx');
const stockList = read('apps/web-admin/src/modules/stock/StockListScreen.jsx');
const table = read('apps/web-admin/src/modules/stock/StockListTable.jsx');
const workspace = read('apps/web-admin/src/components/workspace/Workspace.jsx');
const applySection = service.slice(
  service.indexOf('export async function applyProductBulkUpdate'),
  service.indexOf('export async function getProductDetail'),
);

const checks = [
  ['preview and apply routes require product.edit', routes.includes("'/products/bulk-update/preview', requireAuth, requirePermission('product.edit')") && routes.includes("'/products/bulk-update/apply', requireAuth, requirePermission('product.edit')")],
  ['bulk selection is limited to 500 products', service.includes('const maxBulkProductCount = 500')],
  ['apply is protected by the write guard', applySection.includes('assertMelisaWriteEnabled()')],
  ['apply uses transaction and rollback', applySection.includes('transaction.begin()') && applySection.includes('transaction.commit()') && applySection.includes('transaction.rollback()')],
  ['typed confirmation is required', service.includes('PRODUCT_BULK_CONFIRMATION_INVALID') && dialog.includes('preview.confirmationCode')],
  ['bulk update audit is written', applySection.includes("action: 'products_bulk_updated'")],
  ['bulk update SQL does not change stock price barcode or currency', !applySection.includes('current_stock_qty =') && !applySection.includes('sales_price =') && !applySection.includes('purchase_price =') && !applySection.includes('currency_code =') && !applySection.includes('product_barcodes')],
  ['stock table supports row and visible-list selection', table.includes('selectedRowIds.has(row.id)') && table.includes('onToggleAll')],
  ['stock screen gates bulk edit by permission', stockList.includes("permissions.includes('product.edit')") && stockList.includes('canBulkEdit={canBulkEdit}')],
  ['workspace passes permissions to stock list', /<StockListScreen[\s\S]*?permissions=\{permissions\}[\s\S]*?\/>/.test(workspace)],
  ['dialog supports category brand supplier and name text operations', dialog.includes('Kategori değiştir') && dialog.includes('Marka değiştir') && dialog.includes('Ana tedarikçi değiştir') && dialog.includes('Metin bul ve değiştir')],
  ['preview explains protected fields', dialog.includes('Stok miktarı, barkod, fiyat ve para birimi bu işlemde korunur.')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} - Product bulk update / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
