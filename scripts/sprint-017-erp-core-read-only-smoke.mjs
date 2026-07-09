import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const sources = {
  authRoutes: readFile('apps/api/src/routes/authRoutes.js'),
  authMiddleware: readFile('apps/api/src/middleware/authMiddleware.js'),
  productRoutes: readFile('apps/api/src/routes/productRoutes.js'),
  invoiceRoutes: readFile('apps/api/src/routes/invoiceRoutes.js'),
  financeRoutes: readFile('apps/api/src/routes/financeRoutes.js'),
  dashboardRoutes: readFile('apps/api/src/routes/dashboardRoutes.js'),
  dashboardService: readFile('apps/api/src/services/dashboardService.js'),
  sprint017: readFile('docs/erp-v2/erp-core-read-only-smoke-sprint-017.md'),
  sprint017Report: readFile('docs/erp-v2/erp-core-read-only-smoke-sprint-017-report.md'),
  currentStatus: readFile('docs/erp-v2/current-status.md'),
  roadmap: readFile('docs/erp-v2/master-roadmap-v3.md'),
  packageJson: readFile('apps/web-admin/package.json'),
};

const checks = [];

function readFile(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

function includesAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

function functionBody(source, functionName) {
  const functionPattern = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${functionName}\\s*\\(`);
  const match = functionPattern.exec(source);
  const start = match?.index ?? -1;
  if (start < 0) return '';
  const signatureEnd = source.indexOf(') {', start);
  const bodyStart = signatureEnd < 0 ? -1 : source.indexOf('{', signatureEnd);
  if (bodyStart < 0) return '';

  let depth = 0;
  for (let cursor = bodyStart; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart + 1, cursor);
      }
    }
  }

  return source.slice(start);
}

const managementReportBody = functionBody(sources.dashboardService, 'getManagementReportingData');
const periodicReportBody = functionBody(sources.dashboardService, 'getPeriodicAccountingData');
const forbiddenWriteTokens = [
  'INSERT ',
  'UPDATE ',
  'DELETE ',
  'DROP ',
  'TRUNCATE ',
  'MERGE ',
  'EXEC ',
  '.EXECUTE(',
  '.BATCH(',
];

addCheck(
  'login read check is protected and fail-closed',
  includesAll(sources.authRoutes, [
    "authRoutes.get('/auth/me', requireAuth, getMe)",
  ]) &&
    includesAll(sources.authMiddleware, [
      'AUTH_TOKEN_REQUIRED',
      'Access token is required',
      "type !== 'Bearer'",
      'verifyAccessToken(token)',
    ]),
);

addCheck(
  'stock read routes require auth and product.view',
  includesAll(sources.productRoutes, [
    "productRoutes.get('/products', requireAuth, requirePermission('product.view'), getProducts)",
    "productRoutes.get('/products/options', requireAuth, requirePermission('product.view'), getProductOptions)",
    "productRoutes.get('/products/:id', requireAuth, requirePermission('product.view'), getProduct)",
  ]),
);

addCheck(
  'stock write routes remain permission-gated',
  includesAll(sources.productRoutes, [
    "productRoutes.post('/products', requireAuth, requirePermission('product.edit'), postProduct)",
    "productRoutes.post('/products/:id/images', requireAuth, requirePermission('product.edit'), postProductImage)",
    "productRoutes.patch('/products/:id/passive', requireAuth, requirePermission('product.passive'), patchProductPassive)",
  ]),
);

addCheck(
  'purchase read routes require purchase.view',
  includesAll(sources.invoiceRoutes, [
    "invoiceRoutes.get('/purchase-invoices', requireAuth, requirePermission('purchase.view'), getPurchaseInvoices)",
    "invoiceRoutes.get('/purchase-invoices/:id', requireAuth, requirePermission('purchase.view'), getPurchaseInvoice)",
  ]),
);

addCheck(
  'purchase write routes remain approval-gated by permissions',
  includesAll(sources.invoiceRoutes, [
    "invoiceRoutes.post('/purchase-invoices/draft', requireAuth, requirePermission('purchase.create'), postPurchaseDraft)",
    "invoiceRoutes.post('/purchase-invoices/:id/finalize', requireAuth, requirePermission('purchase.finalize'), postPurchaseFinalize)",
    "invoiceRoutes.post('/purchase-invoices/:id/cancel', requireAuth, requirePermission('purchase.cancel'), postPurchaseCancel)",
    "invoiceRoutes.put('/purchase-invoices/:id/draft', requireAuth, requirePermission('purchase.edit'), putPurchaseDraft)",
  ]),
);

addCheck(
  'sales read routes require sales.view',
  includesAll(sources.invoiceRoutes, [
    "invoiceRoutes.get('/sales-invoices', requireAuth, requirePermission('sales.view'), getSalesInvoices)",
    "invoiceRoutes.get('/sales-invoices/:id', requireAuth, requirePermission('sales.view'), getSalesInvoice)",
  ]),
);

addCheck(
  'sales write routes remain approval-gated by permissions',
  includesAll(sources.invoiceRoutes, [
    "invoiceRoutes.post('/sales-invoices/draft', requireAuth, requirePermission('sales.create'), postSalesDraft)",
    "invoiceRoutes.post('/sales-invoices/:id/finalize', requireAuth, requirePermission('sales.finalize'), postSalesFinalize)",
    "invoiceRoutes.post('/sales-invoices/:id/cancel', requireAuth, requirePermission('sales.cancel'), postSalesCancel)",
    "invoiceRoutes.put('/sales-invoices/:id/draft', requireAuth, requirePermission('sales.edit'), putSalesDraft)",
  ]),
);

addCheck(
  'finance read routes require auth and read permissions',
  includesAll(sources.financeRoutes, [
    "financeRoutes.get('/finance/summary', requireAuth, requirePermission('dashboard.view'), getFinanceSummaryReport)",
    "financeRoutes.get('/finance/accounting-control', requireAuth, requireAnyPermission(['finance.view', 'dashboard.view']), getAccountingControlReport)",
    "financeRoutes.get('/finance/accounts', requireAuth, requireAnyPermission(['finance.view', 'customer.view']), getFinanceAccountList)",
    "financeRoutes.get('/finance/movements', requireAuth, requireAnyPermission(['finance.view', 'customer.view']), getFinanceMovementList)",
    "financeRoutes.get('/finance/journal', requireAuth, requireAnyPermission(['finance.view', 'dashboard.view']), getFinanceJournalReport)",
  ]),
);

addCheck(
  'finance write routes remain approval-gated by permissions',
  includesAll(sources.financeRoutes, [
    "financeRoutes.post('/finance/accounts', requireAuth, requireAnyPermission(['finance.payment', 'finance.collection', 'settings.manage']), postFinanceAccount)",
    "financeRoutes.post('/finance/accounts/cleanup', requireAuth, requireAnyPermission(['finance.payment', 'finance.collection', 'settings.manage']), postFinanceAccountCleanup)",
    "financeRoutes.post('/finance/collections', requireAuth, requireAnyPermission(['finance.collection', 'customer.edit']), postCustomerCollection)",
    "financeRoutes.post('/finance/payments', requireAuth, requireAnyPermission(['finance.payment', 'purchase.edit']), postSupplierPayment)",
  ]),
);

addCheck(
  'report read endpoints require auth and dashboard.view',
  includesAll(sources.dashboardRoutes, [
    "dashboardRoutes.get('/dashboard/management-reporting', requireAuth, requirePermission('dashboard.view'), getManagementReporting)",
    "dashboardRoutes.get('/dashboard/periodic-accounting', requireAuth, requirePermission('dashboard.view'), getPeriodicAccounting)",
  ]),
);

addCheck(
  'management and periodic reports expose assumptions and row limits',
  includesAll(managementReportBody, ['assumptions:', 'dataQuality:', 'rowLimits']) &&
    includesAll(periodicReportBody, ['assumptions:', 'dataQuality:', 'rowLimits']),
);

addCheck(
  'management and periodic reports stay SELECT-only',
  !forbiddenWriteTokens.some((token) => managementReportBody.toUpperCase().includes(token)) &&
    !forbiddenWriteTokens.some((token) => periodicReportBody.toUpperCase().includes(token)),
);

addCheck(
  'Sprint 017 checklist records read-only evidence and protected write gates',
  includesAll(sources.sprint017, [
    'Executed Read-Only Evidence',
    'Protected Write Gate Confirmation',
    'No SQL migrations, DB writes, cleanup, backup/restore/reset, deploys, or external messages were executed',
    'Remaining Gap',
  ]),
);

addCheck(
  'Sprint 017 report documents no risky execution',
  includesAll(sources.sprint017Report, [
    'Status: Completed',
    'No DB writes',
    'No SQL migrations',
    'No WhatsApp, SMS, email, catalog publishing, or external message sending',
    'No risky action required approval',
  ]),
);

addCheck(
  'current status preserves Sprint 017 completion and later approval-gated context',
  includesAll(sources.currentStatus, [
    'Sprint 017 ERP core read-only smoke execution documented',
    'Sprint 018 controlled ERP core write smoke approval plan documented',
    'Sprint 019 controlled ERP core write smoke execution documented',
    'Sprint 020 audit browser and coverage documented',
    'Sprint 021 whole ERP screen completion audit documented',
    'Plan P1 Production Host Network Checklist.',
  ]),
);

addCheck(
  'roadmap marks Sprint 017 completed',
  includesAll(sources.roadmap, [
    '### Sprint 017: ERP Core Read-Only Smoke Execution',
    'Status:** Completed on 2026-07-08',
    'docs/erp-v2/erp-core-read-only-smoke-sprint-017-report.md',
  ]),
);

addCheck(
  'web-admin package exposes Sprint 017 smoke',
  sources.packageJson.includes('"smoke:erp-core-read-only"'),
);

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} - Sprint 017 / ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);

if (failed.length > 0) {
  process.exitCode = 1;
}
