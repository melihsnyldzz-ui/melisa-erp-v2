import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const terminalAdminScreen = read('apps/web-admin/src/modules/terminal/TerminalAdminScreen.jsx');
const terminalAdminApi = read('apps/web-admin/src/services/terminalAdminApi.js');
const terminalAdminRoutes = read('apps/api/src/routes/terminalAdminRoutes.js');
const syncStatusScreen = read('apps/terminal-app/src/screens/SyncStatusScreen.js');
const settingsScreen = read('apps/terminal-app/src/screens/SettingsScreen.js');
const queueService = read('apps/terminal-app/src/services/queueService.js');

const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

function extractExportedFunction(source, functionName) {
  const startNeedle = `export async function ${functionName}`;
  const startIndex = source.indexOf(startNeedle);

  if (startIndex === -1) {
    return '';
  }

  const nextExportIndex = source.indexOf('\nexport async function ', startIndex + startNeedle.length);
  return source.slice(startIndex, nextExportIndex === -1 ? source.length : nextExportIndex);
}

const removeQueueEventBody = extractExportedFunction(queueService, 'removeQueueEvent');
const syncTerminalSaleEventBody = extractExportedFunction(queueService, 'syncTerminalSaleEvent');

addCheck(
  'web-admin terminal overview is labeled read-only',
  terminalAdminScreen.includes('Salt okunur ekran: Terminal cihazlarını ve eşitleme kuyruğunu gösterir') &&
    terminalAdminScreen.includes('cihaz kapatma, kuyruk silme, yeniden gönderme veya veritabanı düzeltme işlemi yapmaz'),
);

addCheck(
  'web-admin failed sync rows are review signals',
  terminalAdminScreen.includes('Başarısız kayıtlar operatörün incelemesi içindir') &&
    terminalAdminScreen.includes('bu ekrandan doğrudan SQL silme veya kuyruk temizleme işlemi yapılmaz'),
);

addCheck(
  'web-admin terminal language is clear Turkish',
  terminalAdminScreen.includes("online: 'Çevrimiçi'") &&
    terminalAdminScreen.includes("offline: 'Çevrimdışı'") &&
    terminalAdminScreen.includes('Çevrimdışı Kuyruk / Eşitleme Kayıtları') &&
    terminalAdminScreen.includes('Eşitleme kaydı bulunamadı.') &&
    ![
      'G?nderilen',
      'sat?r',
      'Terminal queue pending',
      'Failed sync kaydı',
      'Sync kaydi bulunamadi',
    ].some((text) => terminalAdminScreen.includes(text)),
);

addCheck(
  'terminal admin web client remains GET-only',
  terminalAdminApi.includes("import { get } from './apiClient.js';") &&
    terminalAdminApi.includes("return get('/api/terminal-admin/overview', params);") &&
    !/\b(post|put|patch|del|deleteRequest)\s*\(/.test(terminalAdminApi),
);

addCheck(
  'terminal admin API route remains read-only dashboard permission',
  terminalAdminRoutes.includes("terminalAdminRoutes.get('/terminal-admin/overview'") &&
    terminalAdminRoutes.includes("requirePermission('dashboard.view')"),
);

addCheck(
  'terminal app explains send writes and delete is local queue only',
  syncStatusScreen.includes("Gonder butonu fisi API'ye yollar ve ERP'ye yazabilir") &&
    syncStatusScreen.includes('Sil butonu yalnizca bu cihazdaki lokal kuyruk kaydini kaldirir'),
);

addCheck(
  'terminal app warns before deleting failed receipts',
  syncStatusScreen.includes('Hatali fisleri silmeden once musteri, urun, miktar ve hata metnini kontrol edin'),
);

addCheck(
  'terminal settings labels device readiness blockers',
  settingsScreen.includes('API offline, cache bos veya hatali kuyruk varsa cihaz sahaya hazir kabul edilmez'),
);

addCheck(
  'local queue delete does not call API sale submit',
  removeQueueEventBody.includes('await writeQueue(nextQueue);') &&
    removeQueueEventBody.includes('removed:') &&
    !removeQueueEventBody.includes('submitTerminalSale'),
);

addCheck(
  'terminal sync path still identifies API write boundary',
  syncTerminalSaleEventBody.includes('submitTerminalSale'),
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
