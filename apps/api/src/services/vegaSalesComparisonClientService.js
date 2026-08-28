import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../workers/vegaSalesComparisonWorker.js', import.meta.url));

export function getVegaSalesComparisonFromWorker() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        const error = new Error('Vega sales comparison timed out');
        error.code = 'VEGA_SALES_COMPARISON_TIMEOUT';
        error.statusCode = 503;
        reject(error);
      }
    }, 30000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      try {
        const payload = JSON.parse(stdout || '{}');
        if (!payload.ok) {
          const error = new Error(payload.error?.message || 'Vega sales comparison failed');
          error.code = payload.error?.code || 'VEGA_SALES_COMPARISON_FAILED';
          error.statusCode = Number(payload.error?.statusCode || 503);
          reject(error);
          return;
        }
        resolve(payload.result);
      } catch {
        const error = new Error(stderr ? 'Vega sales worker returned an invalid response' : 'Vega sales worker returned no response');
        error.code = 'VEGA_SALES_COMPARISON_INVALID_RESPONSE';
        error.statusCode = 503;
        reject(error);
      }
    });
  });
}
