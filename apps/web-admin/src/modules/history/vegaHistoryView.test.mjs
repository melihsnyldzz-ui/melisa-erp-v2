import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { VEGA_HISTORY_DEFAULT_SCOPE, createVegaHistoryApi, historyPeriodLabel, historyPeriodRange, historyRelationAction, historySelectedScope, readHistoryAccountLink, readVegaHistoryResponse } from './vegaHistoryView.js';
import { buildScreenDeepLink, readScreenDeepLink } from '../../utils/screenDeepLink.js';

const historical = { database: 'VEGA2026', companies: ['F0102', 'F0103'], period: 'D0001', dateFrom: '2020-01-01', dateToExclusive: '2021-01-01' };
const approvedSources = [VEGA_HISTORY_DEFAULT_SCOPE, historical];
const company = 'F0102';
const permissions = ['dashboard.view', 'finance.view', 'customer.view', 'sales.view', 'supplier.view', 'purchase.view'];
function record(kind = 'document', source = historical, changes = {}) {
  const table = `${company}${source.period}TBLSATFAT${kind === 'line' ? 'HAREKET' : 'BASLIK'}`;
  const row = { company, period: source.period, table, sourceId: kind === 'line' ? '2' : '1', kind, documentFamily: 'SATFAT', headerSourceId: kind === 'line' ? '1' : null, partySourceId: '8', date: `${source.dateFrom.slice(0, 4)}-02-20`, currency: 'USD', payload: { TUTAR: '12.3400', BORC: '12.3400' }, ...changes };
  row.sourceKey = `${source.database}/${row.company}/${row.period}/${row.table}/${row.sourceId}`;
  return row;
}
function response(rows, source = historical) { return { success: true, archiveOnly: true, operationalEffects: { stock: false, account: false, cash: false }, source: { database: source.database, company, period: source.period, dateFrom: source.dateFrom, dateToExclusive: source.dateToExclusive }, data: rows, meta: { page: 1, limit: 100, total: rows.length, totalPages: Math.ceil(rows.length / 100) } }; }
const options = { company, kind: 'document', approvedSource: historical };

test('API selection cannot invent a period; existing 2026 query shape remains compatible', async () => {
  const calls = [], api = createVegaHistoryApi((path, query) => { calls.push({ path, query }); }, { approvedSources });
  await api.documents({ company });
  assert.deepEqual(calls[0], { path: '/api/vega-history/documents', query: { company, page: 1, limit: 100 } });
  await api.documents({ company, sourceDatabase: historical.database, period: historical.period });
  assert.equal(calls[1].query.period, 'D0001');
  assert.equal(calls[1].query.sourceDatabase, 'VEGA2026');
  assert.throws(() => api.documents({ company, sourceDatabase: 'VEGA2026', period: 'D0099' }));
  assert.throws(() => api.documents({ company, period: 'D0001' }));
  assert.equal(calls.length, 2);
});

test('response source and every record must match the selected manifest, not the database year', () => {
  const data = response([record()]);
  assert.equal(readVegaHistoryResponse(data, options).data[0].payload.TUTAR, '12.3400');
  assert.throws(() => readVegaHistoryResponse(data, { company, kind: 'document' }), { code: 'HISTORY_INVALID_RESPONSE' });
  for (const alter of [value => { value.source.period = 'D0007'; }, value => { value.source.dateFrom = '2019-01-01'; }, value => { value.data[0] = record('document', VEGA_HISTORY_DEFAULT_SCOPE); }, value => { value.data[0].sourceKey = value.data[0].sourceKey.replace('VEGA2026/', 'VEGA2020/'); }, value => { value.data[0].date = '2020-02-30'; }, value => { value.data[0].payload.TUTAR = 12.34; }, value => { value.operationalEffects.account = true; }]) {
    const changed = structuredClone(data); alter(changed);
    assert.throws(() => readVegaHistoryResponse(changed, options), { code: 'HISTORY_INVALID_RESPONSE' });
  }
  assert.doesNotThrow(() => readVegaHistoryResponse(response([record('document', VEGA_HISTORY_DEFAULT_SCOPE)], VEGA_HISTORY_DEFAULT_SCOPE), { company, kind: 'document' }));
});

test('header and lines cannot cross family, period or source date', () => {
  const header = record(), line = record('line'), data = response([line]);
  data.data = { document: header, lines: [line] };
  const detailOptions = { ...options, sourceKey: header.sourceKey };
  assert.doesNotThrow(() => readVegaHistoryResponse(data, detailOptions));
  for (const alter of [value => { value.data.lines[0].documentFamily = 'ALFAT'; }, value => { value.data.lines[0].date = '2020-02-21'; }, value => { value.data.lines[0] = record('line', VEGA_HISTORY_DEFAULT_SCOPE); }]) {
    const changed = structuredClone(data); alter(changed);
    assert.throws(() => readVegaHistoryResponse(changed, detailOptions), { code: 'HISTORY_INVALID_RESPONSE' });
  }
});

test('a detached relation callback cannot open the old period after selection changes', () => {
  let context = 'VEGA2026/D0001/F0102', opened = null;
  const activate = historyRelationAction({ status: 'linked', target: record() }, context, () => context, value => { opened = value; });
  context = 'VEGA2026/D0007/F0102';
  assert.equal(activate(), false); assert.equal(opened, null);
});

test('account link needs exact source, period and no operational effects', () => {
  const data = response([]);
  data.data = { company, partySourceId: '8', entityType: 'customer', entityId: 4, evidenceHash: 'a'.repeat(64) };
  const accountOptions = { company, entityType: 'customer', entityId: 4, approvedSource: historical };
  assert.equal(readHistoryAccountLink(data, accountOptions).partySourceId, '8');
  const wrong = structuredClone(data); wrong.source.period = 'D0007';
  assert.throws(() => readHistoryAccountLink(wrong, accountOptions), { code: 'HISTORY_INVALID_RESPONSE' });
});

test('navigation retains historical source identity and rejects incomplete or duplicated selectors', () => {
  const registry = { 'vega-history': {}, dashboard: {} }, payload = { company, partySourceId: '8', sourceDatabase: 'VEGA2026', period: 'D0001' };
  const url = buildScreenDeepLink('', 'vega-history', payload);
  assert.deepEqual(readScreenDeepLink(url, registry), { screenId: 'vega-history', payload });
  assert.equal(readScreenDeepLink(url + '&historyPeriod=D0007', registry), null);
  assert.equal(readScreenDeepLink(buildScreenDeepLink('', 'vega-history', { company, period: 'D0001' }), registry), null);
  const unknown = readScreenDeepLink(buildScreenDeepLink('', 'vega-history', { company, sourceDatabase: 'VEGA2026', period: 'D9999' }), registry);
  assert.throws(() => historySelectedScope(unknown.payload, approvedSources));
  assert.deepEqual(readScreenDeepLink(buildScreenDeepLink(url, 'dashboard'), registry), { screenId: 'dashboard', payload: {} });
});

test('date labels use reviewed range; D0001 is never guessed to be a year', () => {
  assert.equal(historyPeriodLabel(historical), '2020');
  assert.equal(historyPeriodRange(historical), '01.01.2020–31.12.2020');
  assert.equal(historyPeriodLabel({ ...historical, dateFrom: '2020-02-01', dateToExclusive: '2020-04-01' }), '2020-02-01–2020-03-31');
});

test('existing screen renders selected period and legacy default correctly without live requests', async () => {
  const output = await build({ stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { VegaHistoryScreen } from './VegaHistoryScreen.jsx'; export const render = props => renderToStaticMarkup(React.createElement(VegaHistoryScreen, props));`, resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'jsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const html = module.exports.render({ api: {}, permissions, approvedSources, initialSourceDatabase: 'VEGA2026', initialPeriod: 'D0001', initialCompany: company });
  assert.match(html, /2020 Cari ve Belge Geçmişi/);
  assert.match(html, /01\.01\.2020–31\.12\.2020/);
  assert.match(html, /2020 Belgeleri/);
  assert.match(html, /D0001/);
  assert.doesNotMatch(html, /2026 Cari ve Belge Geçmişi|2026 Belgeleri/);
  const current = module.exports.render({ api: {}, permissions, initialCompany: company });
  assert.match(current, /2026 Cari ve Belge Geçmişi/);
  const supplierOnly = module.exports.render({ api: {}, permissions, approvedSources: [{ ...historical, companies: ['F0103'] }] });
  assert.match(supplierOnly, /2020 Cari ve Belge Geçmişi/);
  assert.match(supplierOnly, /F0103/);
});
