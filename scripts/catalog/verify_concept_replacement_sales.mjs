import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeVegaSqlPool, getVegaSqlPool } from '../../apps/api/src/config/vegaDatabase.js';
import {
  assertReadOnlyPermissions,
  buildReadOnlyPermissionQuery,
  buildSalesEvidence,
} from './verify_catalog_candidate_sales_core.mjs';
import {
  SHORTLIST_FILE_NAME,
  assertPinnedShortlist,
  buildReplacementSalesQuery,
  parseReplacementSalesArgs,
} from './verify_concept_replacement_sales_core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(rootDir, 'output', 'pdf', 'catalog_work');
const shortlistTarget = path.join(outputDir, SHORTLIST_FILE_NAME);

function printHelp() {
  console.log([
    'Usage: node verify_concept_replacement_sales.mjs [--write-report]',
    '',
    'No argument: runs the read-only Vega check and writes no file.',
    '--write-report: writes a new local evidence file; changes no catalog selection.',
  ].join('\n'));
}

function evidenceFileName(retrievedAt) {
  return `catalog-concept-replacement-sales-${retrievedAt.replace(/[-:.]/g, '')}.json`;
}

async function main() {
  const cli = parseReplacementSalesArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }

  const shortlistSource = await readFile(shortlistTarget, 'utf8');
  const shortlistSha256 = createHash('sha256').update(shortlistSource).digest('hex');
  const shortlistPayload = JSON.parse(shortlistSource);
  const targets = assertPinnedShortlist(shortlistPayload, shortlistSha256);

  const pool = await getVegaSqlPool();
  const permissionResult = await pool.request().query(buildReadOnlyPermissionQuery());
  const permissionEvidence = assertReadOnlyPermissions(permissionResult.recordset || []);
  const request = pool.request();
  request.timeout = 60000;
  targets.forEach((target, index) => {
    request.input(`replacementSourceId${index}`, target.sourceId);
  });
  const result = await request.query(buildReplacementSalesQuery(targets));
  const salesEvidence = buildSalesEvidence(result.recordset || [], targets);
  const retrievedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    retrievedAt,
    sourceIdentity: {
      source: 'vega-live-read-only',
      database: 'VEGA2026',
      companyCode: 'F0102',
      periods: ['D0004', 'D0005', 'D0006', 'D0007'],
      years: [2023, 2024, 2025, 2026],
    },
    shortlist: {
      fileName: SHORTLIST_FILE_NAME,
      sha256: shortlistSha256,
      publicationStatus: shortlistPayload.publicationStatus,
    },
    measurement: {
      name: 'gross-sales-stock-exit-history',
      rule: 'IZAHAT=33 and CIKAN>0; quantities are gross stock exits, not net revenue or profitability',
    },
    safety: {
      queryType: 'SELECT_ONLY',
      permissionEvidence,
      vegaWritePerformed: false,
      erpWritePerformed: false,
      customerDataIncluded: false,
      priceOrCostIncluded: false,
      documentNumberIncluded: false,
      localModelUsed: false,
    },
    summary: {
      targetCount: salesEvidence.targetCount,
      productsWithRecordedSales: salesEvidence.productsWithRecordedSales,
      productsWithoutRecordedSales: salesEvidence.productsWithoutRecordedSales,
    },
    products: salesEvidence.products,
  };

  let evidenceTarget = null;
  if (cli.writeReport) {
    await mkdir(outputDir, { recursive: true });
    evidenceTarget = path.join(outputDir, evidenceFileName(retrievedAt));
    await writeFile(evidenceTarget, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  }

  console.log(JSON.stringify({
    status: 'PASS',
    mode: cli.mode,
    sourceIdentity: payload.sourceIdentity,
    shortlist: payload.shortlist,
    safety: {
      ...payload.safety,
      localEvidenceFileWritten: Boolean(evidenceTarget),
    },
    summary: payload.summary,
    products: payload.products.map((product) => ({
      sourceId: product.sourceId,
      stockCode: product.stockCode,
      hasRecordedSales: product.hasRecordedSales,
      totals: product.totals,
    })),
    evidenceTarget,
  }, null, 2));
}

try {
  await main();
} finally {
  await closeVegaSqlPool().catch(() => {});
}

