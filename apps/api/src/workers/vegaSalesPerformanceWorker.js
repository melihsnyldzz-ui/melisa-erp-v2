import { closeVegaSqlPool } from '../config/vegaDatabase.js';
import { getVegaSalesPerformance } from '../services/vegaSalesPerformanceService.js';

try {
  const result = await getVegaSalesPerformance();
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    error: {
      code: error.code || 'VEGA_SALES_PERFORMANCE_FAILED',
      statusCode: error.statusCode || 503,
      message: 'Vega sales performance could not be read',
    },
  }));
} finally {
  await closeVegaSqlPool().catch(() => {});
}
