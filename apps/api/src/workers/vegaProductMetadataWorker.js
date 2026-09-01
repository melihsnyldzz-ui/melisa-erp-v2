import { closeVegaSqlPool } from '../config/vegaDatabase.js';
import { getVegaProductMetadata } from '../services/vegaProductMetadataService.js';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', async () => {
  try { process.stdout.write(JSON.stringify({ ok: true, result: await getVegaProductMetadata(input ? JSON.parse(input) : {}) })); }
  catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: { code: error.code || 'VEGA_PRODUCT_METADATA_FAILED' } })); }
  finally { await closeVegaSqlPool().catch(() => {}); }
});
