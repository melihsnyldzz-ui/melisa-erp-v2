import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedCollectionCompilerFixture} from './shared-business-selected-collection-revision-sql.test.mjs';
import {BUSINESS_SELECTED_COLLECTION_REGISTRY,BUSINESS_SELECTED_COLLECTION_MODULES} from './shared-business-selected-collection-revision-sql.mjs';
import {validateBusinessSelectedCollectionMetadata,validateBusinessSelectedCollectionNativeProof,configureBusinessSelectedCollectionRevision,getRegisteredBusinessSelectedCollectionRevision,verifyBusinessSelectedCollectionRevision} from './shared-business-selected-collection-revision-bootstrap.mjs';

export async function selectedCollectionProofFixture(){
 const f=await selectedCollectionCompilerFixture(),{copy,bundle}=f;
 const frame={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:91,transactionId:'1001',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared',privateAccess:0,immutableDefinitionHash:bundle.revision.immutableTriggerHash};
 for(const k of Object.keys(BUSINESS_SELECTED_COLLECTION_MODULES))Object.assign(frame,{[`${k}Execute`]:1,[`${k}ViewDefinition`]:1,[`${k}DefinitionHash`]:bundle[`${k}Artifact`].definitionHash});
 const rows=bundle.objects.map((o,i)=>({copyId:copy.copyId,name:o.name,revision:1,baseSealHash:copy.sealHash,baseSaleRevisionHash:bundle.revision.baseSaleRevisionHash,baseHistoryRevisionHash:bundle.revision.baseHistoryRevisionHash,profileHash:bundle.revision.profileHash,revisionHash:bundle.revision.revisionHash,afterHash:o.afterHash,actualHash:o.afterHash,objectId:900+i,objectType:'P',immutableTriggerHash:bundle.revision.immutableTriggerHash,triggerDisabled:0,immutableTriggerObjectId:920,immutableParentName:BUSINESS_SELECTED_COLLECTION_REGISTRY,registrySchemaValid:true,sessionId:91,transactionId:'1001'}));
 return {...f,frame,result:{recordsets:[rows]}};
}

if(import.meta.filename===process.argv[1]){
test('pure collection native proof validation never mints a write capability',async()=>{
 const {copy,bundle,frame,result}=await selectedCollectionProofFixture();
 assert.equal(validateBusinessSelectedCollectionMetadata(copy,bundle,{recordset:[frame]}),frame);
 assert.equal(validateBusinessSelectedCollectionNativeProof(copy,bundle,result,frame),true);
 assert.equal(getRegisteredBusinessSelectedCollectionRevision(copy),null);
 assert.throws(()=>validateBusinessSelectedCollectionMetadata(copy,bundle,{recordset:[frame]},{write:true}));
 frame.copyLockMode='Exclusive';assert.equal(validateBusinessSelectedCollectionMetadata(copy,bundle,{recordset:[frame]},{write:true}),frame);
 assert.equal(getRegisteredBusinessSelectedCollectionRevision(copy),null);
});

test('native collection metadata rejects altered definitions permissions identity and transaction frames',async()=>{
 const changes=[m=>m.beginDefinitionHash='F'.repeat(64),m=>m.intentDefinitionHash=null,m=>m.effectsViewDefinition=0,m=>m.assertExecute=0,m=>m.proofExecute=0,m=>m.privateAccess=1,m=>m.immutableDefinitionHash='F'.repeat(64),m=>m.sysadmin=1,m=>m.live=1,m=>m.originalDatabaseAccess=1,m=>m.transactionId=1001,m=>m.isolationLevel=2,m=>m.copyLockMode='NoLock',m=>m.transactionCount=2,m=>m.transactionState=-1,m=>m.extra='unexpected'];
 for(const change of changes){const {copy,bundle,frame}=await selectedCollectionProofFixture();change(frame);assert.throws(()=>validateBusinessSelectedCollectionMetadata(copy,bundle,{recordset:[frame]}));assert.equal(getRegisteredBusinessSelectedCollectionRevision(copy),null);}
});

test('coherent collection registry rows reject wrong source topology schema object and frame',async()=>{
 const changes=[r=>r.recordsets.push([]),r=>r.recordsets[0].pop(),r=>r.recordsets[0].push({...r.recordsets[0][0]}),r=>r.recordsets[0][0].actualHash='E'.repeat(64),r=>r.recordsets[0][0].baseSaleRevisionHash='E'.repeat(64),r=>r.recordsets[0][0].baseHistoryRevisionHash='E'.repeat(64),r=>r.recordsets[0][0].profileHash='E'.repeat(64),r=>r.recordsets[0][0].revisionHash='E'.repeat(64),r=>r.recordsets[0][0].immutableParentName='dbo.products',r=>r.recordsets[0][0].triggerDisabled=1,r=>r.recordsets[0][0].objectType='TR',r=>r.recordsets[0][0].objectId=null,r=>r.recordsets[0][0].objectId=r.recordsets[0][1].objectId,r=>r.recordsets[0][0].sessionId=92,r=>r.recordsets[0][0].transactionId='1002',r=>r.recordsets[0][0].registrySchemaValid=false,r=>r.recordsets[0][0].immutableTriggerObjectId=null,r=>r.recordsets[0][0].immutableTriggerObjectId=r.recordsets[0][0].objectId,r=>r.recordsets[0][0].immutableTriggerObjectId=921,r=>r.recordsets[0][0].extra=true];
 for(const change of changes){const {copy,bundle,frame,result}=await selectedCollectionProofFixture();change(result);assert.throws(()=>validateBusinessSelectedCollectionNativeProof(copy,bundle,result,frame));assert.equal(getRegisteredBusinessSelectedCollectionRevision(copy),null);}
});

test('compiler output cannot register collection writes without both earned native predecessors',async()=>{
 const {copy,bundle}=await selectedCollectionProofFixture();let reads=0;
 const request={query:async()=>{reads++;throw Error('should not reach SQL without earned parent');}};
 await assert.rejects(()=>configureBusinessSelectedCollectionRevision(copy,bundle.revision,request),{code:'SELECTED_COLLECTION_REGISTERED_PARENTS_REQUIRED'});
 await assert.rejects(()=>verifyBusinessSelectedCollectionRevision(copy,request,{write:true}),{code:'SELECTED_COLLECTION_REGISTERED_CAPABILITY'});
 assert.equal(reads,0);assert.equal(getRegisteredBusinessSelectedCollectionRevision(copy),null);
});
}
