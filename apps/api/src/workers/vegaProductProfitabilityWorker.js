import { closeVegaSqlPool } from '../config/vegaDatabase.js';
import { getVegaProductProfitability } from '../services/vegaProductProfitabilityService.js';

let query = {};
try {
  query = process.argv[2] ? JSON.parse(process.argv[2]) : {};
} catch {
  query = {};
}

try {
  const result = await getVegaProductProfitability(query);
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    error: {
      code: error.code || 'VEGA_PRODUCT_PROFITABILITY_FAILED',
      statusCode: error.statusCode || 503,
      message: error.statusCode === 400
        ? error.message
        : 'Vega product profitability could not be read',
    },
  }));
} finally {
  await closeVegaSqlPool().catch(() => {});
}
