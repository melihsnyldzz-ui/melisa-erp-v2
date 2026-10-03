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
} else if (mode === 'api' || mode === 'catalog') {
  const directory = mode === 'api' ? path.join(root, 'apps/api/src') : path.join(root, 'scripts/catalog');
  // These main catalog suites use synthetic in-memory products. Three other
  // suites require an untracked, owner-approved business catalog JSON; CI
  // must neither copy that data nor fabricate an approval fixture for it.
  const catalogSuites = new Set(['create_safe_concept_replacement.test.mjs',
    'find_safe_concept_replacement.test.mjs', 'promote_owner_approved_catalog.test.mjs',
    'select_catalog_products.test.mjs', 'verify_catalog_candidate_sales.test.mjs',
    'verify_concept_replacement_sales.test.mjs']);
  const tests = files(directory, name => mode === 'api'
    ? /\.test\.(js|mjs)$/.test(name) : catalogSuites.has(name));
  if (mode === 'catalog' && tests.length !== catalogSuites.size) throw new Error('Missing required synthetic catalog suite');
  if (!tests.length) throw new Error('CI refuses an empty test suite');
  console.log(`${mode}: ${tests.length} unit test files; offline guard active`);
  run(['--experimental-test-module-mocks', '--experimental-vm-modules', '--test', '--test-concurrency=2', ...tests], mode === 'api' ? path.join(root, 'apps/api') : root);
} else if (mode === 'build') {
  run([path.join(root, 'apps/web-admin/node_modules/vite/bin/vite.js'), 'build'], path.join(root, 'apps/web-admin'));
} else if (mode === 'guard') {
  run([path.join(root, 'scripts/ci/guard.test.mjs')]);
} else throw new Error('Usage: node scripts/ci/run.mjs quality|guard|api|catalog|build');
