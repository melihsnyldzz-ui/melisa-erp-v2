import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeVegaSqlPool, getVegaSqlPool } from '../../apps/api/src/config/vegaDatabase.js';
import {
  CANDIDATE_FILE_NAME,
  assertReadOnlyPermissions,
  buildSalesEvidence,
  buildReadOnlyPermissionQuery,
  buildTargetedSalesQuery,
  assertCandidateSelection,
  parseCandidateSalesArgs,
} from './verify_catalog_candidate_sales_core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(rootDir, 'output', 'pdf', 'catalog_work');
const candidateTarget = path.join(outputDir, CANDIDATE_FILE_NAME);

function printHelp() {
  console.log([
    'Usage: node verify_catalog_candidate_sales.mjs [--write-report]',
    '',
    'No argument: runs the read-only Vega check and writes no file.',
    '--write-report: writes one new timestamped local evidence file; never changes the catalog candidate.',
  ].join('\n'));
}

function evidenceFileName(retrievedAt) {
  return `catalog-candidate-sales-history-${retrievedAt.replace(/[-:.]/g, '')}.json`;
}

async function main() {
  const cli = parseCandidateSalesArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }

  const candidateSource = await readFile(candidateTarget, 'utf8');
  const candidateSha256 = createHash('sha256').update(candidateSource).digest('hex');
  const candidatePayload = JSON.parse(candidateSource);
  const targets = assertCandidateSelection(candidatePayload, candidateSha256);

  const pool = await getVegaSqlPool();
  const permissionResult = await pool.request().query(buildReadOnlyPermissionQuery());
  const permissionEvidence = assertReadOnlyPermissions(permissionResult.recordset || []);
  const request = pool.request();
  request.timeout = 60000;
  targets.forEach((target, index) => {
    request.input(`candidateSourceId${index}`, target.sourceId);
  });
  const result = await request.query(buildTargetedSalesQuery(targets));
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
    candidate: {
      fileName: CANDIDATE_FILE_NAME,
      sha256: candidateSha256,
      publicationStatus: candidatePayload.publicationStatus,
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
    await writeFile(evidenceTarget, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  }

  console.log(JSON.stringify({
    status: 'PASS',
    mode: cli.mode,
    sourceIdentity: payload.sourceIdentity,
    candidate: payload.candidate,
    safety: {
      ...payload.safety,
      localEvidenceFileWritten: Boolean(evidenceTarget),
    },
    summary: payload.summary,
    evidenceTarget,
  }, null, 2));
}

try {
  await main();
} finally {
  await closeVegaSqlPool().catch(() => {});
}
