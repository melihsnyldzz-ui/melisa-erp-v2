// Earned native consumer capability. No IO/config loading, installation or DDL.
import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {getRegisteredBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-bootstrap.mjs';
import {getRegisteredBusinessProductPriceRevision,verifyBusinessProductPriceRevision} from './shared-business-product-price-bootstrap.mjs';
import {buildBusinessProductPriceSaleRevision,BUSINESS_PRICE_SALE_CONTEXT,BUSINESS_PRICE_SALE_BEGIN,BUSINESS_PRICE_SALE_INTENT,BUSINESS_PRICE_SALE_HISTORY,BUSINESS_PRICE_SALE_ASSERT,BUSINESS_PRICE_SALE_PROOF,BUSINESS_PRICE_SALE_LINK_GUARD,BUSINESS_PRICE_SALE_REGISTRY} from './shared-business-product-price-sale-sql.mjs';

const registered=new WeakMap();
const check=(ok,code)=>{if(!ok)throw Object.assign(Error('Kayıtlı TEST fiyatının belge tüketim kanıtı doğrulanamadı.'),{code,statusCode:503});};
const exact=(v,ks)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===ks.toSorted().join();
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const no=v=>v===false||v===0;
const executeNames=[BUSINESS_PRICE_SALE_CONTEXT,BUSINESS_PRICE_SALE_BEGIN,BUSINESS_PRICE_SALE_INTENT,BUSINESS_PRICE_SALE_HISTORY,BUSINESS_PRICE_SALE_ASSERT,BUSINESS_PRICE_SALE_PROOF];
const metaKeys=['db','server','login','databaseUser','sysadmin','control','live','originalDatabaseAccess','sessionId','transactionId','transactionCount','transactionState','isolationLevel','copyLockMode','privateAccess','contextExecute','beginExecute','intentExecute','historyExecute','assertExecute','proofExecute','proofViewDefinition','proofDefinitionHash'];
export const BUSINESS_PRODUCT_PRICE_SALE_METADATA_SQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,@@SPID sessionId,CONVERT(varchar(30),CURRENT_TRANSACTION_ID()) transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,CASE WHEN HAS_PERMS_BY_NAME(N'${BUSINESS_PRICE_SALE_REGISTRY}','OBJECT','SELECT')=0 AND HAS_PERMS_BY_NAME(N'${BUSINESS_PRICE_SALE_REGISTRY}','OBJECT','INSERT')=0 AND HAS_PERMS_BY_NAME(N'${BUSINESS_PRICE_SALE_REGISTRY}','OBJECT','UPDATE')=0 AND HAS_PERMS_BY_NAME(N'${BUSINESS_PRICE_SALE_REGISTRY}','OBJECT','DELETE')=0 THEN 0 ELSE 1 END privateAccess,${executeNames.map((n,i)=>`HAS_PERMS_BY_NAME(N'${n}','OBJECT','EXECUTE') ${['context','begin','intent','history','assert','proof'][i]}Execute`).join(',')},HAS_PERMS_BY_NAME(N'${BUSINESS_PRICE_SALE_PROOF}','OBJECT','VIEW DEFINITION') proofViewDefinition,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${BUSINESS_PRICE_SALE_PROOF}',N'P'))),2) proofDefinitionHash;`;

export function validateBusinessProductPriceSaleMetadata(copy,bundle,result,{write=false}={}){
 assertIsolatedCopyContext(copy);
 const m=result?.recordset?.length===1?result.recordset[0]:null;
 check(m&&exact(m,metaKeys)&&typeof write==='boolean','PRICE_SALE_NATIVE_METADATA');
 assertIsolatedCopyIdentity(copy,m);
 check(Number.isSafeInteger(m.sessionId)&&m.sessionId>0&&typeof m.transactionId==='string'&&/^[1-9]\d*$/.test(m.transactionId)&&m.transactionCount===1&&m.transactionState===1&&m.isolationLevel===4&&(write?m.copyLockMode==='Exclusive':['Shared','Exclusive'].includes(m.copyLockMode))&&m.privateAccess===0&&['context','begin','intent','history','assert','proof'].every(k=>m[k+'Execute']===1)&&m.proofViewDefinition===1,'PRICE_SALE_NATIVE_FRAME');
 check(m.proofDefinitionHash===bundle.proofArtifact.definitionHash,'PRICE_SALE_NATIVE_EXTERNAL_PROOF_PIN');
 return m;
}

const rowKeys=['copyId','name','revision','baseSealHash','basePriceRevisionHash','baseSelectedRevisionHash','profileHash','afterHash','revisionHash','actualHash','immutableTriggerHash','triggerDisabled','objectId','objectType','parentName','moduleDisabled','insteadOfTrigger','sessionId','transactionId','immutableParentName','registrySchemaValid','immutableTriggerObjectId','immutableTriggerType','immutableInsteadOfTrigger','immutableEventCount'];
// Pure hostile-proof checks do not mint a capability. Configuration also needs
// already registered metadata/v11 parents and restricted caller pins outside EXEC.
export function validateBusinessProductPriceSaleNativeProof(copy,bundle,result,frame){
 assertIsolatedCopyContext(copy);
 check(Array.isArray(result?.recordsets)&&result.recordsets.length===1&&Array.isArray(result.recordsets[0]),'PRICE_SALE_NATIVE_RECORDSETS');
 const rows=result.recordsets[0];
 check(rows.length===7&&new Set(rows.map(r=>r.name)).size===7&&new Set(rows.map(r=>r.objectId)).size===7,'PRICE_SALE_NATIVE_MODULE_COUNT');
 for(const r of rows){
  const expected=bundle.objects.find(o=>o.name===r.name),trigger=r.name===BUSINESS_PRICE_SALE_LINK_GUARD;
  check(exact(r,rowKeys)&&expected&&r.copyId?.toLowerCase()===copy.copyId&&r.revision===13&&r.baseSealHash===copy.sealHash&&r.basePriceRevisionHash===bundle.revision.basePriceRevisionHash&&r.baseSelectedRevisionHash===bundle.revision.baseSelectedRevisionHash&&r.profileHash===isolatedCopyHash(copy)&&r.revisionHash===bundle.revision.revisionHash&&r.afterHash===expected.afterHash&&r.actualHash===expected.afterHash&&r.immutableTriggerHash===bundle.revision.immutableTriggerHash&&no(r.triggerDisabled)&&r.immutableParentName===BUSINESS_PRICE_SALE_REGISTRY,'PRICE_SALE_NATIVE_REGISTRY_PIN');
  check(Number.isSafeInteger(r.objectId)&&r.objectId>0&&r.objectType===(trigger?'TR':'P')&&r.parentName===(trigger?'dbo.work_sales_links':null)&&no(r.moduleDisabled)&&no(r.insteadOfTrigger)&&r.sessionId===frame.sessionId&&r.transactionId===frame.transactionId,'PRICE_SALE_NATIVE_OBJECT_FRAME');
  check((r.registrySchemaValid===true||r.registrySchemaValid===1)&&Number.isSafeInteger(r.immutableTriggerObjectId)&&r.immutableTriggerObjectId>0&&!rows.some(o=>o.objectId===r.immutableTriggerObjectId)&&r.immutableTriggerType==='TR'&&no(r.immutableInsteadOfTrigger)&&r.immutableEventCount===3,'PRICE_SALE_NATIVE_REGISTRY_STRUCTURE');
 }
 check(new Set(rows.map(r=>r.immutableTriggerObjectId)).size===1,'PRICE_SALE_NATIVE_IMMUTABLE_ID');
 return true;
}

function canonicalBundle(copy,selectedBaseInput){
 const selected=getRegisteredBusinessSelectedSaleRevision(copy),metadata=getRegisteredBusinessProductPriceRevision(copy);
 check(selected?.stockPredicateRevision?.version===11&&metadata&&selectedBaseInput,'PRICE_SALE_REGISTERED_PARENTS_REQUIRED');
 check(metadata.revision.baseRevisionHash===selected.stockPredicateRevision.revisionHash,'PRICE_SALE_REGISTERED_PREDECESSOR');
 return buildBusinessProductPriceSaleRevision({copyContext:copy,priceBundle:metadata.bundle,selectedBundle:selected.bundle,selectedBaseInput});
}
async function prove(copy,bundle,request,{write=false}={}){
 check(typeof request?.query==='function','PRICE_SALE_NATIVE_REQUEST');
 const before=validateBusinessProductPriceSaleMetadata(copy,bundle,await request.query(BUSINESS_PRODUCT_PRICE_SALE_METADATA_SQL),{write});
 // Read-only metadata verification intentionally does not depend on this
 // consumer's canEdit capability, avoiding circular activation or trust.
 await verifyBusinessProductPriceRevision(copy,request,{write:false});
 validateBusinessProductPriceSaleNativeProof(copy,bundle,await request.query(bundle.proofSQL),before);
 const after=validateBusinessProductPriceSaleMetadata(copy,bundle,await request.query(BUSINESS_PRODUCT_PRICE_SALE_METADATA_SQL),{write});
 check(before.sessionId===after.sessionId&&before.transactionId===after.transactionId&&before.copyLockMode===after.copyLockMode,'PRICE_SALE_NATIVE_CROSS_TRANSACTION');
}

export async function configureBusinessProductPriceSaleRevision(copy,candidateRevision,request,{selectedBaseInput}={}){
 assertIsolatedCopyContext(copy);check(!registered.has(copy),'PRICE_SALE_ALREADY_REGISTERED');
 const bundle=canonicalBundle(copy,selectedBaseInput);
 check(isolatedCopyJSON(candidateRevision)===isolatedCopyJSON(bundle.revision),'PRICE_SALE_CANONICAL_REVISION');
 await prove(copy,bundle,request);
 const value=freeze({revision:bundle.revision,bundle,canEdit:true});registered.set(copy,value);return value;
}
export function getRegisteredBusinessProductPriceSaleRevision(copy){return registered.get(copy)??null;}
export async function verifyBusinessProductPriceSaleRevision(copy,request,{write=false}={}){
 assertIsolatedCopyContext(copy);const value=registered.get(copy);
 check(value&&typeof write==='boolean','PRICE_SALE_REGISTERED_CAPABILITY');
 await prove(copy,value.bundle,request,{write});return value;
}
