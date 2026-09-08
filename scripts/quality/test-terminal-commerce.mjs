import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE)$/i.test(key)));
env.NODE_ENV = 'test';
env.NODE_OPTIONS = `--require=${JSON.stringify(path.join(root, 'scripts/quality/network-deny.cjs'))}`;
// Pure calculations and static contract checks only; no queue submit or printer invocation.
const checks = [
  ['scripts/terminal-currency-pricing-smoke.mjs', root],
  ['scripts/terminal-user-login-smoke.mjs', root],
  ['scripts/terminal-receipt-printing-smoke.mjs', root],
  ['scripts/check-terminal-working-draft.mjs', path.join(root, 'apps/terminal-app')],
];
let failed = false;
for (const [file, cwd] of checks) {
  const result = spawnSync(process.execPath, [file], { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
