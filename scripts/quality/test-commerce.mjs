import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Explicit reviewed list: no message, transport, live SQL, or write-smoke suites.
const files = [
  'auditMetadataEvents.test.js', 'productCustomsClassifier.test.js',
  'vegaProductImageMatchPolicy.test.js', 'vegaProductImageService.test.js',
  'vegaProductIntelligenceService.test.js', 'vegaProductProfitabilityService.test.js',
  'vegaProductSalesEvidenceService.test.js', 'vegaSupplierPurchaseIntelligenceService.test.js',
].map(name => `apps/api/src/services/${name}`);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE)$/i.test(key)));
env.NODE_ENV = 'test';
env.NODE_OPTIONS = `--require=${JSON.stringify(path.join(root, 'scripts/quality/network-deny.cjs'))}`;
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, env, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
