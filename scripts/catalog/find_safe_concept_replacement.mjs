import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeSqlPool } from '../../apps/api/src/config/database.js';
import {
  getActiveVegaProductImageSourceIds,
  getVegaProductImageMap,
} from '../../apps/api/src/services/vegaProductImageService.js';
import { getVegaProductsListFromWorker } from '../../apps/api/src/services/vegaProductClientService.js';
import {
  assertApiWorkingDirectory,
  assertProductSourceMeta,
} from './select_catalog_products_core.mjs';
import {
  BLOCKED_SOURCE_ID,
  CANONICAL_SELECTION_FILE_NAME,
  CURRENT_CANDIDATE_FILE_NAME,
  assertPinnedSelectionDocuments,
  buildSafeConceptShortlist,
  parseConceptReplacementArgs,
} from './find_safe_concept_replacement_core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(rootDir, 'output', 'pdf', 'catalog_work');
const excludedSourceIds = [119682, 138512, BLOCKED_SOURCE_ID];

function chunks(values, size) {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
}

async function readJsonWithHash(target) {
  const source = await readFile(target, 'utf8');
  return {
    payload: JSON.parse(source),
    sha256: createHash('sha256').update(source).digest('hex'),
  };
}

function evidenceFileName(generatedAt) {
  return `catalog-concept-replacement-shortlist-${generatedAt.replace(/[-:.]/g, '')}.json`;
}

function printHelp() {
  console.log([
    'Usage: node find_safe_concept_replacement.mjs [--write-report]',
    '',
    'No argument: read-only preview; writes no file.',
    '--write-report: writes a new local evidence file; never changes either catalog selection.',
  ].join('\n'));
}

async function main() {
  const cli = parseConceptReplacementArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }
  assertApiWorkingDirectory(process.cwd(), path.join(rootDir, 'apps', 'api'));

  const candidateTarget = path.join(outputDir, CURRENT_CANDIDATE_FILE_NAME);
  const canonicalTarget = path.join(outputDir, CANONICAL_SELECTION_FILE_NAME);
  const candidate = await readJsonWithHash(candidateTarget);
  const canonical = await readJsonWithHash(canonicalTarget);
  const documentEvidence = assertPinnedSelectionDocuments({
    candidatePayload: candidate.payload,
    candidateSha256: candidate.sha256,
    canonicalPayload: canonical.payload,
    canonicalSha256: canonical.sha256,
  });

  const imageSourceIds = await getActiveVegaProductImageSourceIds();
  const products = [];
  const imageMap = new Map();
  let sourceIdentity = null;

  for (const group of chunks(imageSourceIds, 500)) {
    const result = await getVegaProductsListFromWorker({
      includeSourceIds: group,
      imageStatus: 'with-image',
      activeOnly: true,
      page: 1,
      limit: 500,
    });
    sourceIdentity ||= assertProductSourceMeta(result.meta);
    products.push(...(result.data || []));
    const groupImages = await getVegaProductImageMap(group);
    for (const [sourceId, filePath] of groupImages) imageMap.set(sourceId, filePath);
  }

  const shortlist = buildSafeConceptShortlist({
    products,
    imageMap,
    currentProducts: candidate.payload.products,
    excludedSourceIds,
    limit: 10,
  });
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    purpose: 'Find a safe same-brand replacement for blocked source 158798',
    sourceIdentity,
    publicationStatus: 'local-review-evidence-only',
    safety: {
      vegaMode: 'read-only',
      catalogWritePerformed: false,
      canonicalSelectionChanged: false,
      unpublishedCandidateChanged: false,
      localModelUsed: false,
      sensitiveCommercialFieldsIncluded: false,
    },
    pinnedDocuments: {
      candidate: { fileName: CURRENT_CANDIDATE_FILE_NAME, sha256: candidate.sha256 },
      canonical: { fileName: CANONICAL_SELECTION_FILE_NAME, sha256: canonical.sha256 },
      ...documentEvidence,
    },
    shortlist,
  };

  let evidenceTarget = null;
  if (cli.writeReport) {
    await mkdir(outputDir, { recursive: true });
    evidenceTarget = path.join(outputDir, evidenceFileName(generatedAt));
    await writeFile(evidenceTarget, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  }

  console.log(JSON.stringify({
    status: 'PASS',
    mode: cli.mode,
    sourceIdentity,
    safety: {
      ...payload.safety,
      localEvidenceFileWritten: Boolean(evidenceTarget),
    },
    pinnedDocuments: payload.pinnedDocuments,
    shortlist,
    evidenceTarget,
  }, null, 2));
}

try {
  await main();
} finally {
  await closeSqlPool().catch(() => {});
}

