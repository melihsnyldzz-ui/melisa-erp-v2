import { closeVegaSqlPool } from '../config/vegaDatabase.js';
import { closeSqlPool } from '../config/database.js';
import {
  getVegaCustomerLedgerList,
  getVegaCustomerStockExitDocument,
  getVegaSalesStockExitList,
} from '../services/vegaKoliLedgerService.js';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', async () => {
  try {
    const request = input ? JSON.parse(input) : {};
    const action = request.action || 'list';
    const payload = request.payload || request;
    let result;
    if (action === 'stock-exit-document') {
      result = await getVegaCustomerStockExitDocument(payload.customerSourceId, payload.movementSourceId);
    } else if (action === 'sales-stock-exit-list') {
      result = await getVegaSalesStockExitList(payload.query || {});
    } else {
      result = await getVegaCustomerLedgerList(payload.customerSourceId, payload.query || {});
    }
    process.stdout.write(JSON.stringify({ ok: true, result }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      error: {
        code: error.code || 'VEGA_CUSTOMER_LEDGER_FAILED',
        statusCode: error.statusCode || 503,
        message: 'Vega customer ledger could not be read',
      },
    }));
  } finally {
    await Promise.allSettled([
      closeVegaSqlPool(),
      closeSqlPool(),
    ]);
  }
});
