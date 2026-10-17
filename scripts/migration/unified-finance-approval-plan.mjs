// Approval preparation only: reuse the existing delta plan; never write or authorize finance.
import { hash, verifyPlan, direction } from './party-currency-readonly-plan.mjs';
import { uniqueCentProjection } from './party-currency-evidence-resolution.mjs';
import { createHash } from 'node:crypto';
import { replayDecision } from './goal73-supplier-delta.mjs';

export const REPORT_OPENING_METHOD = 'USER_APPROVED_SOURCE_REPORT_OPENING';
const sha = value => /^[a-f0-9]{64}$/.test(value ?? '');
const units = value => { if (typeof value !== 'string' || !/^-?\d{1,20}\.\d{8}$/.test(value)) throw Error('EXACT_DECIMAL_REQUIRED'); return BigInt(value.replace('.', '')); };
const exact = value => { const a = value < 0n ? -value : value; return `${value < 0n ? '-' : ''}${a / 100000000n}.${String(a % 100000000n).padStart(8, '0')}`; };
const currency = raw => ({ '$': 'USD', USD: 'USD', '€': 'EUR', EUR: 'EUR', TL: 'TRY', TRY: 'TRY', '₺': 'TRY' }[String(raw ?? '').trim().toUpperCase()] ?? null);
const keyOf = account => [account.company, account.period, account.sourceId, account.role, account.currencyRaw].join('/');

export function parseIndependentReportRow(account, witness) {
  const missing = [], key = keyOf(account), row = witness?.rawRow;
  if (!account.identityVerified || account.key !== key || !/^\d+$/.test(account.sourceId ?? '') || !['customer', 'supplier'].includes(account.role) || account.company !== (account.role === 'customer' ? 'F0102' : 'F0103') || account.period !== 'D0007') missing.push('EXACT_COMPANY_ROLE_ACCOUNT_IDENTITY_REQUIRED');
  if (!witness?.independent || witness.origin !== 'VEGA_EXPORT' || witness.originalHashVerified !== true || !sha(witness.originalHash) || !sha(witness.scopeHash) || witness.scopeVerified !== true || witness.company !== account.company || witness.period !== account.period || witness.sourceId !== account.sourceId || witness.dateFrom !== account.dateFrom || witness.dateToExclusive !== account.dateToExclusive || !witness.acquiredAt || !Number.isInteger(witness.excelRow) || witness.excelRow < 1) missing.push('ORIGINAL_DATED_SCOPE_EXPORT_REQUIRED');
  if (!Array.isArray(row) || row.length < 4 || typeof row[0] !== 'string' || row[0].trimEnd() !== account.sourceCode?.trimEnd() || currency(row[3]) !== account.currency || !currency(row[3]) || hash(row) !== witness?.rowHash || witness.identityUnique !== true) missing.push('EXACT_EXPORT_ROW_CODE_CURRENCY_REQUIRED');
  const rawDisplay = row?.[2];
  if (/^\s*\(-\)\s*$/.test(rawDisplay ?? '')) missing.push('PLACEHOLDER_IS_NOT_APPROVED_ZERO_OR_DIRECTION');
  const match = typeof rawDisplay === 'string' ? /^\s*([\d.,]+)\s+(\S+)\s*\(\s*([BA])\s*\)\s*$/u.exec(rawDisplay) : null;
  let signedAmount = null, sourceDirection = null;
  if (match) {
    const number = match[1].replaceAll('.', '').replace(',', '.'), parts = /^(\d+)\.(\d{2})$/.exec(number);
    if (!parts || currency(match[2]) !== account.currency) missing.push('REPORT_NUMERIC_CURRENCY_OR_PRECISION_CONFLICT');
    else { signedAmount = `${match[3] === 'A' ? '-' : ''}${parts[1]}.${parts[2]}000000`; sourceDirection = match[3]; if (direction(signedAmount) !== sourceDirection) missing.push('REPORT_ZERO_DIRECTION_CONFLICT'); }
  } else missing.push('REPORT_AMOUNT_AND_BA_NOT_KNOWN');
  return { valid: missing.length === 0, missing, signedAmount, sourceDirection, currency: account.currency, decimalScale: 2, rawDisplay, originalHash: witness?.originalHash, rowHash: witness?.rowHash, scopeHash: witness?.scopeHash, excelRow: witness?.excelRow, acquiredAt: witness?.acquiredAt, reportProducedAt: witness?.reportProducedAt ?? null, dateFrom: witness?.dateFrom, dateToExclusive: witness?.dateToExclusive, exactLedgerPrecisionClaimed: false };
}

export function assessReportOpeningAlternative(account, reportWitness, { readyKeys = [], appliedKeys = [], nativeMovementWitness = null } = {}) {
  const missing = [], report = parseIndependentReportRow(account, reportWitness), key = keyOf(account);
  if (readyKeys.includes(key)) missing.push('EXISTING_READY_METHOD_MUST_NOT_BE_REPLACED');
  if (appliedKeys.includes(key) || account.appliedJournal) missing.push('PRIOR_APPLIED_ACCOUNT_EXCLUDED');
  if (account.finalStatus === 'KART OLUŞTU — FİNANS DOĞRULAMASI BEKLİYOR') missing.push('NEW_UNKNOWN_CARD_SEPARATE');
  if (account.openingSemanticsVerified === true) missing.push('EXPLICIT_CARRY_ALREADY_PROVEN_USE_EXISTING_EVIDENCE');
  if (!['TRY', 'USD', 'EUR'].includes(account.currency)) missing.push('LL_OR_UNKNOWN_CURRENCY_SEPARATE_DECISION');
  missing.push(...report.missing);
  const proof = account.ledgerProof;
  let opening = null, local = null, current = null;
  try {
    opening = units(proof?.opening); local = units(proof?.local); current = units(proof?.current);
    if (units(proof.ledger) !== current || opening + local !== current || !sha(proof.witnessHash)) missing.push('NATIVE_OPENING_LOCAL_LEDGER_CONFLICT');
  } catch { missing.push('NATIVE_BEFORE_AND_LOCAL_UNKNOWN'); }
  if (!nativeMovementWitness || nativeMovementWitness.accountKey !== key || nativeMovementWitness.witnessHash !== proof?.witnessHash || !sha(nativeMovementWitness.ledgerHash) || nativeMovementWitness.closed !== true) missing.push('NATIVE_MOVEMENT_LINEAGE_REQUIRED');
  let sourceAgreement = null;
  if (account.newSourceNet == null) missing.push('SOURCE_NET_UNKNOWN_NO_CONTRADICTION_CHECK');
  else {
    try {
      const projection = uniqueCentProjection(account.newSourceNet);
      sourceAgreement = projection.unique && report.signedAmount !== null && projection.displayValue === report.signedAmount && projection.displayDirection === report.sourceDirection;
      if (!projection.unique) missing.push('HALF_CENT_RULE_NOT_PROVEN');
      else if (!sourceAgreement) missing.push('REAL_SOURCE_REPORT_AMOUNT_OR_DIRECTION_CONFLICT');
    } catch { missing.push('SOURCE_EXACT_NET_INVALID'); }
  }
  if (account.sourceDriftDuringCapture) missing.push('SOURCE_CAPTURE_DRIFT');
  if (!account.targetId || !account.nativeAccountId || nativeMovementWitness?.nativeAccountId !== account.nativeAccountId || nativeMovementWitness?.currency !== account.currency) missing.push('EXACT_NATIVE_TARGET_ACCOUNT_CURRENCY_REQUIRED');
  if (!sha(account.sourceVersionHash) || !sha(account.sourceRowsHash)) missing.push('SOURCE_VERSION_FINGERPRINT_REQUIRED');
  const methodCandidate = missing.length === 0;
  let proposal = null;
  if (methodCandidate) {
    const signed = units(report.signedAmount), sign = account.role === 'supplier' ? -1n : 1n, proposedBase = sign * signed;
    // Replace only the already present migration base: do not add old opening/history again.
    const delta = proposedBase - opening, after = proposedBase + local;
    proposal = { operation: 'OPENING_BASIS_REPLACEMENT', reportSourceSignedAmount: report.signedAmount, reportSourceDirection: report.sourceDirection, nativeSignMapping: account.role === 'supplier' ? 'NEGATE_SOURCE' : 'PRESERVE_SOURCE', acceptedOldSourceNet: account.oldSourceNet, exactCurrentSourceNet: account.newSourceNet, reportPrecisionChoiceImpactSource: exact(signed - units(account.newSourceNet)), priorMigratedOpening: exact(opening), preservedLocalEffects: exact(local), nativeBefore: exact(current), nativeLedgerBefore: proof.ledger, proposedMigrationBase: exact(proposedBase), proposedNativeDelta: exact(delta), expectedAfter: exact(after), expectedInverseDelta: exact(-delta), inverseRestoresBefore: exact(current), oldOpeningAddedAgain: false, historicalDocumentsAddedAgain: false, ledgerHistoryPreserved: true, localMovementsPreserved: nativeMovementWitness.localMovements, nativeLedgerHash: nativeMovementWitness.ledgerHash, nativeWitnessHash: proof.witnessHash, oldHistoricalSourceInterpretationVerified: account.technicalEvidence?.acceptedSourceSemanticsProof?.verified === true, oldHistoricalSourceProjectionMismatchDisclosed: account.technicalEvidence?.acceptedSourceSemanticsProof?.verified === false, openingBasisAndExactAmountApprovalBothRequired: true };
  }
  const held = account.held === true;
  return { accountKey: key, sourceKey: account.sourceKey, targetId: account.targetId, nativeAccountId: account.nativeAccountId, sourceCode: account.sourceCode, sourceName: account.sourceName, role: account.role, currency: account.currency, method: REPORT_OPENING_METHOD, methodSelectedByTask: true, methodSelectionIsAmountApproval: false, amountApproval: 'PENDING', executionAllowed: false, financialWriteAuthorized: false, methodCandidate, selectableForAmountApproval: methodCandidate && !held, held, applicationBlockers: held ? ['HOLD_REMAINS_NO_REMOVAL_AUTHORITY'] : [], missing: [...new Set(missing)].sort(), report, sourceVersionHash: account.sourceVersionHash, sourceRowsHash: account.sourceRowsHash, sourceDataCapturedAt: account.sourceDataCapturedAt ?? null, sourceAgreementAtRecordedVersion: sourceAgreement, proposal, accountSnapshotHash: hash(account), nativeMovementWitnessHash: nativeMovementWitness ? hash(nativeMovementWitness) : null };
}

export function buildUnifiedFinanceApprovalPacket({ runId, readyPlan, matrix, reportWitnesses, nativeMovementWitnesses, priorJournalHash, priorAppliedKeys, matrixFileHash }) {
  if (!runId || matrix.accounts.length !== 209 || !sha(matrixFileHash) || !sha(priorJournalHash) || priorAppliedKeys.length !== 16 || new Set(priorAppliedKeys).size !== 16 || readyPlan.accounts.length !== 38) throw Error('EXACT_EXISTING_SCOPE_REQUIRED');
  const keys = matrix.accounts.map(a => a.key); if (new Set(keys).size !== 209) throw Error('DUPLICATE_MATRIX_ACCOUNT');
  const readyKeys = readyPlan.accounts.map(a => a.key); if (readyKeys.some(key => priorAppliedKeys.includes(key))) throw Error('PRIOR_JOURNAL_REAPPLICATION');
  verifyPlan(readyPlan, { runId: readyPlan.runId, sourceVersionHash: readyPlan.sourceVersionHash, nativeWitnesses: Object.fromEntries(readyPlan.accounts.map(a => [a.key, a.nativeWitnessHash])) });
  const alternatives = [], blocked = [];
  for (const account of matrix.accounts) {
    if (priorAppliedKeys.includes(account.key) || readyKeys.includes(account.key)) continue;
    const assessment = assessReportOpeningAlternative(account, reportWitnesses[account.key], { readyKeys, appliedKeys: priorAppliedKeys, nativeMovementWitness: nativeMovementWitnesses[account.key] });
    if (assessment.methodCandidate) alternatives.push(assessment); else blocked.push(assessment);
  }
  const selectable = alternatives.filter(a => a.selectableForAmountApproval), conditional = alternatives.filter(a => !a.selectableForAmountApproval);
  const group = rows => Object.fromEntries([...new Set(rows.map(r => r.missing[0] ?? r.applicationBlockers[0] ?? 'OTHER'))].sort().map(reason => [reason, rows.filter(r => (r.missing[0] ?? r.applicationBlockers[0] ?? 'OTHER') === reason).map(r => r.accountKey)]));
  const body = { schemaVersion: 'melisa-unified-finance-approval-packet.v1', runId, environment: readyPlan.environment, matrixFileHash, readyPlanHash: readyPlan.planHash, readySourceVersionHash: readyPlan.sourceVersionHash, readyPlan, priorJournalHash, priorAppliedKeys: [...priorAppliedKeys].sort(), readyExactDeltaAccounts: readyKeys, alternatives: alternatives.sort((a, b) => a.accountKey.localeCompare(b.accountKey)), blocked, groupedMissing: group(blocked), businessQuestions: [{ id: 'LL_USAGE_OR_ARCHIVE', accountKeys: matrix.accounts.filter(a => !['TRY', 'USD', 'EUR'].includes(a.currency)).map(a => a.key), question: 'Bilinen iki eski LL deneme hesabı yeni sistemde kullanılacak mı, arşiv erişiminde mi tutulacak?', reaskCurrencyMeaning: false }, { id: 'HELD_KNOWN_REPORT_SCOPE', accountKeys: conditional.map(a => a.accountKey), question: 'Kimliği ve sayısal raporu bilinen bu karantinalı hesaplar yeni sistemin kullanım kapsamına alınacak mı?', releasesHold: false }], summary: { scopeAccounts: 209, priorAppliedExcluded: 16, existingReadyExactDelta: 38, sourceReportOpeningMethodCandidates: alternatives.length, sourceReportOpeningAmountApprovalSelectable: selectable.length, sourceReportOpeningHeldConditional: conditional.length, blockedAccounts: blocked.length, actualFinanceApprovalAccounts: readyKeys.length + selectable.length, readyDifferenceAccounts: readyPlan.accounts.filter(a => a.proposal.nativeDelta !== '0.00000000').length, readyNoOpAccounts: readyPlan.accounts.filter(a => a.proposal.nativeDelta === '0.00000000').length, financialWrites: 0 }, methodSelectionIsAmountApproval: false, financialWriteAuthorized: false, executeAllowed: false, noPerAccountApprovalLoop: true, sourceCurrentFingerprintRequiredBeforeAnyApplication: true, targetCurrentFingerprintRequiredBeforeAnyApplication: true };
  return { ...body, packetHash: hash(body) };
}

export function verifyUnifiedFinanceApprovalPacket(packet, context) {
  const { packetHash, ...body } = packet;
  if (hash(body) !== packetHash || body.executeAllowed !== false || body.financialWriteAuthorized !== false) throw Error('APPROVAL_PACKET_PAYLOAD_CONFLICT');
  if (context.readyPlanHash !== body.readyPlanHash || context.readySourceVersionHash !== body.readySourceVersionHash || context.priorJournalHash !== body.priorJournalHash || context.matrixFileHash !== body.matrixFileHash) throw Error('APPROVAL_REFERENCE_DRIFT');
  const rebuilt = buildUnifiedFinanceApprovalPacket({ ...context.input, runId: body.runId }); if (rebuilt.packetHash !== packetHash) throw Error('APPROVAL_ACCOUNT_SCOPE_OR_EFFECT_DRIFT');
  return { packetHash, status: 'APPROVAL_PREPARATION_VERIFIED', financialWrites: 0, executionAllowed: false, accounts: body.summary.actualFinanceApprovalAccounts };
}

export function bindCurrentApprovalScope(packet, currentFingerprintProof) {
  const { packetHash, ...packetBody } = packet, { evidenceHash, ...proofBody } = currentFingerprintProof;
  if (hash(packetBody) !== packetHash || packet.executeAllowed !== false || packet.financialWriteAuthorized !== false) throw Error('CURRENT_SCOPE_PACKET_HASH_OR_AUTHORITY');
  if (!sha(evidenceHash) || hash(proofBody) !== evidenceHash) throw Error('CURRENT_FINGERPRINT_PROOF_HASH');
  if (currentFingerprintProof.packetHash !== packetHash || currentFingerprintProof.readyPlanHash !== packet.readyPlanHash || currentFingerprintProof.sourceVersionHash !== packet.readySourceVersionHash || currentFingerprintProof.priorJournalHash !== packet.priorJournalHash) throw Error('CURRENT_FINGERPRINT_REFERENCE_DRIFT');
  if (currentFingerprintProof.financialWrites !== 0 || currentFingerprintProof.sourceWrites !== 0 || currentFingerprintProof.targetWrites !== 0 || currentFingerprintProof.sourceScope?.atomicT1 !== false || currentFingerprintProof.sourceScope?.scopeExtendedToToday !== false || !currentFingerprintProof.startedAt || !currentFingerprintProof.endedAt) throw Error('CURRENT_FINGERPRINT_READONLY_SCOPE');
  const ready = packet.readyExactDeltaAccounts, alternatives = packet.alternatives.filter(a => a.selectableForAmountApproval === true && a.held === false).map(a => a.accountKey), keys = [...ready, ...alternatives], proofs = currentFingerprintProof.accounts;
  if (new Set(keys).size !== keys.length || keys.some(k => packet.priorAppliedKeys.includes(k)) || keys.length !== packet.summary.actualFinanceApprovalAccounts || !Array.isArray(proofs) || proofs.length !== keys.length || new Set(proofs.map(a => a.accountKey)).size !== keys.length || proofs.some(a => !keys.includes(a.accountKey))) throw Error('CURRENT_FINGERPRINT_EXACT_ACCOUNT_SCOPE');
  const sideMatched = (side, fields, pairs) => fields.every(k => side?.[k] === true) && pairs.every(([before, after]) => sha(side?.[before]) && side[before] === side[after]);
  const effective = [], deferred = [];
  for (const account of proofs) {
    const original = packet.readyPlan.accounts.find(a => a.key === account.accountKey), alternative = packet.alternatives.find(a => a.accountKey === account.accountKey);
    const originalExactNet = original?.newSourceNet ?? alternative?.proposal?.exactCurrentSourceNet, originalNativeWitness = original?.nativeWitnessHash ?? alternative?.proposal?.nativeWitnessHash;
    if (account.source?.originalExactNet !== originalExactNet || account.target?.frozenWitnessHash !== originalNativeWitness) throw Error('CURRENT_FINGERPRINT_FROZEN_ACCOUNT_BINDING');
    const source = sideMatched(account.source, ['financialRowsMatched', 'typedHeadersMatched', 'typedReferenceComplete', 'exactNetMatched', 'identityMatched'], [['frozenFinancialRowsHash', 'currentFinancialRowsHash'], ['frozenTypedHeadersHash', 'currentTypedHeadersHash']]) && account.source.originalExactNet === account.source.currentExactNet;
    const target = sideMatched(account.target, ['accountRowMatched', 'ledgerMatched', 'witnessMatched', 'identityMatched'], [['frozenLedgerHash', 'currentLedgerHash'], ['frozenWitnessHash', 'currentWitnessHash']]);
    if (source !== account.source?.matched || target !== account.target?.matched || (source && target) !== account.currentScopeMatched || account.applicationAuthorization !== false) throw Error('CURRENT_FINGERPRINT_ACCOUNT_CONTRADICTION');
    if (source && target) effective.push(account.accountKey);
    else deferred.push({ accountKey: account.accountKey, sourceDrift: !source, targetDrift: !target, reason: !source ? 'CURRENT_SOURCE_FINGERPRINT_DRIFT' : 'CURRENT_TARGET_FINGERPRINT_DRIFT', amountsRecomputed: false, applicationEligible: false });
  }
  const body = { schemaVersion: 'melisa-unified-finance-current-approval-scope.v1', historicalPacketHash: packetHash, currentFingerprintProofHash: evidenceHash, readyPlanHash: packet.readyPlanHash, readySourceVersionHash: packet.readySourceVersionHash, priorJournalHash: packet.priorJournalHash, historicalApprovalAccounts: keys.length, historicalReadyAccounts: ready.length, currentReadyAccounts: effective.filter(k => ready.includes(k)).length, currentReportOpeningAccounts: effective.filter(k => alternatives.includes(k)).length, effectiveApprovalAccountKeys: effective.sort(), effectiveApprovalAccounts: effective.length, deferred: deferred.sort((a, b) => a.accountKey.localeCompare(b.accountKey)), priorAppliedExcluded: packet.priorAppliedKeys.length, heldAlternativesExcluded: packet.alternatives.filter(a => a.held).length, amountSourcesUnmodified: true, amountsRecomputed: false, sourceScope: currentFingerprintProof.sourceScope, checkedAt: currentFingerprintProof.endedAt, requiresFreshFingerprintBeforeApplication: true, amountApproval: 'PENDING', methodSelectionIsAmountApproval: false, financialWriteAuthorized: false, executeAllowed: false, financialWrites: 0 };
  return { ...body, finalScopeHash: hash(body) };
}

// ERP-DEC-030: expand preparation, not the fixed approved Goal7.3 writer.
// Dated report witnesses anchor each account; no blanket SUM/zero authority.
const orderedHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const currentKey = a => [a.company, a.period, a.sourceId, a.role, a.currencyRaw].join('/');
const fixedLL = a => a.company === 'F0102' && a.role === 'customer' && a.currencyRaw === 'LL' &&
  ({ '324': 'TLL', '379': 'PEŞİN TLL' }[a.sourceId] === a.code);
const projectedCent = value => { const n = units(value), a = n < 0n ? -n : n; return exact((a / 1000000n + (a % 1000000n >= 500000n ? 1n : 0n)) * 1000000n * (n < 0n ? -1n : 1n)); };
const roundDiv = (n, d) => { const a = n < 0n ? -n : n; return (a / d + (a % d * 2n >= d ? 1n : 0n)) * (n < 0n ? -1n : 1n); };
const recorded9 = m => (units(m.debitRaw) - units(m.creditRaw)) * 1000000000n / units(m.rateRaw);

export function verifyCurrentBalanceWitness(a, reportHashes) {
  const w = a.currentBalanceWitness, r = w?.independentReport;
  if (!w || w.schemaVersion !== 'melisa-current-party-balance-witness.v1' || w.accountKey !== currentKey(a) ||
      w.sourceKey !== a.sourceKey || w.sourceCompany !== a.company || w.sourcePeriod !== 'D0007' ||
      w.sourceRole !== a.role || w.sourceId !== a.sourceId || w.currency !== a.currency || w.currencyRaw !== a.currencyRaw ||
      a.closingVerified !== true || w.closingVerified !== true || w.financialAuthority !== false || w.financialWriteAuthorized !== false ||
      w.globalMethodVerified !== false || w.rawCardBalanceUsed !== false || !w.completeD0007Read || !w.allDatesRetained ||
      w.sourceLowerDateBound !== null || w.sourceUpperDateBound !== null || w.missingOrInvalidRates !== 0 || !w.sourceRowIdsUnique ||
      !w.sourceTwoPassStable || w.noDriftProof?.kind !== 'TWO_READ_EQUAL_ORDERED_ROWS' ||
      w.noDriftProof.validAtCaptureOnly !== true || w.noDriftProof.freshSourceCheckRequiredBeforeFutureApply !== true) return false;
  if (!sha(w.sourceCaptureHash) || !sha(w.sourceRowsHash) || w.sourceRowsHash !== a.rowsHash ||
      orderedHash(w.sourceFingerprint) !== w.sourceFingerprintHash || w.sourceFingerprint.rows !== a.rowsHash ||
      w.sourceFingerprint.sourceId !== a.sourceId || w.sourceFingerprint.currencyRaw !== a.currencyRaw) return false;
  const queries = w.sourceQueries;
  if (!Array.isArray(queries) || queries.length !== 6 || queries.some((q, i) => !sha(q.statementHash) || !sha(q.rowsHash) ||
      q.statementHash !== queries[i ^ 1].statementHash || q.rowsHash !== queries[i ^ 1].rowsHash || q.rows !== queries[i ^ 1].rows)) return false;
  if (!r || r.origin !== 'VEGA_EXPORT' || r.independent !== true || r.headerLabel !== 'Döviz Bakiye' ||
      r.originalSha256 !== reportHashes[a.company] || !sha(r.originalSha256) || !Array.isArray(r.rawRow) ||
      orderedHash(r.rawRow) !== r.rawRowHash || r.rawRow[0] !== a.code || currency(r.rawRow[3]) !== a.currency ||
      r.currency !== a.currency || r.currencyRaw !== a.currencyRaw || !Number.isInteger(r.excelRow) || r.excelRow < 1) return false;
  const raw = /^\s*([\d.,]+)\s+(\S+)\s*\(\s*([BA])\s*\)\s*$/u.exec(r.rawRow[2] ?? '');
  if (!raw || currency(raw[2]) !== a.currency) return false;
  const parsed = raw[1].replaceAll('.', '').replace(',', '.');
  if (!/^\d+\.\d{2}$/.test(parsed) || `${raw[3] === 'A' ? '-' : ''}${parsed}000000` !== r.signedDisplayAmount || raw[3] !== r.direction) return false;
  try {
    if (!Array.isArray(a.sourceRows) || orderedHash(a.sourceRows) !== a.rowsHash || a.sourceRows.length !== a.movementCount) return false;
    const movementIds = new Set();
    const currentDerived9 = a.sourceRows.reduce((sum, m) => {
      if (String(m.sourceId) !== a.sourceId || m.currencyRaw !== a.currencyRaw || movementIds.has(m.movementIND) ||
          ['30', '31'].includes(m.code) || units(m.rateRaw) <= 0n) throw Error('CURRENT_SOURCE_ROWS');
      movementIds.add(m.movementIND);
      return sum + recorded9(m);
    }, 0n);
    // Verified SQL expression divides at decimal(38,9), truncates there, sums,
    // then casts once to decimal(28,8). Never sum individually rounded cents/8s.
    if (roundDiv(currentDerived9, 10n) !== units(w.sourceCurrentExact)) return false;
    if (projectedCent(w.anchorNetExact) !== r.signedDisplayAmount || direction(w.anchorNetExact) !== w.anchorDirection ||
        direction(w.sourceCurrentExact) !== w.sourceCurrentDirection || w.sourceCurrentExact !== a.verifiedCurrentSignedBalance ||
        units(w.nativeCurrentExact) !== units(w.sourceCurrentExact) * (a.role === 'supplier' ? -1n : 1n)) return false;
    const seen = new Set();
    const rollforward = w.rollforwardEffects.reduce((sum, e) => {
      const m = e.sourceMovement, d = e.typedDocument;
      if (seen.has(e.movementIND) || e.sourceCompany !== a.company || e.sourcePeriod !== 'D0007' || e.sourceId !== a.sourceId ||
          e.currencyRaw !== a.currencyRaw || !sha(e.sourceProofHash) || orderedHash(m) !== e.sourceMovementHash || orderedHash(d) !== e.typedDocumentHash ||
          m.movementIND !== e.movementIND || String(m.sourceId) !== a.sourceId || String(d.FIRMANO) !== a.sourceId ||
          m.LN !== d.IND || String(d.BELGETIPI) !== m.code || m.documentNo !== d.BELGENO || d.IPTAL !== false ||
          m.currencyRaw !== a.currencyRaw || d.PARABIRIMI !== a.currencyRaw || m.rateRaw !== d.KUR ||
          m.debitRaw !== d.TUTAR || m.creditRaw !== '0.00000000' || m.recordedEffectExact !== e.deltaExact ||
          units(m.rateRaw) <= 0n || roundDiv(recorded9(m), 10n) !== units(e.deltaExact) ||
          !a.sourceRows.some(original => original.movementIND === e.movementIND && orderedHash(original) === e.sourceMovementHash)) throw Error('CURRENT_TYPED_ROLLFORWARD');
      seen.add(e.movementIND); return sum + units(e.deltaExact);
    }, 0n);
    const anchorDerived9 = a.sourceRows.filter(m => !seen.has(m.movementIND)).reduce((sum, m) => sum + recorded9(m), 0n);
    return roundDiv(anchorDerived9, 10n) === units(w.anchorNetExact) && rollforward === units(w.rollforwardDeltaExact) && units(w.anchorNetExact) + rollforward === units(w.sourceCurrentExact) &&
      w.exactRollforwardClosure === true && w.nativeCurrentExact === a.verifiedCurrentNativeBalance;
  } catch { return false; }
}

function verifyNativeCurrentWitness(n) {
  try {
    const a = n.captureAccountRow, rows = n.captureMovementRows;
    if (!a || !Array.isArray(rows) || a.id !== n.id || a.balanceExact !== n.balanceExact ||
        a.currency !== n.currency || a.partyEntityId !== n.partyEntityId || a[n.role + 'Id'] !== n.targetId ||
        a[n.role === 'customer' ? 'supplierId' : 'customerId'] !== null ||
        hash(rows) !== n.ledgerHash || hash({ a, rows, matches: n.sourceLinks.map(l => l.rowHash) }) !== n.currentEvidenceHash) return false;
    let base = 0n, prior = 0n, local = 0n; const seen = new Set();
    for (const m of rows) {
      if (seen.has(m.id) || m.targetId !== n.targetId || (m.account_currency ?? m.currency_code) !== n.currency ||
          m.accountId !== null && m.accountId !== n.id || m.partyEntityId !== null && m.partyEntityId !== n.partyEntityId) return false;
      seen.add(m.id); if (m.affects_balance === false || m.affects_balance === 0) continue;
      const effect = units(m.effectExact);
      if (m.source_record_key === null && m.cutover_source_key === null) local += effect;
      else if (m.migration_run_id?.startsWith('GOAL73-')) prior += effect;
      else base += effect;
    }
    return base === units(n.importedBaseBeforeGoal73) && prior === units(n.priorAppliedDelta) && local === units(n.localEffects) &&
      base + prior + local === units(n.balanceExact) && units(n.ledger) === units(n.balanceExact);
  } catch { return false; }
}

function verifyScalarWitness(row) {
  const s = row.scalarWitness, n = row.native, a = row.source;
  if (!s) return false;
  try {
    const party = JSON.parse(s.nativePartyBeforeSqlJson), raw = /"balance":(-?\d+(?:\.\d+)?)/.exec(s.nativePartyBeforeSqlJson);
    const pad = value => { const [w, f = ''] = value.split('.'); return `${w}.${f.padEnd(8, '0')}`; };
    const before = units(n.balanceExact), projected4 = exact(roundDiv(before, 10000n) * 10000n);
    return s.accountKey === currentKey(a) && s.sourceKey === a.sourceKey && s.nativeAccountId === n.id && s.targetId === n.targetId &&
      s.role === a.role && s.currency === a.currency && s.mainCurrency === row.mainCurrency && s.mainBalanceScale === row.mainBalanceScale &&
      s.nativeAccountBeforeExact === n.balanceExact && s.nativeAccountWitnessHash === n.currentEvidenceHash && s.nativeLedgerHash === n.ledgerHash &&
      s.sourceClosingWitnessHash === hash(a.closingWitness) && String(party.id) === n.targetId && party.currency_code === row.mainCurrency &&
      createHash('sha256').update(s.nativePartyBeforeSqlJson, 'utf16le').digest('hex').toUpperCase() === s.nativePartyBeforeSqlHash &&
      raw !== null && pad(raw[1]) === s.scalarBeforeExact && s.financialWrites === 0 && s.executionAllowed === false &&
      s.isMainCurrency === (row.mainCurrency === a.currency) && (!s.isMainCurrency ||
        s.scalarBeforeExact === projected4 && s.scalarMirrorBeforeFinancialDeltaExact === n.balanceExact &&
        s.finalExpectedScalarAfterExact === a.verifiedCurrentNativeBalance &&
        s.scalarMirrorRepairRequired === (s.scalarBeforeExact !== n.balanceExact));
  } catch { return false; }
}

export function buildCurrentFinanceApprovalPacket(input) {
  if (input.target?.server !== 'Semih\\MELISADEV' || input.target.database !== 'MELISA_ERP_SIRKET_TEST_20260929_01' ||
      !input.runId || !sha(input.priorJournalHash) || !sha(input.sourceFileHash) || !sha(input.nativeFileHash) ||
      input.sourceIdentity?.server !== 'DESKTOP-KSRK0EQ' || input.sourceIdentity.database !== 'VEGA2026' ||
      input.sourceSELECTOnly !== true || input.actualT1 !== false || !Array.isArray(input.rows)) throw Error('CURRENT_EXACT_TEST_READONLY_INPUT');
  const seen = new Set(), nativeIds = new Set();
  const rows = input.rows.map(row => {
    const a = row.source, n = row.native, key = currentKey(a), missing = [];
    if (!['customer', 'supplier'].includes(a.role) || a.company !== (a.role === 'customer' ? 'F0102' : 'F0103') ||
        a.period !== 'D0007' || !/^[1-9]\d*$/.test(a.sourceId) || a.sourceKey !== `VEGA2026/${a.company}/TBLCARI/${a.sourceId}` ||
        seen.has(key)) throw Error('CURRENT_SOURCE_IDENTITY_DUPLICATE');
    seen.add(key);
    if (fixedLL(a)) missing.push('EXACT_TWO_LL_EXCLUDED');
    else if (!['TRY', 'USD', 'EUR'].includes(a.currency) || currency(a.currencyRaw) !== a.currency) missing.push('SOURCE_CURRENCY_UNKNOWN');
    if (row.held) missing.push('EXISTING_HOLD_REMAINS');
    if (!n || row.matchCount !== 1 || n.identityVerified !== true || n.role !== a.role || n.currency !== a.currency ||
        n.sourceLinks?.length !== 1 || n.sourceLinks[0].sourceKey !== a.sourceKey || n.sourceLinks[0].sourceCompany !== a.company ||
        n.sourceLinks[0].sourceId !== a.sourceId || !n.id || !n.targetId) missing.push('EXACT_NATIVE_ACCOUNT_IDENTITY_MISSING');
    if (n) { if (nativeIds.has(n.id)) throw Error('CURRENT_NATIVE_ACCOUNT_REUSED'); nativeIds.add(n.id); }
    if (n && (!n.nativeLedgerClosed || !n.baselineDecompositionClosed || n.accountMovementConflicts?.length || !verifyNativeCurrentWitness(n))) missing.push('NATIVE_BALANCE_LEDGER_OR_BASIS_UNKNOWN');
    if (n?.localMovements?.length && row.localLineageClassified !== true) missing.push('LOCAL_REAL_SYNTHETIC_LINEAGE_UNPROVEN');
    if (!verifyCurrentBalanceWitness(a, input.reportHashes)) missing.push(a.movementCount === 0 ? 'NO_MOVEMENT_IS_NOT_VERIFIED_ZERO' : a.report?.parseStatus === 'PLACEHOLDER' ? 'PLACEHOLDER_OR_TINY_VALUE_NOT_CLOSING_PROOF' : 'CURRENT_CURRENCY_CLOSING_NOT_VERIFIED');
    if (!missing.length && !n.appliedGoal73.length && !verifyScalarWitness(row)) missing.push('EXACT_SCALAR_PRECISION_PREFLIGHT_MISSING');
    let proposal = null;
    if (!missing.length) {
      const base = units(n.importedBaseBeforeGoal73), applied = units(n.priorAppliedDelta), local = units(n.localEffects), before = units(n.balanceExact);
      if (base + applied + local !== before || units(n.ledger) !== before) throw Error('CURRENT_NATIVE_BASELINE_CONTRADICTION');
      const currentBase = units(a.verifiedCurrentNativeBalance), delta = currentBase - base - applied;
      proposal = { currentSourceExact: a.verifiedCurrentSignedBalance, sourceDirection: a.verifiedCurrentDirection,
        priorMigrationBase: exact(base), priorCommittedDelta: exact(applied), preservedLocalEffects: exact(local),
        nativeBefore: exact(before), nativeDelta: exact(delta), expectedAfter: exact(currentBase + local),
        inverseDelta: exact(-delta), inverseRestoresBefore: exact(before), oldOpeningAddedAgain: false,
        historyPreserved: true, syntheticEffectsAddedToOpening: false,
        precisionUpgradeRequired: row.mainCurrency === a.currency && (currentBase + local) % 10000n !== 0n,
        scalarMirrorRepairRequired: row.scalarWitness?.scalarMirrorRepairRequired === true,
        scalarBeforeExact: row.scalarWitness?.scalarBeforeExact ?? null,
        scalarBeforeSqlHash: row.scalarWitness?.nativePartyBeforeSqlHash ?? null,
        scalarMirrorBeforeDeltaExact: row.scalarWitness?.scalarMirrorBeforeFinancialDeltaExact ?? null,
        existingMainBalanceScale: row.mainBalanceScale ?? 4, exactAccountBalanceScale: 8 };
    }
    const priorApplied = n?.appliedGoal73?.length > 0;
    return { ...row, source: a, accountKey: key, readyForAmountApproval: missing.length === 0,
      status: fixedLL(a) ? 'EXCLUDED_LL' : missing.length ? 'BLOCKED' : priorApplied ? 'PRIOR_16_PRESERVED' : 'AMOUNT_APPROVAL_PENDING',
      priorApplied, missing: [...new Set(missing)], proposal, financialWriteAuthorized: false };
  }).sort((a, b) => a.accountKey.localeCompare(b.accountKey));
  const ready = rows.filter(a => a.readyForAmountApproval), pending = ready.filter(a => !a.priorApplied), prior = rows.filter(a => a.priorApplied);
  if (prior.length !== 16 || input.prior16Unchanged !== true) throw Error('CURRENT_PRIOR_16_PRESERVATION');
  const extra = input.nativeExtra.filter(a => a.sourceLinks?.length === 1).map(a => ({ nativeAccountId: a.id, role: a.role, currency: a.currency,
    sourceKey: a.sourceLinks[0].sourceKey, currentExact: a.balanceExact, reason: 'NATIVE_CURRENCY_NOT_CURRENT_VERIFIED_SOURCE_SCOPE', executionAllowed: false }));
  const reasons = [...rows.filter(a => !a.readyForAmountApproval).map(a => a.missing[0]), ...extra.map(a => a.reason)];
  const body = { schemaVersion: 'melisa-current-finance-approval-packet.v2', runId: input.runId, target: input.target,
    sourceFileHash: input.sourceFileHash, nativeFileHash: input.nativeFileHash, priorJournalHash: input.priorJournalHash,
    reportHashes: input.reportHashes, precisionScriptHash: input.precisionScriptHash ?? null, scalarFileHash: input.scalarFileHash ?? null,
    precisionPhaseFileHash: input.precisionPhaseFileHash ?? null,
    sourceCapturedAt: input.sourceCapturedAt, nativeCapturedAt: input.nativeCapturedAt,
    actualT1: false, universalSourceMethodVerified: false, rows, nativeExtra: extra,
    summary: { sourceAccounts: rows.length, nativeExtraSourceAccounts: extra.length, totalScopeAccounts: rows.length + extra.length,
      readyCustomerAccounts: ready.filter(a => a.source.role === 'customer').length, readySupplierAccounts: ready.filter(a => a.source.role === 'supplier').length,
      readyAccounts: ready.length, priorAppliedAccounts: prior.length, pendingNewAccounts: pending.length,
      pendingDifferenceAccounts: pending.filter(a => a.proposal.nativeDelta !== '0.00000000').length,
      pendingNoOpAccounts: pending.filter(a => a.proposal.nativeDelta === '0.00000000').length,
      precisionUpgradeAccounts: pending.filter(a => a.proposal.precisionUpgradeRequired).length,
      scalarMirrorRepairAccounts: pending.filter(a => a.proposal.scalarMirrorRepairRequired).length,
      scalarMirrorWithLedgerNoOpAccounts: pending.filter(a => a.proposal.scalarMirrorRepairRequired && a.proposal.nativeDelta === '0.00000000').length,
      prior16FutureT1DriftAccounts: ready.filter(a => a.priorApplied && a.proposal.nativeDelta !== '0.00000000').length,
      excludedLLAccounts: rows.filter(a => a.status === 'EXCLUDED_LL').length, blockedOrExcludedAccounts: reasons.length,
      blockedPrimaryReasons: Object.fromEntries([...new Set(reasons)].sort().map(reason => [reason, reasons.filter(r => r === reason).length])), financialWrites: 0 },
    pendingAccountKeys: pending.map(a => a.accountKey), methodDecisionIsNumericApproval: false,
    approval: 'PENDING_EXACT_SINGLE_SCOPE', precisionDDLPreparedOnly: true, scalarRepairsPreparedOnly: true, executableNow: false,
    requiredBeforeApplication: ['EXPLICIT_PACKET_AMOUNT_APPROVAL', 'FRESH_ACCOUNT_SOURCE_AND_NATIVE_FINGERPRINTS', 'VERIFIED_BACKUP',
      'EXACT_MAIN_BALANCE_PRECISION_PREFLIGHT', 'EXISTING_GUARDED_DELTA_ADAPTER', 'INDEPENDENT_RECONCILIATION_AND_REPLAY'],
    financialWriteAuthorized: false, executeAllowed: false };
  return { ...body, packetHash: hash(body) };
}

export function verifyCurrentFinanceApprovalPacket(packet, input) {
  const { packetHash, ...body } = packet;
  if (hash(body) !== packetHash || body.executeAllowed !== false || body.financialWriteAuthorized !== false ||
      buildCurrentFinanceApprovalPacket(input).packetHash !== packetHash) throw Error('CURRENT_SCOPE_SOURCE_NATIVE_OR_EFFECT_DRIFT');
  return { packetHash, financialWrites: 0, executionAllowed: false, accounts: packet.summary.pendingNewAccounts };
}

export function currentFinanceReplayDecision(packet, input, receipt = null) {
  verifyCurrentFinanceApprovalPacket(packet, input);
  if (!receipt) return 'NOT_AUTHORIZED_PREPARATION';
  if (receipt.run_id !== packet.runId) throw Error('CURRENT_REPLAY_RUN_ID');
  return replayDecision(receipt, { manifestHash: packet.packetHash, parentPlanHash: packet.priorJournalHash });
}

// Full BEFORE CAS is sealed; SQL generates row_version on UPDATE, so a full
// AFTER row hash can only be captured from native readback, never predicted.
export function buildCurrentScalarMirrorProjection(row) {
  const sqlHash = text => createHash('sha256').update(text, 'utf16le').digest('hex').toUpperCase();
  const balance = /"balance":(-?\d+(?:\.\d+)?)/g;
  const version = /"row_version":"[A-Za-z0-9+/=]+"/g;
  const text = row.nativePartyBeforeSqlJson;
  if (typeof text !== 'string' || sqlHash(text) !== row.nativePartyBeforeSqlHash ||
      [...text.matchAll(balance)].length !== 1 || [...text.matchAll(version)].length !== 1 ||
      row.scalarMirrorRepairRequired !== true || row.isMainCurrency !== true)
    throw Error('CURRENT_MIRROR_FULL_PREIMAGE_REQUIRED');
  const before8 = text.replace(balance, (_, value) => {
    const [whole, fraction = ''] = value.split('.');
    if (fraction.length > 4) throw Error('CURRENT_MIRROR_EXISTING_SCALE');
    return '"balance":' + whole + '.' + fraction.padEnd(8, '0');
  });
  units(row.scalarMirrorBeforeFinancialDeltaExact); units(row.finalExpectedScalarAfterExact);
  const projection = value => value.replace(version, '"row_version":"SQL_AUTOMATIC_ROW_VERSION"');
  const plannedProjection = projection(before8.replace(balance, '"balance":' + row.scalarMirrorBeforeFinancialDeltaExact));
  return { accountKey: row.accountKey, role: row.role, targetId: row.targetId, nativeAccountId: row.nativeAccountId, currency: row.currency,
    before18_4SqlHash: row.nativePartyBeforeSqlHash, before28_8SqlJson: before8, before28_8SqlHash: sqlHash(before8),
    mirror28_8PlannedProjectionJson: plannedProjection, mirror28_8PlannedProjectionHash: sqlHash(plannedProjection),
    untouchedColumnsProjectionHash: sqlHash(projection(before8).replace(balance, '"balance":"SEALED_SCALAR"')),
    nativeAccountExactUnchanged: row.nativeAccountBeforeExact, approvedMirrorExact: row.scalarMirrorBeforeFinancialDeltaExact,
    finalExpectedScalarAfterExact: row.finalExpectedScalarAfterExact, automaticColumns: ['row_version'],
    onlyMainCurrency: true, noLedgerEffect: true, requirePostDDLReadEqualsSealed28_8Preimage: true,
    requireAllOtherBusinessColumnsUnchanged: true, requireNativeFullAfterimageReadbackAndJournal: true,
    runtimeFullAfterimageHashKnown: false, financialWriteAuthorized: false, executionAllowed: false };
}
