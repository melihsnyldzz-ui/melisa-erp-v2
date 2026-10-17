import { closeVegaSqlPool } from '../config/vegaDatabase.js';
import { getVegaProductMatchIndex } from '../services/vegaProductMatchService.js';

try {
  const data = await getVegaProductMatchIndex();
  process.stdout.write(JSON.stringify({ ok: true, data }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    error: {
      code: error.code || 'VEGA_PRODUCT_MATCH_INDEX_FAILED',
      statusCode: error.statusCode || 503,
      message: 'Vega ürün eşleştirme listesi okunamadı',
    },
  }));
} finally {
  await closeVegaSqlPool().catch(() => {});
}
