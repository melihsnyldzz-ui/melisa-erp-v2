import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

// Modeled owner proof only. The real bootstrap is independently tested against
// hostile native results; no test fixture here claims an earned SQL capability.
const modeled=new WeakMap();
globalThis.__modeledSelectedCollection={get:copy=>modeled.get(copy)??null,verify:async(copy,request)=>{
 const v=modeled.get(copy);assert(v,'modeled owner revision absent');assert(request.parent,'detached modeled request');if(v.revoked)throw Object.assign(Error('revoked'),{code:'SELECTED_COLLECTION_FRESH_CONSUMER'});return v;
}};
registerHooks({resolve(specifier,context,next){
 if(specifier.endsWith('/shared-business-selected-collection-revision-bootstrap.mjs'))return {url:'data:text/javascript,'+encodeURIComponent('export const getRegisteredBusinessSelectedCollectionRevision=c=>globalThis.__modeledSelectedCollection.get(c);export const verifyBusinessSelectedCollectionRevision=(...a)=>globalThis.__modeledSelectedCollection.verify(...a);'),shortCircuit:true};
 return next(specifier,context);
}});
const {selectedSourceCollectionFixture:fixture,selectedSourceCollector:collector,selectedSourceRequestId:uuid}=await import('./businessSelectedSaleCollectionPreparation.test-fixture.mjs');
const {createIsolatedOperationCopyStore,ISOLATED_COPY_FINITE_FK_SQL,isolatedCopySelectedCollectionRequestBody,withSelectedCollectionNativeBridge,isIsolatedSelectedCollectionNativeStore}=await import('./isolatedOperationCopyStoreFactory.mjs');
const {createBusinessSelectedSaleCollectionNativePreparation}=await import('./businessSelectedSaleCollectionPreparation.mjs');
const {isolatedCopyHash,isolatedCopyJSON}=await import('./isolatedOperationCopyContext.mjs');

function harness(){
 const f=fixture(),copy=f.copy,events=[],requests=new Map(),links=new Map(),reversals=new Map();let tx,begun=null;const account=copy.financeAccounts.find(a=>a.currency==='TRY');
 const identity={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0};
 const proof={copyId:copy.copyId,sealHash:copy.sealHash,backupSHA:copy.backupSHA,valid:true,definitionHashes:Object.fromEntries(Object.entries(copy.sql).map(([k,v])=>[k,v.hash]))};
 const artifact={name:'dbo.usp_business_selected_collection_intent_v1',definitionHash:'D'.repeat(64),parentHashes:proof.definitionHashes};
 const consumer={bundle:{intentArtifact:artifact,beginArtifact:{name:'dbo.usp_business_selected_collection_begin_v1'},effectsArtifact:{name:'dbo.usp_business_selected_collection_effects_v1'}}};modeled.set(copy,consumer);
 const state={failEffects:false,failJournal:false,failRead:false};
 class Transaction{
  async begin(){tx=this;this.money=structuredClone(f.state());this.requests=structuredClone(requests);this.links=structuredClone(links);this.reversals=structuredClone(reversals);events.push('begin');}
  async commit(){events.push('commit');}
  async rollback(){Object.assign(f.state(),this.money);requests.clear();for(const [k,v] of this.requests)requests.set(k,v);links.clear();for(const [k,v] of this.links)links.set(k,v);reversals.clear();for(const [k,v] of this.reversals)reversals.set(k,v);events.push('rollback');}
 }
 class Request{
  constructor(parent){this.parent=parent;this.params={};}input(k,t,v){this.params[k]=v;return this;}
  async query(sql){
   if(sql.startsWith('SELECT DB_NAME'))return {recordset:[{...identity,...(sql.includes('readerDefinitionHash')?{sessionId:42,transactionId:'900',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Exclusive',readerDefinitionHash:artifact.definitionHash}:{})}]};
   if(sql.includes('sp_getapplock')){events.push(sql.includes("N'Exclusive'")?'Exclusive':'Shared');return {};}
   if(sql===ISOLATED_COPY_FINITE_FK_SQL)return {recordset:[['FK__test_good__produ__5654B625','test_goods_batch_lines'],['FK__test_purc__produ__69678A99','test_purchase_batch_intent_lines']].map(([constraintName,parentTable])=>({constraintName,parentSchema:'dbo',parentTable,parentColumn:'product_id',referencedSchema:'dbo',referencedTable:'products',referencedColumn:'id',ordinal:1,columnCount:1,isDisabled:false,isNotTrusted:false,deleteAction:'NO_ACTION',updateAction:'NO_ACTION'}))};
   if(sql.startsWith('SELECT actor_id,operation,payload_hash')){if(state.failRead)throw Error('modeled read timeout');const row=requests.get(this.params.request_id);return {recordset:row&&(!this.params.actor_id||String(row.actor_id)===String(this.params.actor_id))?[row]:[]};}
   if(sql.startsWith('SELECT CONVERT(varchar(20),movement_id) movementId')){const link=links.get(this.params.request_id);return {recordset:link&&link.invoiceId===this.params.invoice_id?[structuredClone(link)]:[]};}
   if(sql.startsWith('INSERT dbo.stage4_copy_requests')){if(state.failJournal)throw Error('modeled journal failure');requests.set(this.params.request_id,{...this.params});const response=JSON.parse(this.params.response_json),r=response.collection;const link={invoiceId:r.invoiceId,movementId:this.params.operation==='collection_create'?r.id:String(9000+links.size),originalId:this.params.operation==='collection_create'?null:r.id};links.set(this.params.request_id,link);if(link.originalId!==null)reversals.set(link.originalId,link.movementId);events.push('journal');return {};}
   return f.c.request().query(sql);
  }
  async execute(name){
   if(name===copy.sql.ready.name)return {};
   if(name===copy.sql.context.name)return {recordset:[{proof_json:JSON.stringify(proof),actor_json:JSON.stringify({id:'16',role:'isolated_test_ilker',active:true,permissions:collector().permissions}),context_json:JSON.stringify(f.context)}]};
   if(name===consumer.bundle.beginArtifact.name){begun={...this.params};events.push('owner begin');return {};}
   if(name===artifact.name){
    const p=JSON.parse(begun.payload_json),s=p.businessSelectedCollection;
    const dto=structuredClone(f.context);dto.rate=copy.currencyRates.find(r=>r.currency==='TRY');dto.capabilities={canCollect:true,canCancelCollection:true};
    return {recordset:[{proof_json:JSON.stringify(proof),actor_json:JSON.stringify({id:'16',role:'isolated_test_ilker',active:true,permissions:collector().permissions}),context_json:JSON.stringify(dto),payload_json:begun.payload_json,payloadHash:begun.payload_hash,intent_json:JSON.stringify({schemaVersion:'melisa-selected-collection-native-intent.v1',profileHash:isolatedCopyHash(copy),copyId:copy.copyId,sealHash:copy.sealHash,actorId:'16',operation:p.operation,requestId:p.requestId,payloadHash:begun.payload_hash,...s,selectedRevision:dto.revision}),sessionId:42,transactionId:'900',readerDefinitionHash:artifact.definitionHash}]};
   }
   if(name===consumer.bundle.effectsArtifact.name){assert.deepEqual(Object.keys(this.params).sort(),['copy_id','request_id','actor_id','operation','payload_hash','response_json','replay'].sort());events.push(this.params.replay?'replay effects':'effects');if(state.failEffects)throw Error('modeled effects failure');const p={valid:true,copyId:copy.copyId,sealHash:copy.sealHash,requestId:this.params.request_id,actorId:'16',operation:this.params.operation,payloadHash:this.params.payload_hash,stockVerified:true,partyAccountsVerified:true,financeAccountsVerified:true,protectedRowsVerified:true};return {recordset:[{effect_proof_json:JSON.stringify(p)}]};}
   throw Error('Unexpected native procedure '+name);
  }
 }
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},BigInt:'bigint',UniqueIdentifier:'uuid',NVarChar:()=>{},Char:()=>{},MAX:'max',Bit:'bit'};
 const store=createIsolatedOperationCopyStore({getRuntime:async()=>({copyContext:copy,sql,pool:{}}),buildDomain:async({context})=>({...f.c,context,collection:async id=>{const value=await f.c.collection(id),reversalId=reversals.get(id);return reversalId?{...value,reversalId}:value;},readSelectedSaleCollectionInvoice:original=>f.c.invoice(original.record.invoice.id)})});
 const service=createBusinessSelectedSaleCollectionNativePreparation({getStore:async()=>store});
 return {...f,service,store,events,requests,links,consumer,nativeState:state};
}
async function pay(f,n,amount){const selected=f.selection(amount),preview=await f.service.preview(selected,collector()),body={...selected,requestId:uuid(n),previewHash:preview.previewHash,expectedRevision:preview.revision};return {body,response:await f.service.collect(body,collector())};}

test('native source adapter connects real factory journal and scoped owner dispatch for partial/full/replay/cancel without stock effects',async()=>{
 const f=harness();assert(isIsolatedSelectedCollectionNativeStore(f.store));
 const first=await pay(f,2,'5.0000');assert.equal(first.response.invoice.collections.outstandingExact4,'19.0000');
 assert.equal((await f.service.collect(first.body,collector())).replayed,true);assert.equal(f.state().cash,50000n);
 const full=await pay(f,3,'19.0000');assert.equal(full.response.invoice.collections.outstandingExact4,'0.0000');
 const current=await f.c.collection(full.response.collection.id),cancel={requestId:uuid(4),expectedRevision:current.revision,documentDate:f.copy.date,reason:'Modeled full payment cancellation'};
 const reversed=await f.service.cancel(current.id,cancel,collector());assert.equal(reversed.invoice.collections.outstandingExact4,'19.0000');
 assert.equal((await f.service.cancel(current.id,cancel,collector())).replayed,true);
 assert.equal(f.requests.size,3);assert.equal(f.events.filter(e=>e==='owner begin').length,3);assert.equal(f.events.filter(e=>e==='journal').length,3);assert.equal(f.state().stockEffects,0);
 const body=JSON.parse(f.requests.get(uuid(2)).payload_json);assert.equal(body.businessSelectedCollection.creatorId,'15');assert.equal(body.businessSelectedCollection.collectorId,'16');
});

test('native owner effects or journal failure rolls back financial changes and UUID claim',async()=>{
 for(const key of ['failEffects','failJournal']){const f=harness();f.nativeState[key]=true;await assert.rejects(pay(f,2,'5.0000'),/modeled (effects|journal) failure/);assert.equal(f.state().cash,0n);assert.equal(f.state().customerDebt,240000n);assert.equal(f.requests.size,0);assert.equal(f.events.at(-1),'rollback');}
});

test('native source preserves fresh authority and different-body UUID protections',async()=>{
 const f=harness(),first=await pay(f,2,'5.0000');await assert.rejects(f.service.collect({...first.body,amountExact4:'4.0000'},collector()),{code:'ISOLATED_COPY_REQUEST_CONFLICT'});assert.equal(f.state().cash,50000n);assert.equal(f.requests.size,1);
 f.consumer.revoked=true;await assert.rejects(f.service.collect(first.body,collector()),{code:'SELECTED_COLLECTION_FRESH_CONSUMER'});assert.equal(f.requests.size,1);
});

test('native source marker is server-owned and opaque bridge expires',async()=>{
 const f=harness(),first=await pay(f,2,'5.0000'),body=JSON.parse(f.requests.get(uuid(2)).payload_json),s=body.businessSelectedCollection;
 assert.throws(()=>isolatedCopySelectedCollectionRequestBody(f.copy,collector(),'collection_create',{...first.body,businessSelectedCollection:s},s),{code:'ISOLATED_COPY_CLIENT_PROFILE'});
 assert.throws(()=>isolatedCopySelectedCollectionRequestBody(f.copy,{...collector(),id:'15'},'collection_create',first.body,s),{code:'SELECTED_COLLECTION_OPERATION'});
 let escaped,request,collect;await f.store.withSelectedCollectionNative(collector(),false,bridge=>{escaped=bridge;return withSelectedCollectionNativeBridge(bridge,native=>{request=native.request;collect=native.domain.collect;});});
 assert.throws(()=>withSelectedCollectionNativeBridge(escaped,()=>true),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});assert.throws(()=>request(),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});assert.throws(()=>collect({},uuid(9)),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
});

test('read-only selected SOURCE retained request comparison binds exact body, actor, copy, scope and effect proof',async()=>{
 const f=harness(),first=await pay(f,10,'5.0000'),input={operation:'collection_create',invoiceId:'1000',body:first.body},id=uuid(10),baseline=f.requests.get(id),stateBefore=structuredClone(f.state());
 const verify=async value=>f.service.verifyRetained(value,collector());
 const before=f.events.slice(),matched=await verify(input);assert.deepEqual(matched,{status:'MATCHED'});assert.deepEqual(f.state(),stateBefore);assert.equal(f.requests.size,1);assert.equal(f.events.slice(before.length).includes('owner begin'),false);assert.equal(f.events.slice(before.length).includes('journal'),false);assert.equal(JSON.stringify(matched).includes(first.body.previewHash),false);
 for(const change of ['body','invoice','account','currency','actor','operation','copy','hash','effect','response','missing']){
  f.requests.set(id,structuredClone(baseline));const row=f.requests.get(id),modified=structuredClone(input);
  if(change==='body')modified.body.amountExact4='4.0000';if(change==='invoice')modified.invoiceId='1001';if(change==='account')modified.body.accountId='999';
  if(change==='currency'){const payload=JSON.parse(row.payload_json);payload.businessSelectedCollection.currency='USD';row.payload_json=isolatedCopyJSON(payload);row.payload_hash=isolatedCopyHash(payload);}
  if(change==='actor')row.actor_id='15';if(change==='operation')row.operation='collection_cancel';if(change==='copy'){const payload=JSON.parse(row.payload_json);payload.copyId=uuid(99);row.payload_json=isolatedCopyJSON(payload);row.payload_hash=isolatedCopyHash(payload);}
  if(change==='hash')row.payload_hash='0'.repeat(64);if(change==='effect')row.effect_proof_json='{}';if(change==='response')row.response_json='{}';if(change==='missing')f.requests.delete(id);
  assert.deepEqual(await verify(modified),{status:'UNKNOWN'},change);assert.deepEqual(f.state(),stateBefore,change);
 }
 f.requests.set(id,baseline);f.nativeState.failRead=true;assert.deepEqual(await verify(input),{status:'UNKNOWN'});f.nativeState.failRead=false;
 f.consumer.revoked=true;assert.deepEqual(await verify(input),{status:'UNKNOWN'});f.consumer.revoked=false;
 assert.deepEqual(await f.service.verifyRetained(input,{...collector(),id:'15'}),{status:'UNKNOWN'});assert.deepEqual(await f.service.verifyRetained(input,{...collector(),permissions:['finance.view','customer.view']}),{status:'UNKNOWN'});
 assert.deepEqual(f.state(),stateBefore);assert.equal(f.requests.size,1);
});
test('read-only cancellation comparison requires original cancellation reason and current cancel authority',async()=>{
 const f=harness(),first=await pay(f,11,'5.0000'),current=await f.c.collection(first.response.collection.id),cancel={requestId:uuid(12),expectedRevision:current.revision,documentDate:f.copy.date,reason:'Modeled full payment cancellation'};
 await f.service.cancel(current.id,cancel,collector());const input={operation:'collection_cancel',invoiceId:'1000',collectionId:current.id,body:cancel},before=structuredClone(f.state());
 assert.deepEqual(await f.service.verifyRetained(input,collector()),{status:'MATCHED'});assert.deepEqual(await f.service.verifyRetained({...input,body:{...cancel,reason:'Different cancellation'}},collector()),{status:'UNKNOWN'});
 const originalLink=structuredClone(f.links.get(uuid(12)));f.links.get(uuid(12)).movementId='99999';assert.deepEqual(await f.service.verifyRetained(input,collector()),{status:'UNKNOWN'});f.links.set(uuid(12),originalLink);
 assert.deepEqual(await f.service.verifyRetained(input,{...collector(),permissions:collector().permissions.filter(p=>p!=='finance.collection.cancel')}),{status:'UNKNOWN'});assert.deepEqual(f.state(),before);assert.equal(f.requests.size,2);
});

test('retained verification never attributes another same-amount movement to the original request',async()=>{
 const f=harness(),first=await pay(f,20,'5.0000'),other=await pay(f,21,'5.0000'),input={operation:'collection_create',invoiceId:'1000',body:first.body},row=f.requests.get(uuid(20)),saved=row.response_json;
 const altered=JSON.parse(saved);altered.collection=structuredClone(other.response.collection);row.response_json=isolatedCopyJSON(altered);
 const before=structuredClone(f.state());assert.deepEqual(await f.service.verifyRetained(input,collector()),{status:'UNKNOWN'});assert.deepEqual(f.state(),before);assert.equal(f.requests.size,2);
 f.requests.get(uuid(20)).response_json=saved;assert.deepEqual(await f.service.verifyRetained(input,collector()),{status:'MATCHED'});
});
