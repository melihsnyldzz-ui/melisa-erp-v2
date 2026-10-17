import {assertIsolatedCopyContext,copyAssert,getBusinessDailyHomeReadRevisions,isolatedCopyHash,ISOLATED_COPY_PROCEDURES} from './isolatedOperationCopyContext.mjs';
import {getRegisteredBusinessSelectedSaleRevision} from '../../../../scripts/canonical/shared-business-selected-sale-revision-bootstrap.mjs';

// Reviewed stored CREATE definition: target check, unconditional full ready,
// then domain dispatch. HOME uses inbound and never enters the daily helper.
export const BUSINESS_DAILY_HOME_CONTEXT_HASH='A8C0700DC0D82A89E68ADD59BCE724BC74341AB6A3A8435645C90D089A68362F';
const dailyTrigger='dbo.immutable_stage4_copy_business_daily_revisions';
const profitTrigger='dbo.immutable_stage4_copy_business_daily_profit_revisions';
// All registry rows are returned, including foreign/extra rows. No data or
// permission cache: this SELECT-only proof runs under the caller's copy lock.
export const BUSINESS_DAILY_HOME_READ_PROOF_SQL=`SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,
 @@TRANCOUNT transactionCount,XACT_STATE() transactionState,
 APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,
 (SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,
 (SELECT COUNT_BIG(*) FROM dbo.stage4_copy_module_manifest WITH(HOLDLOCK)) baseManifestRows,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_context',N'P'))),2) contextHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_ready',N'P'))),2) readyHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${dailyTrigger}',N'TR'))),2) dailyTriggerHash,
 ISNULL(CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'${dailyTrigger}'),'ExecIsTriggerDisabled')),1) dailyTriggerDisabled,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${profitTrigger}',N'TR'))),2) profitTriggerHash,
 ISNULL(CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'${profitTrigger}'),'ExecIsTriggerDisabled')),1) profitTriggerDisabled;
SELECT CONVERT(varchar(36),copy_id) copyId,seal_hash sealHash,backup_sha backupSHA,sealed,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',profile_json),2) profileHash FROM dbo.stage4_copy_manifest WITH(HOLDLOCK);
SELECT CONVERT(varchar(36),copy_id) copyId,revision version,base_seal_hash baseSealHash,base_effects_revision_hash baseEffectsRevisionHash,name,before_hash beforeHash,after_hash afterHash,revision_hash revisionHash,daily_scope_hash dailyScopeHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',daily_profile_json),2) dailyProfileHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(name))),2) actualHash FROM dbo.stage4_copy_business_daily_revisions WITH(HOLDLOCK) ORDER BY name;
SELECT CONVERT(varchar(36),copy_id) copyId,revision version,base_seal_hash baseSealHash,base_daily_revision_hash baseDailyRevisionHash,name,before_hash beforeHash,after_hash afterHash,revision_hash revisionHash,daily_scope_hash dailyScopeHash,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(name))),2) actualHash FROM dbo.stage4_copy_business_daily_profit_revisions WITH(HOLDLOCK) ORDER BY name;`;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const sameCopy=(value,context)=>typeof value==='string'&&value.toLowerCase()===context.copyId;
const metaKeys=['databaseName','serverName','transactionCount','transactionState','copyLockMode','isolationLevel','baseManifestRows','contextHash','readyHash','dailyTriggerHash','dailyTriggerDisabled','profitTriggerHash','profitTriggerDisabled'];
const rowKeys=['copyId','version','baseSealHash','name','beforeHash','afterHash','revisionHash','dailyScopeHash','actualHash'];

export async function verifyBusinessDailyHomeReadProof(context,request,{domain,write,automatic}={}){
 assertIsolatedCopyContext(context);
 copyAssert(write===false&&automatic===null,'BUSINESS_HOME_READ_ONLY');
 const registered=getBusinessDailyHomeReadRevisions(context);
 if(domain!=='inbound'||!registered||getRegisteredBusinessSelectedSaleRevision(context))return false;
 const {daily,profit}=registered,contextPin=daily.modules.find(m=>m.name===ISOLATED_COPY_PROCEDURES.context);
 // A different registered context requires its own semantic review; use the
 // existing general reader without weakening any of its guards.
 if(contextPin?.afterHash!==BUSINESS_DAILY_HOME_CONTEXT_HASH)return false;
 copyAssert(typeof request?.query==='function','BUSINESS_HOME_READ_PROOF_REQUEST');
 const sets=(await request.query(BUSINESS_DAILY_HOME_READ_PROOF_SQL))?.recordsets;
 copyAssert(Array.isArray(sets)&&sets.length===4&&sets.every(Array.isArray)&&sets[0].length===1&&sets[1].length===1,'BUSINESS_HOME_READ_PROOF');
 const meta=sets[0][0],manifest=sets[1][0],ready=profit.modules.find(m=>m.name===ISOLATED_COPY_PROCEDURES.ready);
 copyAssert(exact(meta,metaKeys)&&meta.databaseName===context.target.database&&meta.serverName===context.target.server&&meta.transactionCount===1&&meta.transactionState===1&&meta.copyLockMode==='Shared'&&meta.isolationLevel===4&&String(meta.baseManifestRows)==='185'&&meta.contextHash===contextPin.afterHash&&meta.readyHash===ready?.afterHash&&meta.dailyTriggerHash===daily.immutableTriggerHash&&meta.dailyTriggerDisabled===0&&meta.profitTriggerHash===profit.immutableTriggerHash&&meta.profitTriggerDisabled===0,'BUSINESS_HOME_READ_CURRENT');
 copyAssert(exact(manifest,['copyId','sealHash','backupSHA','sealed','profileHash'])&&sameCopy(manifest.copyId,context)&&manifest.sealHash===context.sealHash&&manifest.backupSHA===context.backupSHA&&[true,1].includes(manifest.sealed)&&manifest.profileHash===isolatedCopyHash(context),'BUSINESS_HOME_READ_PROFILE');
 for(const [revision,rows,keys] of [[daily,sets[2],[...rowKeys,'baseEffectsRevisionHash','dailyProfileHash']],[profit,sets[3],[...rowKeys,'baseDailyRevisionHash']]]){
  copyAssert(rows.length===revision.modules.length&&new Set(rows.map(r=>r?.name)).size===revision.modules.length&&revision.modules.every(m=>{
   const row=rows.find(r=>r?.name===m.name),current=profit.modules.find(p=>p.name===m.name)??m;
   return exact(row,keys)&&sameCopy(row.copyId,context)&&row.version===revision.version&&row.baseSealHash===context.sealHash&&row.beforeHash===m.beforeHash&&row.afterHash===m.afterHash&&row.actualHash===current.afterHash&&row.revisionHash===revision.revisionHash&&row.dailyScopeHash===daily.dailyScopeHash&&(revision===daily?row.baseEffectsRevisionHash===daily.baseEffectsRevisionHash&&row.dailyProfileHash===daily.dailyScopeHash:row.baseDailyRevisionHash===daily.revisionHash);
  }),'BUSINESS_HOME_READ_REGISTRY');
 }
 return true;
}
