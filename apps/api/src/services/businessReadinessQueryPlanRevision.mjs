import {copyAssert,isolatedCopyHash,assertIsolatedCopyContext,BUSINESS_COPY_DATABASE,getBusinessReadinessQueryPlanRevision,registerBusinessReadinessQueryPlanRevision} from './isolatedOperationCopyContext.mjs';
import {validateBusinessDailyProfitRevision} from './businessDailyProfitRevision.mjs';

export const BUSINESS_READINESS_QUERY_PLAN_REGISTRY='dbo.stage4_copy_readiness_query_plan_revisions';
export const BUSINESS_READINESS_QUERY_PLAN_TRIGGER='dbo.immutable_stage4_copy_readiness_query_plan_revisions';
const ready='dbo.usp_stage4_copy_ready';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const configKeys=['schemaVersion','version','copyId','baseSealHash','baseDailyRevisionHash','baseProfitRevisionHash','dailyScopeHash','modules','immutableTriggerHash','revisionHash'];
export function validateBusinessReadinessQueryPlanRevision(daily,profit,input){
 validateBusinessDailyProfitRevision(daily,profit);
 copyAssert(exact(input,configKeys)&&input.schemaVersion==='melisa-readiness-query-plan-revision.v1'&&input.version===6&&input.copyId===daily.copyId&&input.baseSealHash===daily.baseSealHash&&input.baseDailyRevisionHash===daily.revisionHash&&input.baseProfitRevisionHash===profit.revisionHash&&input.dailyScopeHash===daily.dailyScopeHash&&Array.isArray(input.modules)&&input.modules.length===1,'BUSINESS_READINESS_QUERY_PLAN_REVISION');
 const m=input.modules[0],parent=profit.modules.find(m=>m.name===ready);
 copyAssert(exact(m,['name','beforeHash','afterHash'])&&m.name===ready&&m.beforeHash===parent?.afterHash&&hash(m.afterHash)&&m.afterHash!==m.beforeHash&&hash(input.immutableTriggerHash),'BUSINESS_READINESS_QUERY_PLAN_PINS');
 const {revisionHash,...body}=input;copyAssert(hash(revisionHash)&&revisionHash===isolatedCopyHash(body),'BUSINESS_READINESS_QUERY_PLAN_SEAL');return input;
}
// No filtering: extra registrations and every parent module remain visible.
export function businessReadinessQueryPlanReadSQL(){return `SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,
 CONVERT(bit,CASE WHEN OBJECT_ID(N'${BUSINESS_READINESS_QUERY_PLAN_REGISTRY}',N'U') IS NULL THEN 0 ELSE 1 END) registryExists,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${ready}'))),2) actualHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${BUSINESS_READINESS_QUERY_PLAN_TRIGGER}'))),2) immutableTriggerHash,
 ISNULL(CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'${BUSINESS_READINESS_QUERY_PLAN_TRIGGER}'),'ExecIsTriggerDisabled')),1) triggerDisabled,
 (SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest) baseManifestRows,
 (SELECT seal_hash FROM dbo.stage4_copy_manifest WHERE sealed=1) manifestSealHash;
IF OBJECT_ID(N'${BUSINESS_READINESS_QUERY_PLAN_REGISTRY}',N'U') IS NOT NULL EXEC(N'SELECT CONVERT(varchar(36),copy_id) copyId,revision version,base_seal_hash baseSealHash,base_daily_revision_hash baseDailyRevisionHash,base_profit_revision_hash baseProfitRevisionHash,daily_scope_hash dailyScopeHash,name,before_hash beforeHash,after_hash afterHash,revision_hash revisionHash FROM ${BUSINESS_READINESS_QUERY_PLAN_REGISTRY} WITH(HOLDLOCK) ORDER BY copy_id;'); ELSE SELECT CAST(NULL AS uniqueidentifier) copyId WHERE 1=0;
SELECT CONVERT(varchar(36),copy_id) copyId,revision version,base_seal_hash baseSealHash,daily_scope_hash dailyScopeHash,name,before_hash beforeHash,after_hash afterHash,revision_hash revisionHash FROM dbo.stage4_copy_business_daily_revisions WITH(HOLDLOCK) ORDER BY name;
SELECT CONVERT(varchar(36),copy_id) copyId,revision version,base_seal_hash baseSealHash,daily_scope_hash dailyScopeHash,name,before_hash beforeHash,after_hash afterHash,revision_hash revisionHash FROM dbo.stage4_copy_business_daily_profit_revisions WITH(HOLDLOCK) ORDER BY name;`;}
export function assertBusinessReadinessQueryPlanProof(context,daily,profit,input,result){
 assertIsolatedCopyContext(context);validateBusinessReadinessQueryPlanRevision(daily,profit,input);
 copyAssert(context.target.database===BUSINESS_COPY_DATABASE&&input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&Array.isArray(result?.recordsets)&&result.recordsets.length===4,'BUSINESS_READINESS_QUERY_PLAN_DB_PROOF');
 const [meta,rows,dailyRows,profitRows]=result.recordsets,r=Array.isArray(meta)&&meta.length===1?meta[0]:null;
 copyAssert(exact(r,['databaseName','serverName','registryExists','actualHash','immutableTriggerHash','triggerDisabled','baseManifestRows','manifestSealHash'])&&r.databaseName===context.target.database&&r.serverName===context.target.server&&[1,true].includes(r.registryExists)&&r.actualHash===input.modules[0].afterHash&&r.immutableTriggerHash===input.immutableTriggerHash&&r.triggerDisabled===0&&r.baseManifestRows===185&&r.manifestSealHash===context.sealHash,'BUSINESS_READINESS_QUERY_PLAN_CURRENT');
 const row=Array.isArray(rows)&&rows.length===1?rows[0]:null,m=input.modules[0];
 copyAssert(exact(row,['copyId','version','baseSealHash','baseDailyRevisionHash','baseProfitRevisionHash','dailyScopeHash','name','beforeHash','afterHash','revisionHash'])&&typeof row.copyId==='string'&&row.copyId.toLowerCase()===input.copyId&&row.version===6&&row.baseSealHash===input.baseSealHash&&row.baseDailyRevisionHash===input.baseDailyRevisionHash&&row.baseProfitRevisionHash===input.baseProfitRevisionHash&&row.dailyScopeHash===input.dailyScopeHash&&row.name===m.name&&row.beforeHash===m.beforeHash&&row.afterHash===m.afterHash&&row.revisionHash===input.revisionHash,'BUSINESS_READINESS_QUERY_PLAN_ROW');
 for(const [parent,parentRows,count] of [[daily,dailyRows,8],[profit,profitRows,3]])copyAssert(Array.isArray(parentRows)&&parentRows.length===count&&new Set(parentRows.map(r=>r?.name)).size===count&&parent.modules.every(m=>parentRows.some(r=>exact(r,['copyId','version','baseSealHash','dailyScopeHash','name','beforeHash','afterHash','revisionHash'])&&typeof r.copyId==='string'&&r.copyId.toLowerCase()===context.copyId&&r.version===parent.version&&r.baseSealHash===context.sealHash&&r.dailyScopeHash===parent.dailyScopeHash&&r.name===m.name&&r.beforeHash===m.beforeHash&&r.afterHash===m.afterHash&&r.revisionHash===parent.revisionHash)),'BUSINESS_READINESS_QUERY_PLAN_PARENT_PROOF');return true;
}
// Apply only after the current v6 definition and append-only parents passed.
export function overlayBusinessReadinessQueryPlanHistory(rows,input){
 const m=input.modules[0];return rows.map(r=>{if(r.name!==ready)return {...r};copyAssert(r.actualHash===m.afterHash,'BUSINESS_READINESS_QUERY_PLAN_CURRENT_PIN');return {...r,actualHash:m.beforeHash};});
}
export function registerBusinessReadinessQueryPlan(context,daily,profit,input,result){
 assertBusinessReadinessQueryPlanProof(context,daily,profit,input,result);return registerBusinessReadinessQueryPlanRevision(context,input,result);
}
export async function verifyBusinessReadinessQueryPlan(context,request){
 const registered=getBusinessReadinessQueryPlanRevision(context);if(!registered)return true;
 copyAssert(typeof request?.query==='function','BUSINESS_READINESS_QUERY_PLAN_REQUEST');
 return assertBusinessReadinessQueryPlanProof(context,registered.daily,registered.profit,registered.revision,await request.query(businessReadinessQueryPlanReadSQL()));
}
