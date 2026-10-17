import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,BUSINESS_COPY_DATABASE,copyAssert,isolatedCopyHash,isolatedCopyJSON,ISOLATED_COPY_PROCEDURES} from './isolatedOperationCopyContext.mjs';
import {getRegisteredBusinessSelectedSaleRevision} from '../../../../scripts/canonical/shared-business-selected-sale-revision-bootstrap.mjs';
import {STOCK_PREDICATE_MODULES,STOCK_PREDICATE_IMMUTABLE} from '../../../../scripts/canonical/shared-business-stock-predicate-distinct-revision-sql.mjs';
import {STOCK_PREDICATE_TRIGGER_ORDER} from '../../../../scripts/canonical/shared-business-stock-predicate-distinct-source.mjs';
import {createHash} from 'node:crypto';

// Reviewed dispatcher: full READY before its trade→daily dispatch. The daily
// helper still calls full READY too. This proof removes only the outer JS call.
export const BUSINESS_SELECTED_SALE_HISTORICAL_CONTEXT_HASH='A8C0700DC0D82A89E68ADD59BCE724BC74341AB6A3A8435645C90D089A68362F';
const immutable=STOCK_PREDICATE_IMMUTABLE;
const metadataSQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,
@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,
APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,
(SELECT COUNT_BIG(*) FROM dbo.stage4_copy_module_manifest WITH(HOLDLOCK)) baseManifestRows,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_context',N'P'))),2) contextHash,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_ready',N'P'))),2) readyHash,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_business_daily_context',N'P'))),2) dailyContextHash,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${immutable}',N'TR'))),2) immutableTriggerHash,
ISNULL(CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'${immutable}'),'ExecIsTriggerDisabled')),1) immutableTriggerDisabled,
OBJECT_SCHEMA_NAME(OBJECT_ID(N'${immutable}',N'TR'))+N'.'+OBJECT_NAME(OBJECT_ID(N'${immutable}',N'TR')) immutableTriggerName,
OBJECT_SCHEMA_NAME((SELECT parent_id FROM sys.triggers WHERE object_id=OBJECT_ID(N'${immutable}',N'TR')))+N'.'+OBJECT_NAME((SELECT parent_id FROM sys.triggers WHERE object_id=OBJECT_ID(N'${immutable}',N'TR'))) immutableParentName;`;
// All rows are read with no copy/revision filter. Extra or foreign registry
// rows fail. Native data, permissions and quarantine are checked by the two
// full owner READY executions which follow this fresh SELECT-only proof.
export const BUSINESS_SELECTED_SALE_HISTORICAL_READ_PROOF_SQL=metadataSQL+`
SELECT CONVERT(varchar(36),copy_id) copyId,seal_hash sealHash,backup_sha backupSHA,sealed,CONVERT(varchar(64),HASHBYTES('SHA2_256',profile_json),2) profileHash FROM dbo.stage4_copy_manifest WITH(HOLDLOCK);
SELECT CONVERT(varchar(36),r.copy_id) copyId,r.name,r.revision,r.base_seal_hash baseSealHash,r.base_operation_quarantine_revision_hash baseOperationQuarantineRevisionHash,r.profile_hash profileHash,r.before_hash beforeHash,r.after_hash afterHash,r.revision_hash revisionHash,
CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2) actualHash,o.object_id objectId,RTRIM(o.type) moduleType,
CASE WHEN o.type=N'TR' THEN ISNULL(CONVERT(int,OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled')),1) ELSE 0 END moduleDisabled,
CASE WHEN o.type=N'TR' THEN OBJECT_SCHEMA_NAME(o.parent_object_id)+N'.'+OBJECT_NAME(o.parent_object_id) ELSE NULL END parentName,
CASE WHEN o.type=N'TR' THEN ISNULL(CONVERT(int,OBJECTPROPERTY(o.object_id,'ExecIsFirstInsertTrigger')),1) ELSE 0 END firstInsert,
CASE WHEN o.type=N'TR' THEN ISNULL(CONVERT(int,OBJECTPROPERTY(o.object_id,'ExecIsFirstUpdateTrigger')),1) ELSE 0 END firstUpdate,
CASE WHEN o.type=N'TR' THEN ISNULL(CONVERT(int,OBJECTPROPERTY(o.object_id,'ExecIsFirstDeleteTrigger')),1) ELSE 0 END firstDelete,
CASE WHEN o.type=N'TR' THEN ISNULL(CONVERT(int,OBJECTPROPERTY(o.object_id,'ExecIsLastInsertTrigger')),1) ELSE 0 END lastInsert,
CASE WHEN o.type=N'TR' THEN ISNULL(CONVERT(int,OBJECTPROPERTY(o.object_id,'ExecIsLastUpdateTrigger')),1) ELSE 0 END lastUpdate,
CASE WHEN o.type=N'TR' THEN ISNULL(CONVERT(int,OBJECTPROPERTY(o.object_id,'ExecIsLastDeleteTrigger')),1) ELSE 0 END lastDelete
FROM dbo.stage4_copy_stock_predicate_revisions r WITH(HOLDLOCK) LEFT JOIN sys.objects o ON o.object_id=OBJECT_ID(r.name) ORDER BY r.name;
`+metadataSQL;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const registeredKeys=['revision','selectedEffectsRevision','selectedParentRevision','supplierItemQuarantineRevision','operationQuarantineRevision','stockPredicateRevision','bundle','parentHashes'];
const metaKeys=['db','server','login','databaseUser','sysadmin','control','live','originalDatabaseAccess','sessionId','transactionId','transactionCount','transactionState','isolationLevel','copyLockMode','baseManifestRows','contextHash','readyHash','dailyContextHash','immutableTriggerHash','immutableTriggerDisabled','immutableTriggerName','immutableParentName'];
const moduleKeys=['copyId','name','revision','baseSealHash','baseOperationQuarantineRevisionHash','profileHash','beforeHash','afterHash','revisionHash','actualHash','objectId','moduleType','moduleDisabled','parentName',...Object.keys(STOCK_PREDICATE_TRIGGER_ORDER)];
const sameCopy=(v,c)=>typeof v==='string'&&v.toLowerCase()===c.copyId;
const dailyHeader=" PROCEDURE dbo.usp_business_daily_context @copy_id uniqueidentifier,@actor_id bigint,@domain nvarchar(20) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;\nIF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_CRM_SHARED_TEST_20261009_02' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' THROW 51904,'STAGE4_WRONG_COPY_TARGET',1;\nEXEC dbo.usp_stage4_copy_ready @copy_id;";

// Pure validation helpers confer no read route or registration authority.
export function supportsBusinessSelectedSaleHistoricalRead(context,registered){
 assertIsolatedCopyContext(context);
 if(context.target.database!==BUSINESS_COPY_DATABASE||!exact(registered,registeredKeys)||registered.revision?.version!==6||registered.selectedEffectsRevision?.version!==7||registered.selectedParentRevision?.version!==8||registered.supplierItemQuarantineRevision?.version!==9||registered.operationQuarantineRevision?.version!==10||registered.stockPredicateRevision?.version!==11||registered.bundle?.revision?.version!==11||registered.parentHashes?.context!==BUSINESS_SELECTED_SALE_HISTORICAL_CONTEXT_HASH)return false;
 const r=registered.stockPredicateRevision,b=registered.bundle;
 if(r.revisionHash!==b.revision.revisionHash||!Array.isArray(r.modules)||r.modules.length!==6||!r.modules.every((m,i)=>m.name===STOCK_PREDICATE_MODULES[i]&&m.type===(i===0?'TR':'P')))return false;
 const daily=b.replacements.find(m=>m.name==='dbo.usp_business_daily_context');
 if(!daily||typeof daily.storedDefinition!=='string'||daily.afterHash!==r.modules[3].afterHash||createHash('sha256').update(daily.storedDefinition,'utf16le').digest('hex').toUpperCase()!==daily.afterHash)return false;
 const body=daily.storedDefinition.replaceAll('\r\n','\n').replace(/^CREATE +PROCEDURE /,'CREATE PROCEDURE ');
 return body.startsWith('CREATE'+dailyHeader)&&body.split('EXEC dbo.usp_stage4_copy_ready @copy_id;').length===2;
}
export function assertBusinessSelectedSaleHistoricalReadProof(context,registered,result){
 assertIsolatedCopyContext(context);copyAssert(supportsBusinessSelectedSaleHistoricalRead(context,registered),'SELECTED_HISTORICAL_SUPPORTED_REGISTRATION');
 const r=registered.stockPredicateRevision,ready=r.modules.find(m=>m.name===ISOLATED_COPY_PROCEDURES.ready),daily=r.modules.find(m=>m.name==='dbo.usp_business_daily_context'),sets=result?.recordsets;
 copyAssert(Array.isArray(sets)&&sets.length===4&&sets.every(Array.isArray)&&sets[0].length===1&&sets[1].length===1&&sets[3].length===1,'SELECTED_HISTORICAL_RECORDSETS');
 for(const row of [sets[0][0],sets[3][0]]){
  assertIsolatedCopyIdentity(context,row);
  copyAssert(exact(row,metaKeys)&&row.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&row.copyLockMode==='Shared'&&Number.isSafeInteger(row.sessionId)&&row.sessionId>0&&/^[1-9]\d*$/.test(String(row.transactionId))&&(typeof row.transactionId!=='number'||Number.isSafeInteger(row.transactionId))&&String(row.baseManifestRows)==='185'&&row.contextHash===BUSINESS_SELECTED_SALE_HISTORICAL_CONTEXT_HASH&&row.readyHash===ready.afterHash&&row.readyHash===registered.parentHashes.ready&&row.dailyContextHash===daily.afterHash&&row.immutableTriggerHash===r.immutableTriggerHash&&row.immutableTriggerDisabled===0&&row.immutableTriggerName===immutable&&row.immutableParentName==='dbo.stage4_copy_stock_predicate_revisions','SELECTED_HISTORICAL_CURRENT');
 }
 copyAssert(isolatedCopyJSON(sets[0][0])===isolatedCopyJSON(sets[3][0]),'SELECTED_HISTORICAL_SAME_TRANSACTION');
 const manifest=sets[1][0];copyAssert(exact(manifest,['copyId','sealHash','backupSHA','sealed','profileHash'])&&sameCopy(manifest.copyId,context)&&manifest.sealHash===context.sealHash&&manifest.backupSHA===context.backupSHA&&[true,1].includes(manifest.sealed)&&manifest.profileHash===isolatedCopyHash(context)&&manifest.profileHash===r.profileHash,'SELECTED_HISTORICAL_MANIFEST');
 const rows=sets[2];copyAssert(rows.length===6&&new Set(rows.map(row=>row.name)).size===6&&new Set(rows.map(row=>row.objectId)).size===6,'SELECTED_HISTORICAL_MODULE_ROWS');
 for(const [i,m]of r.modules.entries()){
  const row=rows.find(row=>row.name===m.name);
  copyAssert(exact(row,moduleKeys)&&sameCopy(row.copyId,context)&&row.revision===11&&row.baseSealHash===context.sealHash&&row.baseOperationQuarantineRevisionHash===r.baseOperationQuarantineRevisionHash&&row.profileHash===r.profileHash&&row.beforeHash===m.beforeHash&&row.afterHash===m.afterHash&&row.actualHash===m.afterHash&&row.revisionHash===r.revisionHash&&Number.isSafeInteger(row.objectId)&&row.objectId>0&&row.moduleType===m.type&&row.moduleDisabled===0&&row.parentName===(i===0?'dbo.stock_movements':null)&&Object.keys(STOCK_PREDICATE_TRIGGER_ORDER).every(k=>row[k]===0),'SELECTED_HISTORICAL_MODULE_PINS');
 }
 return true;
}
export async function verifyBusinessSelectedSaleHistoricalReadProof(context,request,{domain,write,automatic,transaction}={}){
 assertIsolatedCopyContext(context);
 if(domain!=='trade'||write!==false||automatic!==null)return false;
 const registered=getRegisteredBusinessSelectedSaleRevision(context);
 if(!supportsBusinessSelectedSaleHistoricalRead(context,registered))return false;
 copyAssert(transaction&&request?.parent===transaction&&typeof request.query==='function','SELECTED_HISTORICAL_BOUND_REQUEST');
 return assertBusinessSelectedSaleHistoricalReadProof(context,registered,await request.query(BUSINESS_SELECTED_SALE_HISTORICAL_READ_PROOF_SQL));
}
