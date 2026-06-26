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
addCheck('compact desktop sidebar is capped at 204px', /@media \(max-width: 1100px\)[\s\S]*?--erp-sidebar-width:\s*204px;/.test(modernSource));
addCheck('stock 360 panel uses normal block flow', blocks(modernSource, '.stock-360-panel').some((item) => item.includes('display: block')));
addCheck('stock 360 collapses to one column below 1180', /@media \(max-width: 1180px\)[\s\S]*?\.stock-360-layout\s*\{[\s\S]*?grid-template-columns:\s*1fr;/.test(modernSource));
addCheck('dense grid children have min-width zero overlap guard', modernSource.includes('.stock-filter-panel-modern .stock-search-primary > *') && modernSource.includes('min-width: 0;'));
addCheck('table wrappers constrain overflow', block(modernSource, '.table-shell,\n.table-wrap,\n.filter-grid,\n.summary-strip,\n.screen-summary').includes('max-width: 100%'));
addCheck('invoice table has horizontal scroll wrapper', block(tablesSource, '.invoice-table-wrap').includes('overflow: auto'));
addCheck('invoice list table keeps stable minimum width', /\.invoice-list-table\s*\{[\s\S]*?min-width:\s*1120px;/.test(tablesSource));
addCheck('dark mode option is available in view menu', viewOptionsSource.includes("key: 'darkMode'"));
addCheck('dark mode class is mapped on shell', shellSource.includes("'dark-mode-shell'"));
addCheck('dark mode theme layer exists', modernSource.includes('.dark-mode-shell') && modernSource.includes('color-scheme: dark'));
addCheck('view options menu escapes top action scroller', block(modernSource, '.view-options-menu').includes('position: fixed'));
addCheck('supplier list requests enough cards', supplierListSource.includes('limit: 300') && supplierServiceSource.includes('maxLimit: 300'));
addCheck('supplier list has stable KPI and table layout', supplierListSource.includes('supplier-list-kpis') && modernSource.includes('.supplier-table'));
addCheck('supplier list has sortable table headers', supplierListSource.includes('sortRows(column.key)') && supplierListSource.includes('numericSupplierSortKeys'));
addCheck('customer list can expand to 500 rows', customerListSource.includes('defaultCustomerListPageLimit = 500') && customerFiltersSource.includes('<option value={500}>500</option>') && customerServiceSource.includes('maxLimit: 500'));

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
