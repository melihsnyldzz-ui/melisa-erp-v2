import test from 'node:test';
import assert from 'node:assert/strict';
import {homeCapabilities,homeCurrencyTotals,homeDate,homeSummaryDto} from './homeSummaryModel.mjs';
import {createHomeSummaryService} from './homeSummaryService.mjs';
import {createHomeSummaryReadStore,HOME_SUMMARY_SQL} from './homeSummaryReadStore.mjs';
const rights=['goods.view','goods.approve','sales.view','sales.cancel','purchase.view','purchase.cancel','finance.view','finance.collection','finance.payment','customer.view','supplier.view','product.view','stock.adjust'];
const counts={salesCount:'0',salesCancelledCount:'0',goodsPendingCount:'0',salesReturnCount:'0',purchaseReturnCount:'0',returnCancelledCount:'0',countPendingCount:'0',approvalPendingCount:'0'};
const raw=(capabilities=homeCapabilities(rights,rights))=>({capabilities,counts:{...counts},salesTotals:[],collections:[],payments:[],reversals:[],tasks:[]});
const meta={date:'2026-10-05',readAt:'2026-10-04T22:00:00.000Z'};
test('Istanbul date crosses UTC midnight; actor id stays exact and service binds current date',async()=>{
 assert.equal(homeDate(new Date(meta.readAt)),meta.date);let call;
 const svc=createHomeSummaryService({clock:()=>new Date(meta.readAt),store:{read:async v=>{call=v;return raw();}}});
 const dto=await svc.summary({id:'16',permissions:rights});assert.equal(call.actorId,'16');assert.equal(call.date,meta.date);assert.equal(dto.meta.timeZone,'Europe/Istanbul');
 await assert.rejects(svc.summary({id:'16'}),{statusCode:403});
});
test('readonly actor14 sees sales, no finance or approvals; session and current revocation both restrict',()=>{
 const viewer=['sales.view','customer.view','supplier.view','product.view','dashboard.view'];
 const dto=homeSummaryDto(raw(homeCapabilities(viewer,rights)),meta);
 assert.equal(dto.capabilities.sales,true);assert.equal(dto.sections.finance.status,'forbidden');assert.deepEqual(dto.sections.finance.collections,[]);assert.equal(dto.sections.approvals.pendingCount,null);
 assert.equal(homeCapabilities(rights,[]).sales,false);assert.equal(homeCapabilities([],rights).goods,false);
});
test('money exact4 preserves zero/unknown and separates currency; rejects floats/duplicates/unsupported',()=>{
 const totals=homeCurrencyTotals([{currency:'USD',amountExact4:null,knownCount:'1',unknownCount:'1'},{currency:'TRY',amountExact4:'0.0000',knownCount:1,unknownCount:0}]);
 assert.equal(totals[0].amountExact4,'0.0000');assert.equal(totals[1].amountExact4,null);assert.equal(totals[2].knownCount,0);
 for(const row of [{currency:'GBP',amountExact4:'1.0000',knownCount:1,unknownCount:0},{currency:'TRY',amountExact4:1,knownCount:1,unknownCount:0},{currency:'TRY',amountExact4:'1.0000',knownCount:1,unknownCount:1}])assert.throws(()=>homeCurrencyTotals([row]),{statusCode:503});
 assert.throws(()=>homeCurrencyTotals([totals[0],totals[0]]),{statusCode:503});
});
test('goods-only capability remains genuine while LAB links are unavailable; count-cancel exact route',()=>{
 const r=raw(homeCapabilities(['goods.view'],['goods.view']));r.tasks=[{id:'daily:1',kind:'goods',state:'pending',date:null}];
 const dto=homeSummaryDto(r,meta);assert.equal(dto.capabilities.goods,true);assert.equal(dto.navigationReady.goods,false);assert.equal(dto.tasks[0].ready,false);
 const all=raw();all.tasks=[{id:'daily:2',kind:'count-cancel',state:'pending',date:meta.date}];assert.equal(homeSummaryDto(all,meta).tasks[0].target,'/is-akisi-taslagi.html#count-cancel');
 const missingProduct=homeSummaryDto(raw(homeCapabilities(rights.filter(k=>k!=='product.view'),rights)),meta);assert.equal(missingProduct.navigationReady.sales,false);
});
test('tasks fail closed on unknown targets/duplicate ids/excess; no invented cash or complete approval claim',()=>{
 const dto=homeSummaryDto(raw(),meta);assert.equal(dto.sections.finance.cash.status,'unavailable');assert.equal(dto.sections.approvals.complete,false);
 const r=raw();r.tasks=[{id:'daily:1',kind:'https://invalid',state:'pending',date:null}];assert.throws(()=>homeSummaryDto(r,meta),{statusCode:503});
 r.tasks=Array(6).fill({id:'daily:1',kind:'count',state:'pending',date:null});assert.throws(()=>homeSummaryDto(r,meta),{statusCode:503});
 r.tasks=r.tasks.slice(0,2);assert.throws(()=>homeSummaryDto(r,meta),{statusCode:503});
});
function runtime({identity={},roles,sets}={}){
 const calls=[],events=[];
 class Transaction{async begin(level){events.push(level);}async commit(){events.push('commit');}async rollback(){events.push('rollback');}}
 class Request{constructor(){this.inputs={};}input(k,t,v){this.inputs[k]=v;return this;}async query(q){calls.push({q,inputs:this.inputs});if(calls.length===1)return{recordset:[{db:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',login:'melisa_sirket_sales_test_20260929_01',databaseUser:'melisa_sirket_sales_test_20260929_01',sysadmin:0,control:0,live:0,...identity}]};if(calls.length===2)return{recordset:roles??rights.map(permissionKey=>({actorId:'16',permissionKey,canView:true}))};return{recordsets:sets??[[counts],[],[],[],[],[]]};}}
 return{calls,events,getRuntime:async()=>({pool:{},sql:{Transaction,Request,ISOLATION_LEVEL:{READ_COMMITTED:'read-committed'},BigInt:'bigint',Date:'date',Bit:'bit'}})};
}
test('read store uses three bounded reads READ_COMMITTED and actual can_view intersection',async()=>{
 const rt=runtime({roles:[{actorId:'14',permissionKey:'sales.view',canView:true},{actorId:'14',permissionKey:'finance.view',canView:false}]});
 const value=await createHomeSummaryReadStore(rt).read({actorId:'14',sessionPermissions:rights,date:meta.date});
 assert.equal(value.capabilities.sales,true);assert.equal(value.capabilities.finance,false);assert.equal(rt.calls.length,3);assert.equal(rt.calls[1].inputs.actor,'14');assert.equal(rt.calls[2].inputs.finance,false);assert.deepEqual(rt.events,['read-committed','commit']);
});
test('wrong identity and missing/inactive actor fail before aggregates; errors do not expose SQL',async()=>{
 for(const opts of [{identity:{live:1}},{identity:{db:'OTHER'}},{roles:[]}]){const rt=runtime(opts);await assert.rejects(createHomeSummaryReadStore(rt).read({actorId:'16',sessionPermissions:rights,date:meta.date}),e=>[403,503].includes(e.statusCode)&&!e.message.includes('OTHER'));assert.ok(rt.calls.length<3);assert.equal(rt.events.at(-1),'rollback');}
});
test('source query uses finalized header snapshot and reversals separately, bounded native tasks with correct date/flow',()=>{
 assert.match(HOME_SUMMARY_SQL,/DECLARE @HomeSales TABLE/);assert.match(HOME_SUMMARY_SQL,/SUM\(finalizedCount\)/);assert.match(HOME_SUMMARY_SQL,/FROM @HomeSales WHERE finalizedCount>0/);assert.match(HOME_SUMMARY_SQL,/TOP\(5\)/);assert.match(HOME_SUMMARY_SQL,/flow=N'count-cancel' THEN N'count-cancel'/);assert.match(HOME_SUMMARY_SQL,/Turkey Standard Time/);
 assert.doesNotMatch(HOME_SUMMARY_SQL,/sp_getapplock|SERIALIZABLE|UPDATE|DELETE|MERGE|INSERT\s+INTO|finance_accounts|current_balance|opening_balance/i);
 assert.doesNotMatch(HOME_SUMMARY_SQL,/N'sales-draft'|N'purchase-draft'/);
});
