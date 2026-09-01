import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../workers/vegaProductMetadataWorker.js', import.meta.url));
const workerCwd = fileURLToPath(new URL('../../', import.meta.url));

export function getVegaProductMetadataFromWorker(query = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], { cwd: workerCwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = ''; let stderr = ''; let settled = false;
    const fail = (code, message) => { if (!settled) { settled = true; const error = new Error(message); error.code = code; error.statusCode = 503; reject(error); } };
    const timer = setTimeout(() => { child.kill(); fail('VEGA_PRODUCT_METADATA_WORKER_TIMEOUT', 'Vega product metadata worker timed out'); }, 30000);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => { clearTimeout(timer); fail('VEGA_PRODUCT_METADATA_WORKER_FAILED', error.message); });
    child.on('close', () => {
      clearTimeout(timer);
      if (settled) return;
      try {
        const payload = JSON.parse(stdout || '{}');
        if (!payload.ok) return fail(payload.error?.code || 'VEGA_PRODUCT_METADATA_WORKER_FAILED', 'Vega product metadata worker failed');
        settled = true;
        resolve(payload.result);
      } catch { fail('VEGA_PRODUCT_METADATA_WORKER_INVALID_RESPONSE', stderr ? 'Vega product metadata worker returned invalid output' : 'Vega product metadata worker returned no output'); }
    });
    child.stdin.end(JSON.stringify({ offset: Number(query.offset) || 0, limit: Number(query.limit) || 100, stockCode: typeof query.stockCode === 'string' ? query.stockCode : undefined }));
  });
}
