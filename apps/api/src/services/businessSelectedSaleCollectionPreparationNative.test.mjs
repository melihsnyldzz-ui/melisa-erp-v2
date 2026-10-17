import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSourceCollectionFixture as fixture,selectedSourceCollector as collector,selectedSourceRequestId as uuid} from './businessSelectedSaleCollectionPreparation.test-fixture.mjs';
import {bindBusinessSelectedSaleCollectionNativeContext,createBusinessSelectedSaleCollectionNativePreparation,SOURCE_COLLECTION_NATIVE_VERSION} from './businessSelectedSaleCollectionPreparation.mjs';
import {isolatedCopyHash} from './isolatedOperationCopyContext.mjs';

function nativeFixture(change=()=>{}){
 const f=fixture(),stages=[];
 const witness=(pin,stage)=>{const value={...pin,verified:true,stage};delete value.payload;return value;};
 const native={version:SOURCE_COLLECTION_NATIVE_VERSION,transaction:f.c.transaction,rollbackOnError:true,
  ownerIntent:async pin=>{stages.push('owner');return witness(pin,'owner');},
  guard:async pin=>{stages.push('guard');return witness(pin,'guard');},
  effects:async pin=>{stages.push('effects');return witness(pin,'effects');},
  verifyEffects:async pin=>{stages.push('verifyEffects');return witness(pin,'effects');},
  journal:async(pin,execute)=>{stages.push('journal');const response=await f.c.journal(pin.operation,pin.payload,execute);return {response,witness:{...witness(pin,'journal'),responseHash:isolatedCopyHash(response)}};},
  collect:(preview,id,pin)=>{assert.equal(pin?.transaction,f.c.transaction);return f.c.collect(preview,id);},
  cancelCollection:(id,body,pin)=>{assert.equal(pin?.transaction,f.c.transaction);return f.c.cancelCollection(id,body);},
 };
 change(f,native);
 const c=bindBusinessSelectedSaleCollectionNativeContext(f.c,native);
 const service=createBusinessSelectedSaleCollectionNativePreparation({withContext:async(_actor,fn)=>{const before=structuredClone(f.state());try{return await fn(c);}catch(error){Object.assign(f.state(),before);throw error;}}});
 const selection=amountExact4=>f.selection(amountExact4);
 const pay=async(n,amountExact4)=>{const s=selection(amountExact4),p=await service.preview(s,collector()),body={...s,requestId:uuid(n),expectedRevision:p.revision,previewHash:p.previewHash};return {body,response:await service.collect(body,collector())};};
 return {...f,native,c,service,stages,pay};
}

test('v1 injected same-transaction gate permits 5+19 collection, exact replay and reverse in fake transaction',async()=>{
 const f=nativeFixture(),a=await f.pay(2,'5.0000'),b=await f.pay(3,'19.0000');
 assert.equal(a.response.invoice.collections.outstandingExact4,'19.0000');assert.equal(b.response.invoice.collections.outstandingExact4,'0.0000');
 assert.equal((await f.service.collect(a.body,collector())).replayed,true);
 const row=await f.c.collection(b.response.collection.id),body={requestId:uuid(4),expectedRevision:row.revision,documentDate:f.copy.date,reason:'Offline native reversal'};
 assert.equal((await f.service.cancel(row.id,body,collector())).invoice.collections.outstandingExact4,'19.0000');
 assert.equal((await f.service.cancel(row.id,body,collector())).replayed,true);
 assert.deepEqual(f.stages.slice(0,4),['owner','guard','journal','effects']);
 assert.equal(f.stages.filter(s=>s==='effects').length,3);assert.equal(f.stages.filter(s=>s==='verifyEffects').length,2);assert.equal(f.state().stockEffects,0);
});

test('v1 native injection rejects missing brand and transaction substitution before write',async()=>{
 assert.throws(()=>createBusinessSelectedSaleCollectionNativePreparation(),{code:'SOURCE_COLLECTION_NATIVE_STORE_REQUIRED'});
 const f=fixture();await assert.rejects(createBusinessSelectedSaleCollectionNativePreparation({withContext:async(_a,fn)=>fn(f.c)}).preview(f.selection('5.0000'),collector()),{code:'SOURCE_COLLECTION_NATIVE_CONTEXT'});
 assert.throws(()=>bindBusinessSelectedSaleCollectionNativeContext(f.c,{version:SOURCE_COLLECTION_NATIVE_VERSION,transaction:{}}),{code:'SOURCE_COLLECTION_NATIVE_CONTEXT'});
});

test('v1 pin denies owner, guard and effects drift and refuses generic fallback',async()=>{
 for(const [stage,mutate] of [
  ['owner',w=>({...w,actorId:'15'})],['guard',w=>({...w,accountId:'999'})],['effects',w=>({...w,pinHash:'F'.repeat(64)})],
 ]){
  const f=nativeFixture((_f,n)=>{const original=n[stage==='owner'?'ownerIntent':stage];n[stage==='owner'?'ownerIntent':stage]=async pin=>mutate(await original(pin));});
  const s=f.selection('5.0000'),p=await f.service.preview(s,collector());
  await assert.rejects(f.service.collect({...s,requestId:uuid(2),expectedRevision:p.revision,previewHash:p.previewHash},collector()),{code:'SOURCE_COLLECTION_NATIVE_'+stage.toUpperCase()});
  assert.equal(f.state().requests.size,0);assert.equal(f.state().cash,0n);assert.equal(f.state().customerDebt,240000n);assert.equal(f.state().records.length,0);
 }
 assert.throws(()=>nativeFixture((_f,n)=>{delete n.collect;}),{code:'SOURCE_COLLECTION_NATIVE_CONTEXT'});
});

test('v1 journal refuses missing, duplicate or altered callback result and forged journal witness',async()=>{
 const fake=pin=>({requestId:pin.requestId,replayed:false,invoice:{id:pin.invoiceId},collection:{id:'2000',invoiceId:pin.invoiceId,accountId:pin.accountId,currency:'TRY',amountExact4:pin.amountExact4}});
 const cases=[
  n=>{n.journal=async pin=>{const response=fake(pin);return {response,witness:{...pin,stage:'journal',verified:true,responseHash:isolatedCopyHash(response)}};};},
  n=>{n.journal=async(pin,execute)=>{await execute();return execute();};},
  n=>{n.journal=async(pin,execute)=>{const response=structuredClone(await execute());return {response,witness:{...pin,stage:'journal',verified:true,responseHash:isolatedCopyHash(response)}};};},
  n=>{n.journal=async(pin,execute)=>{const response=await execute();return {response,witness:{...pin,stage:'journal',verified:true,pinHash:'F'.repeat(64),responseHash:isolatedCopyHash(response)}};};},
 ];
 for(const change of cases){const f=nativeFixture((_f,n)=>change(n)),s=f.selection('5.0000'),p=await f.service.preview(s,collector());
  await assert.rejects(f.service.collect({...s,requestId:uuid(2),expectedRevision:p.revision,previewHash:p.previewHash},collector()));
  assert.equal(f.state().requests.size,0);assert.equal(f.state().cash,0n);assert.equal(f.state().customerDebt,240000n);assert.equal(f.state().records.length,0);
 }
});

test('v1 callback retained beyond journal return cannot write later',async()=>{
 let retained;
 const f=nativeFixture((_f,n)=>{n.journal=async(pin,execute)=>{retained=execute;const response={requestId:pin.requestId,replayed:false,invoice:{id:pin.invoiceId},collection:{id:'2000',invoiceId:pin.invoiceId,accountId:pin.accountId,currency:'TRY',amountExact4:pin.amountExact4}};return {response,witness:{...pin,stage:'journal',verified:true,responseHash:isolatedCopyHash(response)}};};});
 const s=f.selection('5.0000'),p=await f.service.preview(s,collector());
 await assert.rejects(f.service.collect({...s,requestId:uuid(2),expectedRevision:p.revision,previewHash:p.previewHash},collector()),{code:'SOURCE_COLLECTION_NATIVE_JOURNAL'});
 await assert.rejects(retained(),{code:'SOURCE_COLLECTION_NATIVE_EXECUTION'});
 assert.equal(f.state().records.length,0);assert.equal(f.state().cash,0n);
});

test('v1 replay uses read-only effects verification and rejects its drift',async()=>{
 const f=nativeFixture((_f,n)=>{let count=0,original=n.effects;n.effects=async pin=>{if(++count>1)throw Error('replay called mutating effects');return original(pin);};}),paid=await f.pay(2,'5.0000');
 assert.equal((await f.service.collect(paid.body,collector())).replayed,true);
 const g=nativeFixture((_f,n)=>{n.verifyEffects=async pin=>({...pin,stage:'effects',verified:true,accountId:'999'});}),first=await g.pay(2,'5.0000');
 await assert.rejects(g.service.collect(first.body,collector()),{code:'SOURCE_COLLECTION_NATIVE_EFFECTS'});
 assert.equal(g.state().cash,50000n);assert.equal(g.state().requests.size,1);
});

test('v1 rechecks actor, account, creator price and revision before native journal',async()=>{
 for(const change of [f=>f.actual.accounts[0].id='999',f=>f.row.actor_id='16',f=>f.row.payload_hash='F'.repeat(64),f=>f.items[0].averageCostTryExact4='0.0000']){
  const f=nativeFixture(change),s=f.selection('5.0000');await assert.rejects(f.service.preview(s,collector()));assert(!f.stages.includes('journal'));
 }
 const f=nativeFixture(),s=f.selection('5.0000'),p=await f.service.preview(s,collector());
 await assert.rejects(f.service.collect({...s,requestId:uuid(2),expectedRevision:'F'.repeat(64),previewHash:p.previewHash},collector()),{code:'WORK_STALE'});assert.equal(f.state().requests.size,0);
 f.stages.length=0;await assert.rejects(f.service.collect({...s,requestId:uuid(2),expectedRevision:p.revision,previewHash:p.previewHash},{...collector(),id:'15'}),{statusCode:403});assert(!f.stages.includes('journal'));
});
