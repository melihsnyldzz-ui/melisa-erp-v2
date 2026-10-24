import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Isolated source harness: no native database, no registration setter exported
// by production. Each import receives its own simulated earned owner registry.
async function fixture(change=()=>{}){
 const json=JSON.stringify,hash=v=>createHash('sha256').update(json(v)).digest('hex'),h='a'.repeat(64),transaction={};
 const copy={copyId:'11111111-1111-4111-8111-111111111111',sealHash:h,operationOrigin:'source',customers:[{id:'2',accountId:'3',partyId:'4',currency:'TRY',sourceKey:'c',sourceWitnessHash:h}],financeAccounts:[{id:'5',currency:'TRY',type:'bank'}],currencyRates:[{currency:'TRY',rateExact8:'1.00000000'}]};
 const artifact={name:'dbo.usp_business_selected_collection_intent_v1',definitionHash:h,parentHashes:{begin:h}},consumer={bundle:{intentArtifact:artifact}},requestId='22222222-2222-4222-8222-222222222222',actor={id:'16',permissions:['finance.view','customer.view','finance.collection','finance.collection.cancel']};
 const selected={invoiceId:'6',creatorId:'15',collectorId:'16',customerId:'2',customerAccountId:'3',accountId:'5',currency:'TRY',creationRequestId:requestId,policyHash:h,sourceSelectionHash:h};
 const payload={copyId:copy.copyId,sealHash:h,operationOrigin:'source',actorId:'16',requestId,operation:'collection_create',businessSelectedCollection:selected};
 const dto={revision:h,scope:{customer:copy.customers[0],accounts:copy.financeAccounts},rate:copy.currencyRates[0],capabilities:{canCollect:true,canCancelCollection:true}};
 const intent={schemaVersion:'melisa-selected-collection-native-intent.v1',profileHash:hash(copy),copyId:copy.copyId,sealHash:h,actorId:'16',operation:'collection_create',requestId,payloadHash:hash(payload),...selected,selectedRevision:h};
 const meta={transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Exclusive',sessionId:9,transactionId:'10',readerDefinitionHash:h};
 const row={...meta,proof_json:json({definitionHashes:artifact.parentHashes}),actor_json:json(actor),payload_json:json(payload),payloadHash:hash(payload),intent_json:json(intent),context_json:json(dto)};
 let active=true,verified=0;
 const state={copy,transaction,artifact,consumer,actor,payload,intent,dto,meta,row,requestId};change(state);
 const fail=(v,code)=>{if(!v)throw Object.assign(new Error(code),{code});};
 const bindings={assertIsolatedCopyContext:v=>fail(v===copy,'copy'),assertIsolatedCopyIdentity:()=>{},assertIsolatedCopyReadProof:()=>{},assertIsolatedCopyActor:(c,a,b,p)=>fail(b.id===a.id&&b.permissions.includes(p),'authority'),bindIsolatedCopyOperationDTO:()=>{},copyAssert:fail,isolatedCopyHash:hash,isolatedCopyJSON:json,isolatedCopyTransactionContext:t=>{fail(active&&t===transaction,'transaction');return copy;},workId:v=>{fail(typeof v==='string'&&/^[1-9]\d*$/.test(v),'id');return v;},getRegisteredBusinessSelectedCollectionRevision:()=>consumer,verifyBusinessSelectedCollectionRevision:async()=>{verified++;return consumer;}};
 const key='collectionScopeTest'+Math.random();globalThis[key]=bindings;
 let source=await readFile(new URL('./businessSelectedCollectionWriteScope.mjs',import.meta.url),'utf8');source=source.replace(/^import .* from '(?!node:)[^']+';\n/gm,'');source=`const {${Object.keys(bindings).join(',')}}=globalThis[${JSON.stringify(key)}];\n`+source;
 const scope=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));delete globalThis[key];
 const request=()=>({parent:state.detached?{}:transaction,input(){return this;},async query(){return {recordset:[meta]};},async execute(){return {recordset:[row]};}});
 return {...state,scope,options:{copy,transaction,sql:{UniqueIdentifier:1,BigInt:2,NVarChar:()=>3},request,actor,operation:'collection_create',requestId,collectionConsumer:state.fakeConsumer??consumer},verified:()=>verified,expire:()=>{active=false;}};
}
test('earned owner intent exposes only active same-transaction selection and expires escaped callbacks',async()=>{const f=await fixture();let escaped;await f.scope.withBusinessSelectedCollectionWriteScope(f.options,async dto=>{assert.equal(dto.capabilities.canCollect,true);assert.equal(f.scope.getBusinessSelectedCollectionWriteScope(f.copy,f.transaction).creatorId,'15');escaped=()=>f.scope.getBusinessSelectedCollectionWriteScope(f.copy,f.transaction);});assert.equal(escaped(),null);assert.equal(f.verified(),2);});
test('arbitrary registry lookalike cannot grant write scope',async()=>{const f=await fixture(s=>{s.fakeConsumer={...s.consumer};});await assert.rejects(f.scope.withBusinessSelectedCollectionWriteScope(f.options,()=>{}),{code:'SELECTED_COLLECTION_SERVER_CONSUMER'});});
test('detached SQL requests fail closed',async()=>{const f=await fixture(s=>{s.detached=true;});await assert.rejects(f.scope.withBusinessSelectedCollectionWriteScope(f.options,()=>{}),{code:'SELECTED_COLLECTION_BOUND_REQUEST'});});
test('another actor cannot collect',async()=>{const f=await fixture(s=>{s.actor.id='15';});await assert.rejects(f.scope.withBusinessSelectedCollectionWriteScope(f.options,()=>{}),{code:'ISOLATED_COPY_FORBIDDEN'});});
test('owner intent cannot move between native sessions',async()=>{const f=await fixture(s=>{s.row.sessionId=11;});await assert.rejects(f.scope.withBusinessSelectedCollectionWriteScope(f.options,()=>{}),{code:'SELECTED_COLLECTION_SAME_NATIVE_TRANSACTION'});});
test('payload body hash tampering fails',async()=>{const f=await fixture(s=>{s.row.payloadHash='b'.repeat(64);});await assert.rejects(f.scope.withBusinessSelectedCollectionWriteScope(f.options,()=>{}),{code:'SELECTED_COLLECTION_CANONICAL_INTENT'});});
test('DTO capability alone cannot replace owner intent',async()=>{const f=await fixture(s=>{s.row.intent_json=JSON.stringify({...s.intent,collectorId:'15'});});await assert.rejects(f.scope.withBusinessSelectedCollectionWriteScope(f.options,()=>{}),{code:'SELECTED_COLLECTION_OWNER_INTENT_REQUIRED'});});
test('callback failure expires scope and is propagated',async()=>{const f=await fixture();await assert.rejects(f.scope.withBusinessSelectedCollectionWriteScope(f.options,()=>{throw new Error('rollback');}),/rollback/);assert.equal(f.scope.getBusinessSelectedCollectionWriteScope(f.copy,f.transaction),null);});
