import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deriveDiagnosticReview } from './business-sale-diagnostic-review.mjs';

const sha = value => createHash('sha256').update(value).digest('hex').toUpperCase();
function fixture() {
  const hashes = ['A4E52071F8413A83315E84D661804FA0E5F5AA6A1AA7DAF880230553D4F20C5F', '648A9B07A54ADB6DA97DB8168F9A8B9C2D95AA1809326AEAC259A442042D33EB', 'C91F43028BFA9E3AB944816709B2A2350767340C3447AECBAABAA524E7CA18FA'];
  const modules = ['resolve', 'context', 'begin'].map((part, i) => ({ name: `dbo.usp_canonical_business_sale_${part}_v1`, objectId: [560825160, 576825217, 592825274][i], compiledBeforeCreateSha256: sha(`old-${part}`), compiledAfterCreateSha256: hashes[i], options: { ansiNulls: true, quotedIdentifier: true, executeAs: -2, schemaBound: false, nativeCompilation: false, signatureCount: 0 } }));
  const descriptor = { contextDefinitionHash: modules[1].compiledBeforeCreateSha256, beginDefinitionHash: modules[2].compiledBeforeCreateSha256, readers: [{ name: 'keep', hash: sha('reader') }], unchanged: true };
  const sql = `identity-guard\n${modules.map(m => m.compiledBeforeCreateSha256).join('\n')}\npermissions-and-roles-guard`;
  return {
    artifact: { appDescriptor: structuredClone(descriptor), applyBatches: [{ id: 'after-cas', kind: 'READ_ONLY_CAS', sql, sourceHash: sha(sql) }] }, descriptor,
    packet: { proposedModules: modules, profileMetadataDelta: ['contextDefinitionHash', 'beginDefinitionHash'].map((field, i) => ({ field: `businessSaleAdmission.${field}`, before: descriptor[field], after: hashes[i + 1] })) },
    receipt: { schema: 'melisa-b6-array-repair-post-install-readback.v1', status: 'PASS_READONLY_POST_INSTALL', readOnly: true, executionAuthority: false, runtimeWrites: 0, tradeWrites: 0, failure: null, profileFieldsChanged: 2, profileOtherFieldsUnchanged: true, utc: '2026-10-30T10:05:26.9664143Z', modulesCompared: modules.map(m => ({ name: m.name, objectId: m.objectId, hash: m.compiledAfterCreateSha256 })) },
  };
}
test('derives exactly three CAS literals and two descriptor fields without mutating inputs or granting authority', () => {
  const f = fixture(), before = structuredClone(f), result = deriveDiagnosticReview(f);
  assert.deepEqual(f, before);
  assert.ok(result.privateExpectedAfterSql.startsWith('identity-guard\n'));
  assert.ok(result.privateExpectedAfterSql.endsWith('\npermissions-and-roles-guard'));
  let reversed = result.privateExpectedAfterSql;
  for (const m of f.packet.proposedModules) reversed = reversed.replace(m.compiledAfterCreateSha256, m.compiledBeforeCreateSha256);
  assert.equal(reversed, f.artifact.applyBatches[0].sql);
  const restored = structuredClone(result.privateExpectedDescriptor);
  for (const d of f.packet.profileMetadataDelta) restored[d.field.split('.')[1]] = d.before;
  assert.deepEqual(restored, f.descriptor);
  for (const key of ['installed', 'executionAuthority', 'installable', 'admissionIssued']) assert.equal(result.review[key], false);
  assert.equal(result.review.missingInstallationProof.length, 3);
  assert.match(result.review.profileEvidence, /NOT_RAW_BYTE/);
});
test('rejects wrong, reordered or missing current module tuples', () => {
  for (const mutate of [f => f.receipt.modulesCompared[0].hash = sha('wrong'), f => f.receipt.modulesCompared.reverse(), f => f.receipt.modulesCompared.pop(), f => f.packet.proposedModules[0].objectId++, f => f.packet.proposedModules[0].options.signatureCount++, f => f.packet.proposedModules.push(f.packet.proposedModules[0])]) {
    const f = fixture(); mutate(f); assert.throws(() => deriveDiagnosticReview(f), /REVIEW_/);
  }
});
test('rejects stale, broadened or failed readback and semantic profile claims', () => {
  for (const mutate of [f => f.receipt.status = 'FAIL', f => f.receipt.executionAuthority = true, f => f.receipt.runtimeWrites = 1, f => f.receipt.tradeWrites = 1, f => f.receipt.failure = 'failed', f => f.receipt.profileOtherFieldsUnchanged = false, f => f.receipt.profileFieldsChanged = 3]) {
    const f = fixture(); mutate(f); assert.throws(() => deriveDiagnosticReview(f), /REVIEW_/);
  }
});
test('rejects tampered original CAS, duplicate or missing replacement literals', () => {
  for (const kind of ['hash', 'duplicate', 'missing']) {
    const f = fixture(), batch = f.artifact.applyBatches[0], old = f.packet.proposedModules[0].compiledBeforeCreateSha256;
    batch.sql = kind === 'duplicate' ? batch.sql + old : batch.sql.replace(old, 'changed');
    if (kind !== 'hash') batch.sourceHash = sha(batch.sql);
    assert.throws(() => deriveDiagnosticReview(f), /REVIEW_(ORIGINAL_CAS|HASH_OCCURRENCE)/);
  }
});
test('rejects third, reordered or altered descriptor changes and mismatched original descriptor', () => {
  for (const mutate of [f => f.packet.profileMetadataDelta.push({ field: 'extra' }), f => f.packet.profileMetadataDelta.reverse(), f => f.packet.profileMetadataDelta[0].before = sha('wrong'), f => f.packet.profileMetadataDelta[1].after = sha('wrong'), f => f.artifact.appDescriptor.unchanged = false]) {
    const f = fixture(); mutate(f); assert.throws(() => deriveDiagnosticReview(f), /REVIEW_/);
  }
});
