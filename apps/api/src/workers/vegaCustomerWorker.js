import { getVegaCustomersList } from '../services/vegaCustomerService.js';
import { closeVegaSqlPool } from '../config/vegaDatabase.js';

let input = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', async () => {
  try {
    const query = input ? JSON.parse(input) : {};
    const result = await getVegaCustomersList(query);
    process.stdout.write(JSON.stringify({ ok: true, result }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      error: {
        code: error.code || 'VEGA_CUSTOMER_LIST_FAILED',
        statusCode: error.statusCode || 503,
        message: 'Vega customer list could not be read',
      },
    }));
  } finally {
    await closeVegaSqlPool().catch(() => {});
  }
});
