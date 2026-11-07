import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopWriteListService} from './desktopWriteListService.mjs';

function setup({allow=true,guard=true,receiptTotal='50.0000',receiptState='COMPLETED',receiptCurrency='TRY',richCards=false,schemaVersion,total='1'}={}){
 const calls=[];let committed=0,rolled=0;
 class Transaction{async begin(){calls.push('begin');}async commit(){committed++;}async rollback(){rolled++;}}
 class Request{constructor(tx){this.tx=tx;this.params={};}input(k,_t,v){this.params[k]=v;return this;}async query(q){calls.push({q,p:this.params});if(q.includes('DESKTOP_LIST_TARGET_REJECTED'))return {recordset:[{ok:guard?1:0}]};if(q.includes('COUNT_BIG(*)'))return {recordset:[{total}]};if(q.includes('FROM dbo.sales_invoices i'))return {recordset:[{id:'5',documentNo:'DS-ORIGINAL',documentDate:'2026-11-06',customerName:'Ada',workflowState:receiptState,currency:receiptCurrency,totalExact4:receiptTotal}]};return {recordset:[{id:'1',customerCode:'A',customerName:'Ada',phone:null,city:'Yalova',country:'Türkiye',currency:'TRY',customerType:'customer',balanceExact4:'50.0000'}]};}}
 const sql={Transaction,Request,NVarChar:()=>null,Int:{},ISOLATION_LEVEL:{SERIALIZABLE:1}};
 const service=createDesktopWriteListService({pool:{},sql,richCards,schemaVersion,verifySession:async x=>{calls.push(x);return allow;}});
 return {service,calls,get committed(){return committed;},get rolled(){return rolled;}};
}
test('same transaction checks target and current authority before escaped paginated data',async()=>{
 const x=setup();const r=await x.service.list('7','customers',{page:1,limit:10,search:'%_['});
 assert.equal(r.data[0].city,'Yalova');assert.equal(r.meta.total,1);assert.equal(x.committed,1);
 assert.equal(x.calls.find(v=>v?.permission)?.permission,'customer.view');
 const query=x.calls.find(v=>v?.q?.includes('OFFSET'));assert.equal(query.p.search,'%~%~_~[%');assert.match(query.q,/is_deleted=0/);assert.match(query.q,/OFFSET @offset/);
});
test('V6 lists use the V6 guard and fail closed on guard rejection',async()=>{const x=setup({richCards:true,schemaVersion:6});await x.service.list('7','customers',{page:1,limit:10,search:''});const q=x.calls.find(v=>v?.q?.includes('DESKTOP_LIST_TARGET_REJECTED')).q;assert.match(q,/schema_version=6/);assert.match(q,/DESKTOP_GOODS_V6_SCHEMA_REJECTED/);const denied=setup({richCards:true,schemaVersion:6,guard:false});await assert.rejects(denied.service.list('7','customers',{page:1,limit:10,search:''}));assert.equal(denied.rolled,1);});
test('rich customer paging keeps the same escaped phone/country predicate and selected page',async()=>{
 const x=setup({richCards:true,total:'101'}),r=await x.service.list('7','customers',{page:2,limit:1,search:'00555%_[ Türkiye'});assert.equal(r.meta.page,2);assert.equal(r.meta.hasPreviousPage,true);
 for(const q of x.calls.filter(c=>c?.q?.startsWith('SELECT ')&&(c.q.includes('COUNT_BIG(*)')||c.q.includes('OFFSET')))){assert.match(q.q,/phone LIKE @search ESCAPE N'~'/);assert.match(q.q,/country LIKE @search ESCAPE N'~'/);assert.equal(q.p.offset,1);assert.equal(q.p.search,'%00555~%~_~[ Türkiye%');}
});
test('wrong target or revoked permission rolls back without reading business rows',async()=>{
 for(const opts of [{allow:false},{guard:false}]){const x=setup(opts);await assert.rejects(x.service.list('7','customers',{}));assert.equal(x.rolled,1);assert.equal(x.calls.some(v=>v?.q?.includes('OFFSET')),false);}
});
test('unbounded page, foreign kind and control characters fail before SQL',async()=>{const x=setup();for(const [kind,options] of [['customers',{limit:101}],['other',{}],['customers',{search:'a\0'}]])await assert.rejects(x.service.list('7',kind,options));assert.equal(x.calls.length,0);});

test('receipt history uses sales.view and persisted workflow state without losing exact totals',async()=>{
 for(const receiptState of ['COMPLETED','CANCELLED','PREPARING']){const x=setup({receiptState});const result=await x.service.list('7','receipts',{page:1,limit:10,search:'DS-%_'});assert.equal(result.data[0].workflowState,receiptState);assert.equal(result.data[0].totalExact4,'50.0000');assert.equal(x.calls.find(v=>v?.permission)?.permission,'sales.view');const query=x.calls.find(v=>v?.q?.includes('OFFSET'));assert.match(query.q,/JOIN dbo.desktop_sale_workflows/);assert.match(query.q,/ORDER BY i.id DESC/);assert.equal(query.p.search,'%DS-~%~_%');}
 for(const options of [{receiptTotal:50},{receiptTotal:'50.00'},{receiptState:'UNRECOGNIZED'}]){const x=setup(options);await assert.rejects(x.service.list('7','receipts'));assert.equal(x.rolled,1);assert.equal(x.committed,0);}
});

test('receipt lists retain each original currency and exact total only in the explicit FX profiles',async()=>{
 for(const schemaVersion of [2,3,4,5])for(const receiptCurrency of ['TRY','USD','EUR'])for(const receiptState of ['DRAFT','COMPLETED','CANCELLED']){
  const x=setup({richCards:schemaVersion!==2,schemaVersion,receiptCurrency,receiptState,receiptTotal:'1.1640'});
  if(schemaVersion<4&&receiptCurrency!=='TRY'){await assert.rejects(x.service.list('7','receipts'));assert.equal(x.committed,0);assert.equal(x.rolled,1);continue;}
  const result=await x.service.list('7','receipts');assert.equal(result.data[0].currency,receiptCurrency);assert.equal(result.data[0].totalExact4,'1.1640');assert.equal(result.data[0].workflowState,receiptState);assert.equal(x.committed,1);assert.equal(x.rolled,0);assert.equal(x.calls.find(v=>v?.permission)?.permission,'sales.view');
 }
});

test('FX receipt lists still reject unknown or malformed currency before committing',async()=>{
 for(const schemaVersion of [4,5])for(const receiptCurrency of ['JPY','usd','USD ',null,1,'EUR\0']){const x=setup({richCards:true,schemaVersion,receiptCurrency});await assert.rejects(x.service.list('7','receipts'));assert.equal(x.committed,0);assert.equal(x.rolled,1);}
});
