import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalBusinessPartyHistoryStore,canonicalBusinessPartyHistoryStore} from './canonicalBusinessPartyHistoryStore.mjs';

const options=patch=>({kind:'customer',partyId:'9007199254740993',accountId:'9223372036854775807',currency:'USD',page:1,limit:25,offset:0,dateFrom:null,dateTo:null,...patch});
const account=()=>({id:'9223372036854775807',partyId:'9007199254740993',oppositePartyId:null,partyEntityId:'8000000000000001',currency:'USD'});
const movement=()=>({id:'9007199254740995',kind:'synthetic_read',documentDate:'2026-01-02',documentAmountExact:'99999999999999.1234',documentCurrencyRaw:'EUR',accountAmountExact:'123.4567',accountCurrency:'USD',balanceEffectExact:'-99999999999999999999.12345678',legacyBalanceEffectExact:'-123.4567',affectsBalance:true,invoiceId:'9007199254740997',invoiceNumber:'SYNTHETIC-ONLY',returnId:null});
function fixture(recordsets=[[account()],[{total:'1',unassignedCount:'2',conflictCount:'0'}],[movement()]]){
 const calls=[],queries=[];
 const runtime={sql:{NVarChar:n=>'nvarchar('+n+')',Date:'date',Int:'int'},pool:{request(){calls.push(['request']);return {input(...args){calls.push(['input',...args]);return this;},async query(text){queries.push(text);return {recordsets};}};}}};
 let opens=0;
 return {calls,queries,recordsets,store:createCanonicalBusinessPartyHistoryStore({getRuntime:async()=>{opens++;return runtime;}}),opens:()=>opens};
}
test('import is inert; injected SELECT preserves full bigint/exact4/exact8 and distinct document/account currency',async()=>{
 assert.equal(typeof canonicalBusinessPartyHistoryStore.read,'function');
 const f=fixture(),before=structuredClone(f.recordsets),out=await f.store.read(options());
 assert.deepEqual(out,{account:before[0][0],...before[1][0],rows:before[2]});assert.deepEqual(f.recordsets,before);
 assert.equal(f.opens(),1);assert.equal(f.queries.length,1);
 assert.deepEqual(f.calls.filter(c=>c[0]==='input').map(c=>c.slice(1)),[['partyId','nvarchar(20)','9007199254740993'],['accountId','nvarchar(20)','9223372036854775807'],['currency','nvarchar(3)','USD'],['dateFrom','date',null],['dateTo','date',null],['offset','int',0],['limit','int',25]]);
 assert.equal(out.rows[0].documentCurrencyRaw,'EUR');assert.equal(out.rows[0].accountCurrency,'USD');assert.equal(out.rows[0].balanceEffectExact,'-99999999999999999999.12345678');
 assert.doesNotMatch(f.queries[0],/9007199254740993|9223372036854775807|\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|EXEC|BEGIN|COMMIT|ROLLBACK|CAST|ROUND|COALESCE|ISNULL)\b/i);
});
test('fixed role maps, exact account linkage and same-party invoice header exclude cross-party and known-currency/entity conflicts',async()=>{
 for(const kind of ['customer','supplier']){
  const f=fixture();await f.store.read(options({kind}));const text=f.queries[0],party=kind+'_id',other=kind==='customer'?'supplier_id':'customer_id',invoice=kind==='customer'?'sales':'purchase';
  assert.match(text,new RegExp('FROM dbo\\.'+kind+'_movements m'));
  assert.match(text,new RegExp('a\\.'+other+'\\) oppositePartyId'));
  assert.match(text,new RegExp('a\\.'+party+'=CONVERT\\(bigint,@partyId\\)'));
  assert.match(text,/m\.party_currency_account_id=a\.id/);
  assert.match(text,new RegExp('m\\.'+party+'<>CONVERT\\(bigint,@partyId\\)'));
  assert.match(text,/m\.account_currency IS NOT NULL AND m\.account_currency<>@currency/);
  assert.match(text,/m\.party_entity_id IS NOT NULL AND a\.party_entity_id IS NOT NULL AND m\.party_entity_id<>a\.party_entity_id/);
  assert.match(text,new RegExp('LEFT JOIN dbo\\.'+invoice+'_invoices i ON i\\.id=m\\.'+invoice+'_invoice_id AND i\\.'+party+'=m\\.'+party));
  assert.equal((text.match(/AND NOT \(m\./g)??[]).length,2,'both count and page exclude conflicts');
  assert.doesNotMatch(text,/m\.currency_code\s*=\s*@currency|finance_accounts|finance_account_movements|source_payload|source_record_key|source_document_no|current_balance|SUM\(/i);
 }
});
test('missing account, null unknown values and actual opposite-party identity are preserved for model rejection',async()=>{
 const missing=fixture([[],[{total:'0',unassignedCount:'0',conflictCount:'0'}],[]]);assert.equal((await missing.store.read(options())).account,null);
 const f=fixture();f.recordsets[0][0].oppositePartyId='123';Object.assign(f.recordsets[2][0],{accountAmountExact:null,accountCurrency:null,balanceEffectExact:null,affectsBalance:null,invoiceId:null,invoiceNumber:null,returnId:null});
 const out=await f.store.read(options());assert.equal(out.account.oppositePartyId,'123');assert.equal(out.rows[0].balanceEffectExact,null);assert.equal(out.rows[0].accountAmountExact,null);assert.equal(out.rows[0].affectsBalance,null);assert.equal(out.rows[0].invoiceNumber,null);
});
test('separate count survives an empty out-of-range page without deriving total from rows',async()=>{
 const f=fixture([[account()],[{total:'9007199254740993',unassignedCount:'22',conflictCount:'3'}],[]]);
 const out=await f.store.read(options({page:5,offset:100}));assert.equal(out.total,'9007199254740993');assert.deepEqual(out.rows,[]);assert.equal(out.conflictCount,'3');assert.match(f.queries[0],/COUNT_BIG\(\*\)/);assert.doesNotMatch(f.queries[0],/COUNT_BIG\([^)]*\) OVER/);
});
test('dates filter only explicit document date; unassigned and conflict warnings cover all recorded dates',async()=>{
 const f=fixture();await f.store.read(options({dateFrom:'2026-01-01',dateTo:'2026-12-31'}));
 const text=f.queries[0];assert.match(text,/@dateFrom IS NULL OR m\.document_date>=@dateFrom/);assert.match(text,/@dateTo IS NULL OR m\.document_date<=@dateTo/);assert.doesNotMatch(text,/YEAR\(|created_at|original_document_date|DATEADD|GETDATE|GETUTCDATE/i);
 const counts=text.slice(text.indexOf('SELECT\n CONVERT')),unassigned=counts.slice(counts.indexOf(' total,'),counts.indexOf(' unassignedCount,')),conflicts=counts.slice(counts.indexOf(' unassignedCount,'),counts.indexOf(' conflictCount;'));
 assert.match(unassigned,/m\.party_currency_account_id IS NULL/);assert.doesNotMatch(unassigned,/@dateFrom|@dateTo|account_currency|currency_code/);assert.doesNotMatch(conflicts,/@dateFrom|@dateTo/);
 assert.deepEqual(f.calls.find(c=>c[1]==='dateFrom').slice(2),['date','2026-01-01']);assert.deepEqual(f.calls.find(c=>c[1]==='dateTo').slice(2),['date','2026-12-31']);
});
test('invalid enums, injection, IDs, offsets and dates fail before opening any runtime',async()=>{
 const f=fixture();
 for(const patch of [{kind:'supplier;DROP TABLE x'},{kind:'toString'},{kind:['customer']},{partyId:9007199254740992},{accountId:'9223372036854775808'},{partyId:'01'},{partyId:'1 OR 1=1'},{currency:'USD\'--'},{limit:50},{limit:'25'},{page:0},{page:1.5},{offset:1},{offset:-1},{page:85899347,offset:2147483650},{dateFrom:'2026-02-30'},{dateFrom:'0000-01-01'},{dateFrom:undefined},{dateFrom:'2026-01-01\';SELECT 1--'},{dateFrom:'2026-12-31',dateTo:'2026-01-01'},{extra:'unknown'}])await assert.rejects(f.store.read(options(patch)),{code:'BUSINESS_PARTY_HISTORY_QUERY_INVALID',statusCode:400});
 for(const value of [null,[],{},undefined])await assert.rejects(f.store.read(value),{statusCode:400});assert.equal(f.opens(),0);assert.equal(f.queries.length,0);
});
test('SQL/runtime failures and malformed counts/results fail closed with a sanitized error',async()=>{
 const broken=createCanonicalBusinessPartyHistoryStore({getRuntime:async()=>{throw Error('private-driver-details');}});await assert.rejects(broken.read(options()),e=>e.statusCode===503&&!e.message.includes('private-driver'));
 for(const sets of [undefined,[],[[],[],[]],[[account(),account()],[{total:'0',unassignedCount:'0',conflictCount:'0'}],[]],[[account()],[{total:1,unassignedCount:'0',conflictCount:'0'}],[]],[[account()],[{total:'0',unassignedCount:null,conflictCount:'0'}],[]],[[account()],[{total:'0',unassignedCount:'0',conflictCount:'9223372036854775808'}],[]],[[account()],[{total:'0',unassignedCount:'0',conflictCount:'0'}],Array(26).fill(movement())]]){
  const f=fixture(sets);if(sets===undefined)f.recordsets.length=0;
  await assert.rejects(f.store.read(options()),{code:'BUSINESS_PARTY_HISTORY_UNAVAILABLE',statusCode:503});
 }
});
