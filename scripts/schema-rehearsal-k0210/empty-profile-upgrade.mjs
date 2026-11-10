// SQL previews only. No connection, executor, main, credentials or runtime action.
import {LOCAL_MASTER_CONCURRENCY_GUARD} from '../desktop-empty/local-master-schema-proposal.mjs';
import {OLD_TABLES,NEW_TABLES,ALL_TABLES,ADDED_COLUMNS,UPGRADE_SCHEMA_STAGES,SETTINGS_INSERT,SETTINGS_VERIFY,CASH_INSERT,REFERENCE_ROWS} from './empty-profile-fragments.mjs';
import {HASH_FIELDS,SOURCE_SIGNATURE,utf8sha,assertCompleteBaseline,assertUpgradeAuthority} from './empty-profile-review.mjs';
import {sqlQuote as q,sqlNames as names,hashSql,finishSql as finish,fixedEmptyIdentity as identity,preamble,emptyGuard,snapshot,nativeSelect as selectNative} from './empty-profile-baseline-v2.mjs';
export {compileCompleteSchema2Observer} from './empty-profile-baseline-v2.mjs';
const declareAfter=()=>HASH_FIELDS.map(k=>`DECLARE @after${k}Json nvarchar(max),@after${k}Sha256 varchar(64);`).join('\n');
function captureAfter(){const body=snapshot(ALL_TABLES,false)+'\n'+HASH_FIELDS.map(k=>`SET @out${k}Json=@${k}Json;SET @out${k}Sha256=@${k}Sha256;`).join('\n');const args=HASH_FIELDS.flatMap(k=>[`@out${k}Json nvarchar(max) OUTPUT`,`@out${k}Sha256 varchar(64) OUTPUT`]).join(',');const outs=HASH_FIELDS.flatMap(k=>[`@out${k}Json=@after${k}Json OUTPUT`,`@out${k}Sha256=@after${k}Sha256 OUTPUT`]).join(',');return `EXEC sys.sp_executesql ${q(body)},${q(args)},${outs};`;}
const identityColumns=`schemaName nvarchar(128),tableName nvarchar(128),objectId int,columnId int,columnName nvarchar(128),seedValue varchar(50),incrementValue varchar(50),lastValue varchar(50),identCurrent varchar(50)`;
function identityProjection(input,excludeSettings){return `(SELECT schemaName,tableName,objectId,columnId,columnName,seedValue,incrementValue,lastValue,identCurrent FROM OPENJSON(${input}) WITH(${identityColumns}) WHERE tableName IN(${names(OLD_TABLES)})${excludeSettings?" AND tableName<>N'system_settings'":''} ORDER BY objectId,columnId FOR JSON PATH,INCLUDE_NULL_VALUES)`;}
const replaced=['CK_desktop_local_requests_operation','CK_desktop_profile_version_mode','CK_desktop_request_operation','CK_desktop_resolution_kind','CK_customer_movements_type','CK_stock_movements_source_type','CK_supplier_movements_type','FK_desktop_v3_supplier_entity','FK_desktop_v3_account_supplier','FK_v6_purchase_invoices_entity','FK_v6_purchase_invoices_account','FK_v6_supplier_movements_entity','FK_v6_supplier_movements_account'];
function objectProjection(input){return `(SELECT schemaName,name,type,objectId,parentObjectId,parentName FROM OPENJSON(${input}) WITH(schemaName nvarchar(128),name nvarchar(128),type varchar(2),objectId int,parentObjectId int,parentName nvarchar(128)) WHERE name NOT IN(${names(NEW_TABLES)}) AND (parentName IS NULL OR parentName NOT IN(${names(NEW_TABLES)})) AND name NOT IN(${names(replaced)}) ORDER BY schemaName,name,type FOR JSON PATH,INCLUDE_NULL_VALUES)`;}
function descriptor(m,kind,sql,extra={}){return Object.freeze({kind,sql,sha256:utf8sha(sql),identity:m,identitySha256:utf8sha(JSON.stringify(m)),sourceSignature:SOURCE_SIGNATURE,executionAuthorized:false,sqlTested:false,requiresRootDecisionAndOsProof:true,requiresSeparateNativeObservation:true,...extra});}
export function compileEmptyProfileUpgrade(value,baseline,mode,authority){
 const m=identity(value),b=assertCompleteBaseline(baseline);if(!['rollback','apply'].includes(mode)||mode==='rollback'&&authority!==undefined)throw Error('K0210_EMPTY_PROFILE_MODE');const a=mode==='apply'?assertUpgradeAuthority(authority,b):null;
 const sql=`${preamble(m,OLD_TABLES,2)}
${emptyGuard(OLD_TABLES,['desktop_empty_installation'])}
${snapshot(OLD_TABLES,false)}
IF ${HASH_FIELDS.map(k=>`@${k}Sha256<>${q(b.hashes[k])}`).join(' OR ')} THROW 51995,'K0210_COMPLETE_BASELINE_CHANGED',1;
${UPGRADE_SCHEMA_STAGES.map(s=>`EXEC sys.sp_executesql ${q(s)};`).join('\n')}
${declareAfter()}
${captureAfter()}
IF @aftersecuritySha256<>@securitySha256 OR ${hashSql(objectProjection('@afterobjectIdsJson'))}<>${hashSql(objectProjection('@objectIdsJson'))} OR ${hashSql(identityProjection('@afteridentitiesJson',false))}<>@identitiesSha256 THROW 51995,'K0210_OLD_OBJECT_IDENTITY_OR_SECURITY_CHANGED',1;
IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>43 OR ${ALL_TABLES.map(n=>`OBJECT_ID(${q('dbo.'+n)},N'U') IS NULL`).join(' OR ')} THROW 51995,'K0210_UPGRADE_RESULT_TABLES',1;
${emptyGuard(ALL_TABLES,['desktop_empty_installation'])}
${mode==='apply'?`IF @aftersemanticSha256<>${q(a.candidateSemanticSha256)} THROW 51995,'K0210_UPGRADE_CANDIDATE_CHANGED',1;
EXEC sys.sp_executesql ${q(SETTINGS_INSERT+SETTINGS_VERIFY)};
EXEC sys.sp_executesql ${q(CASH_INSERT)};
IF (SELECT COUNT(*) FROM dbo.finance_accounts)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.finance_accounts WHERE account_code=N'KASA-TRY' AND account_name=N'TRY Ana Kasa' AND account_type=N'cash' AND currency_code=N'TRY' AND opening_balance=0 AND current_balance=0 AND is_active=1) THROW 51995,'K0210_REFERENCE_CASH_REJECTED',1;`:''}
${LOCAL_MASTER_CONCURRENCY_GUARD}
IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'K0210_TRANSACTION_REJECTED',1;
${mode==='rollback'?"SELECT N'K0210_EMPTY_PROFILE_DDL_CANDIDATE' state,@aftersemanticJson semanticJson,@aftersemanticSha256 semanticSha256;THROW 51990,'K0210_EMPTY_PROFILE_DDL_ROLLBACK',1;":"COMMIT TRANSACTION;SELECT N'K0210_EMPTY_PROFILE_SCHEMA7_APPLIED' state;"}
${finish}`;
 return descriptor(m,'K0210_EMPTY_PROFILE_UPGRADE_PREVIEW',sql,{mode,oldTableCount:36,newTableCount:43,existingNullableColumnsAdded:ADDED_COLUMNS.length,referenceSeeds:mode==='apply'?REFERENCE_ROWS:null,rollbackWritesExistingIdentityTables:false,failedApplyMayConsumeSettingsIdentity:mode==='apply',automaticRetryAllowed:false,requiresAuthenticatedRollbackReceipt:mode==='apply',acceptanceSha256:a?.acceptanceSha256??null,applyDecisionSha256:a?.applyDecisionSha256??null});
}
export function compileEmptyProfileObserver(value,baseline,authority){
 const m=identity(value),b=assertCompleteBaseline(baseline),a=assertUpgradeAuthority(authority,b);
 const sql=`${preamble(m,ALL_TABLES,7)}
${emptyGuard(ALL_TABLES,['desktop_empty_installation','system_settings','finance_accounts'])}
${SETTINGS_VERIFY.trim()}
IF (SELECT COUNT(*) FROM dbo.finance_accounts)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.finance_accounts WHERE account_code=N'KASA-TRY' AND account_name=N'TRY Ana Kasa' AND account_type=N'cash' AND currency_code=N'TRY' AND opening_balance=0 AND current_balance=0 AND is_active=1) THROW 51995,'K0210_REFERENCE_CASH_REJECTED',1;
${snapshot(ALL_TABLES,true)}
IF @securitySha256<>${q(b.hashes.security)} OR @semanticSha256<>${q(a.candidateSemanticSha256)} OR ${hashSql(objectProjection('@objectIdsJson'))}<>${hashSql(objectProjection(q(b.native.objectIdsJson)))} OR ${hashSql(identityProjection('@identitiesJson',true))}<>${hashSql(identityProjection(q(b.native.identitiesJson),true))} THROW 51995,'K0210_UPGRADE_READBACK_DRIFT',1;
DECLARE @settingsLast numeric(38,0);
SELECT @settingsLast=TRY_CONVERT(numeric(38,0),lastValue) FROM OPENJSON(${q(b.native.identitiesJson)}) WITH(tableName nvarchar(128),lastValue varchar(50)) WHERE tableName=N'system_settings';
IF CONVERT(numeric(38,0),IDENT_CURRENT(N'dbo.system_settings'))<>ISNULL(@settingsLast,0)+2 THROW 51995,'K0210_REFERENCE_IDENTITY_REJECTED',1;
${selectNative(7)} COMMIT TRANSACTION;${finish}`;
 return descriptor(m,'K0210_EMPTY_PROFILE_SCHEMA7_OBSERVER_PREVIEW',sql,{readOnly:true,requiresActualApplyReceipt:true,referenceSeeds:REFERENCE_ROWS,acceptanceSha256:a.acceptanceSha256,applyDecisionSha256:a.applyDecisionSha256});
}
