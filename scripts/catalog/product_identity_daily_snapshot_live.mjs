import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeVegaSqlPool, getVegaSqlPool } from '../../apps/api/src/config/vegaDatabase.js';
import {
  assertLiveReadOnlyPermissions,
  buildApprovedProductIdentityRegistry,
  buildDailyPriceStockSnapshot,
  buildIdentitySnapshotEvidenceSummary,
  buildLiveReadOnlyPermissionQuery,
  buildLiveVegaObservationSource,
  buildLiveVegaSnapshotQuery,
  currentDateInIstanbul,
  parseProductIdentitySnapshotArgs,
} from './product_identity_daily_snapshot_core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const catalogTarget = path.join(rootDir, 'output', 'pdf', 'catalog_work', 'catalog-selection.json');

function usage() {
  return [
    'Usage: node scripts/catalog/product_identity_daily_snapshot_live.mjs',
    '',
    'Runs one approved SELECT-only Vega snapshot test for the pinned 30-product identity registry.',
    'It checks that the database account has SELECT and no write-capable table permissions first.',
    'It never writes a file or database record and never approves, sends, publishes, reserves, or orders.',
  ].join('\n');
}

async function main() {
  const args = parseProductIdentitySnapshotArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const catalogSource = await readFile(catalogTarget, 'utf8');
  const identityRegistry = buildApprovedProductIdentityRegistry({ catalogSource });
  const pool = await getVegaSqlPool();

  const permissionResult = await pool.request().query(buildLiveReadOnlyPermissionQuery());
  const permissionEvidence = assertLiveReadOnlyPermissions(permissionResult.recordset || []);

  const request = pool.request();
  request.timeout = 60000;
  identityRegistry.products.forEach((product, index) => {
    request.input(`liveSourceId${index}`, product.sourceId);
    request.input(`liveStockCode${index}`, product.stockCode);
  });
  const result = await request.query(buildLiveVegaSnapshotQuery(identityRegistry));
  const observedAt = new Date();
  const observationSource = buildLiveVegaObservationSource({
    identityRegistry,
    rows: result.recordset || [],
    permissionEvidence,
    observedAt,
  });
  const dailySnapshot = buildDailyPriceStockSnapshot({
    identityRegistry,
    observationSource,
    now: observedAt,
  });
  const summary = buildIdentitySnapshotEvidenceSummary({ identityRegistry, dailySnapshot });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    status: 'BLOCKED_FAIL_CLOSED',
    code: error?.code || 'LIVE_DAILY_SNAPSHOT_TEST_FAILED',
    message: 'Live read-only daily snapshot test did not complete.',
    currentIstanbulBusinessDate: currentDateInIstanbul(),
    databaseWritePerformed: false,
    erpOrVegaWritePerformed: false,
    externalMessageSent: false,
    priceApproved: false,
  }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  await closeVegaSqlPool().catch(() => {});
}
