// Read-only adjunct admission. No IO, installation, environment loading or writer grant.
import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {getRegisteredBusinessProductPriceSaleRevision,verifyBusinessProductPriceSaleRevision} from './shared-business-product-price-sale-bootstrap.mjs';
import {buildBusinessCollectionHistoryRevision,assertPreparedBusinessCollectionHistoryArtifact,BUSINESS_COLLECTION_HISTORY_REGISTRY} from './shared-business-collection-history-sql.mjs';

const registered=new WeakMap();
const fail=code=>{throw Object.assign(Error('Satışın salt okunur tahsilat fiyat geçmişi kanıtlanamadı.'),{code,statusCode:503});};
const check=(ok,code)=>{if(!ok)fail(code);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const no=v=>v===false||v===0;
const yes=v=>v===true||v===1;
const metadataKeys=['db','server','login','databaseUser','sysadmin','control','live','originalDatabaseAccess','sessionId','transactionId','transactionCount','transactionState','isolationLevel','copyLockMode','privateAccess','historyExecute','proofExecute','historyViewDefinition','proofViewDefinition','historyDefinitionHash','proofDefinitionHash','immutableDefinitionHash'];
const proofKeys=['copyId','name','revision','baseSealHash','baseSaleRevisionHash','basePriceRevisionHash','profileHash','revisionHash','afterHash','actualHash','objectId','objectType','immutableTriggerHash','triggerDisabled','immutableTriggerObjectId','immutableParentName','registrySchemaValid','sessionId','transactionId'];

function artifacts(copy,bundle){
 assertIsolatedCopyContext(copy);
 assertPreparedBusinessCollectionHistoryArtifact(bundle?.historyArtifact,copy,'history');
 assertPreparedBusinessCollectionHistoryArtifact(bundle?.proofArtifact,copy,'proof');
 check(bundle.revision?.copyId===copy.copyId&&bundle.revision.baseSealHash===copy.sealHash,'COLLECTION_HISTORY_BASE_COPY');
 return bundle;
}

// Pure hostile-result validation never mints a capability.
export function validateBusinessCollectionHistoryMetadata(copy,bundle,result){
 artifacts(copy,bundle);
 check(result?.recordset?.length===1,'COLLECTION_HISTORY_NATIVE_METADATA');
 const m=result.recordset[0];check(exact(m,metadataKeys),'COLLECTION_HISTORY_NATIVE_METADATA');
 assertIsolatedCopyIdentity(copy,m);
 check(Number.isSafeInteger(m.sessionId)&&m.sessionId>0&&typeof m.transactionId==='string'&&/^[1-9]\d*$/.test(m.transactionId)&&m.transactionCount===1&&m.transactionState===1&&m.isolationLevel===4&&['Shared','Exclusive'].includes(m.copyLockMode),'COLLECTION_HISTORY_NATIVE_FRAME');
 check(m.privateAccess===0&&m.historyExecute===1&&m.proofExecute===1&&m.historyViewDefinition===1&&m.proofViewDefinition===1,'COLLECTION_HISTORY_NATIVE_PERMISSION');
 check(m.historyDefinitionHash===bundle.historyArtifact.definitionHash&&m.proofDefinitionHash===bundle.proofArtifact.definitionHash&&m.immutableDefinitionHash===bundle.revision.immutableTriggerHash,'COLLECTION_HISTORY_EXTERNAL_DEFINITION_PIN');
 return m;
}

export function validateBusinessCollectionHistoryNativeProof(copy,bundle,result,frame){
 artifacts(copy,bundle);
 check(Array.isArray(result?.recordsets)&&result.recordsets.length===1&&Array.isArray(result.recordsets[0]),'COLLECTION_HISTORY_NATIVE_RECORDSETS');
 const rows=result.recordsets[0];
 check(rows.length===2&&new Set(rows.map(r=>r?.name)).size===2&&new Set(rows.map(r=>r?.objectId)).size===2,'COLLECTION_HISTORY_NATIVE_MODULE_COUNT');
 for(const r of rows){
  const expected=bundle.objects.find(o=>o.name===r?.name);
  check(exact(r,proofKeys)&&expected&&r.copyId?.toLowerCase()===copy.copyId&&r.revision===1&&r.baseSealHash===copy.sealHash&&r.baseSaleRevisionHash===bundle.revision.baseSaleRevisionHash&&r.basePriceRevisionHash===bundle.revision.basePriceRevisionHash&&r.profileHash===isolatedCopyHash(copy)&&r.revisionHash===bundle.revision.revisionHash&&r.afterHash===expected.afterHash&&r.actualHash===expected.afterHash,'COLLECTION_HISTORY_NATIVE_REGISTRY_PIN');
  check(r.immutableTriggerHash===bundle.revision.immutableTriggerHash&&no(r.triggerDisabled)&&r.immutableParentName===BUSINESS_COLLECTION_HISTORY_REGISTRY&&yes(r.registrySchemaValid),'COLLECTION_HISTORY_NATIVE_REGISTRY_STRUCTURE');
  check(Number.isSafeInteger(r.objectId)&&r.objectId>0&&r.objectType==='P'&&Number.isSafeInteger(r.immutableTriggerObjectId)&&r.immutableTriggerObjectId>0&&!rows.some(o=>o.objectId===r.immutableTriggerObjectId)&&r.sessionId===frame.sessionId&&r.transactionId===frame.transactionId,'COLLECTION_HISTORY_NATIVE_OBJECT_FRAME');
 }
 check(new Set(rows.map(r=>r.immutableTriggerObjectId)).size===1,'COLLECTION_HISTORY_NATIVE_IMMUTABLE_ID');
 return true;
}

function canonical(copy){
 assertIsolatedCopyContext(copy);
 const consumer=getRegisteredBusinessProductPriceSaleRevision(copy);
 check(consumer?.revision?.version===13,'COLLECTION_HISTORY_REGISTERED_PARENT_REQUIRED');
 return {consumer,bundle:buildBusinessCollectionHistoryRevision({copyContext:copy,priceSaleBundle:consumer.bundle})};
}
async function prove(copy,bundle,consumer,request){
 check(typeof request?.query==='function'&&consumer===getRegisteredBusinessProductPriceSaleRevision(copy),'COLLECTION_HISTORY_NATIVE_REQUEST');
 const before=validateBusinessCollectionHistoryMetadata(copy,bundle,await request.query(bundle.metadataSQL));
 check(await verifyBusinessProductPriceSaleRevision(copy,request,{write:false})===consumer,'COLLECTION_HISTORY_FRESH_PARENT');
 validateBusinessCollectionHistoryNativeProof(copy,bundle,await request.query(bundle.proofSQL),before);
 check(await verifyBusinessProductPriceSaleRevision(copy,request,{write:false})===consumer,'COLLECTION_HISTORY_FRESH_PARENT');
 const after=validateBusinessCollectionHistoryMetadata(copy,bundle,await request.query(bundle.metadataSQL));
 check(before.sessionId===after.sessionId&&before.transactionId===after.transactionId&&before.copyLockMode===after.copyLockMode,'COLLECTION_HISTORY_NATIVE_CROSS_TRANSACTION');
}

export async function configureBusinessCollectionHistoryRevision(copy,candidateRevision,request){
 assertIsolatedCopyContext(copy);check(!registered.has(copy),'COLLECTION_HISTORY_ALREADY_REGISTERED');
 const {consumer,bundle}=canonical(copy);
 check(isolatedCopyJSON(candidateRevision)===isolatedCopyJSON(bundle.revision),'COLLECTION_HISTORY_CANONICAL_REVISION');
 await prove(copy,bundle,consumer,request);
 const value=freeze({revision:bundle.revision,bundle,consumer,readOnly:true,canCollect:false,canCancelCollection:false});
 registered.set(copy,value);return value;
}
export function getRegisteredBusinessCollectionHistoryRevision(copy){return registered.get(copy)??null;}
export async function verifyBusinessCollectionHistoryRevision(copy,request){
 assertIsolatedCopyContext(copy);const value=registered.get(copy);
 check(value,'COLLECTION_HISTORY_REGISTERED_CAPABILITY');
 await prove(copy,value.bundle,value.consumer,request);return value;
}
