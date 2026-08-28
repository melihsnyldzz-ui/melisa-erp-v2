import { closeVegaSqlPool } from '../config/vegaDatabase.js';
import { getVegaSalesComparison } from '../services/vegaSalesComparisonService.js';

try {
  const result = await getVegaSalesComparison();
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    error: {
      code: error.code || 'VEGA_SALES_COMPARISON_FAILED',
      statusCode: error.statusCode || 503,
      message: 'Vega sales comparison could not be read',
    },
  }));
} finally {
  await closeVegaSqlPool().catch(() => {});
}
