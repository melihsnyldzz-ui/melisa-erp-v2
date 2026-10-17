import test from 'node:test';
import assert from 'node:assert/strict';
import sql from 'mssql/tedious.js';
import { createProductSalesEvidenceService, createSalesEvidenceRequest, normalizeSalesEvidenceQuery, PRODUCT_SALES_EVIDENCE_SQL } from './vegaProductSalesEvidenceService.js';
import nativeSql from 'mssql/msnodesqlv8.js';
import { createProductSalesEvidenceController } from '../controllers/productSalesEvidenceController.js';
import { productSalesEvidenceRoutes } from '../routes/productSalesEvidenceRoutes.js';

// Isolated aggregate fixtures, never production rows or a live SQL connection.
const input = { sourceId: '42', dateFrom: '2026-01-01', dateTo: '2026-09-06' };
const config = { enabled: true, database: 'VEGA2026', companyCode: 'F0102', periodCode: 'D0007', year: 2026 };
const zero = () => ({ source_database: 'VEGA2026', source_id: 42, active: true, movementRowCount: '0',
  salesCodeRowCount: '0', grossOutboundRowCount: '0', grossOutboundQuantity: 0,
  undatedMovementRowCount: '0', unclassifiedOutboundRowCount: '0', firstSoldAt: null, lastSoldAt: null });
function fixture(rows = [zero()], options = {}) {
  const calls = [], parameters = [];
  const request = { input(...args) { parameters.push(args); return this; }, async query(text) {
    calls.push(text); if (options.failure) throw new Error('PRIVATE_DRIVER_DETAIL'); return { recordset: rows };
  } };
  const service = createProductSalesEvidenceService({ config: { ...config, ...options.config },
    getPool: async () => ({ request: () => { throw new Error('GLOBAL_DRIVER_MUST_NOT_BE_USED'); } }), requestFactory: () => request, now: () => new Date('2026-09-07T00:00:00Z') });
  return { service, calls, parameters };
}
async function http(service, query = input) {
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; } };
  await createProductSalesEvidenceController(service)({ query }, res); return res;
}

test('Vega request remains tedious when the full ERP also loads the native SQL driver', () => {
  const pool = new sql.ConnectionPool({ server: '127.0.0.1', database: 'UNIT_ONLY' });
  const request = createSalesEvidenceRequest(pool);
  assert.ok(request instanceof sql.Request);
  assert.equal(request instanceof nativeSql.Request, false);
  assert.equal(request.parent, pool);
  // No connection/query: this tests driver selection, not production data.
});

test('dated sales return 200 SALES_FOUND with counts and dates, not customer or commercial data', async () => {
  const r = fixture([{ ...zero(), movementRowCount: '4', salesCodeRowCount: '3', grossOutboundRowCount: '2',
    grossOutboundQuantity: 6, firstSoldAt: new Date('2026-02-01T00:00:00Z'), lastSoldAt: new Date('2026-09-06T00:00:00Z'),
    customerName: 'PRIVATE_FIXTURE', price: 99, productName: 'PRIVATE_FIXTURE' }]);
  const res = await http(r.service), { data, meta } = res.body;
  assert.equal(res.statusCode, 200); assert.equal(data.state, 'SALES_FOUND'); assert.equal(data.noSalesInWindow, false);
  assert.equal(data.salesCount, 2); assert.equal(data.firstSoldAt, '2026-02-01'); assert.equal(data.lastSoldAt, '2026-09-06');
  assert.equal(meta.writePerformed, false); assert.equal(JSON.stringify(res.body).includes('PRIVATE_FIXTURE'), false);
  assert.deepEqual(Object.keys(data).sort(), ['sourceId','active','state','noSalesInWindow','salesCount','movementRowCount',
    'salesCodeRowCount','grossOutboundRowCount','grossOutboundQuantity','undatedMovementRowCount','unclassifiedOutboundRowCount','firstSoldAt','lastSoldAt'].sort());
});

test('successful empty aggregate returns explicit 200 zero with complete scope/provenance', async () => {
  const r = fixture(), res = await http(r.service), { data, meta } = res.body;
  assert.equal(r.calls.length, 1); assert.equal(res.statusCode, 200); assert.equal(data.state, 'NO_SALES_IN_WINDOW');
  assert.equal(data.noSalesInWindow, true); assert.equal(data.salesCount, 0);
  assert.ok(['movementRowCount','salesCodeRowCount','grossOutboundRowCount','grossOutboundQuantity','undatedMovementRowCount','unclassifiedOutboundRowCount'].every(key => data[key] === 0));
  assert.deepEqual(meta.scope, { ...input, companyCode:'F0102',periodCode:'D0007',year:2026,
    movementSource:'F0102D0007TBLSTOKHAREKETLERI',dateBoundary:'DATE_FROM_INCLUSIVE_DATE_TO_INCLUSIVE',
    aggregationComplete:true,coverage:'ALL_MATCHING_ROWS_IN_SOURCE_QUERY',rowLimit:null,pagination:false,
    undatedRowsExamined:true,movementDefinition:'IZAHAT_33_POSITIVE_CIKAN' });
  assert.deepEqual(meta, {source:'vega-live-read-only',contractVersion:'vega-product-sales-evidence/v1',
    companyCode:'F0102',periodCode:'D0007',year:2026,database:'VEGA2026',retrievedAt:'2026-09-07T00:00:00.000Z',readOnly:true,writePerformed:false,scope:meta.scope});
});

test('non-sale inbound rows permit no-sales but retain actual movement count', async () => {
  const { data } = await fixture([{ ...zero(), movementRowCount: '7' }]).service(input);
  assert.equal(data.state, 'NO_SALES_IN_WINDOW'); assert.equal(data.movementRowCount, 7);
});
for (const key of ['salesCodeRowCount', 'undatedMovementRowCount', 'unclassifiedOutboundRowCount']) {
  test(`${key} uncertainty cannot be published as zero-sales proof`, async () => {
    const { data } = await fixture([{ ...zero(), movementRowCount: '1', [key]: '1' }]).service(input);
    assert.equal(data.state, 'INDETERMINATE'); assert.equal(data.noSalesInWindow, false);
    assert.equal(data.reason, 'SALES_MOVEMENT_CLASSIFICATION_INCOMPLETE');
  });
}
test('missing exact stock and unavailable query both return 404 UNAVAILABLE, never zero-sales', async () => {
  for (const r of [fixture([]), fixture(undefined, { failure: true })]) {
    const res = await http(r.service);
    assert.equal(res.statusCode, 404); assert.equal(res.body.success, false); assert.equal(res.body.meta.state, 'UNAVAILABLE');
    assert.equal(res.body.data, undefined); assert.equal(JSON.stringify(res.body).includes('PRIVATE_DRIVER_DETAIL'), false);
  }
});
test('disabled or mismatched source fails closed before SQL', async () => {
  for (const override of [{enabled:false},{database:'OTHER'},{companyCode:'F0103'},{periodCode:'D0001'},{year:2025}]) {
    const r=fixture(undefined,{config:override});assert.equal((await http(r.service)).statusCode,404);assert.equal(r.calls.length,0);
  }
});
test('invalid, missing, duplicate and injected inputs fail before SQL', async () => {
  const invalid = [{}, {...input,sourceId:'0'}, {...input,sourceId:'2147483648'}, {...input,sourceId:'42 OR 1=1'},
    {...input,sourceId:['42','43']}, {...input,sourceId:42}, {...input,dateFrom:'2026-02-30'},
    {...input,dateFrom:'2025-12-31'}, {...input,dateTo:'2027-01-01'}, {...input,dateFrom:'2026-09-07'},
    {...input,dateTo:['2026-09-06']}, {...input,dateTo:'2026-09-06T00:00:00Z'}, {...input,limit:'10'}];
  for (const query of invalid) { const r=fixture();assert.equal((await http(r.service,query)).statusCode,400);assert.equal(r.calls.length,0); }
  assert.deepEqual(normalizeSalesEvidenceQuery({...input,dateFrom:'2026-12-31',dateTo:'2026-12-31'}),{...input,dateFrom:'2026-12-31',dateTo:'2026-12-31'});
});
test('missing, non-finite, unsafe or contradictory aggregate evidence fails closed', async () => {
  for (const patch of [{movementRowCount:null},{movementRowCount:''},{movementRowCount:'9007199254740993'},
    {grossOutboundQuantity:NaN},{grossOutboundRowCount:1},{undatedMovementRowCount:-1},
    {firstSoldAt:'2026-02-30'},{source_database:'OTHER'},{source_id:43}]) {
    assert.equal((await http(fixture([{...zero(),...patch}]).service)).statusCode,502);
  }
});
test('sale dates must be present, ordered and inside the exact inclusive window', async () => {
  const sales={...zero(),movementRowCount:1,salesCodeRowCount:1,grossOutboundRowCount:1,grossOutboundQuantity:1};
  for(const patch of [{},{firstSoldAt:'2025-12-31',lastSoldAt:'2026-01-01'},
    {firstSoldAt:'2026-09-06',lastSoldAt:'2026-01-01'},{firstSoldAt:'2026-01-01',lastSoldAt:'2026-09-07'}]) {
    assert.equal((await http(fixture([{...sales,...patch}]).service)).statusCode,502);
  }
});
test('query uses typed parameters and fixed complete read-only movement scope', async () => {
  const r=fixture();await r.service(input);
  assert.deepEqual(r.parameters.map(([name,type])=>[name,type]),[['sourceId',sql.Int],['dateFrom',sql.Date],['dateTo',sql.Date]]);
  assert.equal(r.parameters[0][2],42);assert.equal(r.parameters[1][2].toISOString(),'2026-01-01T00:00:00.000Z');
  assert.equal(r.parameters[2][2].toISOString(),'2026-09-06T00:00:00.000Z');
  assert.equal(r.calls[0],PRODUCT_SALES_EVIDENCE_SQL);
  assert.match(r.calls[0],/product\.IND = @sourceId/);assert.match(r.calls[0],/movement\.STOKNO = product\.IND/);
  assert.match(r.calls[0],/movement\.TARIH >= @dateFrom AND movement\.TARIH < DATEADD\(day, 1, @dateTo\)/);
  assert.match(r.calls[0],/OR movement\.TARIH IS NULL/);assert.match(r.calls[0],/N'33' AND movement\.CIKAN > 0/);
  assert.doesNotMatch(r.calls[0],/\b(INSERT|UPDATE|DELETE|MERGE|EXEC|TOP|OFFSET|NOLOCK)\b/i);
});
test('route is GET-only and denies missing authentication and sales permission', async () => {
  const route=productSalesEvidenceRoutes.stack.find(layer=>layer.route)?.route;
  assert.equal(route.path,'/vega/ai/product-sales-evidence');assert.deepEqual(route.methods,{get:true});
  assert.equal(route.stack.length,3);
  let denied;await route.stack[0].handle({get:()=>''},{},e=>{denied=e;});assert.equal(denied.statusCode,401);
  route.stack[1].handle({user:{permissions:[]}},{},e=>{denied=e;});assert.equal(denied.statusCode,403);
  let allowed=false;route.stack[1].handle({user:{permissions:['sales.view']}},{},()=>{allowed=true;});assert.equal(allowed,true);
});
