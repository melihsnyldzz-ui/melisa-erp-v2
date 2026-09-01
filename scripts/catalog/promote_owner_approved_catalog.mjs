import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APPROVED_CANDIDATE_FILE_NAME,
  CANONICAL_SELECTION_FILE_NAME,
  assertOwnerApprovedMainSelection,
  assertPinnedPromotionInputs,
  buildOwnerApprovedMainSelection,
  parseCatalogPromotionArgs,
} from './promote_owner_approved_catalog_core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(rootDir, 'output', 'pdf', 'catalog_work');

function digest(source) {
  return createHash('sha256').update(source).digest('hex');
}

async function readJsonWithHash(target) {
  const source = await readFile(target, 'utf8');
  return { source, payload: JSON.parse(source), sha256: digest(source) };
}

async function writeNewSynced(target, source) {
  const handle = await open(target, 'wx');
  try {
    await handle.writeFile(source, { encoding: 'utf8' });
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicReplace(target, source, operationStamp, label) {
  const temporaryTarget = `${target}.${label}-${operationStamp}-${process.pid}.tmp`;
  const handle = await open(temporaryTarget, 'wx');
  try {
    await handle.writeFile(source, { encoding: 'utf8' });
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporaryTarget, target);
  } catch (error) {
    await unlink(temporaryTarget).catch(() => {});
    throw error;
  }
}

function stamp(value) {
  return value.replace(/[-:.]/g, '');
}

function printHelp() {
  console.log([
    'Usage: node promote_owner_approved_catalog.mjs [--apply-owner-approval]',
    '',
    'No argument: validates and previews without writing.',
    '--apply-owner-approval: archives the current canonical selection and promotes the pinned approved candidate locally.',
    'This command never publishes a PDF/site and never writes to ERP or Vega.',
  ].join('\n'));
}

async function main() {
  const cli = parseCatalogPromotionArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }

  const candidateTarget = path.join(outputDir, APPROVED_CANDIDATE_FILE_NAME);
  const canonicalTarget = path.join(outputDir, CANONICAL_SELECTION_FILE_NAME);
  const candidate = await readJsonWithHash(candidateTarget);
  const canonical = await readJsonWithHash(canonicalTarget);
  const inputVerification = assertPinnedPromotionInputs({
    candidatePayload: candidate.payload,
    candidateSha256: candidate.sha256,
    canonicalPayload: canonical.payload,
    canonicalSha256: canonical.sha256,
  });
  const operationAt = new Date().toISOString();
  const approvedAt = canonical.payload?.approval?.approvedAt || operationAt;
  const payload = buildOwnerApprovedMainSelection(
    candidate.payload,
    approvedAt,
    operationAt,
    canonical.sha256,
  );
  const resultVerification = assertOwnerApprovedMainSelection(payload, candidate.payload);
  const approvedSource = `${JSON.stringify(payload, null, 2)}\n`;
  const approvedSha256 = digest(approvedSource);
  const timeStamp = stamp(operationAt);
  const archiveFileName = `catalog-selection-archive-${timeStamp}-${canonical.sha256.slice(0, 12)}.json`;
  const snapshotFileName = `catalog-selection-approved-${timeStamp}.json`;
  const approvalFileName = `catalog-selection-owner-approval-${timeStamp}.json`;
  const archiveTarget = path.join(outputDir, archiveFileName);
  const snapshotTarget = path.join(outputDir, snapshotFileName);
  const approvalTarget = path.join(outputDir, approvalFileName);

  let writeEvidence = null;
  if (cli.applyOwnerApproval) {
    await mkdir(outputDir, { recursive: true });

    const [candidateBeforeWrite, canonicalBeforeWrite] = await Promise.all([
      readJsonWithHash(candidateTarget),
      readJsonWithHash(canonicalTarget),
    ]);
    assertPinnedPromotionInputs({
      candidatePayload: candidateBeforeWrite.payload,
      candidateSha256: candidateBeforeWrite.sha256,
      canonicalPayload: canonicalBeforeWrite.payload,
      canonicalSha256: canonicalBeforeWrite.sha256,
    });

    await writeNewSynced(archiveTarget, canonical.source);
    await writeNewSynced(snapshotTarget, approvedSource);
    const archiveHash = digest(await readFile(archiveTarget, 'utf8'));
    const snapshotHash = digest(await readFile(snapshotTarget, 'utf8'));
    if (archiveHash !== canonical.sha256 || snapshotHash !== approvedSha256) {
      throw new Error('Catalog archive or approved snapshot verification failed');
    }

    const [candidateAtCommit, canonicalAtCommit] = await Promise.all([
      readJsonWithHash(candidateTarget),
      readJsonWithHash(canonicalTarget),
    ]);
    if (
      candidateAtCommit.sha256 !== candidate.sha256
      || canonicalAtCommit.sha256 !== canonical.sha256
    ) {
      throw new Error('Catalog promotion inputs changed before the atomic replacement');
    }

    try {
      await atomicReplace(canonicalTarget, approvedSource, timeStamp, 'promote');
      const promoted = await readJsonWithHash(canonicalTarget);
      if (promoted.sha256 !== approvedSha256) {
        throw new Error('Canonical catalog hash does not match approved snapshot');
      }
      assertOwnerApprovedMainSelection(promoted.payload, candidate.payload);

      const approvalPayload = {
        schemaVersion: 1,
        approvedAt,
        appliedAt: operationAt,
        approval: {
          status: 'OWNER_APPROVED',
          userMessage: 'onaylıyorum',
          scope: payload.approval.approvedScope,
          externalPublicationApproved: false,
          erpOrVegaWriteApproved: false,
        },
        before: {
          canonicalFileName: CANONICAL_SELECTION_FILE_NAME,
          canonicalSha256: canonical.sha256,
          archiveFileName,
          archiveSha256: archiveHash,
        },
        sourceCandidate: {
          fileName: APPROVED_CANDIDATE_FILE_NAME,
          sha256: candidate.sha256,
        },
        after: {
          canonicalFileName: CANONICAL_SELECTION_FILE_NAME,
          canonicalSha256: promoted.sha256,
          approvedSnapshotFileName: snapshotFileName,
          approvedSnapshotSha256: snapshotHash,
          ...resultVerification,
        },
        safety: {
          externalPublicationPerformed: false,
          pdfGenerated: false,
          erpWritePerformed: false,
          vegaWritePerformed: false,
          localModelUsed: false,
          rollbackAvailable: true,
        },
      };
      await writeNewSynced(approvalTarget, `${JSON.stringify(approvalPayload, null, 2)}\n`);
      writeEvidence = {
        canonicalTarget,
        canonicalSha256: promoted.sha256,
        archiveTarget,
        archiveSha256: archiveHash,
        snapshotTarget,
        snapshotSha256: snapshotHash,
        approvalTarget,
        approvalSha256: digest(await readFile(approvalTarget, 'utf8')),
      };
    } catch (error) {
      await atomicReplace(canonicalTarget, canonical.source, timeStamp, 'rollback');
      throw error;
    }
  }

  console.log(JSON.stringify({
    status: 'PASS',
    mode: cli.mode,
    writePerformed: cli.applyOwnerApproval,
    inputVerification,
    resultVerification,
    approvedCanonicalSha256: approvedSha256,
    safety: {
      externalPublicationPerformed: false,
      pdfGenerated: false,
      erpWritePerformed: false,
      vegaWritePerformed: false,
      localModelUsed: false,
      rollbackPrepared: cli.applyOwnerApproval,
    },
    writeEvidence,
  }, null, 2));
}

await main();
