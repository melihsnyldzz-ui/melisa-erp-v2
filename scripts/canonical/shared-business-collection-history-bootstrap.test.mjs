import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionHistoryCompilerFixture} from './shared-business-collection-history-sql.test.mjs';
import {buildBusinessCollectionHistoryRevision,BUSINESS_COLLECTION_HISTORY_REGISTRY} from './shared-business-collection-history-sql.mjs';
import {validateBusinessCollectionHistoryMetadata,validateBusinessCollectionHistoryNativeProof,configureBusinessCollectionHistoryRevision,getRegisteredBusinessCollectionHistoryRevision,verifyBusinessCollectionHistoryRevision} from './shared-business-collection-history-bootstrap.mjs';

async function fixture(){
 const {copy,priceSaleBundle}=await collectionHistoryCompilerFixture(),bundle=buildBusinessCollectionHistoryRevision({copyContext:copy,priceSaleBundle});
 const frame={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:91,transactionId:'1001',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared',privateAccess:0,historyExecute:1,proofExecute:1,historyViewDefinition:1,proofViewDefinition:1,historyDefinitionHash:bundle.historyArtifact.definitionHash,proofDefinitionHash:bundle.proofArtifact.definitionHash,immutableDefinitionHash:bundle.revision.immutableTriggerHash};
 const rows=bundle.objects.map((o,i)=>({copyId:copy.copyId,name:o.name,revision:1,baseSealHash:copy.sealHash,baseSaleRevisionHash:bundle.revision.baseSaleRevisionHash,basePriceRevisionHash:bundle.revision.basePriceRevisionHash,profileHash:bundle.revision.profileHash,revisionHash:bundle.revision.revisionHash,afterHash:o.afterHash,actualHash:o.afterHash,objectId:901+i,objectType:'P',immutableTriggerHash:bundle.revision.immutableTriggerHash,triggerDisabled:0,immutableTriggerObjectId:999,immutableParentName:BUSINESS_COLLECTION_HISTORY_REGISTRY,registrySchemaValid:true,sessionId:91,transactionId:'1001'}));
 return {copy,bundle,frame,result:{recordsets:[rows]}};
}

test('collection-history finite native metadata and two-module proof validate content without registration',async()=>{
 const f=await fixture();
 assert.equal(validateBusinessCollectionHistoryMetadata(f.copy,f.bundle,{recordset:[f.frame]}),f.frame);
 assert.equal(validateBusinessCollectionHistoryNativeProof(f.copy,f.bundle,f.result,f.frame),true);
 assert.equal(getRegisteredBusinessCollectionHistoryRevision(f.copy),null);
 assert.match(f.bundle.metadataSQL,/historyDefinitionHash/);assert.match(f.bundle.metadataSQL,/immutableDefinitionHash/);
 for(const permission of ['SELECT','INSERT','UPDATE','DELETE'])assert(f.bundle.metadataSQL.includes("N'"+permission+"')=0"));
});

test('collection-history external pins permissions identity and transaction frame cannot trust owner self-report',async()=>{
 const changes=[m=>m.historyDefinitionHash='E'.repeat(64),m=>m.proofDefinitionHash='E'.repeat(64),m=>m.immutableDefinitionHash='E'.repeat(64),m=>m.historyViewDefinition=0,m=>m.proofViewDefinition=0,m=>m.historyExecute=0,m=>m.proofExecute=0,m=>m.privateAccess=1,m=>m.sysadmin=1,m=>m.control=1,m=>m.originalDatabaseAccess=1,m=>m.live=1,m=>m.databaseUser='dbo',m=>m.login='other',m=>m.db='other',m=>m.server='other',m=>m.transactionCount=0,m=>m.transactionState=-1,m=>m.isolationLevel=2,m=>m.copyLockMode='NoLock',m=>m.transactionId=1001,m=>m.sessionId=0,m=>m.extra=true];
 const f=await fixture();
 for(const change of changes){const frame=structuredClone(f.frame);change(frame);assert.throws(()=>validateBusinessCollectionHistoryMetadata(f.copy,f.bundle,{recordset:[frame]}));}
 assert.equal(getRegisteredBusinessCollectionHistoryRevision(f.copy),null);
 assert.throws(()=>validateBusinessCollectionHistoryMetadata(f.copy,f.bundle,{recordset:[]}));
 assert.throws(()=>validateBusinessCollectionHistoryMetadata(f.copy,f.bundle,{recordset:[f.frame,f.frame]}));
});

test('collection-history registry schema source lineage object and shared frame drift fail closed',async()=>{
 const changes=[r=>r.recordsets[0].pop(),r=>r.recordsets[0].push({...r.recordsets[0][0]}),r=>r.recordsets.push([]),...['copyId','baseSealHash','baseSaleRevisionHash','basePriceRevisionHash','profileHash','revisionHash','afterHash','actualHash','immutableTriggerHash'].map(k=>r=>r.recordsets[0][0][k]='E'.repeat(64)),r=>r.recordsets[0][0].name='dbo.unknown',r=>r.recordsets[0][0].revision=13,r=>r.recordsets[0][0].objectType='TR',r=>r.recordsets[0][0].objectId=null,r=>r.recordsets[0][1].objectId=r.recordsets[0][0].objectId,r=>r.recordsets[0][0].triggerDisabled=true,r=>r.recordsets[0][0].immutableTriggerObjectId=null,r=>r.recordsets[0][0].immutableTriggerObjectId=901,r=>r.recordsets[0][1].immutableTriggerObjectId=998,r=>r.recordsets[0][0].immutableParentName='dbo.products',r=>r.recordsets[0][0].registrySchemaValid=false,r=>r.recordsets[0][0].sessionId=92,r=>r.recordsets[0][0].transactionId='1002',r=>r.recordsets[0][0].extra=true];
 const f=await fixture();
 for(const change of changes){const result=structuredClone(f.result);change(result);assert.throws(()=>validateBusinessCollectionHistoryNativeProof(f.copy,f.bundle,result,f.frame));}
 assert.equal(getRegisteredBusinessCollectionHistoryRevision(f.copy),null);
});

test('collection-history compiler output flags and injected SQL cannot replace earned v13 parent or mint a reader',async()=>{
 const f=await fixture();let queries=0;
 const request={query:async()=>{queries++;throw Error('UNEXPECTED_NATIVE_QUERY');}};
 await assert.rejects(configureBusinessCollectionHistoryRevision(f.copy,f.bundle.revision,request),{code:'COLLECTION_HISTORY_REGISTERED_PARENT_REQUIRED'});
 await assert.rejects(verifyBusinessCollectionHistoryRevision(f.copy,request),{code:'COLLECTION_HISTORY_REGISTERED_CAPABILITY'});
 assert.equal(queries,0);assert.equal(getRegisteredBusinessCollectionHistoryRevision(f.copy),null);assert.equal(getRegisteredBusinessCollectionHistoryRevision(structuredClone(f.copy)),null);
 assert.throws(()=>validateBusinessCollectionHistoryMetadata(f.copy,{...f.bundle,historyArtifact:{...f.bundle.historyArtifact}},{recordset:[f.frame]}),{code:'COLLECTION_HISTORY_SERVER_ARTIFACT_REQUIRED'});
});
