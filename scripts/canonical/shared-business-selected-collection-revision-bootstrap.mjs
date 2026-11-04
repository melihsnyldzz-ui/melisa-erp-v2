// Earned adjunct capability only. Importing this file installs or enables nothing.
import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {getRegisteredBusinessProductPriceSaleRevision,verifyBusinessProductPriceSaleRevision} from './shared-business-product-price-sale-bootstrap.mjs';
import {getRegisteredBusinessCollectionHistoryRevision,verifyBusinessCollectionHistoryRevision} from './shared-business-collection-history-bootstrap.mjs';
import {buildBusinessSelectedCollectionRevision,assertPreparedBusinessSelectedCollectionArtifact,BUSINESS_SELECTED_COLLECTION_REGISTRY,BUSINESS_SELECTED_COLLECTION_MODULES} from './shared-business-selected-collection-revision-sql.mjs';

const registered=new WeakMap(),kinds=Object.keys(BUSINESS_SELECTED_COLLECTION_MODULES);
const fail=code=>{throw Object.assign(Error('Satışa bağlı tahsilatın yerel yazma kapsamı doğrulanamadı.'),{code,statusCode:503});};
const check=(ok,code)=>{if(!ok)fail(code);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const metadataKeys=['db','server','login','databaseUser','sysadmin','control','live','originalDatabaseAccess','sessionId','transactionId','transactionCount','transactionState','isolationLevel','copyLockMode','privateAccess',...kinds.flatMap(k=>[`${k}Execute`,`${k}ViewDefinition`,`${k}DefinitionHash`]),'immutableDefinitionHash'];
const proofKeys=['copyId','name','revision','baseSealHash','baseSaleRevisionHash','baseHistoryRevisionHash','profileHash','revisionHash','afterHash','actualHash','objectId','objectType','immutableTriggerHash','triggerDisabled','immutableTriggerObjectId','immutableParentName','registrySchemaValid','sessionId','transactionId'];

function artifacts(copy,bundle){
 assertIsolatedCopyContext(copy);
 for(const k of kinds)assertPreparedBusinessSelectedCollectionArtifact(bundle?.[`${k}Artifact`],copy,k);
 check(bundle.revision?.copyId===copy.copyId&&bundle.revision.baseSealHash===copy.sealHash,'SELECTED_COLLECTION_BASE_COPY');
 return bundle;
}

// Pure proof inspection cannot register, rebind or enable a writer.
export function validateBusinessSelectedCollectionMetadata(copy,bundle,result,{write=false}={}){
 artifacts(copy,bundle);check(result?.recordset?.length===1,'SELECTED_COLLECTION_NATIVE_METADATA');
 const m=result.recordset[0];check(exact(m,metadataKeys),'SELECTED_COLLECTION_NATIVE_METADATA');assertIsolatedCopyIdentity(copy,m);
 check(Number.isSafeInteger(m.sessionId)&&m.sessionId>0&&typeof m.transactionId==='string'&&/^[1-9]\d*$/.test(m.transactionId)&&m.transactionCount===1&&m.transactionState===1&&m.isolationLevel===4&&(write?m.copyLockMode==='Exclusive':['Shared','Exclusive'].includes(m.copyLockMode)),'SELECTED_COLLECTION_NATIVE_FRAME');
 check(m.privateAccess===0&&kinds.every(k=>m[`${k}Execute`]===1&&m[`${k}ViewDefinition`]===1&&m[`${k}DefinitionHash`]===bundle[`${k}Artifact`].definitionHash)&&m.immutableDefinitionHash===bundle.revision.immutableTriggerHash,'SELECTED_COLLECTION_NATIVE_PERMISSION_PIN');
 return m;
}

export function validateBusinessSelectedCollectionNativeProof(copy,bundle,result,frame){
 artifacts(copy,bundle);
 check(Array.isArray(result?.recordsets)&&result.recordsets.length===1&&Array.isArray(result.recordsets[0]),'SELECTED_COLLECTION_NATIVE_RECORDSETS');
 const rows=result.recordsets[0];check(rows.length===5&&new Set(rows.map(r=>r?.name)).size===5&&new Set(rows.map(r=>r?.objectId)).size===5,'SELECTED_COLLECTION_NATIVE_MODULE_COUNT');
 for(const r of rows){
  const o=bundle.objects.find(o=>o.name===r?.name);
  check(exact(r,proofKeys)&&o&&r.copyId?.toLowerCase()===copy.copyId&&r.revision===1&&r.baseSealHash===copy.sealHash&&r.baseSaleRevisionHash===bundle.revision.baseSaleRevisionHash&&r.baseHistoryRevisionHash===bundle.revision.baseHistoryRevisionHash&&r.profileHash===isolatedCopyHash(copy)&&r.revisionHash===bundle.revision.revisionHash&&r.afterHash===o.afterHash&&r.actualHash===o.afterHash,'SELECTED_COLLECTION_NATIVE_REGISTRY_PIN');
  check(r.immutableTriggerHash===bundle.revision.immutableTriggerHash&&(r.triggerDisabled===false||r.triggerDisabled===0)&&r.immutableParentName===BUSINESS_SELECTED_COLLECTION_REGISTRY&&(r.registrySchemaValid===true||r.registrySchemaValid===1),'SELECTED_COLLECTION_NATIVE_REGISTRY_STRUCTURE');
  check(Number.isSafeInteger(r.objectId)&&r.objectId>0&&r.objectType==='P'&&Number.isSafeInteger(r.immutableTriggerObjectId)&&r.immutableTriggerObjectId>0&&!rows.some(o=>o.objectId===r.immutableTriggerObjectId)&&r.sessionId===frame.sessionId&&r.transactionId===frame.transactionId,'SELECTED_COLLECTION_NATIVE_OBJECT_FRAME');
 }
 check(new Set(rows.map(r=>r.immutableTriggerObjectId)).size===1,'SELECTED_COLLECTION_NATIVE_IMMUTABLE_ID');return true;
}

function canonical(copy){
 assertIsolatedCopyContext(copy);
 const consumer=getRegisteredBusinessProductPriceSaleRevision(copy),history=getRegisteredBusinessCollectionHistoryRevision(copy);
 check(consumer?.revision?.version===13&&history?.readOnly===true&&history.consumer===consumer,'SELECTED_COLLECTION_REGISTERED_PARENTS_REQUIRED');
 const bundle=buildBusinessSelectedCollectionRevision({copyContext:copy,priceSaleBundle:consumer.bundle});
 check(bundle.revision.baseHistoryRevisionHash===history.revision.revisionHash,'SELECTED_COLLECTION_HISTORY_PARENT');return {consumer,history,bundle};
}

async function prove(copy,bundle,consumer,history,request,{write=false}={}){
 check(typeof request?.query==='function'&&consumer===getRegisteredBusinessProductPriceSaleRevision(copy)&&history===getRegisteredBusinessCollectionHistoryRevision(copy),'SELECTED_COLLECTION_NATIVE_REQUEST');
 const before=validateBusinessSelectedCollectionMetadata(copy,bundle,await request.query(bundle.metadataSQL),{write});
 check(await verifyBusinessProductPriceSaleRevision(copy,request,{write})===consumer,'SELECTED_COLLECTION_FRESH_PARENT');
 check(await verifyBusinessCollectionHistoryRevision(copy,request)===history,'SELECTED_COLLECTION_FRESH_HISTORY');
 validateBusinessSelectedCollectionNativeProof(copy,bundle,await request.query(bundle.proofSQL),before);
 check(await verifyBusinessCollectionHistoryRevision(copy,request)===history,'SELECTED_COLLECTION_FRESH_HISTORY');
 check(await verifyBusinessProductPriceSaleRevision(copy,request,{write})===consumer,'SELECTED_COLLECTION_FRESH_PARENT');
 const after=validateBusinessSelectedCollectionMetadata(copy,bundle,await request.query(bundle.metadataSQL),{write});
 check(before.sessionId===after.sessionId&&before.transactionId===after.transactionId&&before.copyLockMode===after.copyLockMode,'SELECTED_COLLECTION_NATIVE_CROSS_TRANSACTION');
}

export async function configureBusinessSelectedCollectionRevision(copy,candidateRevision,request){
 assertIsolatedCopyContext(copy);check(!registered.has(copy),'SELECTED_COLLECTION_ALREADY_REGISTERED');
 const {consumer,history,bundle}=canonical(copy);check(isolatedCopyJSON(candidateRevision)===isolatedCopyJSON(bundle.revision),'SELECTED_COLLECTION_CANONICAL_REVISION');
 await prove(copy,bundle,consumer,history,request);
 const value=freeze({revision:bundle.revision,bundle,consumer,history,readOnly:false,canCollect:true,canCancelCollection:true,genericScopeOnly:true});registered.set(copy,value);return value;
}

export function getRegisteredBusinessSelectedCollectionRevision(copy){return registered.get(copy)??null;}
export async function verifyBusinessSelectedCollectionRevision(copy,request,{write=false}={}){
 assertIsolatedCopyContext(copy);const value=registered.get(copy);check(value,'SELECTED_COLLECTION_REGISTERED_CAPABILITY');
 await prove(copy,value.bundle,value.consumer,value.history,request,{write});return value;
}
