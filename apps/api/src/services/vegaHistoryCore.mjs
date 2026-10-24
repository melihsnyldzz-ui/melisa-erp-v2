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
export function buildHistoryCounts(records, { approvedSource = HISTORY_SOURCE } = {}) {
  validateHistorySource(approvedSource);
  const counts = { total: records.length, byKind: Object.fromEntries(HISTORY_KINDS.map(kind => [kind, 0])), byCompany: Object.fromEntries(approvedSource.companies.map(company=>[company,0])) };
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
// Only an explicit reviewed manifest supplies a different scope. Existing API
// callers retain the fixed 2026 default; snapshot/query input cannot select it.
export function validateHistorySource(source) {
  if(!source||![Object.prototype,null].includes(Object.getPrototypeOf(source))||canonicalJson(Object.keys(source).sort())!==canonicalJson(Object.keys(HISTORY_SOURCE).sort())||!/^VEGA20\d{2}$/.test(source.database)||!Array.isArray(source.companies)||!source.companies.length||source.companies.some(c=>!HISTORY_SOURCE.companies.includes(c))||new Set(source.companies).size!==source.companies.length||!/^D\d{4}$/.test(source.period)||!validDate(source.dateFrom)||!validDate(source.dateToExclusive)||source.dateFrom<'2020-01-01'||source.dateToExclusive<=source.dateFrom)reject('Explicit archive source metadata is invalid.','HISTORY_SCOPE_MISMATCH');
  return source;
}
export function validateHistoryRecord(record, { approvedSource = HISTORY_SOURCE } = {}) {
  validateHistorySource(approvedSource);
  if (!record || canonicalJson(Object.keys(record).sort()) !== canonicalJson(recordKeys)) reject('Archive record fields differ from schemaVersion 1.');
  if (!approvedSource.companies.includes(record.company) || record.period !== approvedSource.period) reject('Record company/period is outside the approved source.', 'HISTORY_SCOPE_MISMATCH');
  if (typeof record.table !== 'string' || !/^[A-Z][A-Z0-9_]{0,127}$/.test(record.table) || (/^F\d{4}/.test(record.table) && !record.table.startsWith(record.company))) reject('Invalid source table scope.', 'HISTORY_SCOPE_MISMATCH');
  const tablePeriod=/^F\d{4}(D\d{4})/.exec(record.table)?.[1];
  if(tablePeriod&&tablePeriod!==record.period)reject('Source table belongs to another period.','HISTORY_SCOPE_MISMATCH');
  if (typeof record.sourceId !== 'string' || !/^[^/\s\u0000-\u001f]{1,80}$/.test(record.sourceId)) reject('sourceId must retain an exact, nonempty source identifier.');
  if (record.sourceKey !== buildHistorySourceKey({...record,database:approvedSource.database}) || record.sourceKey.length > 450) reject('sourceKey differs from the full source identity.', 'HISTORY_SOURCE_KEY_MISMATCH');
  if (!HISTORY_KINDS.includes(record.kind)) reject('Unknown archive record kind.');
  for (const key of ['documentFamily', 'headerSourceId', 'partySourceId', 'currency']) if (!optionalText(record[key], key === 'currency' ? 16 : 128)) reject(`Invalid ${key}.`);
  if (record.date !== null && !validDate(record.date)) reject('Record date must be a real YYYY-MM-DD date.');
  if (!['account', 'product', 'line'].includes(record.kind) && record.date === null) reject('A historical transaction requires its source date.');
  if (!['account', 'product'].includes(record.kind) && record.date !== null && (record.date < approvedSource.dateFrom || record.date >= approvedSource.dateToExclusive)) reject('Transaction is outside the approved date window.', 'HISTORY_YEAR_MISMATCH');
  if (['document', 'line'].includes(record.kind) && record.documentFamily === null) reject('Documents and lines require a source family.');
  if (record.kind === 'line' && record.headerSourceId === null) reject('A line requires its source header identity.');
  if (!record.payload || Array.isArray(record.payload) || typeof record.payload !== 'object') reject('Payload must be an object.');
  const payloadHash = hashHistoryPayload(record.payload);
  exactPayload(record.payload);
  if (!digestPattern.test(record.payloadHash) || record.payloadHash !== payloadHash) reject('Payload hash differs.', 'HISTORY_HASH_MISMATCH');
  return record;
}
// Conversion only: no filesystem, SQL, import execution or commercial motor.
// Every family needs an explicit metadata binding; absent fields remain NULL.
export function mapLegacyHistoryRecord({ legacySourceKey, table, row, relation = null }, { approvedSource = HISTORY_SOURCE, binding } = {}) {
  validateHistorySource(approvedSource);
  const descriptor=/^(F010[234])(D\d{4})TBL([A-Z]+)(BASLIK|HAREKET)$/.exec(table??'');
  const families=['ALFAT','ALIRS','SATFAT','SATIRS','STKGIR','STKCIK','DEVGIR','DEVCIK','CARCIK','CARGIR','CARCIKIADE','CARGIRIADE','SAYIMGIRIS','SAYIMCIKIS','DEPOHAR','TOPLUCARIBORDRO'];
  if(!descriptor||!families.includes(descriptor[3]))reject('This legacy family requires a separate source adapter.','HISTORY_LEGACY_FAMILY_UNSUPPORTED');
  const [,company,period,family,part]=descriptor;
  if(!approvedSource.companies.includes(company)||period!==approvedSource.period)reject('Legacy table is outside the reviewed scope.','HISTORY_SCOPE_MISMATCH');
  const fields=['sourceId','date','currency','partySourceId'];
  if(!binding||canonicalJson(Object.keys(binding).sort())!==canonicalJson(['table','fields','evidenceHash'].sort())||binding.table!==table||!digestPattern.test(binding.evidenceHash??'')||!binding.fields||canonicalJson(Object.keys(binding.fields).sort())!==canonicalJson(fields.sort())||fields.some(field=>binding.fields[field]!==null&&!/^[A-Z][A-Z0-9_]{0,127}$/.test(binding.fields[field]))||binding.fields.sourceId===null)reject('A family-specific metadata binding is required.','HISTORY_LEGACY_BINDING_REQUIRED');
  if(!row||Array.isArray(row)||![Object.prototype,null].includes(Object.getPrototypeOf(row)))reject('Legacy payload must be a plain object.');
  const value=field=>{const column=binding.fields[field];if(column===null)return null;if(!Object.hasOwn(row,column))reject('A bound source column is missing.','HISTORY_LEGACY_COLUMN_MISSING');return row[column];};
  const sourceId=value('sourceId');
  if(typeof sourceId!=='string'||!/^\d{1,80}$/.test(sourceId)||legacySourceKey!==`${approvedSource.database}/${table}/${sourceId}`)reject('Legacy source identity must retain its exact text.','HISTORY_SOURCE_KEY_MISMATCH');
  const rawDate=value('date');let date=null;
  if(rawDate!==null){
    if(typeof rawDate!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/.test(rawDate))reject('Legacy date format is not proven.','HISTORY_LEGACY_DATE_INVALID');
    date=rawDate.slice(0,10);
  }
  let headerSourceId=null;
  if(part==='HAREKET'){
    const prefix=`${approvedSource.database}/${company}${period}TBL${family}BASLIK/`;
    if(!relation||!['LINKED','EXCLUDE_CANCELLED'].includes(relation.status)||typeof relation.headerKey!=='string'||!relation.headerKey.startsWith(prefix)||!/^\d{1,80}$/.test(relation.headerKey.slice(prefix.length)))reject('A unique same-family source header link is required.','HISTORY_LEGACY_HEADER_UNRESOLVED');
    headerSourceId=relation.headerKey.slice(prefix.length);
  }
  const record={sourceKey:buildHistorySourceKey({database:approvedSource.database,company,period,table,sourceId}),company,period,table,sourceId,kind:part==='BASLIK'?'document':'line',documentFamily:family,headerSourceId,partySourceId:value('partySourceId'),date,currency:value('currency'),payload:row,payloadHash:hashHistoryPayload(row)};
  validateHistoryRecord(record,{approvedSource});
  return {record,legacySourceKey,mappingEvidenceHash:binding.evidenceHash};
}
export function validateHistorySnapshot(snapshot, { approvedSource = HISTORY_SOURCE } = {}) {
  validateHistorySource(approvedSource);
  if (!snapshot || snapshot.schemaVersion !== 1 || canonicalJson(snapshot.source) !== canonicalJson(approvedSource)) reject('Snapshot differs from the explicit approved source scope.', 'HISTORY_SCOPE_MISMATCH');
  if (!Array.isArray(snapshot.records)) reject('Snapshot records must be an array.');
  if (typeof snapshot.startedAt !== 'string' || typeof snapshot.completedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.startedAt)) || !Number.isFinite(Date.parse(snapshot.completedAt)) || Date.parse(snapshot.completedAt) < Date.parse(snapshot.startedAt)) reject('Invalid extraction timestamps.');
  const unique = new Map(), duplicates = [], conflicts = [];
  for (const record of snapshot.records) {
    validateHistoryRecord(record,{approvedSource});
    const previous = unique.get(record.sourceKey);
    if (previous) {
      if (hashHistoryRecord(previous) === hashHistoryRecord(record)) duplicates.push(record.sourceKey);
      else conflicts.push({ sourceKey: record.sourceKey, reason: 'DUPLICATE_SOURCE_KEY_DIFFERENT_BODY' });
    } else unique.set(record.sourceKey, record);
  }
  if (canonicalJson(snapshot.counts) !== canonicalJson(buildHistoryCounts(snapshot.records,{approvedSource}))) reject('Snapshot counts differ from actual records.', 'HISTORY_COUNT_MISMATCH');
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
    if (!header || (record.date !== null && record.date !== header.date)) reject('Line has no matching header in the same company/period/family.', 'HISTORY_ORPHAN_LINE');
  }
  return { records: [...unique.values()].sort((a, b) => a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0), duplicates, conflicts, sourceHash };
}
export function planHistoryImport(snapshot, existingRecords = [], { approvedSource = HISTORY_SOURCE } = {}) {
  const validated = validateHistorySnapshot(snapshot,{approvedSource}), existing = new Map();
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
