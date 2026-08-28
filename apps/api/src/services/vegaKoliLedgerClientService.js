import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../workers/vegaKoliLedgerWorker.js', import.meta.url));

function workerError(payload = {}) {
  const error = new Error(payload.message || 'Vega customer ledger worker failed');
  error.code = payload.code || 'VEGA_CUSTOMER_LEDGER_WORKER_FAILED';
  error.statusCode = Number(payload.statusCode || 503);
  return error;
}

function requestVegaKoliWorker(action, payload = {}) {
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
        reject(workerError({ code: 'VEGA_CUSTOMER_LEDGER_WORKER_TIMEOUT', message: 'Vega customer ledger timed out' }));
      }
    }, 30000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(workerError({ message: error.message }));
      }
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      try {
        const payload = JSON.parse(stdout || '{}');
        if (!payload.ok) return reject(workerError(payload.error));
        resolve(payload.result);
      } catch {
        reject(workerError({
          code: 'VEGA_CUSTOMER_LEDGER_WORKER_INVALID_RESPONSE',
          message: stderr ? 'Vega customer ledger worker returned an invalid response' : 'Vega customer ledger worker returned no response',
        }));
      }
    });
    child.stdin.end(JSON.stringify({ action, payload }));
  });
}

export function getVegaCustomerLedgerListFromWorker(customerSourceId, query = {}) {
  return requestVegaKoliWorker('list', { customerSourceId, query });
}

export function getVegaCustomerStockExitDocumentFromWorker(customerSourceId, movementSourceId) {
  return requestVegaKoliWorker('stock-exit-document', { customerSourceId, movementSourceId });
}

export function getVegaSalesStockExitListFromWorker(query = {}) {
  return requestVegaKoliWorker('sales-stock-exit-list', { query });
}
