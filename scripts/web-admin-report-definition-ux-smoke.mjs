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
const managementStyles = read('apps/web-admin/src/styles/management-reports-ux.css');
const dashboardApi = read('apps/web-admin/src/services/dashboardApi.js');
const dashboardService = read('apps/api/src/services/dashboardService.js');
const main = read('apps/web-admin/src/main.jsx');

const checks = [
  ['management detail tables are collapsed', management.includes('report-table-details') && management.includes('<details className="erp-panel dashboard-table-panel')],
  ['management safety notes remain accessible', management.includes('report-boundary-details') && management.includes('Onay Sınırları')],
  ['management exports use a secondary menu', management.includes('report-export-menu') && management.includes('exportManagementReport') && management.includes('printManagementReport')],
  ['period selection remains directly available', management.includes('applyPeriodFilters') && management.includes('periodFilters.dateFrom') && management.includes('periodFilters.dateTo')],
  ['management labels use valid Turkish business language', management.includes('Rapor notları ve veri sınırları') && management.includes('Dönem Varsayımları') && management.includes('Cari Borç / Alacak Raporu') && management.includes('Resmî muhasebe raporu değildir') && !/Y\?netim|Ynetim|satir|notlari|sinirlari|Read-only reporting boundary|Period Assumptions|Period Data Quality/.test(management)],
  ['management data loading remains read-only', dashboardApi.includes("get('/api/dashboard/management-reporting')") && dashboardApi.includes("get('/api/dashboard/periodic-accounting', params)")],
  ['management API notes use Turkish read-only boundaries', dashboardService.includes('Yönetim raporları operasyonel ERP karar desteğidir') && dashboardService.includes('SQL Server salt okunur SELECT özetleri') && dashboardService.includes('veritabanına yazma, şema güncelleme, temizlik') && !/Management reports are|Periodic accounting is|read-only SELECT aggregates/.test(dashboardService)],
  ['management long-form layout overrides dashboard canvas safely', main.includes("import './styles/management-reports-ux.css';") && management.includes('dashboard-main-grid report-boundary-grid') && managementStyles.includes('.management-reports-screen > *') && managementStyles.includes('flex: 0 0 auto;') && managementStyles.includes('.dashboard-main-grid.report-boundary-grid') && managementStyles.includes('repeat(auto-fit, minmax(280px, 1fr)) !important') && managementStyles.includes('.work-area.dashboard-screen.management-reports-screen > .dashboard-main-grid.report-detail-grid') && managementStyles.includes('repeat(auto-fit, minmax(420px, 1fr)) !important') && managementStyles.includes('.periodic-report-panel > .filter-grid') && managementStyles.includes('width: 100%;')],
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
