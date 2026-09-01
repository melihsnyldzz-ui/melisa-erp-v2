import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const systemSettingsScreen = read('apps/web-admin/src/modules/settings/SystemSettingsScreen.jsx');
const accountingControlScreen = read('apps/web-admin/src/modules/finance/AccountingControlScreen.jsx');
const definitionsScreen = read('apps/web-admin/src/modules/settings/DefinitionsScreen.jsx');
const currencyRatesScreen = read('apps/web-admin/src/modules/settings/CurrencyRatesScreen.jsx');
const settingsApi = read('apps/web-admin/src/services/settingsApi.js');
const currencyRateApi = read('apps/web-admin/src/services/currencyRateApi.js');
const workspace = read('apps/web-admin/src/components/workspace/Workspace.jsx');
const systemSettingsStyles = read('apps/web-admin/src/styles/system-settings-ux.css');
const main = read('apps/web-admin/src/main.jsx');

const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

addCheck(
  'system settings labels API write and maintenance approval boundaries',
  systemSettingsScreen.includes('Kaydet düğmesi firma, belge serisi, KDV ve dönem kilidi ayarlarını API') &&
    systemSettingsScreen.includes('önizleme ve onay metni olmadan çalıştırılmaz'),
);

addCheck(
  'period lock labels business-rule impact',
  systemSettingsScreen.includes('İş kuralı etkisi') &&
    systemSettingsScreen.includes('satış, alış, iptal, tahsilat, ödeme ve stok sayım işlemlerinin kayıt kabulünü değiştirir'),
);

addCheck(
  'critical accounting and maintenance actions use valid Turkish text',
  accountingControlScreen.includes('Düzeltilecek taslak belge numarası kalmadı.') &&
    accountingControlScreen.includes('Belge Numarasını Düzelt') &&
    systemSettingsScreen.includes('Muhasebe Dönem Kilidi') &&
    systemSettingsScreen.includes('Test Fiş Arşivi') &&
    ![accountingControlScreen, systemSettingsScreen].some((source) => /D\?zelt|Fi\?|Ar\?iv|sat\?r/.test(source)),
);

addCheck(
  'definitions screen labels write scope and non-import boundary',
  definitionsScreen.includes('stok birimi, cari tipi, ödeme/tahsilat yöntemi ve para birimi tanımlarını API') &&
    definitionsScreen.includes('import veya migration çalıştırmaz') &&
    definitionsScreen.includes('mevcut fişleri toplu olarak düzeltmez'),
);

addCheck(
  'currency rates screen labels invoice snapshot impact',
  currencyRatesScreen.includes('USD ve EUR kurunu API') &&
    currencyRatesScreen.includes('yeni satış/alış fişlerinin kur snapshot davranışını etkiler') &&
    currencyRatesScreen.includes('Eski kesinleşmiş fişleri toplu olarak yeniden hesaplamaz'),
);

addCheck(
  'settings API write methods are explicit',
  settingsApi.includes("return put('/api/settings', payload);") &&
    settingsApi.includes("return post('/api/settings/demo-cleanup/apply', payload);") &&
    settingsApi.includes("return post('/api/settings/test-tree-cleanup/apply', payload);") &&
    settingsApi.includes("return post('/api/settings/test-archive-restore/apply', payload);"),
);

addCheck(
  'currency API write method is explicit',
  currencyRateApi.includes("return put('/api/currency-rates', payload);") ||
    currencyRateApi.includes("return post('/api/currency-rates', payload);"),
);

addCheck(
  'settings and definitions routes require settings manage permission',
  workspace.includes("'settings-overview':") &&
    workspace.includes("'definitions-overview':") &&
    workspace.includes("permissionKeys: ['settings.manage']"),
);

addCheck(
  'system settings uses a dedicated long-form layout boundary',
  systemSettingsScreen.includes('dashboard-screen system-settings-screen') &&
    main.includes("import './styles/system-settings-ux.css';") &&
    systemSettingsStyles.includes('.system-settings-screen > *') &&
    systemSettingsStyles.includes('flex: 0 0 auto;'),
);

addCheck(
  'system settings form and maintenance controls have responsive grids',
  systemSettingsStyles.includes('grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));') &&
    systemSettingsStyles.includes('grid-template-columns: repeat(2, minmax(0, 1fr));') &&
    systemSettingsStyles.includes('.system-settings-screen .cleanup-apply-grid') &&
    systemSettingsStyles.includes('@media (max-width: 960px)') &&
    systemSettingsStyles.includes('.system-settings-screen > .list-state') &&
    systemSettingsStyles.includes('.system-settings-screen .accounting-lock-panel > .list-state') &&
    systemSettingsStyles.includes('min-height: 0;') &&
    systemSettingsStyles.includes('.system-settings-screen .filter-grid input') &&
    systemSettingsStyles.includes('width: 100%;'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
