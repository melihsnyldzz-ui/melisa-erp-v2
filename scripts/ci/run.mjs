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
if (mode === 'quality') {
  for (const filename of files(path.join(root, 'apps/api/src'), name => /\.(js|mjs)$/.test(name))) run(['--check', filename]);
  for (const filename of files(path.join(root, 'scripts/ci'), name => /\.(cjs|mjs)$/.test(name))) run(['--check', filename]);
  console.log('API and CI JavaScript syntax: PASS');
} else if (mode === 'canonical') {
  run(['--test', path.join(root, 'scripts/canonical/crm-order-v2-sql.test.mjs'), path.join(root, 'scripts/canonical/build-crm-order-package.test.mjs'), path.join(root, 'apps/api/crm-order-network.test.mjs')]);
  run(['--test', path.join(root, 'scripts/catalog/apply-confirmed-photo-plan.test.mjs')]);
  run(['--test', path.join(root, 'scripts/canonical/enable-test-purchase-batches.test.mjs'), path.join(root, 'scripts/canonical/enable-test-purchase-batch-stock-source.test.mjs'), path.join(root, 'scripts/canonical/enable-test-purchase-fx.test.mjs'), path.join(root, 'scripts/canonical/enable-test-customer-cards.test.mjs'), path.join(root, 'scripts/canonical/enable-test-supplier-cards.test.mjs'), path.join(root, 'scripts/canonical/enable-test-supplier-contact.test.mjs'), path.join(root, 'scripts/canonical/enable-test-product-prices.test.mjs'), path.join(root, 'scripts/canonical/enable-test-current-price-purchase.test.mjs'), path.join(root, 'scripts/canonical/enable-test-stock-products.test.mjs'), path.join(root, 'scripts/canonical/enable-test-work-catalog.test.mjs'), path.join(root, 'scripts/canonical/enable-test-night-workflows.test.mjs'), path.join(root, 'scripts/canonical/enable-test-work-inbound-counts.test.mjs'), path.join(root, 'scripts/canonical/enable-test-work-finops-fixture.test.mjs')]);
} else if (['api', 'web-admin', 'sites-workflow', 'migration'].includes(mode)) {
  const testRoot = mode === 'migration' ? path.join(root, 'scripts/migration') : path.join(root, 'apps', mode, 'src');
  // The identity regression is a real SQL integration suite. CI deliberately
  // runs only these reviewed synthetic migration models and never that suite.
  const tests = mode === 'migration'
    ? ['accepted-opening-prices', 'mapping-opening', 'operation-quarantine', 'target-native-opening', 'party-currency-readonly-plan', 'goal73-supplier-delta'].map(name => path.join(testRoot, `${name}.test.mjs`))
    : files(testRoot, name => /\.test\.(js|mjs)$/.test(name));
  if (!tests.length) throw new Error('CI refuses an empty test suite');
  console.log(`${mode}: ${tests.length} unit test files; offline guard active`);
  run(['--experimental-test-module-mocks', '--experimental-vm-modules', '--test', '--test-concurrency=2', ...tests], mode === 'migration' ? root : path.join(root, 'apps', mode));
} else if (mode === 'build') {
  for (const app of ['web-admin', 'sites-workflow']) run([path.join(root, 'apps', app, 'node_modules/vite/bin/vite.js'), 'build'], path.join(root, 'apps', app));
} else if (mode === 'guard') {
  run([path.join(root, 'scripts/ci/guard.test.mjs')]);
} else throw new Error('Usage: node scripts/ci/run.mjs quality|guard|api|web-admin|sites-workflow|migration|canonical|build');
