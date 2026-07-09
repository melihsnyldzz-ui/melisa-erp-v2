import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

const salesScreen = read('apps/web-admin/src/modules/sales/SalesInvoiceScreen.jsx');
const purchaseScreen = read('apps/web-admin/src/modules/purchase/PurchaseInvoiceScreen.jsx');
const invoiceDraftApi = read('apps/web-admin/src/services/invoiceDraftApi.js');

const checks = [];

function addCheck(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
}

addCheck(
  'sales invoice screen does not import mock invoice defaults',
  !salesScreen.includes('salesInvoiceMockData') && !salesScreen.includes('salesInvoiceItems'),
);

addCheck(
  'purchase invoice screen does not import mock invoice defaults',
  !purchaseScreen.includes('purchaseInvoiceMockData') && !purchaseScreen.includes('purchaseInvoiceItems'),
);

addCheck(
  'sales invoice screen starts from empty invoice state',
  salesScreen.includes('useState(emptySalesInvoice)') &&
    salesScreen.includes('useState([])') &&
    salesScreen.includes('useState(0)') &&
    salesScreen.includes('useState(null)'),
);

addCheck(
  'purchase invoice screen starts from empty invoice state',
  purchaseScreen.includes('useState(emptyPurchaseInvoice)') &&
    purchaseScreen.includes('useState([])') &&
    purchaseScreen.includes('useState(0)') &&
    purchaseScreen.includes('useState(null)'),
);

addCheck(
  'old sales invoice mock data file is removed',
  !existsSync(resolve(repoRoot, 'apps/web-admin/src/modules/sales/salesInvoiceMockData.js')),
);

addCheck(
  'old purchase invoice mock data file is removed',
  !existsSync(resolve(repoRoot, 'apps/web-admin/src/modules/purchase/purchaseInvoiceMockData.js')),
);

addCheck(
  'demo invoice data remains gated behind demo mode service calls',
  invoiceDraftApi.includes('apiConfig.demoMode') &&
    invoiceDraftApi.includes("from '../demo/demoInvoices.js'"),
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
