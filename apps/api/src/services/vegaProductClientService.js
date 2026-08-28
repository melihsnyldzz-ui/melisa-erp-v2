import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../workers/vegaProductWorker.js', import.meta.url));

function makeWorkerError(payload = {}) {
  const error = new Error(payload.message || 'Vega stock list worker failed');
  error.code = payload.code || 'VEGA_PRODUCT_WORKER_FAILED';
  error.statusCode = Number(payload.statusCode || 503);
  return error;
}

export function getVegaProductsListFromWorker(query = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        reject(makeWorkerError({ code: 'VEGA_PRODUCT_WORKER_TIMEOUT', message: 'Vega stock list timed out' }));
      }
    }, 30000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(makeWorkerError({ message: error.message }));
      }
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      try {
        const payload = JSON.parse(stdout || '{}');
        if (!payload.ok) {
          reject(makeWorkerError(payload.error));
          return;
        }
        resolve(payload.result);
      } catch {
        reject(makeWorkerError({
          code: 'VEGA_PRODUCT_WORKER_INVALID_RESPONSE',
          message: stderr ? 'Vega stock worker returned an invalid response' : 'Vega stock worker returned no response',
        }));
      }
    });

    child.stdin.end(JSON.stringify(query || {}));
  });
}
