import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadOnlyPlan, hash } from './party-currency-readonly-plan.mjs';
import { assessReportOpeningAlternative, parseIndependentReportRow, buildUnifiedFinanceApprovalPacket, verifyUnifiedFinanceApprovalPacket, bindCurrentApprovalScope, REPORT_OPENING_METHOD } from './unified-finance-approval-plan.mjs';
const H = 'a'.repeat(64);
function account(id = '900', role = 'customer') {
  const company = role === 'customer' ? 'F0102' : 'F0103', key = `${company}/D0007/${id}/${role}/$`, opening = role === 'customer' ? '10.00000000' : '-10.00000000', current = role === 'customer' ? '12.00000000' : '-8.00000000';
  return { company, period: 'D0007', sourceId: id, role, cardType: role === 'customer' ? 3 : 4, key, sourceKey: `VEGA2026/${company}/TBLCARI/${id}`, sourceCode: `S${id}`, targetId: id, nativeAccountId: id, currency: 'USD', currencyRaw: '$', identityVerified: true, held: false, openingSemanticsVerified: false, dateFrom: '2026-01-01', dateToExclusive: '2026-10-08', oldSourceNet: '10.00000000', newSourceNet: '20.00400000', sourceVersionHash: H, sourceRowsHash: H, sourceDriftDuringCapture: false, ledgerProof: { opening, local: '2.00000000', current, ledger: current, witnessHash: H }, technicalEvidence: { acceptedSourceSemanticsProof: { verified: false } } };
}
function witness(a, display = '20,00 $ (B)') {
  const rawRow = [a.sourceCode, 'Synthetic party', display, '$'];
  return { rawRow, rowHash: hash(rawRow), origin: 'VEGA_EXPORT', independent: true, originalHashVerified: true, originalHash: H, scopeHash: H, scopeVerified: true, company: a.company, period: a.period, sourceId: a.sourceId, dateFrom: a.dateFrom, dateToExclusive: a.dateToExclusive, acquiredAt: '2026-10-07T10:00:00Z', excelRow: 2, reportProducedAt: null, identityUnique: true };
}
function native(a) { return { accountKey: a.key, nativeAccountId: a.nativeAccountId, currency: a.currency, witnessHash: H, ledgerHash: H, closed: true, localMovements: [{ id: 77, effectExact: '2.00000000', origin: 'LOCAL_PRESERVED_IN_TEST' }] }; }
const assessment = (a = account(), w = witness(a), extra = {}) => assessReportOpeningAlternative(a, w, { nativeMovementWitness: native(a), ...extra });
test('report opening replaces prior migrated base, preserves local effects, and explicitly discloses chosen report precision', () => {
  const a = account(), r = assessment(a); assert.equal(r.method, REPORT_OPENING_METHOD); assert.equal(r.methodCandidate, true); assert.equal(r.selectableForAmountApproval, true);
  assert.equal(r.proposal.proposedNativeDelta, '10.00000000'); assert.equal(r.proposal.expectedAfter, '22.00000000'); assert.equal(r.proposal.reportPrecisionChoiceImpactSource, '-0.00400000'); assert.equal(r.proposal.oldHistoricalSourceProjectionMismatchDisclosed, true);
  assert.equal(r.proposal.oldOpeningAddedAgain, false); assert.equal(r.proposal.historicalDocumentsAddedAgain, false); assert.deepEqual(r.proposal.localMovementsPreserved, native(a).localMovements);
  assert.equal(r.methodSelectionIsAmountApproval, false); assert.equal(r.amountApproval, 'PENDING'); assert.equal(r.executionAllowed, false);
});
test('supplier B/A source direction does not change supplier role or native negation', () => {
  const a = account('901', 'supplier'), r = assessment(a); assert.equal(r.report.sourceDirection, 'B'); assert.equal(r.role, 'supplier'); assert.equal(r.proposal.nativeSignMapping, 'NEGATE_SOURCE'); assert.equal(r.proposal.proposedNativeDelta, '-10.00000000'); assert.equal(r.proposal.expectedAfter, '-18.00000000');
});
test('placeholder, blank currency and null values never produce a verified zero opening', () => {
  const a = account(); assert.equal(assessment(a, witness(a, '(-)')).methodCandidate, false);
  const w = witness(a); w.rawRow[3] = null; w.rowHash = hash(w.rawRow); assert.equal(assessment(a, w).methodCandidate, false);
  assert.equal(assessment({ ...a, newSourceNet: null }).methodCandidate, false);
});
test('amount or direction disagreement and exact half-cent ambiguity remain blocked', () => {
  const a = account(); for (const display of ['21,00 $ (B)', '20,00 $ (A)']) assert.equal(assessment(a, witness(a, display)).methodCandidate, false);
  assert.equal(assessment({ ...a, newSourceNet: '20.00500000' }).methodCandidate, false);
});
test('held known amounts are conditional method candidates, not selectable application scope', () => {
  const r = assessment({ ...account(), held: true }); assert.equal(r.methodCandidate, true); assert.equal(r.selectableForAmountApproval, false); assert.deepEqual(r.applicationBlockers, ['HOLD_REMAINS_NO_REMOVAL_AUTHORITY']); assert.equal(r.financialWriteAuthorized, false);
});
test('known carry, applied accounts, existing ready accounts and UNKNOWN new cards remain separate', () => {
  const a = account(); assert.equal(assessment({ ...a, openingSemanticsVerified: true }).methodCandidate, false);
  assert.equal(assessment(a, witness(a), { appliedKeys: [a.key] }).methodCandidate, false);
  assert.equal(assessment(a, witness(a), { readyKeys: [a.key] }).methodCandidate, false);
  assert.equal(assessment({ ...a, finalStatus: 'KART OLUŞTU — FİNANS DOĞRULAMASI BEKLİYOR' }).methodCandidate, false);
});
test('wrong report company/code/role/currency or native movement lineage is rejected', () => {
  const a = account(); assert.equal(assessment(a, { ...witness(a), company: 'F0103' }).methodCandidate, false);
  const w = witness(a); w.rawRow[0] = 'OTHER'; w.rowHash = hash(w.rawRow); assert.equal(assessment(a, w).methodCandidate, false);
  assert.equal(assessment(a, witness(a), { nativeMovementWitness: { ...native(a), nativeAccountId: 'OTHER' } }).methodCandidate, false);
  assert.equal(assessment(a, witness(a), { nativeMovementWitness: { ...native(a), currency: 'EUR' } }).methodCandidate, false);
  assert.equal(assessment({ ...a, ledgerProof: { ...a.ledgerProof, current: '13.00000000' } }).methodCandidate, false);
});
function packetInput() {
  const readyAccounts = Array.from({ length: 38 }, (_, index) => {
    const a = account(String(index + 1)); return { ...a, openingSemanticsVerified: true, periodDocumentsVerified: true, sameSourceBasisVerified: true, nativeBaselineVerified: true, nativeOpening: '10.00000000', localEffects: '2.00000000', nativeCurrent: '12.00000000', nativeLedger: '12.00000000', nativeWitnessHash: H, newSourceNet: '20.00000000', report: { verified: true, independent: true, origin: 'VEGA_EXPORT', sha256: H, company: a.company, period: a.period, dateFrom: a.dateFrom, dateToExclusive: a.dateToExclusive, currency: a.currency, sourceId: a.sourceId, cardType: a.cardType, activeFilter: 'ALL', zeroFilter: 'INCLUDE', capturedAt: '2026-10-07T10:00:00Z', filterProofHash: H, amountExact: '20.00000000', direction: 'B' } };
  });
  const readyPlan = buildReadOnlyPlan({ environment: 'MELISA_ERP_SIRKET_TEST_20260929_01', runId: 'READY', sourceVersionHash: H, accounts: readyAccounts });
  const prior = Array.from({ length: 16 }, (_, i) => ({ ...account(String(i + 100)), appliedJournal: { verified: true } })), a = account();
  const others = Array.from({ length: 154 }, (_, i) => ({ ...account(String(i + 1000)), identityVerified: false, ledgerProof: null }));
  return { runId: 'UNIFIED', readyPlan, matrix: { accounts: [...readyAccounts, ...prior, a, ...others] }, reportWitnesses: { [a.key]: witness(a) }, nativeMovementWitnesses: { [a.key]: native(a) }, priorJournalHash: H, priorAppliedKeys: prior.map(a => a.key), matrixFileHash: H };
}
test('one packet preserves immutable ready plan and excludes all 16 previous applications', () => {
  const input = packetInput(), before = JSON.stringify(input.readyPlan), p = buildUnifiedFinanceApprovalPacket(input);
  assert.equal(JSON.stringify(input.readyPlan), before); assert.equal(p.readyPlanHash, input.readyPlan.planHash); assert.equal(p.summary.existingReadyExactDelta, 38); assert.equal(p.summary.sourceReportOpeningAmountApprovalSelectable, 1); assert.equal(p.summary.actualFinanceApprovalAccounts, 39); assert.equal(p.summary.priorAppliedExcluded, 16); assert.equal(p.executeAllowed, false);
  assert.equal(p.alternatives.some(a => input.priorAppliedKeys.includes(a.accountKey)), false);
});
test('deterministic replay and body/source/target fingerprint drift checks fail closed', () => {
  const input = packetInput(), packet = buildUnifiedFinanceApprovalPacket(input), context = { input, readyPlanHash: input.readyPlan.planHash, readySourceVersionHash: input.readyPlan.sourceVersionHash, priorJournalHash: H, matrixFileHash: H };
  assert.equal(buildUnifiedFinanceApprovalPacket(input).packetHash, packet.packetHash); assert.equal(verifyUnifiedFinanceApprovalPacket(packet, context).executionAllowed, false);
  assert.throws(() => verifyUnifiedFinanceApprovalPacket({ ...packet, executeAllowed: true }, context), /PAYLOAD_CONFLICT/);
  assert.throws(() => verifyUnifiedFinanceApprovalPacket(packet, { ...context, readySourceVersionHash: 'b'.repeat(64) }), /REFERENCE_DRIFT/);
  const alteredInput = structuredClone(input); alteredInput.matrix.accounts.find(a => a.key === account().key).ledgerProof.current = '13.00000000';
  assert.throws(() => verifyUnifiedFinanceApprovalPacket(packet, { ...context, input: alteredInput }), /SCOPE_OR_EFFECT_DRIFT/);
  const { packetHash: ignored, ...body } = packet; const altered = structuredClone(body); altered.alternatives[0].proposal.proposedNativeDelta = '999.00000000';
  assert.throws(() => verifyUnifiedFinanceApprovalPacket({ ...altered, packetHash: hash(altered) }, context), /SCOPE_OR_EFFECT_DRIFT/);
});

function currentProof(packet) {
  const keys = [...packet.readyExactDeltaAccounts, ...packet.alternatives.filter(a => a.selectableForAmountApproval).map(a => a.accountKey)];
  const body = { packetHash: packet.packetHash, readyPlanHash: packet.readyPlanHash, sourceVersionHash: packet.readySourceVersionHash, priorJournalHash: packet.priorJournalHash, financialWrites: 0, sourceWrites: 0, targetWrites: 0, sourceScope: { atomicT1: false, scopeExtendedToToday: false }, startedAt: '2026-10-08T06:00:00Z', endedAt: '2026-10-08T06:00:01Z', accounts: keys.map(accountKey => ({ accountKey, source: { financialRowsMatched: true, typedHeadersMatched: true, typedReferenceComplete: true, exactNetMatched: true, identityMatched: true, frozenFinancialRowsHash: H, currentFinancialRowsHash: H, frozenTypedHeadersHash: H, currentTypedHeadersHash: H, originalExactNet: '20.00000000', currentExactNet: '20.00000000', matched: true }, target: { accountRowMatched: true, ledgerMatched: true, witnessMatched: true, identityMatched: true, frozenLedgerHash: H, currentLedgerHash: H, frozenWitnessHash: H, currentWitnessHash: H, matched: true }, currentScopeMatched: true, applicationAuthorization: false })) };
  for (const a of body.accounts) {
    const original = packet.readyPlan.accounts.find(r => r.key === a.accountKey), alternative = packet.alternatives.find(r => r.accountKey === a.accountKey);
    a.source.originalExactNet = original?.newSourceNet ?? alternative.proposal.exactCurrentSourceNet; a.source.currentExactNet = a.source.originalExactNet;
  }
  return { ...body, evidenceHash: hash(body) };
}
test('current approval scope retains original amounts and excludes prior and held accounts', () => {
  const input = packetInput();
  for (let i = 0; i < 5; i++) { const held = { ...account(String(i + 1000)), held: true }; input.matrix.accounts[input.matrix.accounts.findIndex(a => a.key === held.key)] = held; input.reportWitnesses[held.key] = witness(held); input.nativeMovementWitnesses[held.key] = native(held); }
  const packet = buildUnifiedFinanceApprovalPacket(input), before = JSON.stringify(packet), overlay = bindCurrentApprovalScope(packet, currentProof(packet));
  assert.equal(overlay.effectiveApprovalAccounts, 39); assert.equal(overlay.currentReadyAccounts, 38); assert.equal(overlay.currentReportOpeningAccounts, 1); assert.equal(overlay.priorAppliedExcluded, 16); assert.equal(overlay.executeAllowed, false); assert.equal(JSON.stringify(packet), before);
  assert.equal(overlay.effectiveApprovalAccountKeys.some(k => packet.priorAppliedKeys.includes(k)), false);
  assert.equal(overlay.heldAlternativesExcluded, 5); assert.equal(overlay.effectiveApprovalAccountKeys.some(k => packet.alternatives.some(a => a.accountKey === k && a.held)), false);
});
test('one changed source account is deferred without recalculating the historical plan', () => {
  const packet = buildUnifiedFinanceApprovalPacket(packetInput()), proof = currentProof(packet), a = proof.accounts[0];
  a.source.financialRowsMatched = false; a.source.currentFinancialRowsHash = 'b'.repeat(64); a.source.matched = false; a.currentScopeMatched = false;
  const { evidenceHash: ignored, ...body } = proof, overlay = bindCurrentApprovalScope(packet, { ...body, evidenceHash: hash(body) });
  assert.equal(overlay.historicalReadyAccounts, 38); assert.equal(overlay.currentReadyAccounts, 37); assert.equal(overlay.effectiveApprovalAccounts, 38); assert.equal(overlay.deferred[0].accountKey, a.accountKey); assert.equal(overlay.amountsRecomputed, false); assert.equal(overlay.historicalPacketHash, packet.packetHash);
});
test('altered fingerprint hash, wrong source reference and unproven account flags fail closed', () => {
  const packet = buildUnifiedFinanceApprovalPacket(packetInput()), proof = currentProof(packet);
  assert.throws(() => bindCurrentApprovalScope(packet, { ...proof, evidenceHash: 'b'.repeat(64) }), /PROOF_HASH/);
  const seal = p => { const { evidenceHash: ignored, ...body } = p; return { ...body, evidenceHash: hash(body) }; };
  assert.throws(() => bindCurrentApprovalScope(packet, seal({ ...proof, sourceVersionHash: 'b'.repeat(64) })), /REFERENCE_DRIFT/);
  const altered = structuredClone(proof); altered.accounts[0].source.typedReferenceComplete = false;
  assert.throws(() => bindCurrentApprovalScope(packet, seal(altered)), /ACCOUNT_CONTRADICTION/);
});
