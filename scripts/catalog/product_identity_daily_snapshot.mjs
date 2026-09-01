import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildApprovedProductIdentityRegistry,
  buildCatalogMigrationObservationSource,
  buildDailyPriceStockSnapshot,
  buildIdentitySnapshotEvidenceSummary,
  currentDateInIstanbul,
  parseProductIdentitySnapshotArgs,
} from './product_identity_daily_snapshot_core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const catalogTarget = path.join(rootDir, 'output', 'pdf', 'catalog_work', 'catalog-selection.json');

function usage() {
  return [
    'Usage: node scripts/catalog/product_identity_daily_snapshot.mjs',
    '',
    'Builds a redacted local contract preview from the pinned approved catalog.',
    'It does not connect to Vega, write a file, approve a price, create a quote, or send anything.',
    'The preview fails closed when the pinned catalog observation is not from the real Istanbul day.',
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
  const observationSource = buildCatalogMigrationObservationSource({ catalogSource });
  const dailySnapshot = buildDailyPriceStockSnapshot({
    identityRegistry,
    observationSource,
  });
  const summary = buildIdentitySnapshotEvidenceSummary({ identityRegistry, dailySnapshot });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  const safeFailure = {
    status: 'BLOCKED_FAIL_CLOSED',
    code: error?.code || 'DAILY_SNAPSHOT_PREVIEW_FAILED',
    message: error?.message || 'Daily snapshot preview failed',
    currentIstanbulBusinessDate: currentDateInIstanbul(),
    liveVegaReadPerformed: false,
    databaseWritePerformed: false,
    erpOrVegaWritePerformed: false,
    externalMessageSent: false,
    priceApproved: false,
  };
  process.stderr.write(`${JSON.stringify(safeFailure, null, 2)}\n`);
  process.exitCode = 1;
});
