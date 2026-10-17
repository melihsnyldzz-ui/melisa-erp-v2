import test from 'node:test';

import {selectedSourceCollectionFixture as fixture,selectedSourceCollector as collector,selectedSourceRequestId as uuid} from './businessSelectedSaleCollectionPreparation.test-fixture.mjs';
import assert from 'node:assert/strict';
import {createBusinessSelectedSaleCollectionPreparation,isBusinessSelectedSaleCollectionPreparationService,prepareBusinessSelectedSaleCollection,SOURCE_COLLECTION_ACCOUNT_SQL} from './businessSelectedSaleCollectionPreparation.mjs';

async function pay(f,n,amount){const selection=f.selection(amount),p=await f.service.preview(selection,collector()),body={...selection,requestId:uuid(n),expectedRevision:p.revision,previewHash:p.previewHash};return {body,response:await f.service.collect(body,collector())};}

test('SOURCE preparation separately proves creator15 and fresh collector16 without enabling existing runtime capabilities',async()=>{
 const f=fixture(),p=await prepareBusinessSelectedSaleCollection(f.c,collector(),'1000');
 assert.equal(isBusinessSelectedSaleCollectionPreparationService(f.service),true);assert(Object.isFrozen(f.service));assert.equal(isBusinessSelectedSaleCollectionPreparationService({...f.service}),false);
 assert.equal(p.proof.creatorId,'15');assert.equal(p.proof.collectorId,'16');assert.equal(p.proof.customerAccountId,f.copy.customers[0].accountId);assert.equal(p.proof.preparationOnly,true);
 assert.equal(p.context.capabilities.canCollect,true);assert.equal(f.context.capabilities.canCollect,false);assert.equal(f.context.capabilities.canCancelCollection,false);assert.equal(f.row.actor_id,'15');assert.equal(f.row.createdBy,'15');
 assert.equal((await f.service.context({invoiceId:'1000'},collector())).invoice.id,'1000');assert.equal(f.state().requests.size,0);
});

test('SOURCE partial/full/cancel executes existing collection service arithmetic and isolated journal replay with no stock effects',async()=>{
 const f=fixture(),first=await pay(f,2,'5.0000');assert.equal(first.response.invoice.collections.outstandingExact4,'19.0000');assert.equal(f.state().cash,50000n);
 const full=await pay(f,3,'19.0000');assert.equal(full.response.invoice.collections.outstandingExact4,'0.0000');assert.equal(f.state().customerDebt,0n);
 assert.equal((await f.service.collect(first.body,collector())).replayed,true);assert.equal((await f.service.collect(full.body,collector())).replayed,true);assert.equal(f.events.filter(e=>e==='collect').length,2);
 const r=await f.c.collection(full.response.collection.id),cancel={requestId:uuid(4),expectedRevision:r.revision,documentDate:f.copy.date,reason:'Offline source cancellation'};
 assert.equal((await f.service.cancel(r.id,cancel,collector())).invoice.collections.outstandingExact4,'19.0000');assert.equal((await f.service.cancel(r.id,cancel,collector())).replayed,true);
 const r2=await f.c.collection(first.response.collection.id);await f.service.cancel(r2.id,{...cancel,requestId:uuid(5),expectedRevision:r2.revision},collector());assert.equal(f.state().customerDebt,240000n);assert.equal(f.state().cash,0n);assert.equal(f.state().stockEffects,0);assert.equal(f.events.filter(e=>e==='reverse').length,2);
});

test('SOURCE overpayment, stale preview and different-body UUID never create another effect',async()=>{
 const f=fixture(),s=f.selection('5.0000'),old=await f.service.preview(s,collector());const first=await pay(f,2,'5.0000');
 await assert.rejects(f.service.collect({...s,requestId:uuid(3),expectedRevision:old.revision,previewHash:old.previewHash},collector()),{code:'WORK_STALE'});
 await assert.rejects(f.service.collect({...first.body,amountExact4:'6.0000'},collector()),{code:'PREPARATION_UUID_CONFLICT'});
 await assert.rejects(f.service.preview(f.selection('20.0000'),collector()),{code:'WORK_COLLECTION_EXCESS'});
 assert.equal(f.state().requests.size,1);assert.equal(f.events.filter(e=>e==='collect').length,1);
});

test('SOURCE creator15, wrong collector, admin session and revoked current rights fail before source or replay',async()=>{
 for(const actor of [{...collector(),id:'15',role:{code:'isolated_test_sales'}},{...collector(),id:'17'},{...collector(),testAdminSession:true},{...collector(),role:{code:'admin'}},{...collector(),permissions:collector().permissions.filter(k=>k!=='customer.view')}]){const f=fixture();await assert.rejects(f.service.context({invoiceId:'1000'},actor),{statusCode:403});assert(!f.events.includes('source'));}
 const f=fixture(),first=await pay(f,2,'5.0000');f.actual.rights=f.actual.rights.filter(k=>k!=='finance.collection');f.events.length=0;
 await assert.rejects(f.service.collect(first.body,collector()),{statusCode:403});assert(!f.events.includes('journal'));assert(!f.events.includes('collect'));
});

test('SOURCE disabled current role and cancellation-right revocation cannot borrow creator authority',async()=>{
 for(const key of ['active','roleActive']){const f=fixture();f.actual[key]=false;await assert.rejects(f.service.context({invoiceId:'1000'},collector()),{statusCode:403});assert.equal(f.state().requests.size,0);}
 const f=fixture(),p=await pay(f,2,'5.0000'),r=await f.c.collection(p.response.collection.id);f.actual.rights=f.actual.rights.filter(k=>k!=='finance.collection.cancel');
 await assert.rejects(f.service.cancel(r.id,{requestId:uuid(3),expectedRevision:r.revision,documentDate:f.copy.date,reason:'Offline cancellation'},collector()),{statusCode:403});assert.equal(f.events.filter(e=>e==='reverse').length,0);
});

test('SOURCE current account absence, disabled, currency or type drift blocks preview and replay before journal',async()=>{
 const changes=[f=>f.actual.accounts=[],f=>f.actual.accounts[0].isActive=false,f=>f.actual.accounts[0].currency='USD',f=>f.actual.accounts[0].type='bank',f=>f.actual.accounts[0].type='other',f=>f.actual.accounts[0].id='999',f=>f.actual.accounts.push({...f.actual.accounts[0]})];
 for(const change of changes){const f=fixture(),first=await pay(f,2,'5.0000');change(f);f.events.length=0;
  await assert.rejects(f.service.preview(f.selection('1.0000'),collector()),{code:'SOURCE_COLLECTION_PREPARATION_ACCOUNT'});
  await assert.rejects(f.service.collect(first.body,collector()),{code:'SOURCE_COLLECTION_PREPARATION_ACCOUNT'});
  const original=await f.c.collection(first.response.collection.id);
  await assert.rejects(f.service.cancel(original.id,{requestId:uuid(3),expectedRevision:original.revision,documentDate:f.copy.date,reason:'Offline account drift'},collector()),{code:'SOURCE_COLLECTION_PREPARATION_ACCOUNT'});
  assert(!f.events.includes('journal'));assert(!f.events.includes('collect'));assert(!f.events.includes('reverse'));assert.equal(f.state().requests.size,1);assert.equal(f.state().cash,50000n);
 }
 assert.match(SOURCE_COLLECTION_ACCOUNT_SQL,/WITH\(HOLDLOCK\) WHERE a.id=@account/);
});

test('SOURCE foreign invoice, account/currency and transaction substitution fail closed',async()=>{
 const f=fixture();await assert.rejects(f.service.context({invoiceId:'1001'},collector()));assert.equal(f.state().requests.size,0);
 await assert.rejects(f.service.preview({...f.selection('1.0000'),accountId:'999'},collector()),{code:'WORK_COLLECTION_SCOPE'});
 await assert.rejects(f.service.preview({...f.selection('1.0000'),documentDate:'2026-10-10'},collector()),{code:'WORK_DATE_SCOPE'});
 for(const change of [f=>f.context.scope.accounts[0].currency='USD',f=>f.context.scope.customer.accountId='999',f=>f.c.transaction={},f=>f.row.currency='USD',f=>f.row.accountCurrency='USD']){const f=fixture();change(f);await assert.rejects(f.service.context({invoiceId:'1000'},collector()));assert.equal(f.state().requests.size,0);}
});

test('SOURCE cancelled invoice or unverified collection totals refuse preparation instead of borrowing old debt',async()=>{
 const f=fixture();f.row.status='cancelled';await assert.rejects(f.service.context({invoiceId:'1000'},collector()));assert.equal(f.state().requests.size,0);
 const g=fixture(),read=g.c.invoice;g.c.invoice=async id=>{const i=await read(id);i.collections.outstandingExact4='0.0000';return i;};
 await assert.rejects(g.service.preview(g.selection('1.0000'),collector()));assert.equal(g.state().cash,0n);
});

test('SOURCE different-UUID second cancel is stale while actor16 exact replay remains allowed',async()=>{
 const f=fixture(),p=await pay(f,2,'5.0000'),r=await f.c.collection(p.response.collection.id),body={requestId:uuid(3),expectedRevision:r.revision,documentDate:f.copy.date,reason:'Offline original reversal'};
 await f.service.cancel(r.id,body,collector());
 await assert.rejects(f.service.cancel(r.id,{...body,requestId:uuid(4)},collector()),{code:'WORK_STALE'});
 assert.equal((await f.service.cancel(r.id,body,collector())).replayed,true);assert.equal(f.events.filter(e=>e==='reverse').length,1);assert.equal(f.state().cash,0n);
});

test('SOURCE altered creator/link/copy/seal/policy/amount/native cost cannot use the preparation route',async()=>{
 const changes=[f=>f.row.actor_id='16',f=>f.row.createdBy='16',f=>f.row.request_id=uuid(7),f=>f.row.copy_id='10000000-0000-4000-8000-000000000099',f=>f.row.payload_hash='F'.repeat(64),f=>f.row.grandTotalExact4='0.0000',f=>f.items[0].averageCostTryExact4='0.0000',f=>{const p=JSON.parse(f.row.preview_json);p.sealHash='F'.repeat(64);f.row.preview_json=JSON.stringify(p);},f=>{const p=JSON.parse(f.row.preview_json);p.policyHash='F'.repeat(64);f.row.preview_json=JSON.stringify(p);}];
 for(const change of changes){const f=fixture();change(f);await assert.rejects(f.service.context({invoiceId:'1000'},collector()));assert.equal(f.state().requests.size,0);assert.equal(f.state().cash,0n);}
});

test('SOURCE journal failure rolls back isolated financial effects; no default/native store is provided',async()=>{
 assert.throws(()=>createBusinessSelectedSaleCollectionPreparation(),{code:'SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED'});
 const f=fixture(),original=f.c.journal;f.c.journal=async(...args)=>{await original(...args);throw Error('Offline rollback');};
 await assert.rejects(pay(f,2,'5.0000'));assert.equal(f.state().requests.size,0);assert.equal(f.state().cash,0n);assert.equal(f.state().customerDebt,240000n);assert.equal(f.state().stockEffects,0);
});

test('SOURCE 500 TRY preflight accepts exact boundary and rejects excess before source reads or journal',async()=>{
 for(const amount of ['499.9999','500.0000']){
  const f=fixture({unitPriceExact8:'125.00000000'}),p=await f.service.preview(f.selection(amount),collector());
  assert.equal(p.amountExact4,amount);
  const response=await f.service.collect({...p.selection,requestId:uuid(80),expectedRevision:p.revision,previewHash:p.previewHash},collector());
  assert.equal(response.collection.amountExact4,amount);assert.equal(f.state().requests.size,1);
 }
 const f=fixture({unitPriceExact8:'125.00000000'});
 await assert.rejects(f.service.preview(f.selection('500.0001'),collector()),{code:'WORK_OPERATION_LIMIT',statusCode:409});
 await assert.rejects(f.service.collect({...f.selection('500.0001'),requestId:uuid(81),expectedRevision:'a'.repeat(64),previewHash:'b'.repeat(64)},collector()),{code:'WORK_OPERATION_LIMIT',statusCode:409});
 assert(f.events.includes('authority'));assert(!f.events.includes('source'));assert(!f.events.includes('journal'));assert(!f.events.includes('collect'));assert.equal(f.state().requests.size,0);assert.equal(f.state().cash,0n);
 const denied=fixture();denied.actual.active=false;
 await assert.rejects(denied.service.preview(denied.selection('500.0001'),collector()),{statusCode:403});
});


test('SOURCE preview snapshots the validated amount before deferred authority',async()=>{
 const f=fixture({unitPriceExact8:'125.00000000'}),original=f.c.request;
 let reached,release;
 const entered=new Promise(resolve=>{reached=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 f.c.request=()=>{const r=original(),query=r.query;r.query=async function(sql){reached();await gate;return query.call(this,sql);};return r;};
 const input=f.selection('500.0001'),pending=f.service.preview(input,collector());
 await entered;input.amountExact4='1.0000';release();
 await assert.rejects(pending,{code:'WORK_OPERATION_LIMIT',statusCode:409});
 assert(!f.events.includes('source'));assert(!f.events.includes('journal'));assert.equal(f.state().cash,0n);
});
