import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const catalogScreen = read('apps/web-admin/src/modules/catalog/CatalogListScreen.jsx');
const plannerScreen = read('apps/web-admin/src/modules/catalog/WhatsappPlannerScreen.jsx');
const queueScreen = read('apps/web-admin/src/modules/catalog/WhatsappWebQueueScreen.jsx');
const quickActions = read('apps/web-admin/src/modules/dashboard/DashboardQuickActions.jsx');
const smartInsights = read('apps/web-admin/src/components/layout/SmartInsightsPanel.jsx');

const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

addCheck(
  'catalog screen labels ERP as manual catalog preparation',
  catalogScreen.includes('yalnizca katalog taslagi') &&
    catalogScreen.includes('Otomatik WhatsApp gonderimi') &&
    catalogScreen.includes('CRM takip akisi'),
);

addCheck(
  'catalog share panel says it does not send external messages',
  catalogScreen.includes('dis servise mesaj gondermez'),
);

addCheck(
  'whatsapp planner labels future CRM ownership',
  plannerScreen.includes('WhatsApp mesaji gondermez') &&
    plannerScreen.includes('gelecekte CRM tarafina tasinacak'),
);

addCheck(
  'whatsapp queue labels manual-only operation',
  queueScreen.includes('operatorun manuel isaretleme') &&
    queueScreen.includes('Otomatik toplu gonderim aktif degildir'),
);

addCheck(
  'whatsapp provider enabled text still requires manual control',
  queueScreen.includes('Provider onayli; yine manuel kontrol gerekir') &&
    queueScreen.includes('ERP bu ekrandan otomatik toplu gonderim baslatmaz'),
);

addCheck(
  'dashboard quick actions do not imply automatic WhatsApp sending',
  quickActions.includes('Manuel hazırlık') &&
    quickActions.includes('Manuel inceleme') &&
    !quickActions.includes("detail: 'Gönderim'") &&
    !quickActions.includes("detail: 'Gonderim'"),
);

addCheck(
  'smart insights use manual WhatsApp copy language',
  smartInsights.includes('WhatsApp hazırlık listesi') &&
    smartInsights.includes('Manuel kopyalama listesini gör'),
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
