import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE)$/i.test(key)));
env.NODE_ENV = 'test';
env.NODE_OPTIONS = `--require=${JSON.stringify(path.join(root, 'scripts/quality/network-deny.cjs'))}`;
// Pure/static checks and VM-isolated queue behavior; all network/process access denied.
const checks = [
  ['scripts/quality/terminal-fresh-images-lifecycle.test.mjs', root, ['--experimental-vm-modules', '--test']],
  ['scripts/quality/terminal-fresh-sale-images.test.mjs', root, ['--test']],
  ['scripts/quality/terminal-reviewed-image.test.mjs', root, ['--test']],
  ['scripts/terminal-currency-pricing-smoke.mjs', root],
  ['scripts/terminal-user-login-smoke.mjs', root],
  ['scripts/terminal-receipt-printing-smoke.mjs', root],
  ['scripts/check-terminal-working-draft.mjs', path.join(root, 'apps/terminal-app')],
  ['scripts/terminal-queue-concurrency.test.mjs', root, ['--experimental-vm-modules', '--test']],
  ['scripts/terminal-sale-screen-safety.test.mjs', root, ['--test']],
];
let failed = false;
for (const [file, cwd, flags = []] of checks) {
  const result = spawnSync(process.execPath, [...flags, file], { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
