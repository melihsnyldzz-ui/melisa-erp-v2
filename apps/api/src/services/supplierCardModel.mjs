import {currencyAccountBalanceFields} from './currencyAccountBalanceModel.mjs';
import {maskPhone} from './queryHelpers.js';

export const supplierCardError = (code = 'SUPPLIER_CARD_DATA_INVALID', message = 'Tedarikçi kartı eşleşmesi doğrulanamadı.', statusCode = 503) => Object.assign(new Error(message), {code, statusCode});
const invalidQuery = () => supplierCardError('SUPPLIER_CARD_QUERY_INVALID', 'Geçerli arama ve sayfalama bilgisi gerekli.', 400);
const bit = value => value === true || value === 1 ? true : value === false || value === 0 ? false : null;
const text = value => typeof value === 'string' && value.trim() ? value : null;
const currencies = new Set(['TRY', 'USD', 'EUR']);
const currency = value => currencies.has(value) ? value : null;
const confidence = new Set(['source-matched', 'native-unverified', 'unknown', 'quarantined', 'drift']);

export function parseSupplierCardId(value) {
  const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || BigInt(id) > 9223372036854775807n) throw invalidQuery();
  return id;
}

export function parseSupplierCardQuery(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).some(key => !['search', 'page', 'limit', 'status', 'quarantine'].includes(key))) throw invalidQuery();
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw invalidQuery();
    return Number(value);
  };
  const search = query.search === undefined ? '' : query.search;
  if (typeof search !== 'string' || search.length > 120) throw invalidQuery();
  const status = query.status ?? 'all', quarantine = query.quarantine ?? 'all';
  if (!['all', 'active', 'passive'].includes(status) || !['all', 'included', 'excluded'].includes(quarantine)) throw invalidQuery();
  return {search: search.trim(), page: integer(query.page, 1, 1000000), limit: integer(query.limit, 25, 100), status, quarantine};
}

export function supplierCardExact(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d{0,19})\.\d{1,8}$/.test(value)) throw supplierCardError();
  return value;
}

function scaled(value) {
  const exact = supplierCardExact(value);
  if (exact == null) return null;
  const negative = exact.startsWith('-'), [whole, fraction] = (negative ? exact.slice(1) : exact).split('.');
  const amount = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
  return negative ? -amount : amount;
}

function account(row, blocked, accepted) {
  const nativeBalanceExact = supplierCardExact(row.nativeBalanceExact);
  const sourceOpeningBalanceExact = supplierCardExact(row.sourceOpeningBalanceExact);
  const local = scaled(row.localDeltaExact), current = scaled(nativeBalanceExact), opening = scaled(sourceOpeningBalanceExact);
  const expected = scaled(row.expectedNativeBalanceExact), ledger = scaled(row.ledgerBalanceExact);
  const sourceDelta = row.sourceDeltaVerified === true ? scaled(row.sourceDeltaExact) : row.sourceDeltaExact === undefined ? 0n : null;
  const matched = accepted && row.matchStatus === 'matched' && row.sourceAccountKey != null;
  const proven = matched && row.reconciliationStatus === 'reconciled' && currency(row.currency) != null
    && [local, current, opening, sourceDelta, expected, ledger].every(value => value !== null)
    && opening + local + sourceDelta === expected && expected === current && current === ledger;
  let certainty = confidence.has(row.confidence) ? row.confidence : 'unknown';
  if (blocked === true) certainty = 'quarantined';
  else if (proven && blocked === false) certainty = 'source-matched';
  else if (row.reconciliationStatus === 'reconciled' && !proven) certainty = 'drift';
  else if (certainty === 'source-matched') certainty = accepted ? 'native-unverified' : 'unknown';
  if (blocked !== true && !currency(row.currency)) certainty = 'unknown';
  return {accountId: row.id == null ? null : parseSupplierCardId(row.id), currency: currency(row.currency),
    balanceExact: proven && blocked === false ? nativeBalanceExact : null, nativeBalanceExact, sourceOpeningBalanceExact,sourceDeltaExact:sourceDelta===null?null:row.sourceDeltaExact??'0.00000000',
    ...currencyAccountBalanceFields({role:'supplier',balanceExact:nativeBalanceExact,localDeltaExact:row.localDeltaExact,proven:proven && blocked === false}),
    confidence: certainty, sourceStatus: text(row.balanceStatus), reconciled: proven && blocked === false ? true : row.reconciliationStatus === 'reconciled' ? false : null,
    sourceAsOf: matched ? '2026-09-30' : null};
}

export function supplierCardDto(raw, {detail = false} = {}) {
  if (!raw || typeof raw !== 'object' || !raw.supplier || !Array.isArray(raw.nativeAccounts) || !Array.isArray(raw.sourceAccounts) || !Array.isArray(raw.quarantineHolds)) throw supplierCardError();
  const supplier = raw.supplier, id = parseSupplierCardId(supplier.id), active = bit(supplier.isActive);
  if (!text(supplier.supplierCode) || !text(supplier.supplierName) || active === null) throw supplierCardError();
  const status = ['accepted-opening', 'unmapped', 'ambiguous', 'unknown'].includes(raw.linkage?.status) ? raw.linkage.status : 'unknown';
  const accepted = status === 'accepted-opening' && raw.linkage?.verified === true
    && raw.linkage.sourceLinkCount === 1 && raw.linkage.sourcePartyCount === 1
    && raw.provenance?.verified === true && raw.provenance.sourceAsOf === '2026-09-30';
  if (raw.quarantineHolds.some(hold => !Array.isArray(hold.reasons) || hold.reasons.some(reason => !text(reason)))) throw supplierCardError();
  const reasons = [...new Set(raw.quarantineHolds.flatMap(hold => hold.reasons))];
  const blocked = raw.provenance?.quarantineVerified === true ? raw.quarantineHolds.length > 0 : raw.quarantineHolds.length > 0 ? true : null;
  const accounts = raw.nativeAccounts.map(row => {
    if (parseSupplierCardId(row.supplierId) !== id) throw supplierCardError();
    const matches = raw.sourceAccounts.filter(source => source.matchedNativeAccountId != null && parseSupplierCardId(source.matchedNativeAccountId) === parseSupplierCardId(row.id));
    const sourceValid = matches.length === 1 && matches[0].currency === row.currency
      && row.nativeOwnerSupplierId === id
      && text(row.sourceAccountKey) !== null && matches[0].sourceKey === row.sourceAccountKey
      && matches[0].role === 'supplier' && matches[0].matchStatus === 'matched'
      && matches[0].balanceStatus === 'SOURCE'
      && scaled(matches[0].sourceOpeningBalanceExact) !== null && scaled(matches[0].sourceOpeningBalanceExact) === scaled(row.sourceOpeningBalanceExact);
    return account(row, blocked, accepted && sourceValid);
  });
  const nativeIds = new Set(accounts.map(row => row.accountId));
  if (nativeIds.has(null) || nativeIds.size !== accounts.length) throw supplierCardError();
  for (const row of raw.sourceAccounts) {
    if (row.matchedNativeAccountId != null && nativeIds.has(parseSupplierCardId(row.matchedNativeAccountId))) continue;
    accounts.push({accountId: null, currency: currency(row.currency), balanceExact: null, nativeBalanceExact: null,
      sourceOpeningBalanceExact: supplierCardExact(row.sourceOpeningBalanceExact),
      ...currencyAccountBalanceFields({role:'supplier',balanceExact:null,localDeltaExact:null}), confidence: blocked === true ? 'quarantined' : 'unknown',
      sourceStatus: text(row.balanceStatus), reconciled: null, sourceAsOf: accepted ? '2026-09-30' : null});
  }
  const dto = {id, supplierCode: supplier.supplierCode, supplierName: supplier.supplierName, isPassive: !active,
    quarantine: {blocked, reasons}, source: {status: accepted ? status : status === 'accepted-opening' ? 'unknown' : status,
      sourceAsOf: accepted ? '2026-09-30' : null, freshLive: false}, accounts, accountCount: accounts.length,
    hasUnknownAccounts: !accounts.length || accounts.some(row => row.balanceExact === null || row.currency === null)};
  if (detail) Object.assign(dto, {fields: {phoneMasked: maskPhone(supplier.phone), city: text(supplier.city), country: text(supplier.country)}});
  return dto;
}
