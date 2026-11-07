// Offline, fixed-target V5 -> V6 compiler. No connection or execution.
// A rollback trial and a separate completed observer must precede apply.
import {createHash} from 'node:crypto';
import {MASTER_V3_TARGET,MASTER_V3_TARGET_IDENTITY_SQL,MASTER_V3_SECURITY_SNAPSHOT_SQL,MASTER_V3_BUSINESS_SNAPSHOT_SQL} from './master-v3-transition.mjs';
import {LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,LOCAL_MASTER_CONCURRENCY_GUARD} from './local-master-schema-proposal.mjs';
import {DESKTOP_MASTER_V5_PERMISSION_MANIFEST,DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL} from '../../apps/api/src/config/desktopMasterV5Policy.mjs';
import {DESKTOP_GOODS_V6_OPERATOR_PERMISSIONS,DESKTOP_GOODS_V6_PERMISSION_MANIFEST,DESKTOP_GOODS_V6_PERMISSION_GUARD_SQL,DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL} from '../../apps/api/src/config/desktopGoodsV6Policy.mjs';
import {compileDesktopGoodsV6SchemaFragments,DESKTOP_GOODS_V6_ADDED_COLUMNS} from '../../apps/api/src/config/desktopGoodsV6Schema.mjs';
import {DESKTOP_GOODS_V6_BASELINE_SNAPSHOT_SQL,DESKTOP_GOODS_V6_CANDIDATE_SNAPSHOT_SQL,DESKTOP_GOODS_V6_ROLLBACK_IDENTITY_VERIFY_SQL,compileDesktopGoodsV6ObserveFragments} from './desktop-goods-v6-snapshot.mjs';

const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const quote=s=>`N'${s.replaceAll("'","''")}'`;
const fail=()=>{throw Error('MASTER_V6_OPTIONS_REJECTED');};
const key=p=>[p.schema,p.name,p.permission,p.column??''].join('/');
const previous=new Set(DESKTOP_MASTER_V5_PERMISSION_MANIFEST.map(key));
const addedGrants=DESKTOP_GOODS_V6_PERMISSION_MANIFEST.filter(p=>!previous.has(key(p)));
if(addedGrants.length!==new Set(addedGrants.map(key)).size||DESKTOP_GOODS_V6_ADDED_COLUMNS.length!==14)fail();
const addedPermissions=DESKTOP_GOODS_V6_OPERATOR_PERMISSIONS.slice(11);
if(addedPermissions.length!==6)fail();
const identity=MASTER_V3_TARGET_IDENTITY_SQL.replace('schema_version IN(2,3)','schema_version IN(5,6)');
const grants=addedGrants.map(p=>`GRANT ${p.permission} ON OBJECT::dbo.[${p.name}]${p.column===null?'':`([${p.column}])`} TO desktop_local_writer_v2;`).join('\n');
const rawSnapshot=`${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}\n${MASTER_V3_SECURITY_SNAPSHOT_SQL}\n${MASTER_V3_BUSINESS_SNAPSHOT_SQL}
SET @metadata=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2));SET @security=@v3_security_sha;SET @business=@v3_business_sha;`;
const rawHashes=`EXEC sys.sp_executesql ${quote(rawSnapshot)},N'@metadata char(64) OUTPUT,@security char(64) OUTPUT,@business char(64) OUTPUT',@metadata=@metadata OUTPUT,@security=@security OUTPUT,@business=@business OUTPUT;`;
const lockTables=`DECLARE @lockTable sysname,@lockSql nvarchar(max),@lockCount bigint;
DECLARE v6_lock_tables CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo') ORDER BY name;
OPEN v6_lock_tables;FETCH NEXT FROM v6_lock_tables INTO @lockTable;
WHILE @@FETCH_STATUS=0 BEGIN SET @lockSql=N'SELECT @n=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@lockTable)+N' WITH(TABLOCKX,HOLDLOCK);';EXEC sys.sp_executesql @lockSql,N'@n bigint OUTPUT',@n=@lockCount OUTPUT;FETCH NEXT FROM v6_lock_tables INTO @lockTable;END;
CLOSE v6_lock_tables;DEALLOCATE v6_lock_tables;`;

// A failed source-parser attempt rolled back its DDL/data but consumed these
// two identities. Keep the gaps; never reseed to conceal that failed attempt.
// Fixed-target independent evidence: v6-parser-incident-identity-v1.json.
export const MASTER_V6_IDENTITY_BASELINE=Object.freeze({permissions:49,settings:2,settingsLastValue:'2'});
export const MASTER_V6_TRANSITION_SCOPE=Object.freeze({fromSchemaVersion:5,toSchemaVersion:6,newTables:4,addedNullableColumns:14,expectedTableCount:40,newOperatorPermissions:6,newSqlRights:addedGrants.length,newPrincipals:0,newPasswords:0,existingBusinessRowsPreserved:true,newSettingsRows:2,settingsOverwrite:false,requiresStoppedOwnedApp:true,rollbackFirst:true,currencyPosting:'TRY_ONLY',externalOperations:0,actualT1:0,identityBaseline:MASTER_V6_IDENTITY_BASELINE});

export function compileMasterV6BaselineObserver(){
 const sql=`SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V6_EXISTING_TRANSACTION',1;
 ${identity}
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;
 DECLARE @owner int;EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @owner<0 THROW 51995,'MASTER_V6_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 ${lockTables}
 ${identity}
 IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=5) OR IDENT_CURRENT(N'dbo.permissions')<>49 OR IDENT_CURRENT(N'dbo.system_settings')<>2 THROW 51995,'MASTER_V6_BASELINE_IDENTITY_DRIFT',1;
 ${DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL}
 ${DESKTOP_GOODS_V6_BASELINE_SNAPSHOT_SQL}
 SELECT N'MASTER_V6_V5_BASELINE_OBSERVED' state,@v6_baseline_metadata_sha256 metadataSha256,@v6_baseline_security_sha256 securitySha256,@v6_baseline_business_sha256 businessRowsSha256,
 @v6_baseline_metadata_raw metadataJson,@v6_baseline_security_raw securityJson,@v6_baseline_business_json businessTablesJson,@v6_original_json originalJson,@v6_original_sha256 originalSha256,
 CONVERT(varchar(40),IDENT_CURRENT(N'dbo.permissions')) permissionIdentityCurrent,CONVERT(varchar(40),IDENT_CURRENT(N'dbo.system_settings')) settingsIdentityCurrent;
 COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;`;
 return Object.freeze({mode:'baseline',sql,sha256:sha(sql),target:MASTER_V3_TARGET,readOnly:true,sqlTested:false});
}

export function compileMasterV6Transition(v){
 const keys=['mode','metadataSha256','securitySha256','businessRowsSha256',...(v?.mode==='apply'?['candidateMetadataSemanticSha256','candidateSecuritySemanticSha256']:[])];
 if(!v||typeof v!=='object'||Array.isArray(v)||!['rollback','apply'].includes(v.mode)||Object.keys(v).sort().join(',')!==keys.sort().join(',')||keys.filter(k=>k!=='mode').some(k=>typeof v[k]!=='string'||!/^[a-f0-9]{64}$/.test(v[k])))fail();
 const baseline=`@metadata COLLATE Latin1_General_100_BIN2<>'${v.metadataSha256}' OR @security COLLATE Latin1_General_100_BIN2<>'${v.securitySha256}' OR @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}'`;
 const permissionValues=addedPermissions.map((p,i)=>`(${v.mode==='rollback'?`${-30101-i},`:''}@operatorRole,${quote(p.key)},${p.view},${p.create},${p.update},${p.delete},${p.approve})`).join(',');
 const permissionInsert=`${v.mode==='rollback'?"SET IDENTITY_INSERT dbo.permissions ON;SET @identityTable=N'permissions';":''}
 INSERT dbo.permissions(${v.mode==='rollback'?'id,':''}role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve) VALUES ${permissionValues};
 IF @@ROWCOUNT<>6 THROW 51995,'MASTER_V6_PERMISSION_INSERT',1;
 ${v.mode==='rollback'?"SET IDENTITY_INSERT dbo.permissions OFF;SET @identityTable=NULL;":''}`;
 let ddl=compileDesktopGoodsV6SchemaFragments({mode:v.mode}).sql;
 if(v.mode==='rollback'){
  if(ddl.split('SET IDENTITY_INSERT dbo.system_settings ON;').length!==2||ddl.split('SET IDENTITY_INSERT dbo.system_settings OFF;').length!==2)fail();
  // The state flag belongs to the outer TRY. Output parameters in a failed
  // dynamic batch cannot be relied on to report an IDENTITY_INSERT change.
  ddl=ddl.replace('SET IDENTITY_INSERT dbo.system_settings ON;','').replace('SET IDENTITY_INSERT dbo.system_settings OFF;','');
 }
 const sql=`SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
 SET ANSI_NULLS ON;SET ANSI_PADDING ON;SET ANSI_WARNINGS ON;SET ARITHABORT ON;SET CONCAT_NULL_YIELDS_NULL ON;SET QUOTED_IDENTIFIER ON;SET NUMERIC_ROUNDABORT OFF;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V6_EXISTING_TRANSACTION',1;
 ${identity}
 DECLARE @metadata char(64),@security char(64),@business char(64),@owner int,@operatorRole bigint,@impersonating bit=0,@identityTable sysname=NULL,@permissionIdentity numeric(38,0),@settingsIdentity numeric(38,0);
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;
 EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @owner<0 THROW 51995,'MASTER_V6_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 ${lockTables}
 ${identity}
 IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>36 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=5)
 OR (SELECT COUNT(*) FROM dbo.roles WHERE code=N'desktop_first_sale_operator' AND is_active=1 AND is_system_role=0)<>1
 OR (SELECT COUNT(*) FROM dbo.permissions p JOIN dbo.roles r ON r.id=p.role_id WHERE r.code=N'desktop_first_sale_operator')<>11
 OR (SELECT COUNT(*) FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE r.code=N'desktop_first_sale_operator')<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=30002 AND u.username=N'erp_deneme' AND u.is_active=1 AND r.code=N'desktop_first_sale_operator')
 OR (SELECT COUNT(*) FROM sys.sql_logins WHERE name=N'melisa_desktop_test_writer_20261105' AND sid=0x417717302D2EFA478380226433A0BCA6 AND is_disabled=0 AND is_policy_checked=1 AND default_database_name=N'MELISA_ERP_DESKTOP_TEST_20261105')<>1
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND security_id=0x417717302D2EFA478380226433A0BCA6)
 OR EXISTS(SELECT 1 FROM dbo.permissions WHERE id BETWEEN -30106 AND -30101)
 OR EXISTS(SELECT 1 FROM dbo.system_settings)
 OR EXISTS(SELECT 1 FROM sys.identity_columns WHERE object_id IN(OBJECT_ID(N'dbo.permissions'),OBJECT_ID(N'dbo.system_settings')) AND (name<>N'id' OR CONVERT(bigint,seed_value)<>1 OR CONVERT(bigint,increment_value)<>1))
 OR (SELECT COUNT(*) FROM sys.identity_columns WHERE object_id IN(OBJECT_ID(N'dbo.permissions'),OBJECT_ID(N'dbo.system_settings')) AND name=N'id')<>2
 THROW 51995,'MASTER_V6_PRECONDITION',1;
 SELECT @operatorRole=id FROM dbo.roles WHERE code=N'desktop_first_sale_operator';
 SET @permissionIdentity=IDENT_CURRENT(N'dbo.permissions');SET @settingsIdentity=IDENT_CURRENT(N'dbo.system_settings');
 IF @permissionIdentity<>49 OR @settingsIdentity<>2 OR NOT EXISTS(SELECT 1 FROM sys.identity_columns WHERE object_id=OBJECT_ID(N'dbo.system_settings') AND CONVERT(nvarchar(100),last_value)=N'2') THROW 51995,'MASTER_V6_IDENTITY_PRECONDITION',1;
 ${DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL}
 ${rawHashes}
 IF ${baseline} THROW 51995,'MASTER_V6_BASELINE_DRIFT',1;
 EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;
 ${DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL}
 REVERT;SET @impersonating=0;
 ${DESKTOP_GOODS_V6_BASELINE_SNAPSHOT_SQL}
 ${v.mode==='rollback'?"SET IDENTITY_INSERT dbo.system_settings ON;SET @identityTable=N'system_settings';":''}
 EXEC sys.sp_executesql ${quote(ddl)};
 ${v.mode==='rollback'?"SET IDENTITY_INSERT dbo.system_settings OFF;SET @identityTable=NULL;":''}
 ${grants}
 ${permissionInsert}
 ${DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL}
 EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;
 ${DESKTOP_GOODS_V6_PERMISSION_GUARD_SQL}
 REVERT;SET @impersonating=0;
 ${DESKTOP_GOODS_V6_CANDIDATE_SNAPSHOT_SQL}
 ${v.mode==='apply'?`IF @v6_metadata_semantic_sha256 COLLATE Latin1_General_100_BIN2<>'${v.candidateMetadataSemanticSha256}' OR @v6_security_semantic_sha256 COLLATE Latin1_General_100_BIN2<>'${v.candidateSecuritySemanticSha256}' THROW 51995,'MASTER_V6_CANDIDATE_DRIFT',1;
 IF IDENT_CURRENT(N'dbo.permissions')<>@permissionIdentity+6 OR IDENT_CURRENT(N'dbo.system_settings')<>4
 OR (SELECT COUNT(*) FROM dbo.permissions WHERE role_id=@operatorRole AND id BETWEEN 50 AND 55)<>6
 OR EXISTS(SELECT 1 FROM dbo.system_settings WHERE id NOT IN(3,4)) THROW 51995,'MASTER_V6_APPLY_IDENTITY_DRIFT',1;`:''}
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 OR @identityTable IS NOT NULL THROW 51995,'MASTER_V6_TRANSACTION_REJECTED',1;
 ${v.mode==='rollback'?`ROLLBACK TRANSACTION;
 ${DESKTOP_GOODS_V6_ROLLBACK_IDENTITY_VERIFY_SQL}
 ${rawHashes}
 IF ${baseline} THROW 51995,'MASTER_V6_ROLLBACK_DRIFT',1;
 IF IDENT_CURRENT(N'dbo.permissions')<>@permissionIdentity OR IDENT_CURRENT(N'dbo.system_settings')<>@settingsIdentity THROW 51995,'MASTER_V6_ROLLBACK_IDENTITY_DRIFT',1;`:'COMMIT TRANSACTION;'}
 SELECT N'${v.mode==='rollback'?'MASTER_V6_ROLLED_BACK':'MASTER_V6_COMMITTED_UNVERIFIED'}' state,
 @v6_baseline_metadata_raw baselineMetadataJson,@v6_baseline_security_raw baselineSecurityJson,
 @v6_original_json originalJson,@v6_original_sha256 originalSha256,
 @v6_baseline_business_sha256 baselineBusinessRowsSha256,
 @v6_candidate_metadata_raw candidateMetadataJson,@v6_candidate_security_raw candidateSecurityJson,
 @v6_metadata_semantic candidateMetadataSemanticJson,@v6_security_semantic candidateSecuritySemanticJson,
 @v6_metadata_semantic_sha256 candidateMetadataSemanticSha256,@v6_security_semantic_sha256 candidateSecuritySemanticSha256,
 CONVERT(varchar(40),IDENT_CURRENT(N'dbo.permissions')) permissionIdentityCurrent,CONVERT(varchar(40),IDENT_CURRENT(N'dbo.system_settings')) settingsIdentityCurrent,
 (SELECT schema_version FROM dbo.desktop_empty_installation WHERE id=1) schemaVersion;
 END TRY BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 IF @impersonating=1 REVERT;
 IF @identityTable=N'permissions' SET IDENTITY_INSERT dbo.permissions OFF;
 IF @identityTable=N'system_settings' SET IDENTITY_INSERT dbo.system_settings OFF;
 THROW;END CATCH;`;
 return Object.freeze({mode:v.mode,sql,sha256:sha(sql),target:MASTER_V3_TARGET,scope:MASTER_V6_TRANSITION_SCOPE,baseline:Object.freeze({metadataSha256:v.metadataSha256,securitySha256:v.securitySha256,businessRowsSha256:v.businessRowsSha256}),candidate:v.mode==='apply'?Object.freeze({metadataSemanticSha256:v.candidateMetadataSemanticSha256,securitySemanticSha256:v.candidateSecuritySemanticSha256}):null,sqlTested:false,requiresIndependentReadback:true,requiresVerifiedRollbackProof:v.mode==='apply'});
}

// Only valid immediately after the reviewed installation, before any goods
// operation. The caller pins the baseline export and both rollback semantics.
export function compileMasterV6ApplyObserver(v){
 const keys=['originalJson','originalSha256','candidateMetadataSemanticSha256','candidateSecuritySemanticSha256'];
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==keys.sort().join(',')||keys.filter(k=>k!=='originalJson').some(k=>typeof v[k]!=='string'||!/^[a-f0-9]{64}$/.test(v[k])))fail();
 const fragments=compileDesktopGoodsV6ObserveFragments({originalJson:v.originalJson,expectedSha256:v.originalSha256});
 const sql=`SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V6_EXISTING_TRANSACTION',1;
 ${identity}
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;
 DECLARE @owner int;EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @owner<0 THROW 51995,'MASTER_V6_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 ${lockTables}
 ${identity}
 IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=6) THROW 51995,'MASTER_V6_OBSERVER_VERSION',1;
 ${DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL}
 ${fragments.rehydrate}
 ${fragments.candidate}
 IF @v6_metadata_semantic_sha256 COLLATE Latin1_General_100_BIN2<>'${v.candidateMetadataSemanticSha256}' OR @v6_security_semantic_sha256 COLLATE Latin1_General_100_BIN2<>'${v.candidateSecuritySemanticSha256}' THROW 51995,'MASTER_V6_OBSERVER_CANDIDATE_DRIFT',1;
 IF IDENT_CURRENT(N'dbo.permissions')<>55 OR IDENT_CURRENT(N'dbo.system_settings')<>4 OR EXISTS(SELECT 1 FROM dbo.system_settings WHERE id NOT IN(3,4)) THROW 51995,'MASTER_V6_OBSERVER_IDENTITY_DRIFT',1;
 SELECT N'MASTER_V6_APPLY_INDEPENDENTLY_OBSERVED' state,
 @v6_candidate_metadata_raw metadataJson,@v6_candidate_security_raw securityJson,
 LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@v6_candidate_metadata_raw)),2)) metadataSha256,
 LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@v6_candidate_security_raw)),2)) securitySha256,
 @v6_metadata_semantic_sha256 metadataSemanticSha256,@v6_security_semantic_sha256 securitySemanticSha256,
 CONVERT(varchar(40),IDENT_CURRENT(N'dbo.permissions')) permissionIdentityCurrent,CONVERT(varchar(40),IDENT_CURRENT(N'dbo.system_settings')) settingsIdentityCurrent,
 (SELECT table_name,row_count,row_hash FROM @v6_candidate_business ORDER BY table_name FOR JSON PATH,INCLUDE_NULL_VALUES) originalBusinessTablesJson;
 COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;`;
 return Object.freeze({mode:'observe-apply',sql,sha256:sha(sql),target:MASTER_V3_TARGET,readOnly:true,sqlTested:false,originalSha256:v.originalSha256});
}

// General V6 read-only snapshot for installation and later GUI observations.
// Unlike the installation verifier it permits genuine goods rows to exist.
export function compileMasterV6Readback(v={}){
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>k!=='appMayBeRunning'))fail();
 const {appMayBeRunning=false}=v;
 if(typeof appMayBeRunning!=='boolean')fail();
 const business=MASTER_V3_BUSINESS_SNAPSHOT_SQL.replaceAll('<>36','<>40').replace('<>33','<>37');
 if(business===MASTER_V3_BUSINESS_SNAPSHOT_SQL||business.includes('<>36')||business.includes('<>33'))fail();
 const sql=`SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V6_EXISTING_TRANSACTION',1;
 ${identity}
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;
 DECLARE @owner int;EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @owner<0 THROW 51995,'MASTER_V6_OWNER_REJECTED',1;
 ${appMayBeRunning?'':LOCAL_MASTER_CONCURRENCY_GUARD}
 ${lockTables.replace('TABLOCKX,HOLDLOCK','TABLOCK,HOLDLOCK')}
 ${identity}
 IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=6) THROW 51995,'MASTER_V6_OBSERVER_VERSION',1;
 ${DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL}
 ${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}
 ${MASTER_V3_SECURITY_SNAPSHOT_SQL}
 ${business}
 SELECT N'MASTER_V6_READ_ONLY_SNAPSHOT' state,
 LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2)) metadataSha256,@v3_security_sha securitySha256,@v3_business_sha businessRowsSha256,
 @local_master_manifest metadataJson,@v3_security_json securityJson,@v3_data_json businessTablesJson,
 CONVERT(varchar(40),IDENT_CURRENT(N'dbo.permissions')) permissionIdentityCurrent,CONVERT(varchar(40),IDENT_CURRENT(N'dbo.system_settings')) settingsIdentityCurrent,
 (SELECT t.name tableName,CONVERT(varchar(40),ic.seed_value) seedValue,CONVERT(varchar(40),ic.increment_value) incrementValue,CONVERT(varchar(40),ic.last_value) lastValue,CONVERT(varchar(40),IDENT_CURRENT(QUOTENAME(SCHEMA_NAME(t.schema_id))+N'.'+QUOTENAME(t.name))) identCurrent FROM sys.tables t LEFT JOIN sys.identity_columns ic ON ic.object_id=t.object_id WHERE t.is_ms_shipped=0 ORDER BY t.name FOR JSON PATH,INCLUDE_NULL_VALUES) identitiesJson;
 COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;`;
 return Object.freeze({mode:'readback',sql,sha256:sha(sql),target:MASTER_V3_TARGET,readOnly:true,sqlTested:false,appMayBeRunning});
}
