import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../workers/vegaProductWorker.js', import.meta.url));
const safeCode = (value) => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value);
function workerError(code, { exitCode = null, signal = null, retryable = false, statusCode = 503 } = {}) {
  const error = new Error('Vega ürün listesi okunamadı. Verileri yeniden güncelleyin.');
  error.code = code;
  error.statusCode = Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 503;
  error.workerExitCode = Number.isInteger(exitCode) ? exitCode : null;
  error.workerSignal = typeof signal === 'string' && /^SIG[A-Z0-9]{1,20}$/.test(signal) ? signal : null;
  error.retryableWorkerFailure = retryable;
  return error;
}

// Only this SELECT-only list worker may repeat. A complete SQL/application error
// is returned directly; an empty, malformed or abnormally closed worker gets one
// new process using the exact same serialized query.
export function createVegaProductReader({ spawnImpl = spawn, timeoutMs = 30000,
  onDiagnostic = (data) => console.warn('[vega-product-read]', JSON.stringify(data)) } = {}) {
  function readOnce(input) {
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = spawnImpl(process.execPath, [workerPath], { cwd: process.cwd(), env: process.env,
          stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      } catch { reject(workerError('VEGA_PRODUCT_WORKER_START_FAILED')); return; }
      let stdout = '', settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (error) reject(error); else resolve(result);
      };
      const timer = setTimeout(() => {
        finish(workerError('VEGA_PRODUCT_WORKER_TIMEOUT'));
        child.kill();
      }, timeoutMs);
      child.stdout.setEncoding?.('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      // Drain without retaining or exposing raw driver diagnostics or credentials.
      child.stderr.resume();
      child.on('error', () => finish(workerError('VEGA_PRODUCT_WORKER_START_FAILED')));
      // EPIPE can precede the close event; the exit code and response at close
      // determine whether this read can receive its single retry.
      child.stdin.on('error', () => {});
      child.on('close', (exitCode, signal) => {
        if (settled) return;
        let payload;
        try { payload = JSON.parse(stdout); } catch {}
        const details = { exitCode, signal };
        if (payload?.ok === false && safeCode(payload.error?.code)) {
          finish(workerError(payload.error.code, { ...details, statusCode: payload.error.statusCode })); return;
        }
        if (exitCode !== 0 || signal) {
          finish(workerError('VEGA_PRODUCT_WORKER_EXIT_FAILED', { ...details, retryable: true })); return;
        }
        if (!stdout.trim()) {
          finish(workerError('VEGA_PRODUCT_WORKER_EMPTY_RESPONSE', { ...details, retryable: true })); return;
        }
        if (payload?.ok !== true || !Array.isArray(payload.result?.data)
          || !payload.result.meta || typeof payload.result.meta !== 'object' || Array.isArray(payload.result.meta)) {
          finish(workerError('VEGA_PRODUCT_WORKER_INVALID_RESPONSE', { ...details, retryable: true })); return;
        }
        finish(null, payload.result);
      });
      try { child.stdin.end(input); }
      catch { finish(workerError('VEGA_PRODUCT_WORKER_START_FAILED')); child.kill(); }
    });
  }
  return async function getVegaProductsListFromWorker(query = {}) {
    const input = JSON.stringify(query || {});
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { return await readOnce(input); }
      catch (error) {
        error.workerAttempts = attempt;
        try { onDiagnostic({ code: error.code, exitCode: error.workerExitCode, signal: error.workerSignal,
          attempt, willRetry: error.retryableWorkerFailure === true && attempt === 1 }); } catch {}
        if (!error.retryableWorkerFailure || attempt === 2) throw error;
      }
    }
  };
}

export const getVegaProductsListFromWorker = createVegaProductReader();
