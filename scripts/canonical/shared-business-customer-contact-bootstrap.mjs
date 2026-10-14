// Restricted native proof earns these WeakMaps. Importing/config JSON does not.
import {CUSTOMER_CONTACT_CONTEXT as GET,CUSTOMER_CONTACT_UPDATE as SET,CUSTOMER_CONTACT_PROOF as PROOF,CUSTOMER_CONTACT_REGISTRY as REG,CUSTOMER_CONTACT_PROJECTOR as FN,CUSTOMER_CONTACT_FRAME_KEYS,CUSTOMER_CONTACT_PROOF_ROW_KEYS,CUSTOMER_CONTACT_PREDECESSOR_NAMES,CUSTOMER_CONTACT_REVISION_SCHEMA} from './shared-business-customer-contact-contract.mjs';
import {buildCustomerContactRevision,assertPreparedCustomerContactArtifact,customerContactHash,customerContactJSON} from './shared-business-customer-contact-sql.mjs';
const registered=new WeakMap(),compatibility=new WeakMap(),earned=new WeakMap();
const fail=()=>{throw Object.assign(new Error('Müşteri iletişim yetkisi ve kayıt kapsamı doğrulanamadı.'),{code:'CUSTOMER_CONTACT_UNAVAILABLE',statusCode:503});};
const check=v=>{if(!v)fail();};
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===k.toSorted().join();
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const bit0=v=>v===0||v===false;
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const frameEqual=(a,b)=>a.sessionId===b.sessionId&&String(a.transactionId)===String(b.transactionId)&&a.copyLockMode===b.copyLockMode;
const DB='MELISA_ERP_CRM_SHARED_TEST_20261009_02',COPY='e16b70f0-4057-428b-9abc-6bbcaf35fe82',ERP='melisa_shared_test_rw_20261009_02',CRM='melisa_crm_shared_draft_20261009_02';
export const CUSTOMER_CONTACT_METADATA_SQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,@@SPID sessionId,CONVERT(varchar(30),CURRENT_TRANSACTION_ID()) transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:${COPY}',N'Transaction') copyLockMode,HAS_PERMS_BY_NAME(N'${GET}','OBJECT','EXECUTE') contextExecute,HAS_PERMS_BY_NAME(N'${SET}','OBJECT','EXECUTE') updateExecute,HAS_PERMS_BY_NAME(N'${PROOF}','OBJECT','EXECUTE') proofExecute,HAS_PERMS_BY_NAME(N'${PROOF}','OBJECT','VIEW DEFINITION') proofViewDefinition,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${PROOF}',N'P'))),2) proofDefinitionHash,CASE WHEN HAS_PERMS_BY_NAME(N'${REG}','OBJECT','SELECT')=0 AND HAS_PERMS_BY_NAME(N'${REG}','OBJECT','INSERT')=0 AND HAS_PERMS_BY_NAME(N'${REG}','OBJECT','UPDATE')=0 AND HAS_PERMS_BY_NAME(N'${REG}','OBJECT','DELETE')=0 THEN 0 ELSE 1 END registryPrivateAccess,CASE WHEN HAS_PERMS_BY_NAME(N'${FN}','OBJECT','SELECT')=0 AND HAS_PERMS_BY_NAME(N'${FN}','OBJECT','EXECUTE')=0 THEN 0 ELSE 1 END projectorPrivateAccess;`;
async function assertContext(context,kind){
 check(kind==='ERP'||kind==='CRM');
 if(kind==='ERP'){
  const {assertIsolatedCopyContext}=await import('../../apps/api/src/services/isolatedOperationCopyContext.mjs');assertIsolatedCopyContext(context);
  check(context.copyId===COPY&&context.target.database===DB&&context.target.login===ERP&&context.actualT1===false);
 }else{
  const {assertCrmOrderCurrentContext}=await import('../../apps/api/src/services/crmOrderCurrentContext.mjs');assertCrmOrderCurrentContext(context);
  check(context.copyId===COPY&&context.target.database===DB&&context.target.login===CRM);
 }
}
function metadata(result,revision,kind,write){
 check(result?.recordset?.length===1);const m=result.recordset[0];
 check(exact(m,CUSTOMER_CONTACT_FRAME_KEYS)&&m.db===DB&&m.server==='Semih\\MELISADEV'&&m.login===(kind==='ERP'?ERP:CRM)&&m.databaseUser===m.login&&bit0(m.sysadmin)&&bit0(m.control)&&bit0(m.live)&&bit0(m.originalDatabaseAccess)&&Number.isSafeInteger(m.sessionId)&&m.sessionId>0&&/^[1-9]\d*$/.test(String(m.transactionId))&&m.transactionCount===1&&m.transactionState===1&&m.isolationLevel===4&&(write?m.copyLockMode==='Exclusive':['Shared','Exclusive'].includes(m.copyLockMode))&&bit0(m.registryPrivateAccess)&&bit0(m.projectorPrivateAccess)&&m.proofExecute===1&&m.proofViewDefinition===1&&m.proofDefinitionHash===revision.modules.find(x=>x.name===PROOF)?.afterHash);
 check(kind==='ERP'?m.contextExecute===1&&m.updateExecute===1:bit0(m.contextExecute)&&bit0(m.updateExecute));return m;
}
export function validateCustomerContactNativeProof(revision,result,frame){
 check(revision?.schemaVersion===CUSTOMER_CONTACT_REVISION_SCHEMA&&revision.copyId===COPY&&revision.version===1&&hash(revision.scopeHash)&&Array.isArray(revision.modules)&&revision.modules.length===22&&new Set(revision.modules.map(x=>x.name)).size===22);
 const {revisionHash,...body}=revision;check(hash(revisionHash)&&customerContactHash(customerContactJSON(body))===revisionHash);
 check(Array.isArray(result?.recordsets)&&result.recordsets.length===3&&result.recordsets.every(Array.isArray)&&result.recordsets[0].length===1&&result.recordsets[2].length===1);
 const f=result.recordsets[0][0];check(exact(f,['sessionId','transactionId','scopeHash'])&&f.sessionId===frame.sessionId&&String(f.transactionId)===String(frame.transactionId)&&f.scopeHash===revision.scopeHash);
 const rows=result.recordsets[1];check(rows.length===22&&new Set(rows.map(x=>x.name)).size===22);
 for(const r of rows){const p=revision.modules.find(x=>x.name===r.name);check(p&&exact(r,CUSTOMER_CONTACT_PROOF_ROW_KEYS)&&r.copyId?.toLowerCase()===COPY&&r.moduleType===p.moduleType&&r.beforeHash===p.beforeHash&&r.afterHash===p.afterHash&&r.actualHash===p.afterHash&&r.scopeHash===revision.scopeHash&&r.revisionHash===revisionHash&&Number.isSafeInteger(r.objectId)&&r.objectId>0&&bit0(r.moduleDisabled)&&r.parentName===(r.name==='dbo.business_product_price_sale_link_guard'?'dbo.work_sales_links':null)&&r.immutableHash===revision.immutableTriggerHash&&bit0(r.immutableDisabled));}
 check(new Set(rows.map(x=>x.objectId)).size===22);
 const s=result.recordsets[2][0];check(exact(s,['scope_json'])&&typeof s.scope_json==='string'&&customerContactHash(s.scope_json)===revision.scopeHash&&s.scope_json===customerContactJSON(revision.scope));return true;
}
async function prove(context,request,revision,kind,write){
 await assertContext(context,kind);check(typeof request?.query==='function'&&typeof write==='boolean'&&!(kind==='CRM'&&write));
 if(kind==='ERP')check(revision.baseSealHash===context.sealHash&&revision.profileHash===customerContactHash(customerContactJSON(context))&&revision.scope?.profileHash===revision.profileHash);
 const before=metadata(await request.query(CUSTOMER_CONTACT_METADATA_SQL),revision,kind,write);
 const result=await request.query(`DECLARE @copy_id uniqueidentifier=N'${COPY}',@proved bit;EXEC ${PROOF} @copy_id,@emit=1,@proved=@proved OUTPUT;`);
 validateCustomerContactNativeProof(revision,result,before);
 const after=metadata(await request.query(CUSTOMER_CONTACT_METADATA_SQL),revision,kind,write);check(frameEqual(before,after));
 return Object.freeze({context,revision,kind,frame:after});
}
export async function configureCustomerContactRevision(copy,candidate,request,{sourceInput}={}){
 await assertContext(copy,'ERP');check(!registered.has(copy));
 const bundle=sourceInput?buildCustomerContactRevision({...sourceInput,copyContext:copy}):assertPreparedCustomerContactArtifact(copy,candidate);
 const revision=candidate?.revision??candidate;check(customerContactJSON(bundle.revision)===customerContactJSON(revision));
 await prove(copy,request,bundle.revision,'ERP',false);
 const capability=freeze({revision:bundle.revision,actor:{...bundle.revision.actor},modules:bundle.revision.modules,bundle});registered.set(copy,capability);return capability;
}
export function getRegisteredCustomerContactRevision(copy){return registered.get(copy)??null;}
export function getRegisteredCustomerContactCompatibility(context){return compatibility.get(context)??null;}
export async function verifyCustomerContactRevision(copy,request,{write=false}={}){
 const cap=registered.get(copy);check(cap&&typeof write==='boolean');await prove(copy,request,cap.revision,'ERP',write);return cap;
}
// A CRM compatibility descriptor has structural proof authority only; it
// cannot register an ERP contact writer or add actors to the sealed copy.
export async function verifyCustomerContactCompatibility(context,request,descriptor,{contextClass='ERP'}={}){
 const revision=descriptor?.revision??descriptor;await assertContext(context,contextClass);
 check(revision?.scope?.profileHash===revision.profileHash&&revision.baseSealHash===revision.scope.sealHash);
 const proof=await prove(context,request,revision,contextClass,false);
 compatibility.set(context,freeze({revision,contextClass}));return proof;
}
export function projectCustomerContactPredecessorProof(witness,result,{metadataModule=null}={}){
 const p=earned.get(witness);check(p&&witness.context===p.context);const cloned=structuredClone(result);
 const project=(name,value)=>{const m=p.revision.modules.find(x=>x.name===name&&CUSTOMER_CONTACT_PREDECESSOR_NAMES.includes(name));if(!m||value!==m.afterHash)return value;check(hash(m.beforeHash));return m.beforeHash;};
 const sets=cloned.recordsets??(Array.isArray(cloned.recordset)?[cloned.recordset]:[]);check(Array.isArray(sets));
 for(const set of sets)for(const row of set){
  if(typeof row.name==='string')for(const key of ['actualHash','proofDefinitionHash','readerDefinitionHash'])if(Object.hasOwn(row,key))row[key]=project(row.name,row[key]);
  if(metadataModule)for(const key of ['proofDefinitionHash','readerDefinitionHash'])if(Object.hasOwn(row,key))row[key]=project(metadataModule,row[key]);
 }
 return cloned;
}
export async function withCustomerContactCompatibilityProof(context,request,descriptor,callback,options={}){
 check(typeof callback==='function');const witness=await verifyCustomerContactCompatibility(context,request,descriptor,options);
 earned.set(witness,{context,revision:witness.revision,kind:witness.kind,frame:witness.frame});
 try{
  const value=await callback((result,projectionOptions)=>projectCustomerContactPredecessorProof(witness,result,projectionOptions));
  await prove(context,request,witness.revision,witness.kind,false);return value;
 }finally{earned.delete(witness);}
}
