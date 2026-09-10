import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Explicit reviewed list: no message, transport, live SQL, or write-smoke suites.
const files = [
  'productImageIdentity.test.mjs',
  'verifiedProductImage.test.mjs',
  'publicCatalogImagePolicy.test.mjs',
  'auditMetadataEvents.test.js', 'productCustomsClassifier.test.js',
  'vegaProductImageMatchPolicy.test.js', 'vegaProductImageService.test.js',
  'vegaProductIntelligenceService.test.js', 'vegaProductProfitabilityService.test.js',
  'vegaProductSalesEvidenceService.test.js', 'vegaSupplierPurchaseIntelligenceService.test.js',
  'financeSchemaGuard.test.js', 'invoiceDraftService.transactionContext.test.js',
  'terminalSaleIdempotency.test.js', 'terminalSaleSubmissionTransaction.test.js',
  'terminalService.lockOrder.test.js',
].map(name => `apps/api/src/services/${name}`);
files.push('apps/api/src/config/safeTrustedSqlDriver.test.js');
files.push('scripts/quality/terminal-server-transaction.test.mjs');
files.push('scripts/quality/invoice-list-scope.test.mjs');
files.push('scripts/quality/stock-count-permission.test.mjs');
files.push('scripts/quality/cash-period-lock.test.mjs');
files.push('scripts/quality/finance-summary-rates.test.mjs');
files.push('scripts/quality/stock-valuation-rates.test.mjs');
files.push('scripts/quality/report-money.test.mjs');
files.push('scripts/quality/shipping-measurement-input.test.mjs');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE)$/i.test(key)));
env.NODE_ENV = 'test';
env.NODE_OPTIONS = `--require=${JSON.stringify(path.join(root, 'scripts/quality/network-deny.cjs'))}`;
const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--test', ...files], { cwd: root, env, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
