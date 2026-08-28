import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../workers/vegaSupplierWorker.js', import.meta.url));

function workerError(payload = {}) {
  const error = new Error(payload.message || 'Vega supplier worker failed');
  error.code = payload.code || 'VEGA_SUPPLIER_WORKER_FAILED';
  error.statusCode = Number(payload.statusCode || 503);
  return error;
}

function requestWorker(action, payload = {}) {
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
        reject(workerError({ code: 'VEGA_SUPPLIER_WORKER_TIMEOUT', message: 'Vega supplier read timed out' }));
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
        const response = JSON.parse(stdout || '{}');
        if (!response.ok) return reject(workerError(response.error));
        resolve(response.result);
      } catch {
        reject(workerError({
          code: 'VEGA_SUPPLIER_WORKER_INVALID_RESPONSE',
          message: stderr ? 'Vega supplier worker returned an invalid response' : 'Vega supplier worker returned no response',
        }));
      }
    });
    child.stdin.end(JSON.stringify({ action, payload }));
  });
}

export function getVegaSuppliersListFromWorker(query = {}) {
  return requestWorker('list', { query });
}

export function getVegaSupplierLedgerListFromWorker(supplierSourceId, query = {}) {
  return requestWorker('ledger', { supplierSourceId, query });
}

export function getVegaSupplierPurchaseDocumentFromWorker(supplierSourceId, movementSourceId) {
  return requestWorker('purchase-document', { supplierSourceId, movementSourceId });
}

export function getVegaPurchaseInvoiceListFromWorker(query = {}) {
  return requestWorker('purchase-list', { query });
}

export function getVegaSupplierPurchaseIntelligenceFromWorker(supplierSourceId, query = {}) {
  return requestWorker('purchase-intelligence', { supplierSourceId, query });
}
