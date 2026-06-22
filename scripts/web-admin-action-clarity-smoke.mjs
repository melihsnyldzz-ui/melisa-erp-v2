import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const screens = [
  {
    name: 'sales invoice list',
    path: 'apps/web-admin/src/modules/sales/SalesInvoiceListScreen.jsx',
    openHandler: 'openInvoice()',
  },
  {
    name: 'purchase invoice list',
    path: 'apps/web-admin/src/modules/purchase/PurchaseInvoiceListScreen.jsx',
    openHandler: 'openDraft()',
  },
];

const checks = [];

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

for (const screen of screens) {
  const source = readFileSync(resolve(repoRoot, screen.path), 'utf8');

  addCheck(`${screen.name} does not expose passive cancel button`, !source.includes('>İptal Et</button>'));
  addCheck(`${screen.name} uses explicit open-for-cancel label`, source.includes('İptal İçin Aç'));
  addCheck(`${screen.name} routes cancel intent to editable document`, source.includes(`onClick={() => ${screen.openHandler}}`));
  addCheck(`${screen.name} limits cancel intent to finalized documents`, source.includes("disabled={selectedRow.status !== 'FINALIZED'}"));
  addCheck(`${screen.name} explains cancel availability`, source.includes('Sadece kesinleşmiş fişler iptal edilebilir'));
}

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
