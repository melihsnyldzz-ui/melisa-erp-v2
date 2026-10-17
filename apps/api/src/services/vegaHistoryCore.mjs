import { createHash } from 'node:crypto';

export const HISTORY_SOURCE = Object.freeze({ database: 'VEGA2026', companies: Object.freeze(['F0102', 'F0103']), period: 'D0007', dateFrom: '2026-01-01', dateToExclusive: '2027-01-01' });
export const HISTORY_KINDS = Object.freeze(['account', 'document', 'line', 'account_movement', 'stock_movement', 'product']);
export const HISTORY_EFFECTS = Object.freeze({ stock: false, account: false, cash: false });
const digestPattern = /^[a-f0-9]{64}$/;
const recordKeys = ['sourceKey', 'company', 'period', 'table', 'sourceId', 'kind', 'documentFamily', 'headerSourceId', 'partySourceId', 'date', 'currency', 'payload', 'payloadHash'].sort();
export function historyError(code, message, statusCode = 400) { return Object.assign(new Error(message), { code, statusCode }); }
function reject(message, code = 'HISTORY_INVALID_SNAPSHOT') { throw historyError(code, message); }

export function canonicalJson(value) {
  const seen = new Set();
  function visit(item) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) reject('Non-finite JSON number.');
      return JSON.stringify(item);
    }
    if (typeof item !== 'object' || seen.has(item)) reject('Only acyclic JSON values are accepted.');
    seen.add(item);
    let result;
    if (Array.isArray(item)) {
      for (let index = 0; index < item.length; index++) if (!Object.hasOwn(item, index)) reject('Sparse arrays are not JSON values.');
      result = `[${item.map(visit).join(',')}]`;
    }
    else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) reject('Only plain JSON objects are accepted.');
      result = `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${visit(item[key])}`).join(',')}}`;
    }
    seen.delete(item);
    return result;
  }
  return visit(value);
}
const hash = value => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
export const hashHistoryPayload = payload => hash(payload);
export const hashHistoryRecord = record => hash(Object.fromEntries(recordKeys.map(key => [key, record[key]])));
export function buildHistorySourceKey({ database = HISTORY_SOURCE.database, company, period, table, sourceId }) {
  return [database, company, period, table, sourceId].join('/');
}
export function buildHistoryCounts(records) {
  const counts = { total: records.length, byKind: Object.fromEntries(HISTORY_KINDS.map(kind => [kind, 0])), byCompany: { F0102: 0, F0103: 0 } };
  for (const record of records) { counts.byKind[record.kind] = (counts.byKind[record.kind] || 0) + 1; counts.byCompany[record.company] = (counts.byCompany[record.company] || 0) + 1; }
  return counts;
}
export function hashHistorySnapshot(snapshot) {
  return hash({ schemaVersion: snapshot.schemaVersion, source: snapshot.source, records: [...snapshot.records].sort((a, b) => a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0) });
}
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function exactPayload(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) reject('Payload decimals and large integers must be exact strings.', 'HISTORY_INEXACT_NUMBER');
  if (value && typeof value === 'object') for (const child of Object.values(value)) exactPayload(child);
}
function optionalText(value, max) { return value === null || (typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max); }
export function validateHistoryRecord(record) {
  if (!record || canonicalJson(Object.keys(record).sort()) !== canonicalJson(recordKeys)) reject('Archive record fields differ from schemaVersion 1.');
  if (!HISTORY_SOURCE.companies.includes(record.company) || record.period !== HISTORY_SOURCE.period) reject('Record company/period is outside the approved source.', 'HISTORY_SCOPE_MISMATCH');
  if (typeof record.table !== 'string' || !/^[A-Z][A-Z0-9_]{0,127}$/.test(record.table) || (/^F\d{4}/.test(record.table) && !record.table.startsWith(record.company))) reject('Invalid source table scope.', 'HISTORY_SCOPE_MISMATCH');
  if (typeof record.sourceId !== 'string' || !/^[^/\s\u0000-\u001f]{1,80}$/.test(record.sourceId)) reject('sourceId must retain an exact, nonempty source identifier.');
  if (record.sourceKey !== buildHistorySourceKey(record) || record.sourceKey.length > 450) reject('sourceKey differs from the full source identity.', 'HISTORY_SOURCE_KEY_MISMATCH');
  if (!HISTORY_KINDS.includes(record.kind)) reject('Unknown archive record kind.');
  for (const key of ['documentFamily', 'headerSourceId', 'partySourceId', 'currency']) if (!optionalText(record[key], key === 'currency' ? 16 : 128)) reject(`Invalid ${key}.`);
  if (record.date !== null && !validDate(record.date)) reject('Record date must be a real YYYY-MM-DD date.');
  if (!['account', 'product', 'line'].includes(record.kind) && record.date === null) reject('A historical transaction requires its source date.');
  if (!['account', 'product'].includes(record.kind) && record.date !== null && (record.date < HISTORY_SOURCE.dateFrom || record.date >= HISTORY_SOURCE.dateToExclusive)) reject('Transaction is outside 2026.', 'HISTORY_YEAR_MISMATCH');
  if (['document', 'line'].includes(record.kind) && record.documentFamily === null) reject('Documents and lines require a source family.');
  if (record.kind === 'line' && record.headerSourceId === null) reject('A line requires its source header identity.');
  if (!record.payload || Array.isArray(record.payload) || typeof record.payload !== 'object') reject('Payload must be an object.');
  const payloadHash = hashHistoryPayload(record.payload);
  exactPayload(record.payload);
  if (!digestPattern.test(record.payloadHash) || record.payloadHash !== payloadHash) reject('Payload hash differs.', 'HISTORY_HASH_MISMATCH');
  return record;
}
export function validateHistorySnapshot(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1 || canonicalJson(snapshot.source) !== canonicalJson(HISTORY_SOURCE)) reject('Only VEGA2026/F0102,F0103/D0007 and 2026 scope is accepted.', 'HISTORY_SCOPE_MISMATCH');
  if (!Array.isArray(snapshot.records)) reject('Snapshot records must be an array.');
  if (typeof snapshot.startedAt !== 'string' || typeof snapshot.completedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.startedAt)) || !Number.isFinite(Date.parse(snapshot.completedAt)) || Date.parse(snapshot.completedAt) < Date.parse(snapshot.startedAt)) reject('Invalid extraction timestamps.');
  const unique = new Map(), duplicates = [], conflicts = [];
  for (const record of snapshot.records) {
    validateHistoryRecord(record);
    const previous = unique.get(record.sourceKey);
    if (previous) {
      if (hashHistoryRecord(previous) === hashHistoryRecord(record)) duplicates.push(record.sourceKey);
      else conflicts.push({ sourceKey: record.sourceKey, reason: 'DUPLICATE_SOURCE_KEY_DIFFERENT_BODY' });
    } else unique.set(record.sourceKey, record);
  }
  if (canonicalJson(snapshot.counts) !== canonicalJson(buildHistoryCounts(snapshot.records))) reject('Snapshot counts differ from actual records.', 'HISTORY_COUNT_MISMATCH');
  const sourceHash = hashHistorySnapshot(snapshot);
  if (!digestPattern.test(snapshot.sourceHash) || snapshot.sourceHash !== sourceHash) reject('Snapshot sourceHash differs.', 'HISTORY_HASH_MISMATCH');
  const headers = new Map();
  for (const record of unique.values()) if (record.kind === 'document') {
    const key = [record.company, record.period, record.documentFamily, record.sourceId].join('/');
    if (headers.has(key)) reject('Ambiguous document family/header identity.', 'HISTORY_AMBIGUOUS_HEADER');
    headers.set(key, record);
  }
  for (const record of unique.values()) if (record.kind === 'line') {
    const header = headers.get([record.company, record.period, record.documentFamily, record.headerSourceId].join('/'));
    if (!header || (record.date !== null && record.date !== header.date)) reject('Line has no matching 2026 header in the same company/family.', 'HISTORY_ORPHAN_LINE');
  }
  return { records: [...unique.values()].sort((a, b) => a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0), duplicates, conflicts, sourceHash };
}
export function planHistoryImport(snapshot, existingRecords = []) {
  const validated = validateHistorySnapshot(snapshot), existing = new Map();
  for (const row of existingRecords) {
    if (typeof row.sourceKey !== 'string' || !digestPattern.test(row.recordHash) || existing.has(row.sourceKey)) reject('Existing archive key/hash inventory is invalid.', 'HISTORY_INVALID_TARGET');
    existing.set(row.sourceKey, row.recordHash);
  }
  const inserts = [], unchanged = [], conflicts = [...validated.conflicts];
  for (const record of validated.records) {
    const recordHash = hashHistoryRecord(record), prior = existing.get(record.sourceKey);
    if (prior === undefined) inserts.push({ ...record, recordHash });
    else if (prior === recordHash) unchanged.push(record.sourceKey);
    else conflicts.push({ sourceKey: record.sourceKey, reason: 'EXISTING_SOURCE_KEY_DIFFERENT_BODY', existingRecordHash: prior, incomingRecordHash: recordHash });
  }
  const targetFingerprint = hash([...existing].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([sourceKey, recordHash]) => ({ sourceKey, recordHash })));
  const blockers = snapshot.capture?.ready === true ? [] : ['HISTORY_CAPTURE_NOT_VERIFIED'];
  return { schemaVersion: 1, mode: 'PREVIEW', archiveOnly: true, operationalEffects: { ...HISTORY_EFFECTS }, canApply: conflicts.length === 0 && blockers.length === 0, blockers, sourceHash: validated.sourceHash, targetFingerprint, inserts, unchanged, duplicates: validated.duplicates, conflicts, counts: { incoming: snapshot.records.length, unique: validated.records.length, inserts: inserts.length, unchanged: unchanged.length, duplicates: validated.duplicates.length, conflicts: conflicts.length } };
}
export function assertHistoryOperationAllowed(operation) {
  if (!['read', 'list', 'detail', 'ledger'].includes(operation)) throw historyError('HISTORY_READ_ONLY', 'Vega geçmişi yeni Melisa belgesi gibi kesinleştirilemez veya yeniden gönderilemez.', 409);
}
export function parseHistoryQuery(query = {}, { requireParty = false, requireSourceKey = false } = {}) {
  if (!HISTORY_SOURCE.companies.includes(query.company)) throw historyError('HISTORY_INVALID_QUERY', 'F0102 veya F0103 şirketi seçilmeli.');
  const integer = (value, fallback, max) => { if (value === undefined || value === '') return fallback; if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) throw historyError('HISTORY_INVALID_QUERY', 'Geçersiz sayfa veya sayfa boyutu.'); return Number(value); };
  const text = (value, max) => { if (value === undefined || value === '') return null; if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f]/.test(value)) throw historyError('HISTORY_INVALID_QUERY', 'Geçersiz arama parametresi.'); return value.trim() || null; };
  const result = { company: query.company, page: integer(query.page, 1, 1000000), limit: integer(query.limit, 100, 500), search: text(query.search, 200), family: text(query.family, 128), partySourceId: text(query.partySourceId, 128), sourceKey: text(query.sourceKey, 450) };
  if (requireParty && !result.partySourceId) throw historyError('HISTORY_INVALID_QUERY', 'Kaynak cari kimliği gerekli.');
  if (requireSourceKey && (!result.sourceKey || !result.sourceKey.startsWith(`VEGA2026/${result.company}/D0007/`))) throw historyError('HISTORY_INVALID_QUERY', 'Aynı şirket kapsamındaki kaynak belge kimliği gerekli.');
  return result;
}
export function historyPermissions(company) {
  if (!HISTORY_SOURCE.companies.includes(company)) throw historyError('HISTORY_INVALID_QUERY', 'Geçersiz kaynak şirketi.');
  return ['dashboard.view', 'finance.view', ...(company === 'F0102' ? ['customer.view', 'sales.view'] : ['supplier.view', 'purchase.view'])];
}
export function parseHistoryAccountLinkQuery(query = {}) {
  if (!['customer', 'supplier'].includes(query.entityType) || !['string', 'number'].includes(typeof query.entityId) || !/^[1-9]\d*$/.test(String(query.entityId)) || !Number.isSafeInteger(Number(query.entityId))) throw historyError('HISTORY_INVALID_QUERY', 'Geçerli cari türü ve pozitif kesin cari kimliği gerekli.');
  return { entityType: query.entityType, entityId: Number(query.entityId), company: query.entityType === 'customer' ? 'F0102' : 'F0103' };
}
