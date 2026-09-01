import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeSqlPool } from '../../apps/api/src/config/database.js';
import { getVegaProductImageMap } from '../../apps/api/src/services/vegaProductImageService.js';
import { getVegaProductsListFromWorker } from '../../apps/api/src/services/vegaProductClientService.js';
import {
  assertApiWorkingDirectory,
  assertProductSourceMeta,
} from './select_catalog_products_core.mjs';
import {
  CANONICAL_SELECTION_FILE_NAME,
  CURRENT_CANDIDATE_FILE_NAME,
} from './find_safe_concept_replacement_core.mjs';
import {
  SALES_EVIDENCE_FILE_NAME,
  SELECTED_REPLACEMENT,
  VISUAL_EVIDENCE_FILE_NAME,
  assertReplacementEvidence,
  assertReplacementResult,
  buildSafeReplacementCandidate,
  parseCreateReplacementArgs,
} from './create_safe_concept_replacement_core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(rootDir, 'output', 'pdf', 'catalog_work');

async function readJsonWithHash(target) {
  const source = await readFile(target, 'utf8');
  return {
    payload: JSON.parse(source),
    sha256: createHash('sha256').update(source).digest('hex'),
  };
}

function candidateFileName(generatedAt) {
  return `catalog-selection-candidate-${generatedAt.replace(/[-:.]/g, '')}.json`;
}

function printHelp() {
  console.log([
    'Usage: node create_safe_concept_replacement.mjs [--write-candidate]',
    '',
    'No argument: validates and previews; writes no file.',
    '--write-candidate: creates a new unpublished timestamped candidate with 7770 replaced by 8023.',
  ].join('\n'));
}

async function main() {
  const cli = parseCreateReplacementArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }
  assertApiWorkingDirectory(process.cwd(), path.join(rootDir, 'apps', 'api'));

  const candidateTarget = path.join(outputDir, CURRENT_CANDIDATE_FILE_NAME);
  const canonicalTarget = path.join(outputDir, CANONICAL_SELECTION_FILE_NAME);
  const salesTarget = path.join(outputDir, SALES_EVIDENCE_FILE_NAME);
  const visualTarget = path.join(outputDir, VISUAL_EVIDENCE_FILE_NAME);
  const [candidate, canonical, sales, visual] = await Promise.all([
    readJsonWithHash(candidateTarget),
    readJsonWithHash(canonicalTarget),
    readJsonWithHash(salesTarget),
    readJsonWithHash(visualTarget),
  ]);
  const replacementEvidence = assertReplacementEvidence({
    candidatePayload: candidate.payload,
    candidateSha256: candidate.sha256,
    canonicalPayload: canonical.payload,
    canonicalSha256: canonical.sha256,
    salesPayload: sales.payload,
    salesSha256: sales.sha256,
    visualPayload: visual.payload,
    visualSha256: visual.sha256,
  });

  const result = await getVegaProductsListFromWorker({
    sourceId: SELECTED_REPLACEMENT.sourceId,
    activeOnly: true,
    page: 1,
    limit: 1,
  });
  const sourceIdentity = assertProductSourceMeta(result.meta);
  if (!Array.isArray(result.data) || result.data.length !== 1) {
    throw new Error('Selected replacement could not be read uniquely from Vega');
  }
  const imageMap = await getVegaProductImageMap([SELECTED_REPLACEMENT.sourceId]);
  const imagePath = imageMap.get(SELECTED_REPLACEMENT.sourceId);
  const imageDiskPath = path.join(rootDir, 'apps', 'api', imagePath.replace(/^\//, ''));
  const imageSource = await readFile(imageDiskPath);
  const imageSha256 = createHash('sha256').update(imageSource).digest('hex');
  const generatedAt = new Date().toISOString();
  const payload = buildSafeReplacementCandidate({
    candidatePayload: candidate.payload,
    canonicalPayload: canonical.payload,
    liveProduct: result.data[0],
    imagePath,
    imageSha256,
    salesRow: replacementEvidence.salesRow,
    generatedAt,
    evidence: {
      sourceCandidate: { fileName: CURRENT_CANDIDATE_FILE_NAME, sha256: candidate.sha256 },
      canonicalSelection: { fileName: CANONICAL_SELECTION_FILE_NAME, sha256: canonical.sha256 },
      sales: { fileName: SALES_EVIDENCE_FILE_NAME, sha256: sales.sha256 },
      visual: { fileName: VISUAL_EVIDENCE_FILE_NAME, sha256: visual.sha256 },
      imageSha256,
      sourceIdentity,
    },
  });
  const verification = assertReplacementResult(payload, candidate.payload);
  const target = path.join(outputDir, candidateFileName(generatedAt));

  if (cli.writeCandidate) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  }

  const [candidateAfter, canonicalAfter] = await Promise.all([
    readJsonWithHash(candidateTarget),
    readJsonWithHash(canonicalTarget),
  ]);
  if (candidateAfter.sha256 !== candidate.sha256 || canonicalAfter.sha256 !== canonical.sha256) {
    throw new Error('A pinned source catalog selection changed during candidate creation');
  }

  console.log(JSON.stringify({
    status: 'PASS',
    mode: cli.mode,
    writePerformed: cli.writeCandidate,
    sourceIdentity,
    selectedReplacement: {
      sourceId: SELECTED_REPLACEMENT.sourceId,
      stockCode: SELECTED_REPLACEMENT.stockCode,
      brand: SELECTED_REPLACEMENT.brand,
    },
    verification,
    protectedInputs: {
      sourceCandidate: { sha256: candidateAfter.sha256, changed: false },
      canonicalSelection: { sha256: canonicalAfter.sha256, changed: false },
    },
    publicationPerformed: false,
    candidateTarget: cli.writeCandidate ? target : null,
  }, null, 2));
}

try {
  await main();
} finally {
  await closeSqlPool().catch(() => {});
}

