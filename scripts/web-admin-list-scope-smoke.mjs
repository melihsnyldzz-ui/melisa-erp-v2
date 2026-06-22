import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const listScreens = [
  {
    name: 'sales invoice list',
    path: 'apps/web-admin/src/modules/sales/SalesInvoiceListScreen.jsx',
    fetchName: 'fetchSalesDrafts',
    guidance: 'fiş no, cari, tarih veya durum filtresiyle',
  },
  {
    name: 'purchase invoice list',
    path: 'apps/web-admin/src/modules/purchase/PurchaseInvoiceListScreen.jsx',
    fetchName: 'fetchPurchaseDrafts',
    guidance: 'fiş no, tedarikçi veya durum filtresiyle',
  },
];

const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

for (const screen of listScreens) {
  const source = readFileSync(resolve(repoRoot, screen.path), 'utf8');

  addCheck(`${screen.name} keeps API list limit visible`, source.includes('limit: 100'));
  addCheck(`${screen.name} detects partial API results`, source.includes('const hasPartialList = Number(meta?.total || 0) > rows.length;'));
  addCheck(`${screen.name} renders an info state for partial results`, source.includes('hasPartialList') && source.includes('list-state list-state-info'));
  addCheck(`${screen.name} explains how to narrow search`, source.includes(screen.guidance));
  addCheck(`${screen.name} still uses expected API fetcher`, source.includes(screen.fetchName));
}

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
