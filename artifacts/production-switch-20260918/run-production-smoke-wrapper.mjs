import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..', '..');
const sourcePath = path.join(root, 'artifacts', 'live3-runtime-signoff-20260917', 'run-http-smoke.mjs');
const temporaryPath = path.join(dir, '.production-http-smoke.private.mjs');
if (!sourcePath.startsWith(root) || !temporaryPath.startsWith(dir)) throw Error('SMOKE_PATH_REJECTED');
const source = fs.readFileSync(sourcePath, 'utf8')
  .replaceAll('LIVE3-20260917-01', 'PRODUCTION-SWITCH-20260918-01')
  .replaceAll('http://127.0.0.1:4233', 'http://192.168.1.46:4116');
fs.writeFileSync(temporaryPath, source, { flag: 'wx' });
try {
  const result = spawnSync(process.execPath, [temporaryPath], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
}
