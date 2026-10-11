import test from 'node:test';
import assert from 'node:assert/strict';
import {homeCapabilities,businessInboundHomeCapabilities,businessDailyHomeCapabilities,homeCurrencyTotals,homeDate,homeSummaryDto} from './homeSummaryModel.mjs';
import {createHomeSummaryService} from './homeSummaryService.mjs';
import {createHomeSummaryReadStore,HOME_SUMMARY_SQL,COPY_HOME_SUMMARY_SQL,BUSINESS_INBOUND_HOME_SUMMARY_SQL,BUSINESS_DAILY_HOME_SUMMARY_SQL} from './homeSummaryReadStore.mjs';
import {fixtureContext,fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {ISOLATED_COPY_FINITE_FK_SQL} from './isolatedOperationCopyStore.mjs';
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
function copyRuntime({wrongDB=false,deny=false,badProof=false,badFk=false,business=false,actorId='16',actualPermissions=rights,dailySets}={}){
 const copy=business?businessInboundFixture().copy:validateIsolatedOperationCopyContext(fixtureContext()),calls=[],events=[];
 class Transaction{async begin(level){events.push(level);}async commit(){events.push('commit');}async rollback(){events.push('rollback');}}
 class Request{constructor(){this.inputs={};}input(k,t,v){this.inputs[k]=v;return this;}async query(q){calls.push({q,inputs:this.inputs});if(q.startsWith('SELECT DB_NAME'))return{recordset:[{...fixtureIdentity(copy),...(wrongDB?{db:copy.sourceDatabase}:{})}]};if(q.includes('sp_getapplock')){assert.match(q,/@LockMode=N'Shared'/);assert.equal(this.inputs.lockKey,'melisa-stage4-copy:'+copy.copyId);return{recordset:[]};}if(q===ISOLATED_COPY_FINITE_FK_SQL)return{recordset:[['FK__test_good__produ__5654B625','test_goods_batch_lines'],['FK__test_purc__produ__69678A99','test_purchase_batch_intent_lines']].map(([constraintName,parentTable])=>({constraintName,parentSchema:'dbo',parentTable,parentColumn:'product_id',referencedSchema:'dbo',referencedTable:badFk?'test_purchase_batch_scope':'products',referencedColumn:'id',ordinal:1,columnCount:1,isDisabled:false,isNotTrusted:false,deleteAction:'NO_ACTION',updateAction:'NO_ACTION'}))};if(q===BUSINESS_DAILY_HOME_SUMMARY_SQL)return {recordsets:dailySets??[[{...counts,salesReturnCount:null}],[],[],[],[],[]]};assert.equal(q,business?BUSINESS_INBOUND_HOME_SUMMARY_SQL:COPY_HOME_SUMMARY_SQL);return {recordsets:[[business?{...counts,salesCount:null,salesCancelledCount:null,salesReturnCount:null,purchaseReturnCount:null,returnCancelledCount:null,countPendingCount:null,goodsPendingCount:'3',approvalPendingCount:actorId==='16'?'3':null}:counts],[],[],[],[],[business?{id:'goods-batch:41',kind:'goods',state:'pending',date:null}:{id:'sales-draft:51',kind:'sales-draft',state:'draft',date:copy.date}]]};}async execute(name){calls.push({name,inputs:this.inputs});if(name.endsWith('_ready'))return {recordset:[]};assert(name.endsWith('_context'));assert.equal(this.inputs.domain,business?'inbound':'daily');return {recordset:[{proof_json:JSON.stringify({...fixtureProof(copy),...(badProof?{sealHash:'wrong'}:{})}),actor_json:JSON.stringify({id:actorId,role:copy.actors.find(a=>a.id===actorId).role,active:true,permissions:deny?[]:actualPermissions}),context_json:JSON.stringify({meta:{date:copy.date,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin},scope:{synthetic:false,operationOrigin:copy.operationOrigin}})}]};}}
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'serializable'},BigInt:'bigint',UniqueIdentifier:'uuid',Date:'date',Char:n=>'char'+n,NVarChar:n=>'nvarchar'+n,Bit:'bit'};
 return {copy,calls,events,getRuntime:async()=>({copyContext:copy,pool:{},sql})};
}
test('copy HOME uses existing sealed gates once and bounded own journal summary on its sealed business day',async()=>{
 const rt=copyRuntime(),store=createHomeSummaryReadStore(rt),service=createHomeSummaryService({store,clock:()=>new Date('2026-10-09T00:00:00Z')}),dto=await service.summary({id:'16',permissions:rights});
 assert.equal(dto.meta.date,'2026-10-08');assert.equal(dto.meta.readAt,'2026-10-09T00:00:00.000Z');assert.equal(dto.meta.copyId,rt.copy.copyId);assert.equal(dto.meta.sealHash,rt.copy.sealHash);assert.equal(dto.sections.sales.count,0);assert.equal(dto.tasks[0].label,'Satış taslağı');assert.equal(rt.calls.filter(c=>c.q===COPY_HOME_SUMMARY_SQL).length,1);assert.equal(rt.calls.find(c=>c.q===COPY_HOME_SUMMARY_SQL).inputs.date,rt.copy.date);assert.deepEqual(rt.events,['serializable','commit']);
});
test('copy HOME rejects wrong identity, revoked actor permission and changed module proof before reading totals',async()=>{
 for(const options of [{wrongDB:true},{deny:true},{badProof:true},{badFk:true}]){const rt=copyRuntime(options);await assert.rejects(createHomeSummaryReadStore(rt).read({actorId:'16',sessionPermissions:rights,date:meta.date}));assert.equal(rt.calls.some(c=>c.q===COPY_HOME_SUMMARY_SQL),false);assert.equal(rt.events.at(-1),'rollback');}
});
test('copy HOME owners and amounts require exact copy journal/effect bindings and do not mix restored history',()=>{
 assert.match(COPY_HOME_SUMMARY_SQL,/j.copy_id=@copy_id/g);assert.match(COPY_HOME_SUMMARY_SQL,/effect_json COLLATE Latin1_General_100_BIN2=\(SELECT m\.\* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES\)/);assert.match(COPY_HOME_SUMMARY_SQL,/GROUP BY h.document_currency/);assert.match(COPY_HOME_SUMMARY_SQL,/GROUP BY currency/);assert.match(COPY_HOME_SUMMARY_SQL,/TOP\(5\)/);assert.match(COPY_HOME_SUMMARY_SQL,/j.operation=N'count_create'/);assert.match(COPY_HOME_SUMMARY_SQL,/j.operation=N'purchase_draft'/);assert.doesNotMatch(COPY_HOME_SUMMARY_SQL,/UPDATE|DELETE|MERGE|INSERT dbo|CREATE TABLE dbo|finance_accounts|opening_balance|migration_run_id/i);
});
test('copy SQL table variables do not collide with case-insensitive native capability parameters',()=>{
 const parameters=new Set(['copy_id','date','sales','goods','purchase','finance','count','approval','approve_goods','sales_return','purchase_return']);
 const declarations=[...COPY_HOME_SUMMARY_SQL.matchAll(/DECLARE\s+@([A-Za-z]+)\s+TABLE/g)].map(m=>m[1].toLowerCase());assert(declarations.length>0);assert.equal(new Set(declarations).size,declarations.length);for(const declaration of declarations)assert.equal(parameters.has(declaration),false,declaration);
});
test('business HOME reads inbound owner proof and keeps supported goods workflow ready without sales/product grants',async()=>{
 for(const actorId of ['15','16']){
  const rt=copyRuntime({business:true,actorId}),service=createHomeSummaryService({store:createHomeSummaryReadStore(rt),clock:()=>new Date('2026-10-10T00:00:00Z')}),dto=await service.summary({id:actorId,permissions:rights});
  assert.equal(dto.meta.scopeKind,'VERIFIED_BUSINESS_TEST');assert.equal(dto.meta.date,rt.copy.date);assert.equal(dto.navigationReady.goods,true);assert.equal(dto.tasks[0].ready,true);assert.equal(dto.sections.goods.pendingCount,3);
  for(const key of ['sales','collection','customer','finance','payment','count','returns'])assert.equal(dto.capabilities[key],false,key);assert.equal(dto.capabilities.product,true);assert.equal(dto.navigationReady.product,true);
  for(const key of ['sales','finance','counts','refunds'])assert.equal(dto.sections[key].status,'unavailable',key);assert.equal(dto.sections.sales.count,null);assert.equal(dto.sections.refunds.purchaseCount,null);assert.deepEqual(dto.sections.finance.collections,[]);
  assert.equal(dto.navigationReady.purchase,actorId==='16');assert.equal(dto.navigationReady.supplier,actorId==='16');assert.equal(dto.capabilities.approval,actorId==='16');if(actorId==='16')assert.deepEqual(dto.sections.approvals.sourceCoverage,['goods']);
  assert.equal(rt.calls.filter(c=>c.q===BUSINESS_INBOUND_HOME_SUMMARY_SQL).length,1);assert.equal(rt.calls.some(c=>c.q===COPY_HOME_SUMMARY_SQL),false);assert.deepEqual(rt.events,['serializable','commit']);
 }
 const revoked=businessInboundHomeCapabilities(rights.filter(r=>r!=='goods.view'),rights,'16');assert.equal(revoked.goods,false);assert.equal(businessInboundHomeCapabilities(rights,rights,'15').purchase,false);
 assert.equal(businessInboundHomeCapabilities(rights.filter(r=>r!=='product.view'),rights,'16').product,false);assert.equal(businessInboundHomeCapabilities(rights,rights.filter(r=>r!=='product.view'),'15').product,false);
});
test('business HOME journal scope excludes financial/source history and exposes no invented money or unsupported pending counts',async()=>{
 assert.match(BUSINESS_INBOUND_HOME_SUMMARY_SQL,/j\.copy_id=@copy_id/g);assert.match(BUSINESS_INBOUND_HOME_SUMMARY_SQL,/work_business_count_bindings/);assert.match(BUSINESS_INBOUND_HOME_SUMMARY_SQL,/c\.created_by=@actor OR @actor=16/);assert.match(BUSINESS_INBOUND_HOME_SUMMARY_SQL,/TOP\(5\)/);
 assert.doesNotMatch(BUSINESS_INBOUND_HOME_SUMMARY_SQL,/sales_invoices|customer_movements|supplier_movements|finance_accounts|test_daily_drafts|invoice_returns|UPDATE|DELETE|MERGE|INSERT dbo/i);
 for(const options of [{wrongDB:true},{deny:true},{badProof:true},{badFk:true}]){const rt=copyRuntime({...options,business:true});await assert.rejects(createHomeSummaryReadStore(rt).read({actorId:'16',sessionPermissions:rights,date:meta.date}));assert.equal(rt.calls.some(c=>c.q===BUSINESS_INBOUND_HOME_SUMMARY_SQL),false);assert.equal(rt.events.at(-1),'rollback');}
});
test('registered daily HOME reads copy-owned sales for role15 without finance or approval grants',async()=>{
 const staff=['goods.view','goods.create','product.view','purchase.view','sales.view','sales.create','sales.finalize','sales.cancel','customer.view'];
 const rt=copyRuntime({business:true,actorId:'15',actualPermissions:staff});let reads=0;
 const getDailySelection=copy=>{assert.equal(copy,rt.copy);assert(rt.calls.some(c=>c.name?.endsWith('_ready')));assert(rt.calls.some(c=>c.name?.endsWith('_context')));reads++;return {productIds:['34765']};};
 const dto=await createHomeSummaryService({store:createHomeSummaryReadStore({...rt,getDailySelection,getDailyScopeHash:()=> 'A'.repeat(64)}),clock:()=>new Date(meta.readAt)}).summary({id:'15',permissions:staff});
 assert.equal(reads,1);for(const key of ['sales','customer','product','goods','returns'])assert.equal(dto.navigationReady[key],true,key);
 for(const key of ['finance','collection','payment','count','approval','supplier','purchase'])assert.equal(dto.capabilities[key],false,key);
 assert.equal(dto.sections.sales.status,'available');assert.equal(dto.sections.sales.count,0);assert.equal(dto.sections.finance.status,'forbidden');assert.deepEqual(dto.sections.finance.collections,[]);assert.equal(dto.sections.counts.pendingCount,null);assert.equal(dto.sections.refunds.salesCount,null);
 assert.equal(rt.calls.filter(c=>c.q===BUSINESS_DAILY_HOME_SUMMARY_SQL).length,1);assert.equal(rt.calls.some(c=>c.q===COPY_HOME_SUMMARY_SQL),false);
});
test('verified daily links still require current permission AND session; inbound approval remains separate',()=>{
 for(const removeFrom of ['actual','session']){
  const actual=removeFrom==='actual'?rights.filter(k=>k!=='sales.view'&&k!=='finance.view'&&k!=='stock.adjust'):rights;
  const session=removeFrom==='session'?rights.filter(k=>k!=='sales.view'&&k!=='finance.view'&&k!=='stock.adjust'):rights;
  const capabilities=businessDailyHomeCapabilities(actual,session,'16');
  for(const key of ['sales','finance','collection','payment','count','salesReturn'])assert.equal(capabilities[key],false,key);
 }
 assert.equal(businessDailyHomeCapabilities(rights,rights,'15').approval,false);
 assert.equal(businessDailyHomeCapabilities(rights,rights,'16').approveGoods,true);
 const capabilities=businessDailyHomeCapabilities(rights,rights,'16');
 const dto=homeSummaryDto({...raw(capabilities),counts:{...counts,salesReturnCount:null},copyMeta:{scopeKind:'VERIFIED_BUSINESS_TEST',dailySelectionReady:true}},meta);
 assert.equal(dto.navigationReady.collection,true);assert.equal(dto.navigationReady.count,true);assert.equal(dto.sections.finance.cash.status,'unavailable');assert.equal(dto.sections.approvals.complete,false);assert.deepEqual(dto.sections.approvals.sourceCoverage,['goods','count','purchase-return']);
});
test('daily selection is never read before failed SQL identity/registry/read proof/actor/FK gates',async()=>{
 for(const bad of [{wrongDB:true},{badProof:true},{deny:true},{badFk:true}]){
  const rt=copyRuntime({...bad,business:true});let called=false;
  await assert.rejects(createHomeSummaryReadStore({...rt,getDailySelection:()=>{called=true;return {};}}).read({actorId:'16',sessionPermissions:rights,date:meta.date}));
  assert.equal(called,false);assert.equal(rt.calls.some(c=>c.q===BUSINESS_INBOUND_HOME_SUMMARY_SQL),false);
 }
});

const dailyStore=rt=>createHomeSummaryReadStore({...rt,getDailySelection:()=>({productIds:['34765']}),getDailyScopeHash:()=> 'A'.repeat(64)});
test('registered business daily summary consumes six typed sets with precise money, supported refunds and pending work on sealed day',async()=>{
 const money=[{currency:'TRY',knownCount:'2',unknownCount:'0',amountExact4:'9007199254740993.1234'},{currency:'USD',knownCount:'1',unknownCount:'0',amountExact4:'10.1000'},{currency:'EUR',knownCount:'0',unknownCount:'1',amountExact4:null}];
 const rt=copyRuntime({business:true,dailySets:[[{...counts,salesCount:'2',salesCancelledCount:'1',salesReturnCount:null,purchaseReturnCount:'1',returnCancelledCount:'2',countPendingCount:'3',goodsPendingCount:'4',approvalPendingCount:'8'}],money,money,money,money,[{id:'daily:501',kind:'count',state:'pending',date:'2026-10-09'},{id:'daily:502',kind:'return-purchase',state:'pending',date:'2026-10-09'},{id:'sales-draft:601',kind:'sales-draft',state:'draft',date:'2026-10-09'}]]});
 const dto=await createHomeSummaryService({store:dailyStore(rt),clock:()=>new Date('2026-10-11T21:30:00Z')}).summary({id:'16',permissions:rights});
 assert.equal(dto.meta.date,'2026-10-09');assert.equal(dto.meta.currentDate,'2026-10-12');assert.equal(dto.meta.dateBasis,'sealed-copy-date');assert.equal(dto.meta.readAt,'2026-10-11T21:30:00.000Z');assert.equal(dto.sections.sales.count,2);assert.equal(dto.sections.sales.cancelledCount,1);assert.equal(dto.sections.sales.currencyTotals[0].amountExact4,'9007199254740993.1234');assert.equal(dto.sections.finance.payments[1].amountExact4,'10.1000');assert.equal(dto.sections.finance.collections[2].amountExact4,null);assert.equal(dto.sections.finance.cash.status,'unavailable');assert.deepEqual(dto.sections.finance.cash.currencyTotals,[]);assert.deepEqual(dto.sections.refunds,{status:'available',salesCount:null,purchaseCount:1,cancelledCount:2});assert.equal(dto.sections.counts.pendingCount,3);assert.equal(dto.sections.approvals.pendingCount,8);assert(dto.tasks.every(t=>t.ready));
 const q=rt.calls.find(c=>c.q===BUSINESS_DAILY_HOME_SUMMARY_SQL);assert.equal(q.inputs.date,rt.copy.date);assert.equal(q.inputs.actor,'16');assert.equal(q.inputs.seal_hash,rt.copy.sealHash);assert.equal(q.inputs.daily_scope_hash,'A'.repeat(64));assert.equal(q.inputs.collection,true);assert.equal(q.inputs.payment,true);assert.deepEqual(rt.events,['serializable','commit']);
});

test('business actor15 cannot gain financial or approval data from an overbroad permission snapshot or raw result',async()=>{
 const rt=copyRuntime({business:true,actorId:'15',dailySets:[[{...counts,salesCount:'1',salesReturnCount:null}],[],[{currency:'TRY',amountExact4:'999.0000',knownCount:1,unknownCount:0}],[{currency:'USD',amountExact4:'888.0000',knownCount:1,unknownCount:0}],[],[]]});
 const dto=await createHomeSummaryService({store:dailyStore(rt),clock:()=>new Date(meta.readAt)}).summary({id:'15',permissions:rights});
 for(const key of ['finance','collection','payment','approval'])assert.equal(dto.capabilities[key],false,key);assert.equal(dto.sections.finance.status,'forbidden');assert.deepEqual(dto.sections.finance.collections,[]);assert.deepEqual(dto.sections.finance.payments,[]);assert.equal(dto.sections.approvals.pendingCount,null);assert.equal(dto.sections.sales.count,1);const q=rt.calls.find(c=>c.q===BUSINESS_DAILY_HOME_SUMMARY_SQL);assert.equal(q.inputs.actor,'15');assert.equal(q.inputs.finance,false);assert.equal(q.inputs.collection,false);assert.equal(q.inputs.payment,false);
});

test('business daily money capabilities require specific current AND session permissions, and a missing registered scope hash fails before query',async()=>{
 for(const key of ['finance.collection','finance.payment'])for(const side of ['actual','session']){const actual=side==='actual'?rights.filter(x=>x!==key):rights,session=side==='session'?rights.filter(x=>x!==key):rights,rt=copyRuntime({business:true,actualPermissions:actual});const dto=await createHomeSummaryService({store:dailyStore(rt),clock:()=>new Date(meta.readAt)}).summary({id:'16',permissions:session});assert.equal(dto.capabilities[key==='finance.collection'?'collection':'payment'],false);assert.deepEqual(dto.sections.finance[key==='finance.collection'?'collections':'payments'],[]);}
 const rt=copyRuntime({business:true});await assert.rejects(createHomeSummaryReadStore({...rt,getDailySelection:()=>({productIds:['34765']})}).read({actorId:'16',sessionPermissions:rights,date:meta.date}),{statusCode:503});assert(!rt.calls.some(q=>q.q===BUSINESS_DAILY_HOME_SUMMARY_SQL));assert.equal(rt.events.at(-1),'rollback');
});

test('daily SQL excludes foreign copy, wrong scope, actors, body/proof identity and changed native effects before aggregation; no persistent mutation or cash opening',()=>{
 const q=BUSINESS_DAILY_HOME_SUMMARY_SQL;
 for(const needle of ['d.name=N\'dbo.usp_stage4_copy_context\'','d.revision=4','d.base_seal_hash=@seal_hash',"HASHBYTES('SHA2_256',d.daily_profile_json)",'j.copy_id=@copy_id','j.actor_id=@actor OR @actor=16',"'$.businessDailyScopeHash')=@daily_scope_hash","HASHBYTES('SHA2_256',j.payload_json)","'$.payloadHash')=j.payload_hash","'$.actorId')=CONVERT(varchar(20),j.actor_id)",'l.request_id=j.request_id','l.actor_id=j.actor_id'])assert(q.includes(needle),needle);
 for(const flag of ['valid','stockVerified','partyAccountsVerified','financeAccountsVerified','protectedRowsVerified'])assert(q.includes(`JSON_VALUE(j.effect_proof_json,'$.${flag}')=N'true'`),flag);
 for(const needle of ["j.operation=N'sale_draft'","j.operation=N'sale_finalize'","j.operation=N'collection_create'","j.operation=N'collection_cancel'","j.operation=N'payment'","j.operation=N'payment_cancel'","j.operation=N'stock_count_draft'","j.operation=N'purchase_return_draft'",'s.accountId=m.party_currency_account_id','s.partyId=m.party_entity_id','m.created_by=j.actor_id','e.copy_id=@copy_id','cash.request_id=j.request_id','f.party_movement_id=m.id','f.account_id','e.effect_json COLLATE Latin1_General_100_BIN2=(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)','cash.effect_json COLLATE Latin1_General_100_BIN2=(SELECT f.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)','@actor=16 AND @finance=1 AND @collection=1','@actor=16 AND @finance=1 AND @payment=1','COUNT_BIG(*)-COUNT(amount)','h.document_date=@date','GROUP BY h.document_currency','GROUP BY currency','TOP(5)'])assert(q.includes(needle),needle);
 assert.doesNotMatch(q,/\b(?:UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|EXEC|EXECUTE|GRANT|DENY|REVOKE)\b|INSERT\s+(?:INTO\s+)?dbo\.|finance_accounts|opening_balance|current_balance/i);
 const tableNames=[...q.matchAll(/DECLARE\s+(@\w+)\s+TABLE/g)].map(m=>m[1]);assert(tableNames.length>=7);assert([...q.matchAll(/INSERT\s+(@\w+)/g)].every(m=>tableNames.includes(m[1])));assert(!tableNames.some(n=>['@sales','@purchase','@finance','@count','@approval','@goods'].includes(n.toLowerCase())));
});

test('staff visibility follows document creation ownership while an office decision can verify the current state of the same owned document',()=>{
 const q=BUSINESS_DAILY_HOME_SUMMARY_SQL;
 for(const operation of ['sale_draft','count_create','count_submit','purchase_draft'])assert(q.includes(`FROM @HomeJournal j WHERE (j.actor_id=@actor OR @actor=16) AND j.operation=N'${operation}'`),operation);
 assert(q.includes("FROM @HomeJournal j WHERE (j.actor_id=@actor OR @actor=16) AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.id'))=d.id AND d.created_by=j.actor_id"));
 assert(q.includes("WHERE j.operation=N'sale_finalize' AND TRY_CONVERT(bigint,JSON_VALUE(j.payload_json,'$.id'))=h.id"));assert(q.includes("FROM @HomeJournal j WHERE j.operation=N'sale_cancel' AND TRY_CONVERT(bigint,JSON_VALUE(j.payload_json,'$.id'))=h.id"));
 assert(q.includes('m.sales_invoice_id=h.id AND m.customer_id=h.customer_id'));assert(q.includes('h.created_by=j.actor_id AND l.request_id=j.request_id AND l.actor_id=j.actor_id'));
});
