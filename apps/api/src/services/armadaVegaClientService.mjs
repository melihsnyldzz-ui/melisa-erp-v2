import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export function queryArmadaVega(request) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../workers/armadaVegaWorker.js', import.meta.url))], {
      env: process.env, cwd: process.cwd(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = ''; let invalid = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error('ARMADA_VEGA_READ_TIMEOUT')); }, 18000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; if (output.length > 1024 * 1024) { invalid = true; child.kill(); } });
    child.stderr.resume();
    child.once('error', () => { clearTimeout(timer); reject(new Error('ARMADA_VEGA_WORKER_FAILED')); });
    child.once('close', () => {
      clearTimeout(timer);
      try { const result = JSON.parse(output); if (invalid || result.ok !== true) throw new Error(); resolve(result.data); }
      catch { reject(new Error('ARMADA_VEGA_READ_FAILED')); }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
