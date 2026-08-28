import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const management = read('apps/web-admin/src/modules/reports/ManagementReportsScreen.jsx');
const exportCenter = read('apps/web-admin/src/modules/reports/ExportCenterScreen.jsx');
const definitions = read('apps/web-admin/src/modules/settings/DefinitionsScreen.jsx');
const rates = read('apps/web-admin/src/modules/settings/CurrencyRatesScreen.jsx');
const styles = read('apps/web-admin/src/styles/report-definition-ux.css');
const main = read('apps/web-admin/src/main.jsx');

const checks = [
  ['management detail tables are collapsed', management.includes('report-table-details') && management.includes('<details className="erp-panel dashboard-table-panel')],
  ['management safety notes remain accessible', management.includes('report-boundary-details') && management.includes('Approval Boundaries')],
  ['management exports use a secondary menu', management.includes('report-export-menu') && management.includes('exportManagementReport') && management.includes('printManagementReport')],
  ['period selection remains directly available', management.includes('applyPeriodFilters') && management.includes('periodFilters.dateFrom') && management.includes('periodFilters.dateTo')],
  ['export center keeps report and load primary', exportCenter.includes('export-filter-form') && exportCenter.includes('Veriyi Getir')],
  ['export center secondary filters are collapsible', exportCenter.includes('export-advanced-filters') && exportCenter.includes('Arama ve tarih filtreleri')],
  ['definition editor shows one selected group', definitions.includes('activeDefinition') && definitions.includes('definition-selector') && definitions.includes('definition-active-field')],
  ['definition save still sends all groups', definitions.includes('const payload = DEFINITION_FIELDS.map') && definitions.includes('updateSettings({ settings: payload })')],
  ['registered definition data is collapsible', definitions.includes('definition-registered-details')],
  ['currency editor keeps date USD and EUR inputs', rates.includes('currency-rate-editor') && rates.includes("updateRate('USD'") && rates.includes("updateRate('EUR'")],
  ['currency snapshot and write effect are collapsible', rates.includes('currency-snapshot-details') && rates.includes('definition-boundary-note')],
  ['scoped responsive stylesheet is loaded', main.includes("import './styles/report-definition-ux.css';") && styles.includes('@media (max-width: 1100px)') && styles.includes('@media (max-width: 760px)')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} - Report Definition UX / ${name}`);
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
