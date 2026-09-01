import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenRegistry } from '../apps/web-admin/src/data/mockNavigationData.js';
import { buildScreenDeepLink, readScreenDeepLink } from '../apps/web-admin/src/utils/screenDeepLink.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const appShellSource = readFileSync(resolve(repoRoot, 'apps/web-admin/src/components/layout/AppShell.jsx'), 'utf8');
const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok });
}

const salesLink = readScreenDeepLink('?screen=sales-invoice-list', screenRegistry);
const stockLink = readScreenDeepLink('?screen=stock-list&stockCode=STK-42&sourceId=17', screenRegistry);
const restrictedScreens = new Set(['dashboard', 'stock-list']);

addCheck('known non-stock screens open from a direct URL', salesLink?.screenId === 'sales-invoice-list');
addCheck('non-stock direct links do not invent record payloads', Object.keys(salesLink?.payload || {}).length === 0);
addCheck('unknown screen ids are rejected', readScreenDeepLink('?screen=not-a-real-screen', screenRegistry) === null);
addCheck('the selected role view is respected', readScreenDeepLink('?screen=sales-invoice-list', screenRegistry, restrictedScreens) === null);
addCheck('allowed role screens remain available', readScreenDeepLink('?screen=stock-list', screenRegistry, restrictedScreens)?.screenId === 'stock-list');
addCheck('existing stock direct-link filters are preserved', stockLink?.payload?.stockCode === 'STK-42' && stockLink?.payload?.sourceId === '17');
addCheck('active screen replaces the shareable URL without losing unrelated query data', buildScreenDeepLink('?campaign=erp', 'purchase-invoice-list') === '?campaign=erp&screen=purchase-invoice-list');
addCheck('stock-only filters are removed after leaving stock', buildScreenDeepLink('?screen=stock-list&stockCode=STK-42&sourceId=17', 'sales-invoice-list') === '?screen=sales-invoice-list');
addCheck('AppShell reads and updates links through validated helpers', appShellSource.includes('readScreenDeepLink(window.location.search, screenRegistry, roleScreenIds)')
  && appShellSource.includes('buildScreenDeepLink(window.location.search, activeScreenId)')
  && appShellSource.includes('window.history.replaceState'));

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} - Deep Link / ${check.name}`);
}
console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
