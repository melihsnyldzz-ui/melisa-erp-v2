import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const guard = path.join(root, 'scripts/ci/offline-guard.cjs');
const mode = process.argv[2];
// Only the OS essentials enter an application process. No repository secrets.
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|LANG|LC_ALL)$/i.test(name)));
env.NODE_OPTIONS = `--require="${guard.replaceAll('\\', '/')}"`;
env.CI = 'true';
env.NODE_ENV = mode === 'build' ? 'production' : 'test';
function files(dir, match) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'dist', '.git'].includes(entry.name) ? [] : files(name, match);
    return match(entry.name) ? [name] : [];
  }).sort();
}
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, ['--require', guard, ...args], { cwd, env, stdio: 'inherit', timeout: 180_000 });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
export const WINDOWS_PROCESS_PROBE_BUDGET_MS = 180_000;
export function windowsProcessProbeDiagnostic(result, elapsedMs) {
  return { mode: 'windows-process-probe', elapsedMs: Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 ? elapsedMs : 0,
    status: Number.isInteger(result.status) ? result.status : null,
    signal: ['SIGTERM', 'SIGKILL', 'SIGINT'].includes(result.signal) ? result.signal : result.signal ? 'OTHER_SIGNAL' : null,
    errorCode: ['ETIMEDOUT', 'ENOENT', 'EACCES', 'EINVAL'].includes(result.error?.code) ? result.error.code : result.error ? 'OTHER_ERROR' : null };
}
// Importing the finite diagnostic helpers never starts a child process.
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
if (mode === 'quality') {
  for (const filename of files(path.join(root, 'apps/api/src'), name => /\.(js|mjs)$/.test(name))) run(['--check', filename]);
  for (const filename of files(path.join(root, 'scripts/ci'), name => /\.(cjs|mjs)$/.test(name))) run(['--check', filename]);
  console.log('API and CI JavaScript syntax: PASS');
} else if (mode === 'canonical') {
  run(['--test', path.join(root, 'scripts/canonical/crm06-captured-recovery.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/crm06-unified-candidate.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/crm06-combined-candidate.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/web-build-baseline.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/crm06-stop-child-diagnostic.test.mjs')]);
  run(['--test', ...['shared-business-product-price-revision-sql','shared-business-product-price-bootstrap','shared-business-product-price-sale-sql','shared-business-product-price-sale-bootstrap'].map(name => path.join(root, 'scripts/canonical', name + '.test.mjs'))]);
  run(['--test', path.join(root, 'scripts/canonical/public-terminal-artifact.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/terminal-persistent-web-support.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/terminal-completion-logon.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/prepare-terminal-completion-private.test.mjs'), path.join(root, 'scripts/canonical/terminal-worktest-package.test.mjs')]);
  run(['--test', ...['shared-business-selected-sale-preview-sql','shared-business-selected-sale-write-scope-sql','shared-business-selected-sale-revision-sql','shared-business-selected-sale-effects-revision-sql','shared-business-selected-sale-parent-revision-sql','shared-business-selected-sale-revision-bootstrap'].map(name => path.join(root, 'scripts/canonical', name + '.test.mjs'))]);
  run(['--test',path.join(root,'apps/api/src/services/normalTestRefreshSession.test.mjs'),path.join(root,'apps/sites-workflow/src/workflow/protectedDeviceSession.test.mjs')]);
  run(['--experimental-test-module-mocks', '--test', path.join(root, 'scripts/test-business-selected-sale-native-engine.mjs')]);
  run(['--test', ...['shared-business-scope','shared-business-copy-sql','shared-business-party-readers','shared-business-ready-revision-sql','shared-business-ready-performance-revision-sql','shared-business-effects-performance-revision-sql','crm-order-current-sql'].map(name => path.join(root, 'scripts/canonical', name + '.test.mjs'))]);
  run(['--test', path.join(root, 'scripts/canonical/stage5-origin-review.test.mjs')]);
  run(['--test', ...['stage4-opening-separation', 'stage4-copy-sql', 'stage4-copy-context-sql', 'stage4-copy-recovery'].map(name => path.join(root, 'scripts/canonical', name + '.test.mjs'))]);
  run(['--test', path.join(root, 'scripts/canonical/product-completion-readers.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/crm-order-v2-sql.test.mjs'), path.join(root, 'scripts/canonical/build-crm-order-package.test.mjs'), path.join(root, 'apps/api/crm-order-network.test.mjs'), path.join(root, 'apps/api/crm-order-projected-bootstrap.test.mjs')]);
  run(['--test', path.join(root, 'scripts/catalog/apply-confirmed-photo-plan.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/goal8-test-day-contract.test.mjs'),path.join(root,'scripts/canonical/goal8-test-day-profile.test.mjs'),path.join(root,'scripts/canonical/goal8-test-day-runner.test.mjs'),path.join(root,'scripts/canonical/goal8-test-day-repair.test.mjs'),path.join(root,'scripts/canonical/goal8-final-reader-fixture.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/enable-test-purchase-batches.test.mjs'), path.join(root, 'scripts/canonical/enable-test-purchase-batch-stock-source.test.mjs'), path.join(root, 'scripts/canonical/enable-test-purchase-fx.test.mjs'), path.join(root, 'scripts/canonical/enable-test-customer-cards.test.mjs'), path.join(root, 'scripts/canonical/enable-test-supplier-cards.test.mjs'), path.join(root, 'scripts/canonical/enable-test-supplier-contact.test.mjs'), path.join(root, 'scripts/canonical/enable-test-product-prices.test.mjs'), path.join(root, 'scripts/canonical/enable-test-current-price-purchase.test.mjs'), path.join(root, 'scripts/canonical/enable-test-stock-products.test.mjs'), path.join(root, 'scripts/canonical/enable-test-work-catalog.test.mjs'), path.join(root, 'scripts/canonical/enable-test-night-workflows.test.mjs'), path.join(root, 'scripts/canonical/enable-test-work-inbound-counts.test.mjs'), path.join(root, 'scripts/canonical/enable-test-work-finops-fixture.test.mjs')]);
} else if (mode === 'windows-process-probe') {
  // This fixed PS5 fixture replaces every OS/network API in memory. Keep it
  // outside the application child runner; never widen offline-guard to allow
  // arbitrary shell execution. The Windows CI job calls only this exact mode.
  if (process.platform !== 'win32') throw new Error('WINDOWS_PROCESS_PROBE_REQUIRES_WINDOWS');
  // 27 isolated PowerShell starts need the same bounded budget as unit suites
  // on hosted Windows; every fixture assertion and offline boundary is retained.
  const started = Date.now();
  const result = spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(root, 'scripts/canonical/hub-stack-process-probe.test.ps1'), '-SourcePath', path.join(root, 'scripts/canonical/hub-stack-process-probe.ps1')], { cwd: root, env, stdio: 'inherit', timeout: WINDOWS_PROCESS_PROBE_BUDGET_MS });
  if (result.error || result.status !== 0) {
    // Never emit command arguments, inherited environment or raw OS errors.
    const diagnostic = windowsProcessProbeDiagnostic(result, Date.now() - started);
    console.error(JSON.stringify(diagnostic));
    process.exit(result.status || 1);
  }

} else if (['api', 'web-admin', 'sites-workflow', 'migration'].includes(mode)) {
  const testRoot = mode === 'migration' ? path.join(root, 'scripts/migration') : path.join(root, 'apps', mode, 'src');
  // The identity regression is a real SQL integration suite. CI deliberately
  // runs only these reviewed synthetic migration models and never that suite.
  const tests = mode === 'migration'
    ? ['accepted-opening-prices', 'mapping-opening', 'operation-quarantine', 'operation-quarantine-v2', 'target-native-opening', 'party-currency-readonly-plan', 'party-currency-evidence-resolution', 'supplier-identity-metadata', 'product-purchase-reference', 'product-last-purchase-model', 'product-last-purchase-runtime', 'unified-finance-approval-plan', 'current-finance-approval-plan', 'current-finance-test-application', 'goal73-supplier-delta', 'product-completion-plan', 'product-completion-test-application', 'committed-batch-recovery', 'final-cutover-plan', 'final-cutover-runtime', 'final-cutover-price-reader'].map(name => path.join(testRoot, `${name}.test.mjs`))
    : files(testRoot, name => /\.test\.(js|mjs)$/.test(name));
  if (!tests.length) throw new Error('CI refuses an empty test suite');
  console.log(`${mode}: ${tests.length} unit test files; offline guard active`);
  run(['--experimental-test-module-mocks', '--experimental-vm-modules', '--test', '--test-concurrency=2', ...tests], mode === 'migration' ? root : path.join(root, 'apps', mode));
} else if (mode === 'build') {
  for (const app of ['web-admin', 'sites-workflow']) run([path.join(root, 'apps', app, 'node_modules/vite/bin/vite.js'), 'build'], path.join(root, 'apps', app));
} else if (mode === 'guard') {
  run([path.join(root, 'scripts/ci/guard.test.mjs')]);
  run(['--test', path.join(root, 'scripts/ci/windows-process-probe-runner.test.mjs')]);
} else throw new Error('Usage: node scripts/ci/run.mjs quality|guard|api|web-admin|sites-workflow|migration|canonical|build|windows-process-probe');

}
