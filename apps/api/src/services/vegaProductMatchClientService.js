import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../workers/vegaProductMatchWorker.js', import.meta.url));

export function getVegaProductMatchIndexFromWorker() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill();
      const error = new Error('Vega ürün eşleştirme listesi zaman aşımına uğradı');
      error.code = 'VEGA_PRODUCT_MATCH_INDEX_TIMEOUT';
      reject(error);
    }, 45000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const payload = JSON.parse(stdout || '{}');
        if (!payload.ok) {
          const error = new Error(payload.error?.message || 'Vega ürün eşleştirme listesi okunamadı');
          error.code = payload.error?.code || 'VEGA_PRODUCT_MATCH_INDEX_FAILED';
          reject(error);
          return;
        }
        resolve(payload.data || []);
      } catch {
        const error = new Error(stderr || 'Vega ürün eşleştirme işçisi geçersiz yanıt döndürdü');
        error.code = 'VEGA_PRODUCT_MATCH_INDEX_INVALID_RESPONSE';
        reject(error);
      }
    });
  });
}
