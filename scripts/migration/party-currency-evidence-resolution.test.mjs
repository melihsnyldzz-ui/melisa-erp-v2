import test from 'node:test';
import assert from 'node:assert/strict';
import { observedDisplayProof, verifyObservedDisplayProof, uniqueCentProjection, classifyCarryEvidence, resolveAccountEvidence, evidenceHash } from './party-currency-evidence-resolution.mjs';
const hash = 'a'.repeat(64), key = 'F0103/D0007/123/supplier/$';
function proof(exact = '-1.23456789', displayed = '-1.23000000', direction = 'A', raw = null) {
  raw ??= `${displayed.replace('-', '').slice(0, -6).replace('.', ',')} USD (${direction})`;
  const rawRow = ['S123', 'Synthetic supplier', raw, '$'];
  return observedDisplayProof({ accountKey: key, sourceVersionHash: hash, exactSourceNet: exact, sourceWitness: { accountKey: key, sourceVersionHash: hash, sourceCode: 'S123', exactNet: exact, captureHash: hash, typedDocumentHash: hash, typedDocumentsVerified: true, exactNetVerified: true, financialSemanticsUnchanged: true }, reportWitness: { accountKey: key, origin: 'VEGA_EXPORT', independent: true, originalHashVerified: true, originalHash: hash, rowHash: evidenceHash(rawRow), rawRow, scopeHash: hash, scopeVerified: true, excelRow: 9, rawDisplay: raw, signedValue: displayed, direction } });
}
test('positive/negative projection preserves every exact digit without a ledger rounding claim', () => {
  for (const [exact, shown, dir] of [['1.23456789', '1.23000000', 'B'], ['-1.23600000', '-1.24000000', 'A']]) {
    const p = proof(exact, shown, dir); assert.equal(p.valid, true); assert.equal(p.exactSourceNet, exact); assert.equal(p.exactLedgerReconciliationClaimed, false); assert.equal(p.generalActiveReportAlgorithmClaimed, false);
  }
});
test('both exact half-cent boundaries fail closed instead of selecting a tie algorithm', () => {
  for (const exact of ['1.23500000', '-1.23500000', '0.00500000', '-0.00500000']) {
    assert.equal(uniqueCentProjection(exact).unique, false); assert.equal(proof(exact).valid, false);
  }
});
test('positive and negative tiny values, and real zero retain different source states', () => {
  for (const exact of ['0.00000001', '-0.00000001', '0.00000000']) {
    const p = proof(exact, null, null, '(-)'); assert.equal(p.valid, true); assert.equal(p.projection.displayDirection, 'ZERO'); assert.equal(p.sourceIsExactZero, exact === '0.00000000'); assert.equal(p.exactSourceNet, exact);
  }
  assert.equal(proof('-0.00600000', null, null, '(-)').valid, false);
});
test('raw placeholder cannot carry an invented signed zero or B/A value', () => {
  assert.equal(proof('0.00000000', '0.00000000', 'ZERO', '(-)').valid, false);
});
test('a calculator output, missing original hash or changed financial source is no independent witness', () => {
  const p = proof(); for (const change of [{ origin: 'LOCAL_CALCULATOR' }, { originalHashVerified: false }, { rowHash: 'bad' }, { independent: false }]) assert.equal(observedDisplayProof({ ...p, reportWitness: { ...p.reportWitness, ...change } }).valid, false);
  assert.equal(observedDisplayProof({ ...p, sourceWitness: { ...p.sourceWitness, financialSemanticsUnchanged: false } }).valid, false);
});
test('raw export row binds code, currency, displayed digits and direction, not just a caller flag', () => {
  const p = proof();
  for (const rawRow of [['OTHER', 'Synthetic supplier', p.reportWitness.rawDisplay, '$'], ['S123', 'Synthetic supplier', p.reportWitness.rawDisplay, 'TL'], ['S123', 'Synthetic supplier', '1,24 USD (A)', '$']]) assert.equal(observedDisplayProof({ ...p, reportWitness: { ...p.reportWitness, rawRow, rowHash: evidenceHash(rawRow) } }).valid, false);
});
test('explicit known typed report capture can reconcile a retained earlier record change without hiding it', () => {
  const p = proof(); const binding = { method: 'CURRENT_EXACT_EQUALS_TYPED_REPORT_CAPTURE', captureHash: hash, typedDocumentHash: hash, exactNet: p.exactSourceNet, typedDocumentsVerified: true, recordedAmountBasisUnchanged: true, currentRecordProjectionUnchangedSinceCapture: true, earlierRecordChangeRetained: true };
  const witness = { ...p.sourceWitness, financialSemanticsUnchanged: false, reportCaptureBinding: binding };
  const reconciled = observedDisplayProof({ ...p, sourceWitness: witness }); assert.equal(reconciled.valid, true); assert.equal(reconciled.sourceWitness.financialSemanticsUnchanged, false);
  for (const change of [{ exactNet: '-1.23456788' }, { currentRecordProjectionUnchangedSinceCapture: false }, { typedDocumentsVerified: false }, { recordedAmountBasisUnchanged: false }, { earlierRecordChangeRetained: false }]) assert.equal(observedDisplayProof({ ...p, sourceWitness: { ...witness, reportCaptureBinding: { ...binding, ...change } } }).valid, false);
});
test('proof is bound to exact account, source version and net, including a rehashed altered body', () => {
  const p = proof(), witness = { accountKey: key, sourceVersionHash: hash, exactSourceNet: '-1.23456789' };
  assert.equal(verifyObservedDisplayProof(p, witness), true);
  for (const drift of [{ accountKey: `${key}x` }, { sourceVersionHash: 'b'.repeat(64) }, { exactSourceNet: '-1.23456788' }]) assert.equal(verifyObservedDisplayProof(p, { ...witness, ...drift }), false);
  const { proofHash: ignored, ...body } = p; const changed = { ...body, projection: { ...body.projection, displayValue: '-1.24000000' } };
  assert.equal(verifyObservedDisplayProof({ ...changed, proofHash: evidenceHash(changed) }, witness), false);
});
test('display method acceptance only removes display blocker; hold, native and carry stay blocked', () => {
  const a = { key, sourceVersionHash: hash, newSourceNet: '-1.23456789', currency: 'USD', held: true, missing: ['REPORT_EXACT_AMOUNT_OR_DIRECTION_NOT_RECONCILED', 'NATIVE_OPENING_LOCAL_LEDGER_PROOF_MISSING'] };
  const r = resolveAccountEvidence(a, { displayProof: proof() }, { displayMethodAccepted: true });
  assert.deepEqual(r.missing, ['HOLD_REMAINS', 'NATIVE_OPENING_LOCAL_LEDGER_PROOF_MISSING']); assert.equal(r.finalStatus, 'TEKNİK KANIT EKSİK');
});
test('same mathematics for TRY/USD/EUR leaves currencies and supplier mapping to the existing planner', () => {
  for (const currency of ['TRY', 'USD', 'EUR']) { const a = { key, currency, sourceVersionHash: hash, newSourceNet: '-1.23456789', missing: ['REPORT_EXACT_AMOUNT_OR_DIRECTION_NOT_RECONCILED'] }; assert.equal(resolveAccountEvidence(a, { displayProof: proof() }, { displayMethodAccepted: true }).finalStatus, 'AKTARIM KANITI TAMAM — UYGULAMA ONAYI BEKLİYOR'); }
});
test('new card does not imply documented no-carry; complete inception still requires accepted baseline provenance', () => {
  const w = { cardOpenedAt: '2026-02-01T00:00:00', firstMovementDate: '2026-02-02T00:00:00', priorYearMovementCount: 0, identityContinuityVerified: true, priorYearScopeVerified: true, completeCurrentPeriodVerified: true };
  assert.equal(classifyCarryEvidence(w).verified, false); assert.equal(classifyCarryEvidence({ ...w, acceptedSourceSemanticsVerified: true }).verified, true);
  assert.equal(classifyCarryEvidence({ ...w, acceptedSourceSemanticsVerified: true, firstMovementDate: '2026-01-31T00:00:00' }).verified, false);
  assert.equal(classifyCarryEvidence({ priorYearMovementCount: 4 }).category, 'PRIOR_ACTIVITY_WITHOUT_EXPLICIT_CARRY'); assert.equal(classifyCarryEvidence({ otherCurrencyHasCarry: true }).verified, false);
});
test('created cards, LL decisions and an exact verified applied journal have separate final states', () => {
  const a = { key, currency: 'USD', missing: ['HOLD_REMAINS'] };
  assert.equal(resolveAccountEvidence(a, { cardCreated: true }).finalStatus, 'KART OLUŞTU — FİNANS DOĞRULAMASI BEKLİYOR');
  assert.equal(resolveAccountEvidence({ ...a, currency: 'LL' }).finalStatus, 'İŞLETME KARARI BEKLİYOR');
  assert.equal(resolveAccountEvidence(a, { appliedJournal: { verified: true, accountKey: key, journalHash: hash } }).finalStatus, 'UYGULANMIŞ');
  assert.equal(resolveAccountEvidence(a, { appliedJournal: { verified: true, accountKey: `${key}x`, journalHash: hash } }).finalStatus, 'TEKNİK KANIT EKSİK');
});
