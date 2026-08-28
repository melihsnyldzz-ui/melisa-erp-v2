import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const screen = read('apps/web-admin/src/modules/supplier/SupplierMovementsScreen.jsx');
const vegaScreen = read('apps/web-admin/src/modules/supplier/VegaSupplierMovementsScreen.jsx');
const movementService = read('apps/api/src/services/movementService.js');
const supplierCard = read('apps/web-admin/src/modules/supplier/SupplierCardScreen.jsx');
const supplierProductTrace = read('apps/web-admin/src/modules/supplier/SupplierProductTracePanel.jsx');
const supplierService = read('apps/api/src/services/supplierService.js');
const styles = read('apps/web-admin/src/styles/supplier-movements-ux.css');
const main = read('apps/web-admin/src/main.jsx');

const checks = [
  ['screen names invoices payments and remaining debt', screen.includes('Tedarikçi Fatura ve Ödemeleri') && screen.includes('Kalan Borç')],
  ['supplier and document search is available', screen.includes('Tedarikçi adı, kodu veya belge numarası ara')],
  ['movement tabs separate invoices and payments', screen.includes('Alış Faturaları') && screen.includes('Ödemeler')],
  ['summary exposes invoice payment and balance totals', screen.includes('summary.purchases') && screen.includes('summary.payments') && screen.includes('summary.balances')],
  ['table has dedicated invoice and payment columns', screen.includes('<th>Alış Faturası</th>') && screen.includes('<th>Ödeme</th>')],
  ['rows keep invoice and payment navigation', screen.includes('openLedgerTarget(row, onOpenScreen)') && screen.includes('ledgerTargetActionLabel(row)')],
  ['cancelled movements remain optional', screen.includes('showCancelled: false') && screen.includes('İptal kayıtlarını göster')],
  ['server calculates running supplier balance', movementService.includes('newer_balance_effect') && movementService.includes('runningBalance: Number(row.running_balance || 0)')],
  ['running balance is based on complete movement history', movementService.includes('FROM dbo.supplier_movements sm') && movementService.includes('FROM movement_balances sm')],
  ['supplier movement list keeps 500 row capacity', screen.includes('limit: 500')],
  ['screen has scoped responsive table styling', styles.includes('.supplier-movement-table-shell') && styles.includes('@media (max-width: 1280px)')],
  ['compact header overrides the legacy statement height', styles.includes('.supplier-ledger-screen.supplier-movements-workspace > .erp-panel.supplier-movement-header:first-child') && styles.includes('min-height: 0 !important')],
  ['Vega supplier ledger uses the compact movement workspace', vegaScreen.includes('supplier-movements-workspace vega-supplier-ledger-screen') && vegaScreen.includes('vega-supplier-filter-line')],
  ['Vega supplier ledger overrides the legacy 735px header', styles.includes('.supplier-ledger-screen.supplier-movements-workspace.vega-supplier-ledger-screen > .erp-panel.vega-supplier-movement-header:first-child') && styles.includes('grid-template-rows: auto auto minmax(300px, 1fr)')],
  ['Vega supplier summary and table use compact movement components', vegaScreen.includes('className="supplier-movement-summary"') && vegaScreen.includes('vega-supplier-movement-table-shell')],
  ['supplier movement stylesheet loads before global hardening', main.indexOf("import './styles/supplier-movements-ux.css';") > -1 && main.indexOf("import './styles/supplier-movements-ux.css';") < main.indexOf("import './styles/responsive-layout-hardening.css';")],
  ['supplier card exposes cumulative remaining debt first', supplierCard.includes('<th>Kalan borç</th>') && supplierCard.includes('supplier-running-balance') && supplierCard.includes('row.runningBalance')],
  ['supplier card distinguishes purchases and payments', supplierCard.includes("'purchase-row'") && supplierCard.includes("'payment-row'")],
  ['supplier detail API calculates running balance', supplierService.includes('newer_balance_effect') && supplierService.includes('runningBalance: Number(row.running_balance || 0)')],
  ['supplier card exposes main supplier sell-through and remaining stock', supplierCard.includes('Satılan adet') && supplierCard.includes('Kalan adet') && supplierCard.includes('Kalan mal değeri') && supplierCard.includes('summary.remainingValues')],
  ['supplier API calculates stock portfolio from main supplier products', supplierService.includes('p.supplier_id = @stockSummarySupplierId') && supplierService.includes("si.status = N'finalized'") && supplierService.includes('sp.current_stock_qty * nac.average_cost_currency')],
  ['product-level purchase trace is collapsed by default', supplierProductTrace.includes('<details') && supplierProductTrace.includes('supplier-product-trace-details') && !supplierProductTrace.includes('<details open')],
  ['supplier card prioritizes movements before product trace', styles.includes('.supplier-card-screen {') && styles.includes('display: grid !important;') && styles.includes('.supplier-card-screen > .supplier-movements-panel { order: 3; }') && styles.includes('.supplier-card-screen > .supplier-product-trace-panel { order: 5; }')],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} - Supplier Movements UX / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
