// Approval preparation only: reuse the existing delta plan; never write or authorize finance.
import { hash, verifyPlan, direction } from './party-currency-readonly-plan.mjs';
import { uniqueCentProjection } from './party-currency-evidence-resolution.mjs';

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
