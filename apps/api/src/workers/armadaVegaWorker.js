import { readArmadaVegaPreflight } from '../services/armadaVegaPreflightService.js';
import { readArmadaVegaResult } from '../services/armadaVegaResultService.js';
import { closeVegaSqlPool } from '../config/vegaDatabase.js';
import { readDailyPreflight } from '../services/armadaDailyPreflightService.js';
import { readOfflineCatalogCards } from '../services/terminalOfflineCatalogReadService.js';
let input = '';
try {
  for await (const chunk of process.stdin) { input += chunk.toString('utf8'); if (input.length > 65536) throw new Error('INPUT_LIMIT'); }
  const request = JSON.parse(input);
  let data;
  if (request.operation === 'preflight') data = await readArmadaVegaPreflight(request.documentNumber);
  else if (request.operation === 'daily-preflight') data = await readDailyPreflight(request.intent, request.documentNumber);
  else if (request.operation === 'result') data = await readArmadaVegaResult(request.expected);
  else if (request.operation === 'offline-catalog') data = await readOfflineCatalogCards(request.kind, request.ids);
  else throw new Error('OPERATION_INVALID');
  console.log(JSON.stringify({ ok: true, data }));
} catch { console.log(JSON.stringify({ ok: false, code: 'ARMADA_VEGA_READ_FAILED' })); process.exitCode = 1; }
finally { await closeVegaSqlPool().catch(() => {}); }
