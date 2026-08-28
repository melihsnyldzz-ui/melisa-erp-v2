import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const customerFilters = read('apps/web-admin/src/modules/customer/CustomerListFilters.jsx');
const customerList = read('apps/web-admin/src/modules/customer/CustomerListScreen.jsx');
const customerToolbar = read('apps/web-admin/src/modules/customer/CustomerListToolbar.jsx');
const customerCard = read('apps/web-admin/src/modules/customer/CustomerCardScreen.jsx');
const customerForm = read('apps/web-admin/src/modules/customer/CustomerCardForm.jsx');
const supplierList = read('apps/web-admin/src/modules/supplier/SupplierListScreen.jsx');
const supplierCard = read('apps/web-admin/src/modules/supplier/SupplierCardScreen.jsx');
const debouncedValueHook = read('apps/web-admin/src/hooks/useDebouncedValue.js');
const styles = read('apps/web-admin/src/styles/entity-list-card-ux.css');
const main = read('apps/web-admin/src/main.jsx');

const checks = [
  ['customer has one primary quick search', customerFilters.includes('entity-list-search-field') && customerFilters.includes("updateFilter('search'")],
  ['customer advanced filters are collapsible', customerFilters.includes('entity-list-advanced-filters') && customerFilters.includes('Ayrıntılı filtreler')],
  ['customer search reaches API and local filtering', customerList.includes('filters.search') && customerList.includes('matchesQuickSearch')],
  ['customer search is debounced and supports native clear', customerList.includes('useDebouncedValue(serverSearch)') && customerFilters.includes('type="search"')],
  ['customer default columns are reduced', customerList.includes("['code', 'name', 'phone', 'city', 'balance', 'status']")],
  ['customer secondary tools use overflow menu', customerToolbar.includes('entity-list-tools-menu') && customerToolbar.includes('Kolonlar')],
  ['supplier default columns are reduced', supplierList.includes("['code', 'name', 'phone', 'city', 'balance', 'purchaseCount', 'status']")],
  ['supplier large KPI grid is removed', !supplierList.includes('supplier-list-kpis') && supplierList.includes('entity-list-summary')],
  ['supplier filters include a reset command', supplierList.includes('entity-list-reset-button') && supplierList.includes("setFilters({ search: '', currency: 'all', status: 'active' })")],
  ['supplier has debounced server search', supplierList.includes('useDebouncedValue(filters.search)') && supplierList.includes('aria-label="Tedarikçi ara"')],
  ['shared debounce clears pending timers', debouncedValueHook.includes('window.clearTimeout(timer)')],
  ['search remains visible in simple and hidden-filter modes', styles.includes('.simple-mode-shell .customer-list-screen .customer-filter-panel') && styles.includes('.hide-filters .supplier-list-screen .supplier-filter-panel')],
  ['customer 360 traces are collapsible', customerCard.includes('entity-360-details') && customerCard.includes('Son hareketler ve ürünler')],
  ['supplier 360 traces are collapsible', supplierCard.includes('entity-360-details') && supplierCard.includes('Son hareketler ve ürünler')],
  ['entity forms collapse in view mode', customerForm.includes('entity-card-form-details') && supplierCard.includes('entity-card-form-details')],
  ['responsive scoped stylesheet is loaded', main.includes("import './styles/entity-list-card-ux.css';") && styles.includes('@media (max-width: 1450px)') && styles.includes('@media (max-width: 680px)')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} - Entity UX / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
