import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const baseSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/styles/base.css'), 'utf8');
const modernSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/styles/erp-modern.css'), 'utf8');
const tablesSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/styles/tables.css'), 'utf8');
const shellSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/components/layout/AppShell.jsx'), 'utf8');
const viewOptionsSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/config/viewOptions.js'), 'utf8');
const supplierListSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/supplier/SupplierListScreen.jsx'), 'utf8');
const supplierServiceSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/supplierService.js'), 'utf8');
const customerListSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/customer/CustomerListScreen.jsx'), 'utf8');
const customerFiltersSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/customer/CustomerListFilters.jsx'), 'utf8');
const customerServiceSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/customerService.js'), 'utf8');
const productServiceSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/productService.js'), 'utf8');
const catalogServiceSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/catalogService.js'), 'utf8');
const financeServiceSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/financeService.js'), 'utf8');
const invoiceDraftServiceSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/invoiceDraftService.js'), 'utf8');
const movementServiceSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/movementService.js'), 'utf8');
const terminalAdminServiceSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/terminalAdminService.js'), 'utf8');
const queryHelpersSource = readFileSync(resolve(repoRoot, 'apps/api/src/services/queryHelpers.js'), 'utf8');
const searchTextSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/utils/searchText.js'), 'utf8');
const commandPaletteSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/components/layout/CommandPalette.jsx'), 'utf8');
const sidebarSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/components/navigation/Sidebar.jsx'), 'utf8');
const authAdminSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/settings/AuthAdminScreen.jsx'), 'utf8');
const demoCustomersSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/demo/demoCustomers.js'), 'utf8');
const demoProductsSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/demo/demoProducts.js'), 'utf8');
const demoSuppliersSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/demo/demoSuppliers.js'), 'utf8');
const stockListSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/stock/StockListScreen.jsx'), 'utf8');
const stockListFiltersSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/stock/StockListFilters.jsx'), 'utf8');
const productCardSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/product/ProductCardScreen.jsx'), 'utf8');
const productCardHeaderSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/product/ProductCardHeader.jsx'), 'utf8');
const productCardFormSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/product/ProductCardForm.jsx'), 'utf8');
const productDetailApiSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/services/productDetailApi.js'), 'utf8');
const purchaseInvoiceSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/purchase/PurchaseInvoiceScreen.jsx'), 'utf8');
const purchaseInvoiceToolbarSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/purchase/PurchaseInvoiceToolbar.jsx'), 'utf8');
const salesInvoiceSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/sales/SalesInvoiceScreen.jsx'), 'utf8');
const salesInvoiceToolbarSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/sales/SalesInvoiceToolbar.jsx'), 'utf8');
const collectionsOverviewSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/finance/CollectionsOverviewScreen.jsx'), 'utf8');
const dashboardToolbarSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/modules/dashboard/DashboardToolbar.jsx'), 'utf8');
const suggestedTextInputSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/components/forms/SuggestedTextInput.jsx'), 'utf8');
const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

function numberVar(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*(\\d+)px`));
  return match ? Number(match[1]) : null;
}

function block(source, selector) {
  const index = source.indexOf(selector);
  if (index < 0) return '';
  const start = source.indexOf('{', index);
  if (start < 0) return '';
  let depth = 0;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, cursor);
    }
  }
  return '';
}

function blocks(source, selector) {
  const result = [];
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const index = source.indexOf(selector, searchFrom);
    if (index < 0) break;
    const start = source.indexOf('{', index);
    if (start < 0) break;
    let depth = 0;
    for (let cursor = start; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          result.push(source.slice(start + 1, cursor));
          searchFrom = cursor + 1;
          break;
        }
      }
    }
    if (searchFrom <= start) break;
  }
  return result;
}

const bodyMinWidth = Number(baseSource.match(/body\s*\{[\s\S]*?min-width:\s*(\d+)px/)?.[1] || 0);
const sidebarWidth = numberVar(modernSource, '--erp-sidebar-width');
const compactSidebarWidth = numberVar(modernSource, '--erp-sidebar-compact-width');
const smartPanelWidth = numberVar(modernSource, '--erp-smart-panel-width');
const compactSmartPanelWidth = Number(modernSource.match(/@media \(max-width: 1366px\)[\s\S]*?--erp-smart-panel-width:\s*(\d+)px/)?.[1] || 0);
const collapsedSmartPanelWidth = numberVar(modernSource, '--erp-smart-panel-collapsed-width');
const workspacePadding = numberVar(modernSource, '--erp-workspace-padding');
const minWorkspaceAt1366 = 1366 - compactSidebarWidth - compactSmartPanelWidth - (workspacePadding * 2);
const minWorkspaceCollapsedAt1180 = 1180 - compactSidebarWidth - collapsedSmartPanelWidth - (workspacePadding * 2);

addCheck('body minimum width fits compact desktop viewport', bodyMinWidth > 0 && bodyMinWidth <= 1024, `min-width=${bodyMinWidth}`);
addCheck('shell widths are declared', [sidebarWidth, compactSidebarWidth, smartPanelWidth, compactSmartPanelWidth, collapsedSmartPanelWidth, workspacePadding].every(Number.isFinite));
addCheck('1366 shell leaves useful workspace width', minWorkspaceAt1366 >= 780, `workspace=${minWorkspaceAt1366}`);
addCheck('1180 collapsed shell leaves useful workspace width', minWorkspaceCollapsedAt1180 >= 850, `workspace=${minWorkspaceCollapsedAt1180}`);
addCheck('smart panel hides below 1180', /@media \(max-width: 1180px\)[\s\S]*?\.smart-panel\s*\{[\s\S]*?display:\s*none;/.test(modernSource));
addCheck('smart panel hides below 1280', /@media \(max-width: 1280px\)[\s\S]*?\.smart-panel\s*\{[\s\S]*?display:\s*none !important;/.test(modernSource));
addCheck('main layout uses minmax workspace track', block(modernSource, '.main-layout').includes('minmax(0, 1fr)'));
addCheck('work area scrolls instead of pushing shell', blocks(modernSource, '.work-area').some((item) => item.includes('overflow: auto')));
addCheck('top menu module row can scroll horizontally', blocks(modernSource, '.module-menu').some((item) => item.includes('overflow-x: auto')));
addCheck('top actions can scroll horizontally', blocks(modernSource, '.top-actions').some((item) => item.includes('overflow-x: auto')));
addCheck('core screen toolbars keep actions visible', [dashboardToolbarSource, productCardHeaderSource, salesInvoiceToolbarSource, purchaseInvoiceToolbarSource].every((source) => source.includes('dashboard-toolbar') || source.includes('product-card-header') || source.includes('sales-invoice-toolbar') || source.includes('purchase-invoice-toolbar')) && [productCardSource, salesInvoiceSource, purchaseInvoiceSource].every((source) => source.includes('Toolbar') || source.includes('Header')) && collectionsOverviewSource.includes('collections-hero-actions'));
addCheck('toolbar actions can wrap on compact desktop', blocks(modernSource, '.dashboard-toolbar-actions').some((item) => item.includes('flex-wrap: wrap')) && blocks(modernSource, '.product-card-toolbar').some((item) => item.includes('flex-wrap: wrap')) && modernSource.includes('.collections-hero-actions'));
addCheck('compact desktop sidebar is capped at 204px', /@media \(max-width: 1100px\)[\s\S]*?--erp-sidebar-width:\s*204px;/.test(modernSource));
addCheck('stock 360 panel uses normal block flow', blocks(modernSource, '.stock-360-panel').some((item) => item.includes('display: block')));
addCheck('stock 360 collapses to one column below 1180', /@media \(max-width: 1180px\)[\s\S]*?\.stock-360-layout\s*\{[\s\S]*?grid-template-columns:\s*1fr;/.test(modernSource));
addCheck('invoice forms collapse before 1366 office width', /@media \(max-width: 1400px\)[\s\S]*?\.sales-invoice-screen \.sales-invoice-layout,[\s\S]*?\.purchase-invoice-screen \.purchase-invoice-layout\s*\{[\s\S]*?grid-template-columns:\s*1fr;/.test(modernSource));
addCheck('bulk purchase layout keeps action buttons inside panels', block(modernSource, '.bulk-purchase-layout').includes('minmax(0, 1fr)') && block(modernSource, '.bulk-purchase-layout').includes('max-width: 100%'));
addCheck('bulk purchase entry grid can shrink without burying add button', block(modernSource, '.bulk-purchase-entry-grid').includes('max-width: 100%') && block(modernSource, '.bulk-purchase-entry-grid button').includes('width: 100%') && /@media \(max-width: 1800px\)[\s\S]*?\.bulk-purchase-layout\s*\{[\s\S]*?grid-template-columns:\s*1fr;/.test(modernSource));
addCheck('bulk purchase entry grid stacks below compact desktop', /@media \(max-width: 1180px\)[\s\S]*?\.bulk-purchase-entry-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/.test(modernSource) && /@media \(max-width: 1180px\)[\s\S]*?\.bulk-purchase-entry-grid button\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/.test(modernSource));
addCheck('dense grid children have min-width zero overlap guard', modernSource.includes('.stock-filter-panel-modern .stock-search-primary > *') && modernSource.includes('min-width: 0;'));
addCheck('table wrappers constrain overflow', block(modernSource, '.table-shell,\n.table-wrap,\n.filter-grid,\n.summary-strip,\n.screen-summary').includes('max-width: 100%'));
addCheck('invoice table has horizontal scroll wrapper', block(tablesSource, '.invoice-table-wrap').includes('overflow: auto'));
addCheck('invoice list table keeps stable minimum width', /\.invoice-list-table\s*\{[\s\S]*?min-width:\s*1120px;/.test(tablesSource));
addCheck('dark mode option is available in view menu', viewOptionsSource.includes("key: 'darkMode'"));
addCheck('dark mode class is mapped on shell', shellSource.includes("'dark-mode-shell'"));
addCheck('dark mode theme layer exists', modernSource.includes('.dark-mode-shell') && modernSource.includes('color-scheme: dark'));
addCheck('view options menu escapes top action scroller', block(modernSource, '.view-options-menu').includes('position: fixed'));
addCheck('supplier list requests enough cards', supplierListSource.includes('limit: 500') && supplierServiceSource.includes('maxLimit: 500'));
addCheck('supplier list has compact summary and stable table layout', supplierListSource.includes('entity-list-summary') && modernSource.includes('.supplier-table'));
addCheck('supplier list has sortable table headers', supplierListSource.includes('sortRows(column.key)') && supplierListSource.includes('numericSupplierSortKeys'));
addCheck('customer list can expand to 500 rows', customerListSource.includes('defaultCustomerListPageLimit = 500') && customerFiltersSource.includes('<option value={500}>500</option>') && customerServiceSource.includes('maxLimit: 500'));
addCheck('turkish search normalization is shared by key lists', searchTextSource.includes('normalizeSearchText') && searchTextSource.includes('replace(/[I\\u0130\\u0131]/g') && searchTextSource.includes('replace(/\\u0131/g') && customerListSource.includes('searchTextIncludes') && supplierListSource.includes('normalizeSearchText') && stockListSource.includes('searchTextIncludes'));
addCheck('api list search folds Turkish i variants', queryHelpersSource.includes('toSearchPattern') && queryHelpersSource.includes('replace(/[I\\u0130\\u0131]/g') && queryHelpersSource.includes('replace(/\\u0131/g') && [customerServiceSource, supplierServiceSource, productServiceSource].every((source) => source.includes('toSearchPattern') && source.includes('sqlNormalizedLike')));
addCheck('api extended searches fold Turkish i variants', [catalogServiceSource, financeServiceSource, invoiceDraftServiceSource, movementServiceSource, terminalAdminServiceSource].every((source) => source.includes('toSearchPattern') && source.includes('sqlNormalizedLike')));
addCheck('api text searches no longer use Latin1 LIKE for user query', ![catalogServiceSource, financeServiceSource, invoiceDraftServiceSource, movementServiceSource, terminalAdminServiceSource].some((source) => /COLLATE Latin1_General_CI_AI LIKE @(search|productSearch|customerSearch|supplierSearch|summarySearchLike|searchLike)/.test(source)));
addCheck('web utility searches fold Turkish i variants', [commandPaletteSource, sidebarSource, authAdminSource, demoCustomersSource, demoProductsSource, demoSuppliersSource].every((source) => source.includes('normalizeSearchText')));
addCheck('product supplier suggestions are not capped at 100 or 40', productCardSource.includes('fetchProductOptions') && productDetailApiSource.includes("get('/api/products/options')") && productServiceSource.includes('SELECT TOP (500)') && productCardFormSource.includes('maxOptions={300}') && stockListFiltersSource.includes('maxOptions={300}') && suggestedTextInputSource.includes('maxOptions = 40'));
addCheck('suggested text input uses normalized custom filtering', suggestedTextInputSource.includes('normalizeSearchText(option).includes(query)') && suggestedTextInputSource.includes('className={`suggested-options') && suggestedTextInputSource.includes('role="listbox"') && !suggestedTextInputSource.includes('<datalist'));
addCheck('purchase invoice product lookup is scoped to selected supplier', purchaseInvoiceSource.includes('supplierId: invoice.supplierId') && purchaseInvoiceSource.includes("String(product.supplierId || '') !== String(invoice.supplierId)") && purchaseInvoiceSource.includes('setPurchaseProductOptions([])'));
addCheck('purchase draft API rejects product supplier mismatch', invoiceDraftServiceSource.includes('assertPurchaseItemsBelongToSupplier') && invoiceDraftServiceSource.includes('PURCHASE_PRODUCT_SUPPLIER_MISMATCH') && invoiceDraftServiceSource.includes('await assertPurchaseItemsBelongToSupplier(sqlDriver, transaction, supplierId, draft.items)'));

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
