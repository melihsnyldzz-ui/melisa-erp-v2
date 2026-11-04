// Offline derivation only. This module cannot issue an admission or execute SQL.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const hash = value => createHash('sha256').update(value).digest('hex').toUpperCase();
const requireProof = (condition, code) => { if (!condition) throw new Error(`B6_DIAGNOSTIC_REVIEW_${code}`); };
const tuples = [
  ['resolve', 560825160, 'A4E52071F8413A83315E84D661804FA0E5F5AA6A1AA7DAF880230553D4F20C5F'],
  ['context', 576825217, '648A9B07A54ADB6DA97DB8168F9A8B9C2D95AA1809326AEAC259A442042D33EB'],
  ['begin', 592825274, 'C91F43028BFA9E3AB944816709B2A2350767340C3447AECBAABAA524E7CA18FA'],
].map(([part, objectId, definitionHash]) => ({ name: `dbo.usp_canonical_business_sale_${part}_v1`, objectId, hash: definitionHash }));
const options = { ansiNulls: true, quotedIdentifier: true, executeAs: -2, schemaBound: false, nativeCompilation: false, signatureCount: 0 };

/** Receipts are historical evidence, never a live capture or installation authority.
 * SQL and descriptor outputs belong in the existing private evidence area only.
 * Callers must additionally pin the original artifact/descriptor/packet bytes.
 */
export function deriveDiagnosticReview({ artifact, descriptor, packet, receipt }) {
  requireProof(receipt?.schema === 'melisa-b6-array-repair-post-install-readback.v1'
    && receipt.status === 'PASS_READONLY_POST_INSTALL' && receipt.readOnly === true
    && receipt.executionAuthority === false && receipt.runtimeWrites === 0
    && receipt.tradeWrites === 0 && receipt.failure === null, 'RECEIPT');
  requireProof(isDeepStrictEqual(receipt.modulesCompared, tuples), 'CURRENT_TUPLES');
  requireProof(receipt.profileFieldsChanged === 2 && receipt.profileOtherFieldsUnchanged === true, 'PROFILE_SEMANTIC_PROOF');
  requireProof(isDeepStrictEqual(artifact.appDescriptor, descriptor), 'ORIGINAL_DESCRIPTOR');
  const batch = artifact.applyBatches?.at(-1);
  requireProof(batch?.id === 'after-cas' && batch.kind === 'READ_ONLY_CAS'
    && typeof batch.sql === 'string' && hash(batch.sql) === batch.sourceHash, 'ORIGINAL_CAS');
  requireProof(packet.proposedModules?.length === 3, 'MODULE_COUNT');
  let sql = batch.sql;
  const changes = [];
  for (let i = 0; i < tuples.length; i++) {
    const module = packet.proposedModules[i], expected = tuples[i];
    requireProof(module.name === expected.name && module.objectId === expected.objectId
      && module.compiledAfterCreateSha256 === expected.hash
      && isDeepStrictEqual(module.options, options), 'MODULE_IDENTITY');
    const before = module.compiledBeforeCreateSha256;
    requireProof(typeof before === 'string' && /^[A-F0-9]{64}$/.test(before)
      && before !== expected.hash && sql.split(before).length === 2
      && !sql.includes(expected.hash), 'HASH_OCCURRENCE');
    sql = sql.replace(before, expected.hash);
    changes.push({ before, after: expected.hash });
  }
  let reversed = sql;
  for (const change of changes.toReversed()) reversed = reversed.replace(change.after, change.before);
  requireProof(reversed === batch.sql, 'CAS_REVERSIBILITY');
  const delta = packet.profileMetadataDelta;
  requireProof(delta?.length === 2, 'DESCRIPTOR_DELTA');
  const candidateDescriptor = structuredClone(descriptor);
  for (let i = 0; i < 2; i++) {
    const field = ['contextDefinitionHash', 'beginDefinitionHash'][i];
    requireProof(delta[i].field === `businessSaleAdmission.${field}`
      && delta[i].before === descriptor[field] && delta[i].after === tuples[i + 1].hash, 'DESCRIPTOR_DELTA');
    candidateDescriptor[field] = delta[i].after;
  }
  return {
    review: {
      schema: 'melisa-b6-diagnostic-current-state-review.v1',
      installed: false, executionAuthority: false, installable: false, admissionIssued: false,
      freshness: 'DATED_RECEIPTS_ONLY', receiptUtc: receipt.utc,
      expectedModules: structuredClone(tuples), expectedAfterCasSha256: hash(sql),
      originalAfterCasSha256: batch.sourceHash, descriptorFieldsChanged: 2,
      profileEvidence: 'SEMANTIC_OTHER_FIELDS_EQUAL_NOT_RAW_BYTE_EQUALITY',
      missingInstallationProof: [
        'FRESH_PRIVATE_PROFILE_BYTE_EQUAL_CAPTURE',
        'FRESH_EXCLUSIVE_OWNER_API_TASK_FUTURE_LAUNCHER_CAPTURE_AND_ENTRY_LOCKS',
        'REVIEWED_FIXED_PACKAGE_REFRESH_GENERATION_BOUND_TO_CURRENT_AFTER_AND_DESCRIPTOR',
      ],
    },
    privateExpectedAfterSql: sql, privateExpectedDescriptor: candidateDescriptor,
  };
}
