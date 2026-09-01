import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const screen = read('apps/web-admin/src/modules/sales/SalesInvoiceScreen.jsx');
const listScreen = read('apps/web-admin/src/modules/sales/SalesInvoiceListScreen.jsx');
const vegaListScreen = read('apps/web-admin/src/modules/sales/VegaSalesInvoiceListScreen.jsx');
const workspace = read('apps/web-admin/src/components/workspace/Workspace.jsx');
const movementApi = read('apps/web-admin/src/services/movementApi.js');
const movementRoutes = read('apps/api/src/routes/movementRoutes.js');
const vegaSalesStyles = read('apps/web-admin/src/styles/vega-sales-list.css');
const toolbar = read('apps/web-admin/src/modules/sales/SalesInvoiceToolbar.jsx');
const header = read('apps/web-admin/src/modules/sales/SalesInvoiceHeader.jsx');
const items = read('apps/web-admin/src/modules/sales/SalesInvoiceItemsTable.jsx');
const totals = read('apps/web-admin/src/modules/sales/SalesInvoiceTotals.jsx');
const styles = read('apps/web-admin/src/styles/sales-invoice-ux.css');
const hierarchyStyles = read('apps/web-admin/src/styles/invoice-visual-hierarchy.css');
const main = read('apps/web-admin/src/main.jsx');

const checks = [
  ['draft entry is hidden for finalized and cancelled invoices', screen.includes('!isReadonly && <section className="erp-panel sales-draft-controls sales-quick-add-panel">')],
  ['duplicate product select is removed from quick entry', !screen.includes('<span>Seçim</span>')],
  ['cash customer shortcuts are directly visible', screen.includes('cash-customer-direct') && screen.includes('Peşin satış')],
  ['cash sales list stays on the sales screen and filters live Vega stock exits', vegaListScreen.includes('fetchVegaSalesStockExits') && vegaListScreen.includes("code: '2-PEŞİN TL'") && vegaListScreen.includes("code: '1-PEŞİN $'") && vegaListScreen.includes("code: '3-PEŞİN €'") && vegaListScreen.includes('lastSevenDays()') && vegaListScreen.includes('Fiş İçeriği')],
  ['sales list route uses the all-customer Vega stock exit screen', workspace.includes("render: ({ onOpenScreen }) => <VegaSalesInvoiceListScreen onOpenScreen={onOpenScreen} />")],
  ['Vega sales list has a protected read-only API route', movementApi.includes("get('/api/vega/sales/stock-exits'") && movementRoutes.includes("requirePermission('sales.view'), getVegaSalesStockExits")],
  ['cash filter buttons use distinct TRY USD EUR visual tones', vegaSalesStyles.includes('.vega-cash-filter.try.active') && vegaSalesStyles.includes('.vega-cash-filter.usd.active') && vegaSalesStyles.includes('.vega-cash-filter.eur.active')],
  ['selected customer and product use one compact context row', screen.includes('sales-entry-context')],
  ['new invoice clears prior quick-entry context', screen.includes("setCustomerQuery('')") && screen.includes("setProductQuery('')") && screen.includes("setProductToAddId('')") && screen.includes('setQuickQuantity(1)')],
  ['empty product query never selects the first product', screen.includes("productQuery.trim() ? resolveProductFromQuery(productLookupOptions, productQuery) : null")],
  ['empty product query stays unselected after API options load', !screen.includes("return String(options[0]?.productId ?? '');")],
  ['currency conversion error text is valid Turkish', !screen.includes('ççevrilemedi') && screen.includes('fişine çevrilemedi')],
  ['invoice secondary fields are collapsible', header.includes('sales-invoice-details') && header.includes('Fiş ayarları ve açıklama')],
  ['toolbar actions support controlled finalized correction', toolbar.includes('onEditFinalized') && toolbar.includes('isCorrectionMode') && toolbar.includes('Değişiklikleri Kaydet')],
  ['finalized correction keeps customer and currency locked', screen.includes('disabled={isReadonly || isFinalized}') && screen.includes('isIdentityLocked={isFinalized}')],
  ['finalized financial columns are optional', items.includes('showFinancialDetails') && items.includes('Maliyet ve Kâr')],
  ['invoice table keeps only essential default columns', items.includes('<th>Barkod</th>') && !items.includes('<th>Para birimi</th>')],
  ['totals start as a compact glance', totals.includes('sales-total-glance') && totals.includes('{isOpen && <dl>')],
  ['sales identity uses one dense strip', header.includes('sales-header-status') && !header.includes('<strong>FiÅŸ Bilgisi</strong>') && header.includes('Settings2')],
  ['sales invoice number and date are editable when unlocked', header.includes("updateField('invoiceNo'") && header.includes("updateField('date'")],
  ['sales product and barcode use separate columns', items.includes("'sales-items-table show-financial-details'") && items.includes('className="invoice-barcode-cell"')],
  ['sales totals are a sticky single-line bar', styles.includes('position: sticky') && styles.includes('.sales-total-glance span') && totals.includes('invoice-grand-total')],
  ['sales table uses dense row sizing', styles.includes('height: 32px') && styles.includes('max-height: none !important')],
  ['sales invoice UX styles load after the existing ERP theme', main.includes("import './styles/sales-invoice-ux.css';")],
  ['sales invoice uses layered workspace and zebra row hierarchy', main.includes("import './styles/invoice-visual-hierarchy.css';") && hierarchyStyles.includes('--invoice-workspace') && hierarchyStyles.includes('nth-child(even)')],
  ['product search suggestions stay above invoice panels', hierarchyStyles.includes('.sales-invoice-screen .sales-quick-add-panel') && hierarchyStyles.includes('z-index: 20') && hierarchyStyles.includes('contain: none') && hierarchyStyles.includes('.sales-invoice-screen .sales-product-suggestion-list') && hierarchyStyles.includes('z-index: 1000')],
  ['compact invoice layout has responsive breakpoints', styles.includes('@media (max-width: 1200px)') && styles.includes('@media (max-width: 760px)')],
  ['1366 invoice header reserves enough room for the date field', styles.includes('72px minmax(150px, 1fr) 175px minmax(150px, 1fr) 110px 120px')],
  ['wide invoice header reserves enough room for the date field', styles.includes('72px minmax(250px, 1fr) 175px minmax(300px, 1.5fr) 150px 170px')],
  ['compact invoice toolbar keeps actions on one line when space permits', styles.includes('.sales-invoice-screen .sales-toolbar-actions') && styles.includes('gap: 5px;') && styles.includes('padding: 0;')],
];

const failed = checks.filter(([, ok]) => !ok);

for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - Sales Invoice UX / ${name}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
