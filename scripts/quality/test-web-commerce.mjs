import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE)$/i.test(key)));
env.NODE_ENV = 'test';
env.NODE_OPTIONS = `--require=${JSON.stringify(path.join(root, 'scripts/quality/network-deny.cjs'))}`;
const checks = [
  ['scripts/web-admin-proforma-smoke.mjs'],
  ['scripts/web-admin-sales-pipeline-list-safety-smoke.mjs'],
  ['scripts/stock-count-safety-smoke.mjs'],
  ['--test', 'scripts/quality/dashboard-loading.test.mjs'],
  ['--test', 'scripts/quality/api-error-response.test.mjs'],
];
let failed = false;
for (const args of checks) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
