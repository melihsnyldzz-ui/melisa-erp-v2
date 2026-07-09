import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const systemSettingsScreen = read('apps/web-admin/src/modules/settings/SystemSettingsScreen.jsx');
const definitionsScreen = read('apps/web-admin/src/modules/settings/DefinitionsScreen.jsx');
const currencyRatesScreen = read('apps/web-admin/src/modules/settings/CurrencyRatesScreen.jsx');
const settingsApi = read('apps/web-admin/src/services/settingsApi.js');
const currencyRateApi = read('apps/web-admin/src/services/currencyRateApi.js');
const workspace = read('apps/web-admin/src/components/workspace/Workspace.jsx');

const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

addCheck(
  'system settings labels API write and maintenance approval boundaries',
  systemSettingsScreen.includes('Kaydet firma, belge seri, KDV ve donem kilidi ayarlarini API') &&
    systemSettingsScreen.includes('onizleme ve onay metni olmadan calistirilmaz'),
);

addCheck(
  'period lock labels business-rule impact',
  systemSettingsScreen.includes('Is kurali etkisi') &&
    systemSettingsScreen.includes('satis, alis, iptal, tahsilat, odeme ve stok sayim islemlerinin kayit kabulunu degistirir'),
);

addCheck(
  'definitions screen labels write scope and non-import boundary',
  definitionsScreen.includes('stok birimi, cari tipi, odeme/tahsilat yontemi ve para birimi tanimlarini API') &&
    definitionsScreen.includes('import veya migration calistirmaz') &&
    definitionsScreen.includes('mevcut fisleri toplu olarak duzeltmez'),
);

addCheck(
  'currency rates screen labels invoice snapshot impact',
  currencyRatesScreen.includes('USD/EUR kurunu API') &&
    currencyRatesScreen.includes('yeni satis/alis fislerinin kur snapshot davranisini etkiler') &&
    currencyRatesScreen.includes('Eski kesinlesmis fisleri toplu olarak yeniden hesaplamaz'),
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

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  process.exit(1);
}

console.log(`SUMMARY: ${checks.length}/${checks.length} PASS`);
