import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const screen = read('apps/web-admin/src/modules/purchase/PurchaseInvoiceScreen.jsx');
const toolbar = read('apps/web-admin/src/modules/purchase/PurchaseInvoiceToolbar.jsx');
const header = read('apps/web-admin/src/modules/purchase/PurchaseInvoiceHeader.jsx');
const items = read('apps/web-admin/src/modules/purchase/PurchaseInvoiceItemsTable.jsx');
const totals = read('apps/web-admin/src/modules/purchase/PurchaseInvoiceTotals.jsx');
const bulk = read('apps/web-admin/src/modules/purchase/BulkPurchaseEntryScreen.jsx');
const styles = read('apps/web-admin/src/styles/purchase-invoice-ux.css');
const salesStyles = read('apps/web-admin/src/styles/sales-invoice-ux.css');
const hierarchyStyles = read('apps/web-admin/src/styles/invoice-visual-hierarchy.css');
const main = read('apps/web-admin/src/main.jsx');

const checks = [
  ['normal purchase entry is hidden for closed invoices', screen.includes('!isReadonly && <section className="erp-panel purchase-draft-controls">')],
  ['supplier search and selection use one field', screen.includes('purchase-supplier-suggestions') && !screen.includes('<span>Tedarikçi seç</span>')],
  ['product search and selection use one field', screen.includes('purchase-product-suggestions') && !screen.includes('<span>Ürün seç</span>')],
  ['supplier suggestions survive filtered refreshes', screen.includes('const merged = new Map(currentOptions.map') && bulk.includes('const merged = new Map(currentSuppliers.map')],
  ['supplier suggestion values use supplier names', screen.includes('value={supplier.supplierName}') && bulk.includes('value={supplier.supplierName || supplier.name}')],
  ['product suggestions survive filtered refreshes', screen.includes('const merged = new Map(currentOptions.map((product)') && bulk.includes('const merged = new Map(currentProducts.map')],
  ['lookup refresh does not clear an explicit product selection', !screen.includes('setProductToAddId((currentId) =>') && !bulk.includes('setProductId((current) => {')],
  ['new purchase invoice clears selected product', screen.includes("setProductToAddId('')")],
  ['empty lookup does not auto-select the first product', !screen.includes("nextProducts.find((product) => !product.isPassive)?.productId")],
  ['normal purchase context is compact', screen.includes('purchase-entry-context')],
  ['purchase secondary fields are collapsible', header.includes('purchase-invoice-details') && header.includes('Fiş ayarları ve iskontolar')],
  ['toolbar actions support controlled finalized correction', toolbar.includes('onEditFinalized') && toolbar.includes('isCorrectionMode') && toolbar.includes('Değişiklikleri Kaydet')],
  ['finalized correction keeps supplier and currency locked', screen.includes('disabled={isFinalized}') && screen.includes('isIdentityLocked={isFinalized}')],
  ['purchase cost columns are optional', items.includes('showCostDetails') && items.includes('Maliyet Detayı')],
  ['purchase rows show gross-to-net discount allocation', items.includes('Fiş isk. payı') && items.includes('Net alış') && items.includes('Net satır')],
  ['bulk purchase keeps supplier discount at invoice level', bulk.includes('supplierDiscountRate: group.supplierDiscountRate') && bulk.includes('setLineDiscountRate(Number(selectedProduct.lineDiscountRate || 0))')],
  ['purchase table keeps only essential default columns', items.includes('<th>Barkod</th>') && !items.includes('<th>Para birimi</th>') && !items.includes('<th>Not</th>')],
  ['purchase totals start as a compact glance', totals.includes('purchase-total-glance') && totals.includes('{isOpen && <dl>')],
  ['purchase identity uses one dense strip', header.includes('purchase-header-status') && !header.includes('<strong>FiÅŸ Bilgisi</strong>') && header.includes('Settings2')],
  ['purchase product and barcode use separate columns', items.includes("'purchase-items-table show-cost-details'") && items.includes('className="invoice-barcode-cell"')],
  ['purchase totals are a sticky single-line bar', styles.includes('position: sticky') && styles.includes('.purchase-total-glance span') && totals.includes('invoice-grand-total')],
  ['purchase table uses dense row sizing', styles.includes('height: 32px') && styles.includes('max-height: none !important')],
  ['bulk purchase uses combined supplier and product fields', bulk.includes('bulk-purchase-supplier-suggestions') && bulk.includes('bulk-purchase-product-suggestions')],
  ['bulk purchase never auto-selects the first supplier or product', !bulk.includes('nextSuppliers[0]') && !bulk.includes('supplierProducts[0]')],
  ['bulk purchase has a compact context row', bulk.includes('bulk-purchase-entry-context')],
  ['bulk purchase table removes duplicate barcode and currency columns', !bulk.includes('<th>Barkod</th>') && !bulk.includes('<th>PB</th>')],
  ['simple mode preserves core invoice entry', styles.includes('.simple-mode-shell .purchase-invoice-screen .purchase-draft-controls') && salesStyles.includes('.simple-mode-shell .sales-invoice-screen .sales-draft-controls')],
  ['purchase UX styles load after existing ERP styles', main.includes("import './styles/purchase-invoice-ux.css';")],
  ['purchase invoice uses distinct accent and layered table hierarchy', main.includes("import './styles/invoice-visual-hierarchy.css';") && hierarchyStyles.includes('.purchase-invoice-screen {') && hierarchyStyles.includes('--invoice-accent: #059669')],
  ['purchase and bulk layouts have responsive breakpoints', styles.includes('@media (max-width: 1500px)') && styles.includes('@media (max-width: 900px)')],
];

const failed = checks.filter(([, ok]) => !ok);

for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - Purchase UX / ${name}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
