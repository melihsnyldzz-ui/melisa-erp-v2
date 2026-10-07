// Pure, account/version-bound evidence helpers. No SQL, network, filesystem or writer.
import { createHash } from 'node:crypto';

export const DISPLAY_METHOD = 'BOUNDED_DISPLAY_ACCOUNT_V1';
export const FINAL_STATUSES = Object.freeze(['UYGULANMIŞ', 'AKTARIM KANITI TAMAM — UYGULAMA ONAYI BEKLİYOR', 'TEKNİK KANIT EKSİK', 'İŞLETME KARARI BEKLİYOR', 'KART OLUŞTU — FİNANS DOĞRULAMASI BEKLİYOR']);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const evidenceHash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const sha = value => /^[a-f0-9]{64}$/.test(value ?? '');
const currency = value => ({ '$': 'USD', USD: 'USD', '€': 'EUR', EUR: 'EUR', TL: 'TRY', TRY: 'TRY', '₺': 'TRY' }[String(value ?? '').trim().toUpperCase()] ?? null);
const parse = value => {
  if (typeof value !== 'string' || !/^-?\d{1,20}\.\d{8}$/.test(value)) throw Error('EXACT_EIGHT_DECIMAL_REQUIRED');
  return BigInt(value.replace('.', ''));
};
const format = value => { const a = value < 0n ? -value : value; return `${value < 0n ? '-' : ''}${a / 100000000n}.${String(a % 100000000n).padStart(8, '0')}`; };
export const exactDirection = value => { const n = parse(value); return n > 0n ? 'B' : n < 0n ? 'A' : 'ZERO'; };

// This unique projection makes no choice between tie algorithms. Exact ties fail closed.
export function uniqueCentProjection(value) {
  const n = parse(value), a = n < 0n ? -n : n, remainder = a % 1000000n;
  if (remainder === 500000n) return { unique: false, reason: 'HALF_CENT_RULE_NOT_PROVEN', exactPreserved: value };
  const cent = (a / 1000000n + (remainder > 500000n ? 1n : 0n)) * 1000000n * (n < 0n ? -1n : 1n);
  return { unique: true, displayValue: format(cent), displayDirection: exactDirection(format(cent)), exactPreserved: value };
}

export function observedDisplayProof({ accountKey, sourceVersionHash, exactSourceNet, sourceWitness, reportWitness }) {
  const missing = [];
  if (!accountKey || !sha(sourceVersionHash)) missing.push('ACCOUNT_SOURCE_VERSION_REQUIRED');
  // A known typed capture can bind an exact current net even when an earlier ledger changed.
  // That earlier change stays explicit; this alternative never relabels it "unchanged".
  const capture = sourceWitness?.reportCaptureBinding;
  const knownCaptureMatch = capture?.method === 'CURRENT_EXACT_EQUALS_TYPED_REPORT_CAPTURE' && sha(capture.captureHash) && sha(capture.typedDocumentHash) && capture.exactNet === exactSourceNet && capture.typedDocumentsVerified === true && capture.recordedAmountBasisUnchanged === true && capture.currentRecordProjectionUnchangedSinceCapture === true && capture.earlierRecordChangeRetained === true;
  if (sourceWitness?.accountKey !== accountKey || sourceWitness?.sourceVersionHash !== sourceVersionHash || sourceWitness?.exactNet !== exactSourceNet || !sha(sourceWitness?.captureHash) || !sha(sourceWitness?.typedDocumentHash) || sourceWitness?.typedDocumentsVerified !== true || sourceWitness?.exactNetVerified !== true || (sourceWitness?.financialSemanticsUnchanged !== true && !knownCaptureMatch)) missing.push('EXACT_TYPED_SOURCE_WITNESS_REQUIRED');
  if (reportWitness?.accountKey !== accountKey || reportWitness?.origin !== 'VEGA_EXPORT' || reportWitness?.independent !== true || reportWitness?.originalHashVerified !== true || !sha(reportWitness?.originalHash) || !sha(reportWitness?.rowHash) || !sha(reportWitness?.scopeHash) || reportWitness?.scopeVerified !== true || !Number.isInteger(reportWitness?.excelRow) || reportWitness.excelRow < 1 || typeof reportWitness?.rawDisplay !== 'string') missing.push('ORIGINAL_INDEPENDENT_EXPORT_ROW_REQUIRED');
  const rawRow = reportWitness?.rawRow;
  if (!Array.isArray(rawRow) || rawRow.length < 4 || evidenceHash(rawRow) !== reportWitness?.rowHash || rawRow[2] !== reportWitness?.rawDisplay || typeof rawRow[0] !== 'string' || rawRow[0].trimEnd() !== sourceWitness?.sourceCode?.trimEnd() || currency(rawRow[3]) !== currency(accountKey?.split('/').at(-1)) || !currency(rawRow[3])) missing.push('EXPORT_RAW_ROW_IDENTITY_OR_CONTENT_CONFLICT');
  let projection;
  try { projection = uniqueCentProjection(exactSourceNet); } catch { missing.push('EXACT_SOURCE_VALUE_REQUIRED'); }
  if (projection && !projection.unique) missing.push(projection.reason);
  const placeholder = /^\s*\(-\)\s*$/.test(reportWitness?.rawDisplay ?? '');
  if (!placeholder) {
    const parsed = /^\s*([\d.,]+)\s+([^\s]+)\s*\(\s*([BA])\s*\)\s*$/u.exec(reportWitness?.rawDisplay ?? '');
    if (!parsed || currency(parsed[2]) !== currency(rawRow?.[3])) missing.push('RAW_REPORT_DISPLAY_NOT_PARSED');
    else {
      const number = parsed[1].replaceAll('.', '').replace(',', '.');
      const [whole, fraction = ''] = number.split('.');
      const signed = `${parsed[3] === 'A' ? '-' : ''}${whole}.${fraction.padEnd(8, '0')}`;
      if (fraction.length !== 2 || signed !== reportWitness.signedValue || parsed[3] !== reportWitness.direction) missing.push('RAW_REPORT_VALUE_OR_DIRECTION_CONFLICT');
    }
  }
  if (projection?.unique) {
    if (placeholder) {
      if (projection.displayValue !== '0.00000000' || reportWitness.signedValue !== null || reportWitness.direction !== null) missing.push('PLACEHOLDER_IS_NOT_EXACT_SOURCE_ZERO');
    } else if (reportWitness?.signedValue !== projection.displayValue || reportWitness?.direction !== projection.displayDirection) missing.push('OBSERVED_VALUE_OR_DIRECTION_DIFFERENCE');
  }
  const body = { schemaVersion: 'melisa-observed-display-proof.v1', method: DISPLAY_METHOD, accountKey, sourceVersionHash, exactSourceNet, sourceDirection: projection ? exactDirection(exactSourceNet) : null, sourceWitness, reportWitness, projection: projection ?? null, reportZeroObserved: placeholder, sourceIsExactZero: exactSourceNet === '0.00000000', exactLedgerReconciliationClaimed: false, generalActiveReportAlgorithmClaimed: false, tieRuleVerified: false, valid: missing.length === 0, missing };
  return { ...body, proofHash: evidenceHash(body) };
}

export function verifyObservedDisplayProof(proof, { accountKey, sourceVersionHash, exactSourceNet }) {
  if (!proof) return false;
  const { proofHash, ...body } = proof;
  if (!sha(proofHash) || evidenceHash(body) !== proofHash || proof.accountKey !== accountKey || proof.sourceVersionHash !== sourceVersionHash || proof.exactSourceNet !== exactSourceNet) return false;
  const rebuilt = observedDisplayProof(body);
  return rebuilt.valid && rebuilt.proofHash === proofHash;
}

// Absence of Jan 1 documents alone is insufficient. Never synthesize a zero amount.
export function classifyCarryEvidence(witness) {
  if (witness?.explicitCarryVerified === true) return { category: 'EXPLICIT_CARRY', verified: true };
  const opened = witness?.cardOpenedAt, first = witness?.firstMovementDate;
  const inception = typeof opened === 'string' && opened >= '2026-01-01' && opened < '2027-01-01';
  if (inception && witness?.priorYearMovementCount === 0) {
    // Vega movement TARIH is a business day; card creation may carry a time on that day.
    const verified = witness.identityContinuityVerified === true && witness.priorYearScopeVerified === true && witness.completeCurrentPeriodVerified === true && typeof first === 'string' && first.slice(0, 10) >= opened.slice(0, 10) && witness.acceptedSourceSemanticsVerified === true;
    return { category: 'NEW_ACCOUNT_NO_CARRY', verified, missing: verified ? [] : ['INCEPTION_HISTORY_AND_ACCEPTED_BASELINE_PROVENANCE_REQUIRED'] };
  }
  if (witness?.otherCurrencyHasCarry === true) return { category: 'OTHER_CURRENCY_CARRY_DOES_NOT_PROVE_THIS_ACCOUNT', verified: false };
  if (witness?.priorYearMovementCount > 0) return { category: 'PRIOR_ACTIVITY_WITHOUT_EXPLICIT_CARRY', verified: false };
  return { category: 'ACCOUNT_INCEPTION_OR_READ_SCOPE_MISSING', verified: false };
}

export function resolveAccountEvidence(account, overlay = {}, { displayMethodAccepted = false } = {}) {
  const missing = new Set(account.missing ?? []);
  const displayVerified = verifyObservedDisplayProof(overlay.displayProof, { accountKey: account.key, sourceVersionHash: account.sourceVersionHash, exactSourceNet: account.newSourceNet });
  if (displayVerified && displayMethodAccepted) missing.delete('REPORT_EXACT_AMOUNT_OR_DIRECTION_NOT_RECONCILED');
  if (displayVerified && !displayMethodAccepted) missing.add('BOUNDED_DISPLAY_METHOD_REVIEW_REQUIRED');
  if (account.held) missing.add('HOLD_REMAINS');
  const carry = classifyCarryEvidence(overlay.carryWitness);
  if (carry.verified) missing.delete('OPENING_OR_DOCUMENTED_NO_CARRY_MISSING');
  // Source/native/semantics guards remain owned by the existing plan and fresh target witnesses.
  let finalStatus = missing.size ? FINAL_STATUSES[2] : FINAL_STATUSES[1];
  if (!['TRY', 'USD', 'EUR'].includes(account.currency) || overlay.businessDecisionRequired) finalStatus = FINAL_STATUSES[3];
  if (overlay.cardCreated === true && !overlay.financeVerified) finalStatus = FINAL_STATUSES[4];
  if (overlay.appliedJournal?.verified === true && overlay.appliedJournal.accountKey === account.key && sha(overlay.appliedJournal.journalHash)) finalStatus = FINAL_STATUSES[0];
  return { accountKey: account.key, originalStatus: account.status, originalResult: account.result ?? null, displayVerified, carry, finalStatus, missing: [...missing].sort(), financialWriteAuthorized: false, exactSourceNetPreserved: account.newSourceNet };
}
