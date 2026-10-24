import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_SOURCE, HISTORY_EFFECTS, buildHistorySourceKey, hashHistoryPayload, hashHistoryRecord, historySourceScopes, parseHistoryQuery } from './vegaHistoryCore.mjs';
import { createVegaHistoryService, resolveHistoryRelation } from './vegaHistoryService.js';

// Synthetic manifest metadata: database name and period number do not imply year.
const historical = { database: 'VEGA2026', companies: ['F0102', 'F0103'], period: 'D0001', dateFrom: '2020-01-01', dateToExclusive: '2021-01-01' };
const approvedSources = [HISTORY_SOURCE, historical];
const selected = { company: 'F0102', sourceDatabase: historical.database, period: historical.period };
function record(kind = 'document', source = historical, changes = {}) {
  const company = changes.company || 'F0102';
  const families = { document: 'SATFAT', line: 'SATFAT', account_movement: 'CARIHAREKETLERI', account: null, product: null };
  const tables = { document: `${company}${source.period}TBLSATFATBASLIK`, line: `${company}${source.period}TBLSATFATHAREKET`, account_movement: `${company}${source.period}TBLCARIHAREKETLERI`, account: `${company}TBLCARI`, product: `${company}TBLSTOKLAR` };
  const row = { company, period: source.period, table: tables[kind], sourceId: '7', kind, documentFamily: families[kind], headerSourceId: kind === 'line' ? '7' : null,
    partySourceId: ['document', 'account_movement'].includes(kind) ? '8' : null, date: ['account', 'product'].includes(kind) ? '2019-01-01' : `${source.dateFrom.slice(0, 4)}-02-20`, currency: 'USD',
    payload: { BELGENO: 'ARCHIVE-7', BELGETIPI: 'SALE', NET: '12.34567890', IPTAL: false, ...(kind === 'line' ? { STOKNO: '9', MIKTAR: '2.0000' } : {}), ...(kind === 'account_movement' ? { IZAHAT: 'SALE', EVRAKNO: 'ARCHIVE-7', BORC: '12.34567890' } : {}) }, ...changes };
  row.sourceKey = buildHistorySourceKey({ ...row, database: source.database });
  row.payloadHash = hashHistoryPayload(row.payload);
  return row;
}
function stored(row) { return { source_key: row.sourceKey, company: row.company, period: row.period, source_table: row.table, source_id: row.sourceId, kind: row.kind, document_family: row.documentFamily, header_source_id: row.headerSourceId, party_source_id: row.partySourceId, source_date: row.date, currency: row.currency, payload_json: JSON.stringify(row.payload), payload_hash: row.payloadHash, record_hash: hashHistoryRecord(row) }; }
const page = rows => ({ recordsets: [[{ total: rows.length }], rows.map(stored)] });
const schema = { recordset: [{ ready: 1 }], recordsets: [[{ ready: 1 }], [{ captureCompletedAt: '2026-10-24T00:00:00Z', importedAt: '2026-10-24T00:00:01Z' }]] };
function fakeService(responses, sources = approvedSources) {
  const calls = [];
  let opens = 0;
  const pool = { request() { const parameters = {}; return { input(name, type, value) { parameters[name] = value; return this; }, async query(statement) {
    assert.doesNotMatch(statement, /\b(?:INSERT|UPDATE|DELETE|MERGE|EXEC|BACKUP|RESTORE)\b/i);
    calls.push({ statement, parameters });
    const result = responses.shift();
    assert.notEqual(result, undefined, 'Unexpected archive query');
    if (result instanceof Error) throw result;
    return result;
  } }; } };
  const service = createVegaHistoryService({ approvedSources: sources, getPool: async () => { opens++; return pool; }, sql: { NVarChar: size => size, Int: 'Int', BigInt: 'BigInt' } });
  return { service, calls, get opens() { return opens; } };
}
function assertScope(call, source = historical) {
  assert.equal(call.parameters.sourceDatabase, source.database);
  assert.equal(call.parameters.period, source.period);
  assert.equal(call.parameters.company, 'F0102');
  assert.match(call.statement, /source_database=@sourceDatabase/);
  assert.match(call.statement, /period=@period/);
}

test('query selection uses only the registered scope; unknown or injected scope fails before SQL', () => {
  const fake = fakeService([]);
  for (const query of [{ ...selected, period: 'D9999' }, { ...selected, sourceDatabase: 'VEGA2020' }, { ...selected, company: 'F0104' }, { company: 'F0102', period: 'D0001' }, { ...selected, table: 'dbo.users' }, { ...selected, dateFrom: '2019-01-01' }, { ...selected, approvedSource: historical }]) {
    assert.throws(() => fake.service.listDocuments(query), { code: 'HISTORY_INVALID_QUERY' });
  }
  assert.equal(fake.opens, 0);
  assert.throws(() => historySourceScopes([historical, { ...historical, dateToExclusive: '2022-01-01' }]), { code: 'HISTORY_SCOPE_MISMATCH' });
  assert.throws(() => historySourceScopes([{ ...historical, companies: ['F0104'] }]), { code: 'HISTORY_SCOPE_MISMATCH' });
  assert.throws(() => parseHistoryQuery({ ...selected, sourceKey: record('document', HISTORY_SOURCE).sourceKey }, { approvedSources, requireSourceKey: true }), { code: 'HISTORY_INVALID_QUERY' });
});

test('legacy 2026 calls keep their source, dates, metadata and zero operational effects', async () => {
  const row = record('document', HISTORY_SOURCE), fake = fakeService([schema, page([row])], [HISTORY_SOURCE]);
  const result = await fake.service.listDocuments({ company: 'F0102' });
  assertScope(fake.calls[1], HISTORY_SOURCE);
  assert.equal(result.source.period, 'D0007');
  assert.equal(result.source.dateFrom, '2026-01-01');
  assert.equal(result.source.importedAt, schema.recordsets[1][0].importedAt);
  assert.deepEqual(result.operationalEffects, HISTORY_EFFECTS);
  assert.deepEqual(result.data, [row]);
});

test('selected historical period reaches query, row validation and response without borrowing global package dates', async () => {
  const row = record(), fake = fakeService([schema, page([row])]);
  const result = await fake.service.listDocuments(selected);
  assertScope(fake.calls[1]);
  assert.equal(result.source.database, 'VEGA2026');
  assert.equal(result.source.period, 'D0001');
  assert.equal(result.source.dateFrom, '2020-01-01');
  assert.equal(result.source.importedAt, null);
  assert.equal(result.source.captureCompletedAt, null);
  assert.equal(result.data[0].payload.NET, '12.34567890');
  assert.deepEqual(result.operationalEffects, HISTORY_EFFECTS);
});

test('source list is copied at construction; later caller mutation cannot widen scope', async () => {
  const mutable = structuredClone(historical), fake = fakeService([schema, page([record()])], [mutable]);
  mutable.period = 'D9999'; mutable.companies.push('F0104');
  assert.equal((await fake.service.listDocuments(selected)).source.period, 'D0001');
  assert.throws(() => fake.service.listDocuments({ ...selected, period: 'D9999' }), { code: 'HISTORY_INVALID_QUERY' });
});

test('valid hash is insufficient for rows from another company, period, database or date range', async () => {
  for (const row of [record('document', HISTORY_SOURCE), record('document', historical, { company: 'F0103' }), record('document', { ...historical, database: 'VEGA2020' }), record('document', historical, { date: '2021-01-01' })]) {
    const fake = fakeService([schema, page([row])]);
    await assert.rejects(fake.service.listDocuments(selected), { code: 'HISTORY_ARCHIVE_CORRUPT' });
  }
});

test('document detail retains period and family while preserving distinct in-period header and line dates', async () => {
  const header = record(), line = record('line', historical, { sourceId: '10', date: '2020-02-21' }), product = record('product', historical, { sourceId: '9' }), party = record('account', historical, { sourceId: '8' });
  const fake = fakeService([schema, { recordset: [stored(header)] }, page([line]), page([product]), page([party])]);
  const result = await fake.service.documentDetail({ ...selected, sourceKey: header.sourceKey });
  fake.calls.slice(1).forEach(call => assertScope(call));
  assert.equal(fake.calls[2].parameters.family, 'SATFAT');
  assert.equal(fake.calls[2].parameters.headerSourceId, '7');
  assert.deepEqual(result.data, { document: header, lines: [line] });
  assert.equal(result.data.document.date, '2020-02-20');
  assert.equal(result.data.lines[0].date, '2020-02-21');
  assert.deepEqual(result.relations.map(relation => relation.status), ['linked', 'linked']);
  const crossFamily = record('line', historical, { documentFamily: 'ALFAT', table: 'F0102D0001TBLALFATHAREKET' });
  for (const invalidLine of [crossFamily, record('line', historical, { headerSourceId: '99' }), record('line', historical, { date: '2021-01-01' })]) {
    const rejected = fakeService([schema, { recordset: [stored(header)] }, page([invalidLine])]);
    await assert.rejects(rejected.service.documentDetail({ ...selected, sourceKey: header.sourceKey }), { code: 'HISTORY_ARCHIVE_CORRUPT' });
  }
});

test('ledger links cannot cross databases, periods or companies with the same source IND', async () => {
  const movement = record('account_movement'), header = record();
  const others = [record('document', HISTORY_SOURCE), record('document', { ...historical, database: 'VEGA2020' }), record('document', historical, { company: 'F0103' })];
  assert.equal(resolveHistoryRelation(movement, others, 'document').status, 'missing');
  assert.equal(resolveHistoryRelation(movement, [...others, header], 'document').target.sourceKey, header.sourceKey);
  const fake = fakeService([schema, page([movement]), page([header])]);
  const result = await fake.service.listLedger({ ...selected, partySourceId: '8' });
  fake.calls.slice(1).forEach(call => assertScope(call));
  assert.equal(result.relations[0].status, 'linked');
});

test('multi-period account links require source and period evidence; missing schema or wrong binding never falls back', async () => {
  const link = { source_database: 'VEGA2026', period: 'D0001', company: 'F0102', party_source_id: '8', entity_type: 'customer', entity_id: 1, evidence_hash: 'a'.repeat(64) };
  const query = { sourceDatabase: 'VEGA2026', period: 'D0001', entityType: 'customer', entityId: 1 };
  const fake = fakeService([schema, { recordset: [link] }]);
  const result = await fake.service.accountLink(query);
  assertScope(fake.calls[1]);
  assert.match(fake.calls[1].statement, /l\.source_database=@sourceDatabase AND l\.period=@period/);
  assert.equal(result.data.partySourceId, '8');
  assert.equal(result.source.period, 'D0001');
  for (const bad of [{ ...link, period: 'D0007' }, { ...link, source_database: 'VEGA2020' }, { ...link, source_database: undefined, period: undefined }]) {
    const rejected = fakeService([schema, { recordset: [bad] }]);
    await assert.rejects(rejected.service.accountLink(query), { code: 'HISTORY_ARCHIVE_CORRUPT' });
  }
  const absent = fakeService([schema, Object.assign(new Error('fixture column absent'), { number: 207 })]);
  await assert.rejects(absent.service.accountLink(query), { code: 'HISTORY_ARCHIVE_NOT_READY' });
});

test('unchanged legacy account-link schema remains usable only in the fixed default scope', async () => {
  const row = { company: 'F0102', party_source_id: '8', entity_type: 'customer', entity_id: 1, evidence_hash: 'b'.repeat(64) };
  const fake = fakeService([schema, { recordset: [row] }], [HISTORY_SOURCE]);
  const result = await fake.service.accountLink({ entityType: 'customer', entityId: 1 });
  assertScope(fake.calls[1], HISTORY_SOURCE);
  assert.doesNotMatch(fake.calls[1].statement, /l\.period/);
  assert.equal(result.data.evidenceHash, row.evidence_hash);
});
