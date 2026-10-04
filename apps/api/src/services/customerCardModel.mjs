import {maskPhone} from './queryHelpers.js';

export const customerCardError = (code = 'CUSTOMER_CARD_DATA_INVALID', message = 'Müşteri kartı eşleşmesi doğrulanamadı.', statusCode = 503) => Object.assign(new Error(message), {code, statusCode});
const invalidQuery = () => customerCardError('CUSTOMER_CARD_QUERY_INVALID', 'Geçerli arama ve sayfalama bilgisi gerekli.', 400);
const bit = value => value === true || value === 1 ? true : value === false || value === 0 ? false : null;
const text = value => typeof value === 'string' && value.trim() ? value : null;
const currencies = new Set(['TRY', 'USD', 'EUR']);
const currency = value => currencies.has(value) ? value : null;
const confidence = new Set(['source-matched', 'native-unverified', 'unknown', 'quarantined', 'drift']);

export function parseCustomerCardId(value) {
  const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || BigInt(id) > 9223372036854775807n) throw invalidQuery();
  return id;
}

export function parseCustomerCardQuery(query = {}) {
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

export function customerCardExact(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d{0,19})\.\d{1,8}$/.test(value)) throw customerCardError();
  return value;
}

function scaled(value) {
  const exact = customerCardExact(value);
  if (exact == null) return null;
  const negative = exact.startsWith('-'), [whole, fraction] = (negative ? exact.slice(1) : exact).split('.');
  const amount = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
  return negative ? -amount : amount;
}

function account(row, blocked, accepted) {
  const nativeBalanceExact = customerCardExact(row.nativeBalanceExact);
  const sourceOpeningBalanceExact = customerCardExact(row.sourceOpeningBalanceExact);
  const local = scaled(row.localDeltaExact), current = scaled(nativeBalanceExact), opening = scaled(sourceOpeningBalanceExact);
  const expected = scaled(row.expectedNativeBalanceExact), ledger = scaled(row.ledgerBalanceExact);
  const matched = accepted && row.matchStatus === 'matched' && row.sourceAccountKey != null;
  const proven = matched && row.reconciliationStatus === 'reconciled' && currency(row.currency) != null
    && [local, current, opening, expected, ledger].every(value => value !== null)
    && opening + local === expected && expected === current && current === ledger;
  let certainty = confidence.has(row.confidence) ? row.confidence : 'unknown';
  if (blocked === true) certainty = 'quarantined';
  else if (proven && blocked === false) certainty = 'source-matched';
  else if (row.reconciliationStatus === 'reconciled' && !proven) certainty = 'drift';
  else if (certainty === 'source-matched') certainty = accepted ? 'native-unverified' : 'unknown';
  if (blocked !== true && !currency(row.currency)) certainty = 'unknown';
  return {accountId: row.id == null ? null : parseCustomerCardId(row.id), currency: currency(row.currency),
    balanceExact: proven && blocked === false ? nativeBalanceExact : null, nativeBalanceExact, sourceOpeningBalanceExact,
    confidence: certainty, sourceStatus: text(row.balanceStatus), reconciled: proven && blocked === false ? true : row.reconciliationStatus === 'reconciled' ? false : null,
    sourceAsOf: matched ? '2026-09-30' : null};
}

export function customerCardDto(raw, {detail = false} = {}) {
  if (!raw || typeof raw !== 'object' || !raw.customer || !Array.isArray(raw.nativeAccounts) || !Array.isArray(raw.sourceAccounts) || !Array.isArray(raw.quarantineHolds)) throw customerCardError();
  const customer = raw.customer, id = parseCustomerCardId(customer.id), active = bit(customer.isActive);
  if (!text(customer.customerCode) || !text(customer.customerName) || active === null) throw customerCardError();
  const status = ['accepted-opening', 'unmapped', 'ambiguous', 'unknown'].includes(raw.linkage?.status) ? raw.linkage.status : 'unknown';
  const accepted = status === 'accepted-opening' && raw.linkage?.verified === true
    && raw.linkage.sourceLinkCount === 1 && raw.linkage.sourcePartyCount === 1
    && raw.provenance?.verified === true && raw.provenance.sourceAsOf === '2026-09-30';
  if (raw.quarantineHolds.some(hold => !Array.isArray(hold.reasons) || hold.reasons.some(reason => !text(reason)))) throw customerCardError();
  const reasons = [...new Set(raw.quarantineHolds.flatMap(hold => hold.reasons))];
  const blocked = raw.provenance?.quarantineVerified === true ? raw.quarantineHolds.length > 0 : raw.quarantineHolds.length > 0 ? true : null;
  const accounts = raw.nativeAccounts.map(row => {
    if (parseCustomerCardId(row.customerId) !== id) throw customerCardError();
    const matches = raw.sourceAccounts.filter(source => source.matchedNativeAccountId != null && parseCustomerCardId(source.matchedNativeAccountId) === parseCustomerCardId(row.id));
    const sourceValid = matches.length === 1 && matches[0].currency === row.currency
      && text(row.sourceAccountKey) !== null && matches[0].sourceKey === row.sourceAccountKey
      && matches[0].role === 'customer' && matches[0].matchStatus === 'matched'
      && matches[0].balanceStatus === 'SOURCE'
      && scaled(matches[0].sourceOpeningBalanceExact) !== null && scaled(matches[0].sourceOpeningBalanceExact) === scaled(row.sourceOpeningBalanceExact);
    return account(row, blocked, accepted && sourceValid);
  });
  const nativeIds = new Set(accounts.map(row => row.accountId));
  if (nativeIds.has(null) || nativeIds.size !== accounts.length) throw customerCardError();
  for (const row of raw.sourceAccounts) {
    if (row.matchedNativeAccountId != null && nativeIds.has(parseCustomerCardId(row.matchedNativeAccountId))) continue;
    accounts.push({accountId: null, currency: currency(row.currency), balanceExact: null, nativeBalanceExact: null,
      sourceOpeningBalanceExact: customerCardExact(row.sourceOpeningBalanceExact), confidence: blocked === true ? 'quarantined' : 'unknown',
      sourceStatus: text(row.balanceStatus), reconciled: null, sourceAsOf: accepted ? '2026-09-30' : null});
  }
  const dto = {id, customerCode: customer.customerCode, customerName: customer.customerName, isPassive: !active,
    quarantine: {blocked, reasons}, source: {status: accepted ? status : status === 'accepted-opening' ? 'unknown' : status,
      sourceAsOf: accepted ? '2026-09-30' : null, freshLive: false}, accounts, accountCount: accounts.length,
    hasUnknownAccounts: !accounts.length || accounts.some(row => row.balanceExact === null || row.currency === null)};
  if (detail) Object.assign(dto, {fields: {phoneMasked: maskPhone(customer.phone), city: text(customer.city), country: text(customer.country), note: text(customer.note)}});
  return dto;
}
