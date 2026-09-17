// Owner specification, 2026-09-17. Pure rules: no SQL connections or side effects.
import { createHash } from 'node:crypto';

export const SPEC = Object.freeze({ version: '2026-09-17', source: 'VEGA2026', target: 'MELISA_ERP_FULL_TEST_20260916', server: 'Semih\\MELISADEV', startDate: '2020-01-01', depot: 'MERKEZ', unit: 'ADET' });
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const clean = value => String(value ?? '').trim().replace(/\s+/gu, ' ');
export const currency = value => ({ TL: 'TRY', TRY: 'TRY', USD: 'USD', '$': 'USD', EUR: 'EUR', EURO: 'EUR', '€': 'EUR' }[clean(value).toUpperCase()] ?? null);
export const group = (rows, key) => { const result = new Map(); for (const row of rows) { const k = key(row); if (!result.has(k)) result.set(k, []); result.get(k).push(row); } return result; };
export function requireRule(ok, code) { if (!ok) throw Object.assign(new Error(code), { code }); }

// Exact decimal arithmetic. Never coerce null to zero or silently round quantity.
export function decimal(value) {
  requireRule(value !== null && value !== undefined && /^[-+]?\d+(\.\d+)?$/.test(String(value)), 'DECIMAL_REQUIRED');
  const [whole, fraction = ''] = String(value).replace(/^[-+]/, '').split('.');
  return { n: BigInt(whole + fraction) * (String(value).startsWith('-') ? -1n : 1n), scale: fraction.length };
}
export function formatDecimal({ n, scale }) {
  const negative = n < 0n; let digits = (negative ? -n : n).toString().padStart(scale + 1, '0');
  if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/0+$/, '').replace(/\.$/, '');
  return `${negative ? '-' : ''}${digits}`;
}
export function sumExact(values) {
  const ds = values.map(decimal), scale = Math.max(0, ...ds.map(d => d.scale));
  return formatDecimal({ n: ds.reduce((n, d) => n + d.n * 10n ** BigInt(scale - d.scale), 0n), scale });
}
export const negate = value => { const d = decimal(value); return formatDecimal({ ...d, n: -d.n }); };
export const equalDecimal = (a, b) => sumExact([a, negate(b)]) === '0';
export function multiplyExact(a, b) { const x = decimal(a), y = decimal(b); return formatDecimal({ n: x.n * y.n, scale: x.scale + y.scale }); }

export function migrationWindow({ startDate = SPEC.startDate, endExclusive, startApproval } = {}) {
  const valid = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  requireRule(valid(startDate) && valid(endExclusive) && endExclusive > startDate, 'VALID_MIGRATION_WINDOW_REQUIRED');
  requireRule(startDate >= SPEC.startDate, 'START_BEFORE_SPECIFICATION');
  if (startDate !== SPEC.startDate) requireRule(startApproval?.startDate === startDate && startApproval?.approved === true && clean(startApproval?.reference), 'START_YEAR_OWNER_APPROVAL_REQUIRED');
  return { startDate, endExclusive, openingRequired: true, openingLabel: 'Vega Devir Bakiyesi', startApproval: startApproval ?? null };
}
export function assertTestIdentity(identity) {
  requireRule(identity?.database === SPEC.target && identity?.server?.toLowerCase() === SPEC.server.toLowerCase(), 'EXACT_TEST_TARGET_REQUIRED');
}
export function assertWritePrerequisites({ identity, backup, planHash, targetBeforeHash, targetNowHash, protectedBeforeHash, protectedNowHash, unresolved, adaptersVerified }) {
  assertTestIdentity(identity);
  requireRule(/^[a-f0-9]{64}$/.test(planHash || ''), 'FROZEN_PLAN_HASH_REQUIRED');
  requireRule(backup?.status === 'PASS_VERIFIED_TEST_BACKUP' && backup.database === SPEC.target && backup.identity?.server?.toLowerCase() === SPEC.server.toLowerCase() && backup.planHash === planHash && backup.backupSetGuid, 'CURRENT_PLAN_VERIFIED_BACKUP_REQUIRED');
  requireRule(/^[a-f0-9]{64}$/.test(targetBeforeHash || '') && targetBeforeHash === targetNowHash && backup.targetHash === targetBeforeHash, 'TARGET_CHANGED_AFTER_BACKUP');
  requireRule(/^[a-f0-9]{64}$/.test(protectedBeforeHash || '') && protectedNowHash === protectedBeforeHash, 'PROTECTED_TERMINAL_CHANGED');
  requireRule(Array.isArray(unresolved) && unresolved.length === 0 && adaptersVerified === true, 'MIGRATION_NOT_READY');
  return { mode: 'COMMIT_TEST', rollbackSuccessfulRecords: false, clearExistingData: false, liveEnabled: false };
}

export function stockSelection({ active, quantity }) {
  if (active === true) return { include: true, reason: 'ACTIVE_CARD', quantityKnown: quantity != null };
  if (quantity == null) return { include: null, reason: 'QUANTITY_UNKNOWN' };
  const nonzero = decimal(quantity).n !== 0n;
  if (nonzero) return { include: true, reason: 'NONZERO_STOCK', negative: decimal(quantity).n < 0n };
  return active === false ? { include: false, reason: 'PASSIVE_ZERO_STOCK' } : { include: null, reason: 'ACTIVITY_UNKNOWN' };
}
export function resolveUnits(units) {
  if (!units.length) return { unit: SPEC.unit, status: 'REVIEW', reason: 'UNIT_EVIDENCE_MISSING' };
  const incompatible = units.filter(u => clean(u.name).toLocaleUpperCase('tr-TR') !== SPEC.unit || u.multiplier == null || !equalDecimal(u.multiplier, '1'));
  return { unit: SPEC.unit, status: incompatible.length ? 'REVIEW' : 'VERIFIED', technicalIds: units.map(u => u.id), reason: incompatible.length ? 'NON_ADET_OR_NON_UNIT_MULTIPLIER' : null };
}
export function mergeDepots(rows) {
  requireRule(rows.every(r => r.quantity != null), 'DEPOT_QUANTITY_UNKNOWN');
  requireRule(new Set(rows.map(r => String(r.depotId))).size === rows.length, 'DUPLICATE_DEPOT_SNAPSHOT');
  return { depot: SPEC.depot, quantity: sumExact(rows.map(r => r.quantity)), sourceDepots: rows.map(r => ({ ...r })) };
}

// Shared barcode alone never decides a merge. A reviewed group binds all cards and evidence.
export function planBarcodes(cards, units, approvedMerges = []) {
  const byId = new Map(cards.map(c => [String(c.id), c]));
  const canonical = new Map(cards.map(c => [String(c.id), String(c.id)]));
  const used = new Set();
  for (const merge of approvedMerges) {
    requireRule(merge.approved === true && clean(merge.reference) && merge.sourceIds.length > 1, 'DUPLICATE_MERGE_APPROVAL_REQUIRED');
    const ids = merge.sourceIds.map(String).sort();
    requireRule(ids.includes(String(merge.canonicalId)) && ids.every(id => byId.has(id) && !used.has(id)), 'MERGE_IDENTITY_CONFLICT');
    requireRule(merge.evidenceHash === hash(ids.map(id => byId.get(id))), 'MERGE_EVIDENCE_CHANGED');
    const shared = units.filter(u => ids.includes(String(u.productId)) && clean(u.barcode));
    const duplicateBarcode = [...group(shared, u => String(u.barcode)).values()].some(rs => new Set(rs.map(r => String(r.productId))).size > 1);
    const names = ids.map(id => clean(byId.get(id).name));
    requireRule(duplicateBarcode && names.every(Boolean) && clean(merge.nameModelEvidence), 'BARCODE_AND_NAME_MODEL_EVIDENCE_REQUIRED');
    for (const id of ids) { canonical.set(id, String(merge.canonicalId)); used.add(id); }
  }
  const mappings = [], conflicts = [], orphanUnits = [];
  for (const u of units) if (!byId.has(String(u.productId))) orphanUnits.push(u);
  for (const [barcode, rows] of group(units.filter(u => byId.has(String(u.productId)) && clean(u.barcode)), u => String(u.barcode))) {
    const targets = [...new Set(rows.map(u => canonical.get(String(u.productId))))];
    if (targets.length !== 1) conflicts.push({ barcode, sourceIds: [...new Set(rows.map(u => String(u.productId)))], names: targets.map(id => byId.get(id).name), reason: 'CROSS_PRODUCT_BARCODE_REVIEW' });
    else mappings.push({ barcode, canonicalSourceId: targets[0], unitIds: rows.map(u => u.id), sourceIds: [...new Set(rows.map(u => String(u.productId)))] });
  }
  return { mappings, conflicts, orphanUnits, canonical: Object.fromEntries(canonical), sourceCodeAliases: cards.map(c => ({ sourceId: String(c.id), stockCode: c.code, canonicalSourceId: canonical.get(String(c.id)) })) };
}

const cashCards = new Set(['1-PEŞİN $', '2-PEŞİN TL', '3-PEŞİN €']);
export function partySelection({ company, active, balances, hasHistory }) {
  const role = company === 'F0102' ? 'customer' : company === 'F0103' ? 'supplier' : null;
  if (!role) return { include: null, role, reason: 'F0104_RELATION_REVIEW' };
  if (active === true || hasHistory === true || balances?.some(b => b.amount != null && decimal(b.amount).n !== 0n)) return { include: true, role };
  if (active === false && hasHistory === false && balances?.length && balances.every(b => b.amount != null && decimal(b.amount).n === 0n)) return { include: false, role, reason: 'PASSIVE_ZERO_NO_HISTORY' };
  return { include: null, role, reason: 'PARTY_SCOPE_EVIDENCE_MISSING' };
}
export function planParties(cards, verifiedGroups = []) {
  const ids = new Map(cards.map(c => [c.key, c])), membership = new Map(), reviews = [];
  for (const g of verifiedGroups) {
    requireRule(g.verified === true && clean(g.reference) && g.keys.length > 1 && /^[a-f0-9]{64}$/.test(g.evidenceHash || ''), 'PARTY_IDENTITY_EVIDENCE_REQUIRED');
    requireRule(g.keys.every(k => ids.has(k) && !membership.has(k)), 'PARTY_GROUP_CONFLICT');
    const rows = [...g.keys].sort().map(k => ids.get(k));
    requireRule(g.evidenceHash === hash(rows) && new Set(rows.map(r => r.company)).size === 1 && !rows.some(r => cashCards.has(clean(r.code))) && rows.every(r => ['F0102', 'F0103'].includes(r.company)), 'PARTY_GROUP_INVALID');
    for (const k of g.keys) membership.set(k, g.keys.slice().sort()[0]);
  }
  const planned = [];
  for (const c of cards) {
    const scope = partySelection(c);
    if (scope.include !== true) { if (scope.include === null) reviews.push({ key: c.key, reason: scope.reason }); continue; }
    if (!clean(c.name)) reviews.push({ key: c.key, reason: 'AMBIGUOUS_PARTY_NAME' });
    const accountCurrency = currency(c.currency);
    if (!accountCurrency) reviews.push({ key: c.key, reason: 'UNSUPPORTED_CURRENCY', sourceCurrency: c.currency });
    planned.push({ ...c, name: clean(c.name), role: scope.role, partyKey: membership.get(c.key) || c.key, accountKey: c.key, accountCurrency, generalCashCustomer: cashCards.has(clean(c.code)), original: c });
  }
  for (const rows of group(planned.filter(p => !p.generalCashCustomer && clean(p.name)), p => `${p.role}/${clean(p.name)}`).values()) {
    if (new Set(rows.map(p => p.partyKey)).size > 1) reviews.push({ reason: 'POSSIBLE_MULTI_CURRENCY_PARTY', keys: rows.map(p => p.key), autoMerged: false });
  }
  return { accounts: planned, parties: [...group(planned, p => p.partyKey)].map(([key, accounts]) => ({ key, role: accounts[0].role, accounts: accounts.map(a => a.accountKey) })), reviews };
}

export function salesperson(documentNo, confirmed = {}) {
  const prefix = String(documentNo ?? '').match(/^([A-Za-zÇĞİÖŞÜçğıöşü]+)(?=[\s\d/._-]|$)/u)?.[1]?.toLocaleUpperCase('tr-TR') ?? null;
  const mapping = prefix ? confirmed[prefix] : null;
  return { sourcePrefix: prefix, personId: mapping?.verified === true && clean(mapping.reference) ? mapping.personId ?? null : null, status: mapping?.verified === true && mapping.personId != null && clean(mapping.reference) ? 'VERIFIED' : 'REVIEW' };
}

// Documents and their effects are separate. A proven shared event is posted once.
export function planHistory({ documents, effects, window, eventLinks = [], people = {} }) {
  const docs = new Map();
  for (const d of documents) { requireRule(!docs.has(d.key), 'DUPLICATE_DOCUMENT_SOURCE_KEY'); docs.set(d.key, d); }
  const assignments = new Map();
  for (const link of eventLinks) {
    requireRule(link.verified === true && clean(link.reference) && link.documentKeys.length > 1 && link.evidenceHash === hash(link.documentKeys.slice().sort().map(k => docs.get(k))), 'EVENT_LINK_EVIDENCE_REQUIRED');
    requireRule(link.documentKeys.every(k => docs.has(k) && !assignments.has(k)), 'EVENT_LINK_CONFLICT');
    for (const key of link.documentKeys) assignments.set(key, link.eventKey);
  }
  const included = [], excluded = [], reviews = [], plannedEffects = [], seenEffects = new Set();
  for (const d of documents) {
    if (d.cancelled === true || ['order', 'cheque', 'promissory_note'].includes(d.kind)) { excluded.push({ key: d.key, reason: d.cancelled ? 'CANCELLED' : 'OUT_OF_SCOPE' }); continue; }
    if (d.cancelled !== false) { reviews.push({ key: d.key, reason: 'CANCELLATION_UNKNOWN' }); continue; }
    if (d.company === 'F0104') { reviews.push({ key: d.key, reason: 'F0104_RELATION_REVIEW' }); continue; }
    if (!d.date || Number.isNaN(Date.parse(d.date))) { reviews.push({ key: d.key, reason: 'ORIGINAL_DATE_UNKNOWN' }); continue; }
    if (d.date.slice(0, 10) < window.startDate || d.date.slice(0, 10) >= window.endExclusive) { excluded.push({ key: d.key, reason: 'OUTSIDE_WINDOW' }); continue; }
    included.push({ ...d, eventKey: assignments.get(d.key) || d.key, salesperson: salesperson(d.number, people), paymentMethod: d.explicitPaymentMethod || 'UNKNOWN', sourceHash: hash(d) });
  }
  const includedKeys = new Set(included.map(d => d.key));
  const chosen = new Map();
  for (const e of effects) {
    requireRule(!seenEffects.has(e.key), 'DUPLICATE_EFFECT_SOURCE_KEY'); seenEffects.add(e.key);
    if (!docs.has(e.documentKey)) { reviews.push({ key: e.key, reason: 'ORPHAN_EFFECT' }); continue; }
    if (!includedKeys.has(e.documentKey)) continue;
    // Annual carryovers are not new business. Preserve their evidence, reconcile separately.
    if (e.periodCarryover === true) { excluded.push({ key: e.key, reason: 'PERIOD_CARRYOVER_RECONCILE_ONLY' }); continue; }
    if (!e.verifiedEffectKey || !/^[a-f0-9]{64}$/.test(e.effectEvidenceHash || '')) { reviews.push({ key: e.key, reason: 'EFFECT_IDENTITY_UNVERIFIED' }); continue; }
    const eventKey = assignments.get(e.documentKey) || e.documentKey;
    const prior = chosen.get(e.verifiedEffectKey);
    if (prior) {
      if (prior.effectEvidenceHash !== e.effectEvidenceHash || prior.eventKey !== eventKey || prior.kind !== e.kind || prior.currency !== e.currency) reviews.push({ key: e.key, reason: 'DUPLICATE_EVENT_EFFECT_CONFLICT' });
      else prior.sourceKeys.push(e.key);
    } else { const row = { ...e, eventKey, sourceKeys: [e.key], targetDepot: e.kind === 'stock' ? SPEC.depot : null }; chosen.set(e.verifiedEffectKey, row); plannedEffects.push(row); }
  }
  return { documents: included, effects: plannedEffects, excluded, reviews };
}

export function openingBalances({ balancesAtStart, window }) {
  return balancesAtStart.map(b => {
    requireRule(currency(b.currency) && b.verified === true && clean(b.evidence) && b.asOf === window.startDate, 'OPENING_BALANCE_EVIDENCE_REQUIRED');
    decimal(b.amount);
    return { ...b, currency: currency(b.currency), date: window.startDate, kind: 'migration_opening', description: window.openingLabel, migrationSource: SPEC.source };
  });
}
export function verifyPakelRelationship({ ledger, finance, link }) {
  const failures = [];
  if (ledger?.company !== 'F0103' || clean(ledger?.partyCode) !== 'PAKEL' || ledger?.date?.slice(0, 10) !== '2026-01-23' || currency(ledger?.currency) !== 'USD' || ledger?.amount == null || !equalDecimal(ledger.amount, '16310')) failures.push('PAKEL_LEDGER_CASE_MISSING');
  if (clean(finance?.accountCode) !== 'MERKEZ' || finance?.date?.slice(0, 10) !== '2026-01-23' || finance?.amount == null || finance?.rate == null || !equalDecimal(finance.amount, '701330') || !equalDecimal(finance.rate, '43')) failures.push('PAKEL_FINANCE_CASE_MISSING');
  if (link?.verified !== true || !clean(link?.reference) || link?.ledgerKey !== ledger?.key || link?.financeKey !== finance?.key) failures.push('PAKEL_DOCUMENT_RELATION_UNVERIFIED');
  if (ledger?.amount != null && finance?.rate != null && finance?.amount != null && !equalDecimal(multiplyExact(ledger.amount, finance.rate), finance.amount)) failures.push('PAKEL_AMOUNT_RATE_DIFFERENCE');
  return { status: failures.length ? 'REVIEW' : 'PASS', failures, paymentMethod: finance?.explicitPaymentMethod || 'UNKNOWN', createFinancialEvents: failures.length ? 0 : 1 };
}

export const CRITICAL_DIMENSIONS = Object.freeze(['products', 'barcodes', 'stock', 'negativeStock', 'customers', 'suppliers', 'balancesUSD', 'balancesEUR', 'balancesTRY', 'purchaseHeaders', 'purchaseLines', 'stockEntryHeaders', 'stockEntryLines', 'stockExitHeaders', 'stockExitLines', 'returns', 'payments', 'collections', 'accountMovements', 'financeMovements', 'documentNumbers', 'documentDates', 'quantities', 'prices', 'discounts', 'brandCategory', 'salespeople', 'notes', 'countries', 'protectedTerminal', 'openingBalances', 'eventLinks']);
export function reconcileDimension(source, target, fields) {
  requireRule(Array.isArray(source) && Array.isArray(target) && fields.length > 0, 'RECONCILIATION_INPUT_REQUIRED');
  const left = group(source, r => r.key), right = group(target, r => r.key), details = [];
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const a = left.get(key), b = right.get(key);
    if (a?.length > 1 || b?.length > 1) { details.push({ key, reason: 'DUPLICATE_KEY', sourceCount: a?.length || 0, targetCount: b?.length || 0 }); continue; }
    if (!a || !b) { details.push({ key, reason: !a ? 'UNEXPECTED_TARGET' : 'MISSING_TARGET' }); continue; }
    for (const f of fields) {
      const av = a[0][f], bv = b[0][f];
      if (av === undefined || bv === undefined) details.push({ key, field: f, reason: 'UNVERIFIED_FIELD' });
      else if (JSON.stringify(av) !== JSON.stringify(bv)) details.push({ key, field: f, reason: 'VALUE_DIFFERENCE', source: av, target: bv });
    }
  }
  return { status: details.length ? 'FAIL' : 'PASS', sourceCount: source.length, targetCount: target.length, differenceCount: details.length, details };
}
export function reconciliationSummary(proofs) {
  const dimensions = CRITICAL_DIMENSIONS.map(name => {
    const p = proofs[name];
    return { name, status: p?.status === 'PASS' && p.differenceCount === 0 && Array.isArray(p.details) && p.details.length === 0 ? 'PASS' : p ? 'FAIL' : 'UNVERIFIED', sourceCount: p?.sourceCount ?? null, targetCount: p?.targetCount ?? null, differenceCount: p?.differenceCount ?? null };
  });
  return { status: dimensions.every(d => d.status === 'PASS') ? 'PASS' : 'PARTIAL', liveEnabled: false, dimensions };
}
