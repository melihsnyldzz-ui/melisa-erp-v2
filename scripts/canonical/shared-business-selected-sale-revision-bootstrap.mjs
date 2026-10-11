import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,isolatedCopyTopology,copyAssert,isolatedCopyHash,isolatedCopyJSON,validateIsolatedOperationCopyContext,getBusinessDailyHomeReadRevisions} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {configureBusinessDailyRevision,BUSINESS_DAILY_REVISION_PROOF_SQL} from '../../apps/api/src/services/businessDailyRevisionBootstrap.mjs';
import {businessDailyProfitReadSQL} from '../../apps/api/src/services/businessDailyProfitRevision.mjs';
import {businessDailyNativeCheckReadSQL} from '../../apps/api/src/services/businessDailyNativeCheck.mjs';
import {buildBusinessSelectedSaleRevision,validateBusinessSelectedSaleInstall} from './shared-business-selected-sale-revision-sql.mjs';
import {buildBusinessSelectedSaleEffectsRevision,SELECTED_SALE_EFFECTS_MODULES} from './shared-business-selected-sale-effects-revision-sql.mjs';
import {buildBusinessSelectedSaleParentRevision,SELECTED_SALE_PARENT_MODULES} from './shared-business-selected-sale-parent-revision-sql.mjs';
import {SELECTED_SALE_REGISTRY,SELECTED_SALE_IMMUTABLE} from './shared-business-selected-sale-revision-contract.mjs';
import {COPY_MUTABLE_TABLES} from './stage4-copy-sql.mjs';

// Registration is earned by native proof and canonical source regeneration.
// There is deliberately no caller-facing registration or hash override setter.
const registered=new WeakMap();
// Keep the SQL export available during the core/store/compiler import cycle.
// At proof time this finite projection must equal the compiler's table set.
const schemaTables=Object.freeze([
 'products','customers','suppliers','party_currency_accounts','finance_accounts',
 'sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items',
 'customer_movements','supplier_movements','finance_account_movements','stock_movements',
 'invoice_returns','invoice_return_items','audit_logs',
 'test_daily_drafts','test_daily_requests','test_stock_reversals','test_goods_batches','test_goods_batch_lines',
 'test_purchase_batch_drafts','test_purchase_batch_links','test_purchase_batch_intent_lines',
 'test_finance_requests','test_payment_requests','test_refund_requests','test_purchase_requests',
 'work_inbound_counts','work_inbound_requests','work_supplier_payment_requests',
 'work_trade_requests','work_trade_intents','work_sales_links','work_collection_links',
]);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const hex=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const moduleNames=['ready','context','begin','guard','effects'].map(k=>'dbo.usp_stage4_copy_'+k).concat(['dbo.usp_business_daily_context','dbo.usp_business_selected_sale_context_v2','dbo.usp_business_selected_sale_write_intent_v1','dbo.usp_business_selected_sale_begin_v1','dbo.usp_business_selected_sale_guard_v1']);
const revisionKeys=['schemaVersion','version','copyId','baseSealHash','baseDailyRevisionHash','baseProfitRevisionHash','profileHash','modules','immutableTriggerHash','operations','maxItems','quantity','maxInvoiceAmountExact4','revisionHash'];
const rowKeys=['copyId','name','revision','baseSealHash','baseDailyRevisionHash','baseProfitRevisionHash','beforeHash','afterHash','revisionHash','profileHash','actualHash','immutableTriggerHash','triggerDisabled'];
const metadataKeys=['db','server','login','databaseUser','sysadmin','control','live','originalDatabaseAccess','sessionId','transactionId','transactionCount','transactionState','isolationLevel','copyLockMode','manifestRows','moduleManifestRows','copyId','sealHash','backupSHA','profileHash','queryPlanRegistryExists'];

const metadataSQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,
@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,
(SELECT COUNT(*) FROM dbo.stage4_copy_manifest) manifestRows,(SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest) moduleManifestRows,CONVERT(varchar(36),m.copy_id) copyId,m.seal_hash sealHash,m.backup_sha backupSHA,CONVERT(varchar(64),HASHBYTES('SHA2_256',m.profile_json),2) profileHash,CONVERT(bit,CASE WHEN OBJECT_ID(N'dbo.stage4_copy_readiness_query_plan_revisions') IS NULL THEN 0 ELSE 1 END) queryPlanRegistryExists FROM dbo.stage4_copy_manifest m WITH(HOLDLOCK) WHERE m.copy_id=@copy_id AND m.sealed=1;`;

export const BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL=metadataSQL+BUSINESS_DAILY_REVISION_PROOF_SQL+businessDailyProfitReadSQL()+businessDailyNativeCheckReadSQL()+`
SELECT CONVERT(varchar(36),r.copy_id) copyId,r.name,r.revision,r.base_seal_hash baseSealHash,r.base_daily_revision_hash baseDailyRevisionHash,r.base_profit_revision_hash baseProfitRevisionHash,r.before_hash beforeHash,r.after_hash afterHash,r.revision_hash revisionHash,r.profile_hash profileHash,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(r.name))),2) actualHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${SELECTED_SALE_IMMUTABLE}'))),2) immutableTriggerHash,ISNULL(CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'${SELECTED_SALE_IMMUTABLE}'),'ExecIsTriggerDisabled')),1) triggerDisabled FROM ${SELECTED_SALE_REGISTRY} r WITH(HOLDLOCK) ORDER BY r.name;
SELECT s.name schemaName,t.name tableName,c.name columnName,y.name typeName FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types y ON y.user_type_id=c.user_type_id WHERE s.name=N'dbo' AND t.name IN(${schemaTables.map(t=>`N'${t}'`).join(',')}) ORDER BY s.name,t.name,c.name;`+metadataSQL;

// Keep this finite SQL available during the core/compiler import cycle.
export const BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL=metadataSQL+`
SELECT CONVERT(varchar(36),r.copy_id) copyId,r.name,r.revision,r.base_seal_hash baseSealHash,r.base_selected_revision_hash baseSelectedRevisionHash,r.profile_hash profileHash,r.before_hash beforeHash,r.after_hash afterHash,r.revision_hash revisionHash,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(r.name))),2) actualHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.immutable_stage4_copy_business_selected_sale_effects_revisions'))),2) immutableTriggerHash,ISNULL(CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'dbo.immutable_stage4_copy_business_selected_sale_effects_revisions'),'ExecIsTriggerDisabled')),1) triggerDisabled FROM dbo.stage4_copy_business_selected_sale_effects_revisions r WITH(HOLDLOCK) ORDER BY r.name;
`+metadataSQL;

export const BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL=metadataSQL+`
SELECT CONVERT(varchar(36),r.copy_id) copyId,r.name,r.revision,r.base_seal_hash baseSealHash,r.base_selected_revision_hash baseSelectedRevisionHash,r.base_effects_revision_hash baseEffectsRevisionHash,r.profile_hash profileHash,r.before_hash beforeHash,r.after_hash afterHash,r.revision_hash revisionHash,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(r.name))),2) actualHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.immutable_stage4_copy_business_selected_sale_parent_revisions'))),2) immutableTriggerHash,ISNULL(CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'dbo.immutable_stage4_copy_business_selected_sale_parent_revisions'),'ExecIsTriggerDisabled')),1) triggerDisabled FROM dbo.stage4_copy_business_selected_sale_parent_revisions r WITH(HOLDLOCK) ORDER BY r.name;
`+metadataSQL;

function validateParentRevision(copy,base,effects,revision){
 const keys=['schemaVersion','version','copyId','baseSealHash','baseSelectedRevisionHash','baseEffectsRevisionHash','profileHash','modules','immutableTriggerHash','repair','revisionHash'];
 copyAssert(effects&&exact(revision,keys)&&revision.schemaVersion==='melisa-business-selected-sale-parent-revision.v1'&&revision.version===8&&revision.copyId===copy.copyId&&revision.baseSealHash===copy.sealHash&&revision.baseSelectedRevisionHash===base.revisionHash&&revision.baseEffectsRevisionHash===effects.revisionHash&&revision.profileHash===isolatedCopyHash(copy)&&revision.repair==='CURRENT_PARENT_PINS','SELECTED_PARENT_BOOT_REVISION');
 const {revisionHash,...body}=revision;copyAssert(hex(revisionHash)&&revisionHash===isolatedCopyHash(body)&&hex(revision.immutableTriggerHash),'SELECTED_PARENT_BOOT_SEAL');
 copyAssert(Array.isArray(revision.modules)&&revision.modules.length===4&&revision.modules.every((m,i)=>exact(m,['name','beforeHash','afterHash'])&&m.name===SELECTED_SALE_PARENT_MODULES[i]&&hex(m.afterHash)&&m.beforeHash===(effects.modules.find(p=>p.name===m.name)?.afterHash??base.modules.find(p=>p.name===m.name)?.afterHash)&&m.beforeHash!==m.afterHash),'SELECTED_PARENT_BOOT_PREDECESSOR_PINS');
}
function parentProof(copy,revision,result,nativeReadOnly){
 copyAssert(Array.isArray(result?.recordsets)&&result.recordsets.length===3&&result.recordsets.every(Array.isArray)&&result.recordsets[0].length===1&&result.recordsets[2].length===1,'SELECTED_PARENT_BOOT_RECORDSETS');
 const before=result.recordsets[0][0],after=result.recordsets[2][0];metadata(copy,before,nativeReadOnly);metadata(copy,after,nativeReadOnly);copyAssert(isolatedCopyJSON(before)===isolatedCopyJSON(after),'SELECTED_PARENT_BOOT_SAME_TRANSACTION');
 const rows=result.recordsets[1],keys=['copyId','name','revision','baseSealHash','baseSelectedRevisionHash','baseEffectsRevisionHash','profileHash','beforeHash','afterHash','revisionHash','actualHash','immutableTriggerHash','triggerDisabled'];
 copyAssert(rows.length===4&&new Set(rows.map(r=>r.name)).size===4,'SELECTED_PARENT_BOOT_REGISTRY_ROWS');
 for(const m of revision.modules){const r=rows.find(r=>r.name===m.name);copyAssert(exact(r,keys)&&r.copyId?.toLowerCase()===copy.copyId&&r.revision===8&&r.baseSealHash===copy.sealHash&&r.baseSelectedRevisionHash===revision.baseSelectedRevisionHash&&r.baseEffectsRevisionHash===revision.baseEffectsRevisionHash&&r.profileHash===revision.profileHash&&r.beforeHash===m.beforeHash&&r.afterHash===m.afterHash&&r.actualHash===m.afterHash&&r.revisionHash===revision.revisionHash&&r.immutableTriggerHash===revision.immutableTriggerHash&&r.triggerDisabled===0,'SELECTED_PARENT_BOOT_NATIVE_PINS');}
 return result;
}
function projectVerifiedParents(revision,parentResult,result,selected){
 const length=selected?11:3;
 copyAssert(Array.isArray(result?.recordsets)&&result.recordsets.length===length&&result.recordsets.every(Array.isArray)&&result.recordsets[0].length===1&&result.recordsets[length-1].length===1,'SELECTED_PARENT_BOOT_HISTORY_RECORDSETS');
 copyAssert(isolatedCopyJSON(parentResult.recordsets[0][0])===isolatedCopyJSON(result.recordsets[0][0])&&isolatedCopyJSON(parentResult.recordsets[2][0])===isolatedCopyJSON(result.recordsets[length-1][0]),'SELECTED_PARENT_BOOT_SAME_TRANSACTION');
 const projected=structuredClone(result),groups=selected?[...projected.recordsets.slice(1,6),projected.recordsets[8]]:[projected.recordsets[1]];
 // Only the proven four v8 definitions may be interpreted as their exact
 // immutable predecessors. Daily context returns directly to v6; the other
 // three return to v7, whose separate native registry is proven next.
 for(const rows of groups)for(const r of rows){const m=revision.modules.find(m=>m.name===r.name);if(m){copyAssert(r.actualHash===m.afterHash,'SELECTED_PARENT_BOOT_HISTORY_CURRENT_PIN');r.actualHash=m.beforeHash;}}
 return projected;
}

function validateEffectsRevision(copy,base,revision){
 const keys=['schemaVersion','version','copyId','baseSealHash','baseSelectedRevisionHash','profileHash','modules','immutableTriggerHash','optimization','revisionHash'];
 copyAssert(exact(revision,keys)&&revision.schemaVersion==='melisa-business-selected-sale-effects-revision.v1'&&revision.version===7&&revision.copyId===copy.copyId&&revision.baseSealHash===copy.sealHash&&revision.baseSelectedRevisionHash===base.revisionHash&&revision.profileHash===isolatedCopyHash(copy)&&revision.optimization==='SELECTED_MAX_IDS_ONCE','SELECTED_EFFECTS_BOOT_REVISION');
 const {revisionHash,...body}=revision;copyAssert(hex(revisionHash)&&revisionHash===isolatedCopyHash(body)&&hex(revision.immutableTriggerHash),'SELECTED_EFFECTS_BOOT_SEAL');
 copyAssert(Array.isArray(revision.modules)&&revision.modules.length===4&&revision.modules.every((m,i)=>exact(m,['name','beforeHash','afterHash'])&&m.name===SELECTED_SALE_EFFECTS_MODULES[i]&&hex(m.afterHash)&&m.beforeHash===base.modules.find(p=>p.name===m.name)?.afterHash&&m.beforeHash!==m.afterHash),'SELECTED_EFFECTS_BOOT_PREDECESSOR_PINS');
}
function effectsProof(copy,revision,result,nativeReadOnly){
 copyAssert(Array.isArray(result?.recordsets)&&result.recordsets.length===3&&result.recordsets.every(Array.isArray)&&result.recordsets[0].length===1&&result.recordsets[2].length===1,'SELECTED_EFFECTS_BOOT_RECORDSETS');
 const before=result.recordsets[0][0],after=result.recordsets[2][0];metadata(copy,before,nativeReadOnly);metadata(copy,after,nativeReadOnly);copyAssert(isolatedCopyJSON(before)===isolatedCopyJSON(after),'SELECTED_EFFECTS_BOOT_SAME_TRANSACTION');
 const rows=result.recordsets[1],keys=['copyId','name','revision','baseSealHash','baseSelectedRevisionHash','profileHash','beforeHash','afterHash','revisionHash','actualHash','immutableTriggerHash','triggerDisabled'];
 copyAssert(rows.length===4&&new Set(rows.map(r=>r.name)).size===4,'SELECTED_EFFECTS_BOOT_REGISTRY_ROWS');
 for(const m of revision.modules){const r=rows.find(r=>r.name===m.name);copyAssert(exact(r,keys)&&r.copyId?.toLowerCase()===copy.copyId&&r.revision===7&&r.baseSealHash===copy.sealHash&&r.baseSelectedRevisionHash===revision.baseSelectedRevisionHash&&r.profileHash===revision.profileHash&&r.beforeHash===m.beforeHash&&r.afterHash===m.afterHash&&r.actualHash===m.afterHash&&r.revisionHash===revision.revisionHash&&r.immutableTriggerHash===revision.immutableTriggerHash&&r.triggerDisabled===0,'SELECTED_EFFECTS_BOOT_NATIVE_PINS');}
 return result;
}
function projectVerifiedEffects(revision,effectsResult,result){
 copyAssert(Array.isArray(result?.recordsets)&&result.recordsets.length===11&&result.recordsets[0]?.length===1&&result.recordsets[10]?.length===1,'SELECTED_BOOT_RECORDSETS');
 copyAssert(isolatedCopyJSON(effectsResult.recordsets[0][0])===isolatedCopyJSON(result.recordsets[0][0])&&isolatedCopyJSON(effectsResult.recordsets[2][0])===isolatedCopyJSON(result.recordsets[10][0]),'SELECTED_EFFECTS_BOOT_SAME_TRANSACTION');
 const projected=structuredClone(result);
 // All four current definitions and their immutable overlay were proven first.
 // Only these finite witnesses may now be read as their exact v6 predecessors.
 for(const rows of [...projected.recordsets.slice(1,6),projected.recordsets[8]])for(const r of rows){const m=revision.modules.find(m=>m.name===r.name);if(m){copyAssert(r.actualHash===m.afterHash,'SELECTED_EFFECTS_BOOT_HISTORY_CURRENT_PIN');r.actualHash=m.beforeHash;}}
 return projected;
}

async function readCurrentProof(copy,state,request){
 let parentResult,overlayResult;
 if(state.selectedEffectsRevision!==undefined)validateEffectsRevision(copy,state.selectedRevision,state.selectedEffectsRevision);
 if(state.selectedParentRevision!==undefined){validateParentRevision(copy,state.selectedRevision,state.selectedEffectsRevision,state.selectedParentRevision);parentResult=parentProof(copy,state.selectedParentRevision,await request.query(BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL),state.nativeReadOnly);}
 if(state.selectedEffectsRevision!==undefined){const raw=await request.query(BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL);overlayResult=effectsProof(copy,state.selectedEffectsRevision,parentResult?projectVerifiedParents(state.selectedParentRevision,parentResult,raw,false):raw,state.nativeReadOnly);}
 const raw=await request.query(BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL),parentProjected=parentResult?projectVerifiedParents(state.selectedParentRevision,parentResult,raw,true):raw,result=overlayResult?projectVerifiedEffects(state.selectedEffectsRevision,overlayResult,parentProjected):parentProjected;
 return selectedProof(copy,state.selectedRevision,result,state.nativeReadOnly,state.schema);
}

function validateRevision(copy,daily,profit,revision){
 assertIsolatedCopyContext(copy);
 copyAssert(exact(revision,revisionKeys)&&revision.schemaVersion==='melisa-business-selected-sale-revision.v1'&&revision.version===6&&revision.copyId===copy.copyId&&revision.baseSealHash===copy.sealHash&&revision.baseDailyRevisionHash===daily?.revisionHash&&revision.baseProfitRevisionHash===profit?.revisionHash&&revision.profileHash===isolatedCopyHash(copy),'SELECTED_BOOT_REVISION');
 const {revisionHash,...body}=revision;
 copyAssert(hex(revisionHash)&&revisionHash===isolatedCopyHash(body)&&hex(revision.immutableTriggerHash)&&isolatedCopyJSON(revision.operations)===isolatedCopyJSON(['sale_draft','sale_finalize','sale_cancel'])&&revision.maxItems===200&&revision.quantity==='POSITIVE_WHOLE_MAIN_UNIT'&&revision.maxInvoiceAmountExact4==='20000.0000','SELECTED_BOOT_REVISION_SEAL');
 copyAssert(Array.isArray(revision.modules)&&revision.modules.length===10&&revision.modules.every((m,i)=>exact(m,['name','beforeHash','afterHash'])&&m.name===moduleNames[i]&&hex(m.afterHash)&&m.beforeHash===(profit.modules.find(p=>p.name===m.name)?.afterHash??daily.modules.find(p=>p.name===m.name)?.afterHash??null)),'SELECTED_BOOT_PREDECESSOR_PINS');
}
function metadata(copy,row,nativeReadOnly){
 copyAssert(exact(row,metadataKeys),'SELECTED_BOOT_METADATA');
 if(nativeReadOnly){const reader=isolatedCopyTopology(copy).reader;copyAssert(row.db===copy.target.database&&row.server===copy.target.server&&row.login===reader&&row.databaseUser===reader&&row.sysadmin===0&&row.control===0&&row.live===0&&row.originalDatabaseAccess===0,'SELECTED_BOOT_READER_IDENTITY');}
 else assertIsolatedCopyIdentity(copy,row);
 copyAssert(row.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&['Shared','Exclusive'].includes(row.copyLockMode)&&Number.isSafeInteger(row.sessionId)&&row.sessionId>0&&/^[1-9]\d*$/.test(String(row.transactionId))&&(typeof row.transactionId!=='number'||Number.isSafeInteger(row.transactionId)),'SELECTED_BOOT_TRANSACTION');
 copyAssert(row.manifestRows===1&&row.moduleManifestRows===185&&row.copyId?.toLowerCase()===copy.copyId&&row.sealHash===copy.sealHash&&row.backupSHA===copy.backupSHA&&row.profileHash===isolatedCopyHash(copy)&&[0,false].includes(row.queryPlanRegistryExists),'SELECTED_BOOT_MANIFEST');
}
function selectedProof(copy,revision,result,nativeReadOnly,schema){
 copyAssert(isolatedCopyJSON(schemaTables)===isolatedCopyJSON(COPY_MUTABLE_TABLES),'SELECTED_BOOT_SCHEMA_TABLE_SET');
 copyAssert(Array.isArray(result?.recordsets)&&result.recordsets.length===11&&result.recordsets.every(Array.isArray)&&result.recordsets[0].length===1&&result.recordsets[10].length===1,'SELECTED_BOOT_RECORDSETS');
 const before=result.recordsets[0][0],after=result.recordsets[10][0];metadata(copy,before,nativeReadOnly);metadata(copy,after,nativeReadOnly);
 copyAssert(isolatedCopyJSON(before)===isolatedCopyJSON(after),'SELECTED_BOOT_SAME_TRANSACTION');
 const rows=result.recordsets[8];copyAssert(rows.length===10&&new Set(rows.map(r=>r.name)).size===10,'SELECTED_BOOT_REGISTRY_ROWS');
 for(const m of revision.modules){const r=rows.find(r=>r.name===m.name);copyAssert(exact(r,rowKeys)&&r.copyId?.toLowerCase()===copy.copyId&&r.revision===6&&r.baseSealHash===copy.sealHash&&r.baseDailyRevisionHash===revision.baseDailyRevisionHash&&r.baseProfitRevisionHash===revision.baseProfitRevisionHash&&r.beforeHash===m.beforeHash&&r.afterHash===m.afterHash&&r.actualHash===m.afterHash&&r.revisionHash===revision.revisionHash&&r.profileHash===revision.profileHash&&r.immutableTriggerHash===revision.immutableTriggerHash&&r.triggerDisabled===0,'SELECTED_BOOT_NATIVE_PINS');}
 const schemaRows=result.recordsets[9],keys=['schemaName','tableName','columnName','typeName'];
 const normalize=rows=>rows.map(r=>Object.fromEntries(keys.map(k=>[k,r[k]]))).sort((a,b)=>isolatedCopyJSON(a).localeCompare(isolatedCopyJSON(b)));
 copyAssert(schemaRows.length>0&&schemaRows.every(r=>exact(r,keys)&&r.schemaName==='dbo'&&COPY_MUTABLE_TABLES.includes(r.tableName)&&typeof r.columnName==='string'&&typeof r.typeName==='string')&&new Set(schemaRows.map(r=>r.tableName+'.'+r.columnName)).size===schemaRows.length&&isolatedCopyJSON(normalize(schemaRows))===isolatedCopyJSON(normalize(schema.filter(r=>r.schemaName==='dbo'&&COPY_MUTABLE_TABLES.includes(r.tableName)))),'SELECTED_BOOT_NATIVE_SCHEMA');
 return result;
}
function historicalPool(revision,result){
 const daily=structuredClone(result.recordsets.slice(1,5)),profit=structuredClone(result.recordsets[5]),native={recordsets:structuredClone(result.recordsets.slice(6,8))};
 // Current v6 definitions may be interpreted as historical v5/v4 only after
 // independently verifying all ten actual hashes and the immutable registry.
 for(const rows of [...daily,profit])for(const row of rows){const m=revision.modules.find(m=>m.name===row.name);if(m){copyAssert(m.beforeHash!==null&&row.actualHash===m.afterHash,'SELECTED_BOOT_HISTORY_CURRENT_PIN');row.actualHash=m.beforeHash;}}
 return {request:()=>({query:async sql=>{
  if(sql===BUSINESS_DAILY_REVISION_PROOF_SQL)return {recordsets:structuredClone(daily)};
  if(sql===businessDailyProfitReadSQL())return {recordset:structuredClone(profit)};
  if(sql===businessDailyNativeCheckReadSQL())return structuredClone(native);
  copyAssert(false,'SELECTED_BOOT_HISTORY_QUERY');
 }})};
}
async function proveHistory(copy,input,result){
 await configureBusinessDailyRevision(copy,input.base,input.performance,input.effects,input.daily.revision,historicalPool(input.selectedRevision,result),input.profit.revision,input.nativeCheck);
}

// request is a single transaction-bound request with @copy_id already bound.
// One query reads metadata before/after and every historical registry row.
export async function configureBusinessSelectedSaleRevision({copy,request,nativeReadOnly=false,...options}){
 assertIsolatedCopyContext(copy);copyAssert(typeof request?.query==='function'&&!registered.has(copy)&&getBusinessDailyHomeReadRevisions(copy)===null,'SELECTED_BOOT_FRESH_CONTEXT');
 copyAssert(typeof nativeReadOnly==='boolean','SELECTED_BOOT_MODE');
 const input=freeze(structuredClone(options));
 const revision=input.selectedRevision??input.selectedInstall?.revision;
 copyAssert(revision&&input.daily&&input.profit&&Array.isArray(input.schema),'SELECTED_BOOT_INPUT');
 // The validated startup loader serializes an absent optional adjunct as null.
 // Historical native proof still must demonstrate that it is unconfigured.
 const state={...input,nativeCheck:input.nativeCheck===null?undefined:input.nativeCheck,selectedRevision:revision,nativeReadOnly};validateRevision(copy,state.daily.revision,state.profit.revision,revision);
 const result=await readCurrentProof(copy,state,request);
 // Prove the original chain on a distinct branded context first. An invalid
 // canonical candidate cannot leave the application's copy partly registered.
 const historical=validateIsolatedOperationCopyContext(copy);await proveHistory(historical,state,result);
 const args={copy:historical,daily:state.daily,profit:state.profit,schema:state.schema},candidate=buildBusinessSelectedSaleRevision(args);
 copyAssert(isolatedCopyJSON(candidate.revision)===isolatedCopyJSON(revision),'SELECTED_BOOT_CANONICAL_REVISION');
 if(state.selectedInstall!==undefined)validateBusinessSelectedSaleInstall(state.selectedInstall,args);
 if(state.selectedEffectsRevision!==undefined){const overlay=buildBusinessSelectedSaleEffectsRevision(args);copyAssert(isolatedCopyJSON(overlay.revision)===isolatedCopyJSON(state.selectedEffectsRevision),'SELECTED_EFFECTS_BOOT_CANONICAL_REVISION');}
 if(state.selectedParentRevision!==undefined){const overlay=buildBusinessSelectedSaleParentRevision(args);copyAssert(isolatedCopyJSON(overlay.revision)===isolatedCopyJSON(state.selectedParentRevision),'SELECTED_PARENT_BOOT_CANONICAL_REVISION');}
 await proveHistory(copy,state,result);
 const baseBundle=buildBusinessSelectedSaleRevision({copy,daily:state.daily,profit:state.profit,schema:state.schema});
 const effectiveArgs={copy,daily:state.daily,profit:state.profit,schema:state.schema},effectsBundle=state.selectedEffectsRevision===undefined?null:buildBusinessSelectedSaleEffectsRevision(effectiveArgs);
 const bundle=state.selectedParentRevision===undefined?(effectsBundle??baseBundle):buildBusinessSelectedSaleParentRevision(effectiveArgs);
 const value=freeze({revision:baseBundle.revision,...(effectsBundle?{selectedEffectsRevision:effectsBundle.revision}:{}),...(state.selectedParentRevision===undefined?{}:{selectedParentRevision:bundle.revision}),bundle,parentHashes:bundle.parentHashes});
 registered.set(copy,{value,input:freeze(state)});return value;
}
export function getRegisteredBusinessSelectedSaleRevision(copy){
 return registered.get(copy)?.value??null;
}
export async function verifyBusinessSelectedSaleRevision(copy,request){
 assertIsolatedCopyContext(copy);const state=registered.get(copy);copyAssert(state&&typeof request?.query==='function','SELECTED_BOOT_SERVER_REGISTRATION');
 const result=await readCurrentProof(copy,state.input,request);
 await proveHistory(validateIsolatedOperationCopyContext(copy),state.input,result);return true;
}
