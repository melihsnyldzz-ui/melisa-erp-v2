import test from 'node:test';
import assert from 'node:assert/strict';
import {CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
import {CLEAN_COLLECTION_TABLES,cleanCollectionDependencies,createCleanStoreDayCollectionReadPreparation} from './cleanStoreDayCollectionPreparation.mjs';
import {workHash} from './workSalesModel.mjs';

const rights=['customer.view','finance.view','finance.collection'];
const actor={id:'15',role:{code:'clean_test_sales'},permissions:rights};
// Hypothetical offline readiness, NOT an installed role, cash opening or grant.
function fixture(){
 const c={identity:{databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,
  sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID,synthetic:true,actualT1:false,externalOperations:false},
 tableNames:[...CLEAN_COLLECTION_TABLES],actors:[{id:'15',roleCode:'clean_test_sales',active:true,roleActive:true,isAdmin:false,permissions:[...rights]}],
 accounts:[{id:'1',currency:'TRY',type:'cash',active:true,synthetic:true,environmentId:CLEAN_ENVIRONMENT_ID}],
 source:{orderId:'3',orderRequestId:'45064956-9c91-470f-a7b6-a9330b60e456',invoiceId:'1',customerId:'1',creatorId:'15',approverId:'17',currency:'TRY',totalExact4:'376.5000'},
 context:{meta:{date:'2026-10-22',environmentId:CLEAN_ENVIRONMENT_ID},scope:{synthetic:true,customer:{id:'1',currency:'TRY',synthetic:true},accounts:[]}},
 record:{id:'1',customerId:'1',currency:'TRY',status:'finalized',grandTotalExact4:'376.5000',collections:{receivedExact4:'0.0000',outstandingExact4:'376.5000',revision:workHash({invoiceId:'1',items:[]}),items:[]}},
 protected:{stock:'23.000',supplierBalance:'120.0000',customerBalance:'376.5000',oldInvoiceCount:1,orderCount:3,collectionCount:0},reads:0};
 c.context.scope.accounts=c.accounts;
 c.invoice=async()=>structuredClone(c.record);
 const service=createCleanStoreDayCollectionReadPreparation({withReadContext:async(a,fn)=>{c.reads++;return fn(c);}});
 return {c,service};
}
const selection={invoiceId:'1',accountId:'1',amountExact4:'376.5000',documentDate:'2026-10-22'};

test('actual observed missing finance schema, cash and collector remain explicit dependencies; no defaults',async()=>{
 const {c,service}=fixture();c.tableNames=[];c.accounts=[];c.context.scope.accounts=[];c.actors[0].permissions=['customer.view'];
 const result=await service.inspect({...actor,permissions:['customer.view']});
 assert.deepEqual(result.missingTables,[...CLEAN_COLLECTION_TABLES]);assert.deepEqual(result.actorIds,[]);assert.deepEqual(result.accountIds,[]);
 assert.deepEqual(result.blockers,['FINANCE_SCHEMA_MISSING','COLLECTOR_ROLE_MISSING','SYNTHETIC_TRY_CASH_MISSING','NATIVE_COLLECTION_SCOPE_NOT_INSTALLED']);
 assert.equal(result.canCollect,false);assert.equal(result.readOnly,true);
 await assert.rejects(()=>service.preview(selection,actor),{code:'CLEAN_COLLECTION_PREPARATION_REQUIRED'});
 assert.throws(()=>createCleanStoreDayCollectionReadPreparation(),{statusCode:503});
});

test('existing collection calculator prepares exact TRY amount/revision; every exposed capability stays read only',async()=>{
 const {service,c}=fixture(),before=structuredClone(c.protected);
 const p=await service.preview(selection,actor),again=await service.preview(selection,actor);
 assert.equal(p.amountExact4,'376.5000');assert.equal(p.receivedAfterExact4,'376.5000');assert.equal(p.outstandingAfterExact4,'0.0000');
 assert.equal(p.previewHash,again.previewHash);assert.equal(p.revision,c.record.collections.revision);assert.equal(p.readOnly,true);assert.equal(p.canCollect,false);
 const context=await service.context({invoiceId:'1'},actor);assert.deepEqual(context.capabilities,{canCollect:false,canCancelCollection:false});
 assert.deepEqual(c.protected,before);assert.equal((await service.inspect(actor)).blockers.at(-1),'NATIVE_COLLECTION_SCOPE_NOT_INSTALLED');
});

test('wrong target, privilege drift, external access and non-synthetic identity fail before invoice access',async()=>{
 for(const change of [c=>c.identity.databaseName='MELISA_ERP_SIRKET_TEST_20260929_01',c=>c.identity.serverName='OTHER',
  c=>c.identity.environmentId='00000000-0000-4000-8000-000000000000',c=>c.identity.loginName='admin',
  c=>c.identity.sysadmin=1,c=>c.identity.databaseControl=1,c=>c.identity.originalDatabaseAccess=1,c=>c.identity.liveDatabaseAccess=1]){
  const {c,service}=fixture();change(c);c.invoice=async()=>assert.fail('Invoice must not be read');
  await assert.rejects(()=>service.preview(selection,actor),{code:'CLEAN_TEST_IDENTITY_REJECTED'});
 }
 for(const change of [c=>c.identity.synthetic=false,c=>c.identity.actualT1=true,c=>c.identity.externalOperations=true]){
  const {c,service}=fixture();change(c);await assert.rejects(()=>service.preview(selection,actor),{code:'CLEAN_COLLECTION_PREPARATION_REQUIRED'});
 }
});

test('fresh actual actor/role and auth rights must intersect; admin/old actor alias supplies no authority',async()=>{
 for(const change of [c=>c.actors[0].active=false,c=>c.actors[0].roleActive=false,c=>c.actors[0].isAdmin=true,
  c=>c.actors[0].roleCode='admin',c=>c.actors[0].id='16',c=>c.actors[0].permissions=['customer.view'],c=>c.actors.push({...c.actors[0]})]){
  const {c,service}=fixture();change(c);await assert.rejects(()=>service.preview(selection,actor));
 }
 const {service,c}=fixture();await service.preview(selection,actor);c.actors[0].permissions=['customer.view'];
 await assert.rejects(()=>service.preview(selection,actor),{statusCode:503});
 for(const a of [{...actor,permissions:['customer.view']},{...actor,isAdmin:true},{...actor,testAdminSession:true},{...actor,id:'16'}])await assert.rejects(()=>service.preview(selection,a));
});

test('cash must be unique/current/TRY/synthetic in this environment; unknown opening is never invented',async()=>{
 for(const change of [c=>c.accounts[0].currency='USD',c=>c.accounts[0].type='bank',c=>c.accounts[0].active=false,
  c=>c.accounts[0].synthetic=false,c=>c.accounts[0].environmentId='other',c=>c.accounts.push({...c.accounts[0]}),
  c=>c.context.scope.accounts=[{...c.accounts[0],id:'99'}],c=>c.context.scope.accounts=[]]){
  const {c,service}=fixture();change(c);await assert.rejects(()=>service.preview(selection,actor));
 }
 const {service,c}=fixture();await service.preview(selection,actor);assert.equal(Object.hasOwn(c.accounts[0],'openingBalance'),false);
});

test('only exact existing order3-sale1-customer1 TRY debt; history or source drift requires new read',async()=>{
 for(const change of [c=>c.source.orderId='2',c=>c.source.orderRequestId='other',c=>c.source.creatorId='16',c=>c.source.approverId='19',
  c=>c.record.id='2',c=>c.record.customerId='2',c=>c.record.currency='USD',c=>c.record.status='draft',
  c=>c.record.grandTotalExact4='400.0000',c=>c.record.collections.outstandingExact4='376.4900',
  c=>c.context.meta.date='2026-10-23',c=>c.context.scope.customer.synthetic=false,c=>c.context.scope.customer.currency='USD']){
  const {c,service}=fixture();change(c);await assert.rejects(()=>service.preview(selection,actor),{code:'CLEAN_COLLECTION_SOURCE_CHANGED'});
 }
 const {service}=fixture();await assert.rejects(()=>service.context({invoiceId:'2'},actor),{code:'CLEAN_COLLECTION_SOURCE_CHANGED'});
});

test('existing domain rejects overcollection, wrong date/account/currency and invalid exact amounts',async()=>{
 const {service}=fixture();
 for(const input of [{...selection,amountExact4:'376.5001'},{...selection,amountExact4:'0.0000'},
  {...selection,amountExact4:'-1.0000'},{...selection,amountExact4:'1.00'},
  {...selection,accountId:'2'},{...selection,invoiceId:'2'},{...selection,documentDate:'2026-10-23'},
  {...selection,currency:'USD'},{...selection,role:'admin'}])await assert.rejects(()=>service.preview(input,actor));
});

test('partial collection history is read afresh, matched to invoice and never silently treated as zero',async()=>{
 const {service,c}=fixture(),p=await service.preview(selection,actor);
 const item={id:'1',invoiceId:'1',currency:'TRY',status:'active',amountExact4:'100.0000'};
 c.record.collections={receivedExact4:'100.0000',outstandingExact4:'276.5000',items:[item],revision:workHash(item)};
 const next=await service.preview({...selection,amountExact4:'276.5000'},actor);
 assert.notEqual(next.previewHash,p.previewHash);assert.equal(next.receivedAfterExact4,'376.5000');assert.equal(next.outstandingAfterExact4,'0.0000');
 await assert.rejects(()=>service.preview(selection,actor),{code:'WORK_COLLECTION_EXCESS'});
 for(const items of [[],[item,item],[{...item,invoiceId:'2'}],[{...item,currency:'USD'}],[{...item,status:'cancelled'}]]){
  c.record.collections.items=items;await assert.rejects(()=>service.preview({...selection,amountExact4:'1.0000'},actor),{code:'CLEAN_COLLECTION_SOURCE_CHANGED'});
 }
});

test('double click, refresh/retry, same UUID/different body and uncertain response cannot reach a writer in this slice',async()=>{
 const {service,c}=fixture(),before=structuredClone(c.protected),p=await service.preview(selection,actor),reads=c.reads;
 const body={...selection,requestId:'a2a49b48-3696-4f2d-b237-e519af1e1b88',previewHash:p.previewHash,expectedRevision:p.revision};
 for(const input of [body,body,{...body,amountExact4:'100.0000'},body])await assert.rejects(()=>service.collect(input,actor),{code:'CLEAN_COLLECTION_READ_ONLY',statusCode:403});
 await assert.rejects(()=>service.cancel('1',body,actor),{code:'CLEAN_COLLECTION_READ_ONLY',statusCode:403});
 assert.equal(c.reads,reads);assert.deepEqual(c.protected,before);assert.equal(c.record.collections.receivedExact4,'0.0000');
 // This proves write rejection, NOT a successful native collection/replay.
});
