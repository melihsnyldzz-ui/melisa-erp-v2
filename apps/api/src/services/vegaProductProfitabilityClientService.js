import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../workers/vegaProductProfitabilityWorker.js', import.meta.url));
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const pending = new Map();

function cacheKey(query = {}) {
  return JSON.stringify({
    dateFrom: String(query.dateFrom || ''),
    dateTo: String(query.dateTo || ''),
    limit: String(query.limit || ''),
  });
}

function runWorker(query) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath, JSON.stringify(query || {})], {
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
        const error = new Error('Vega product profitability timed out');
        error.code = 'VEGA_PRODUCT_PROFITABILITY_TIMEOUT';
        error.statusCode = 503;
        reject(error);
      }
    }, 150000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(error); }
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      try {
        const payload = JSON.parse(stdout || '{}');
        if (!payload.ok) {
          const error = new Error(payload.error?.message || 'Vega product profitability failed');
          error.code = payload.error?.code || 'VEGA_PRODUCT_PROFITABILITY_FAILED';
          error.statusCode = Number(payload.error?.statusCode || 503);
          reject(error);
          return;
        }
        resolve(payload.result);
      } catch {
        const error = new Error(stderr
          ? 'Vega profitability worker returned an invalid response'
          : 'Vega profitability worker returned no response');
        error.code = 'VEGA_PRODUCT_PROFITABILITY_INVALID_RESPONSE';
        error.statusCode = 503;
        reject(error);
      }
    });
  });
}

export function getVegaProductProfitabilityFromWorker(query = {}) {
  const key = cacheKey(query);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return Promise.resolve({ ...cached.result, cache: { hit: true, ttlSeconds: CACHE_TTL_MS / 1000 } });
  }
  if (pending.has(key)) return pending.get(key);

  const request = runWorker(query)
    .then((result) => {
      cache.set(key, { createdAt: Date.now(), result });
      return { ...result, cache: { hit: false, ttlSeconds: CACHE_TTL_MS / 1000 } };
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
