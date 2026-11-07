// Offline compiler for a rollback-only trial. The caller must independently
// verify target, process ownership and proof provenance. No apply is exposed.
import {createHash} from 'node:crypto';
import {MASTER_V3_TARGET,MASTER_V3_TARGET_IDENTITY_SQL,MASTER_V3_SECURITY_SNAPSHOT_SQL,MASTER_V3_BUSINESS_SNAPSHOT_SQL} from './master-v3-transition.mjs';
import {LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,LOCAL_MASTER_CONCURRENCY_GUARD} from './local-master-schema-proposal.mjs';
import {DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL,DESKTOP_GOODS_V6_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopGoodsV6Policy.mjs';
import {DESKTOP_FINANCE_V7_SCHEMA_GUARD_CANDIDATE,DESKTOP_FINANCE_V7_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopFinanceV7Policy.mjs';
import {compileDesktopFinanceV7MutationFragments} from './master-v7-mutation-fragments.mjs';
import {assertDesktopFinanceV6Baseline} from './master-v7-snapshot-verify.mjs';
const fail=()=>{throw Error('MASTER_V7_TRIAL_SOURCE_INVALID');};
const quote=s=>`N'${s.replaceAll("'","''")}'`;
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
function exact(s,a,b,count=1){if(s.split(a).length!==count+1)fail();return s.split(a).join(b);}
const identity=exact(MASTER_V3_TARGET_IDENTITY_SQL,'schema_version IN(2,3)','schema_version IN(6,7)');
const exclude="NOT IN(N'desktop_empty_installation',N'roles',N'permissions')";
const baseBusiness=MASTER_V3_BUSINESS_SNAPSHOT_SQL.replaceAll('<>36','<>40').replace('<>33','<>37');
let candidateBusiness=exact(baseBusiness,exclude,"NOT IN(N'desktop_empty_installation',N'roles',N'permissions',N'finance_accounts',N'finance_account_movements',N'desktop_finance_requests')");
candidateBusiness=exact(candidateBusiness,'<>40','<>43',2);
const ids=`SELECT t.name tableName,CONVERT(varchar(40),ic.seed_value) seedValue,CONVERT(varchar(40),ic.increment_value) incrementValue,CONVERT(varchar(40),ic.last_value) lastValue,CONVERT(varchar(40),IDENT_CURRENT(QUOTENAME(SCHEMA_NAME(t.schema_id))+N'.'+QUOTENAME(t.name))) identCurrent FROM sys.tables t LEFT JOIN sys.identity_columns ic ON ic.object_id=t.object_id WHERE t.is_ms_shipped=0`;
const objects=`SELECT t.name tableName,t.object_id objectId FROM sys.tables t WHERE t.is_ms_shipped=0 AND t.schema_id=SCHEMA_ID(N'dbo')`;
function capture(business,candidate){const filter=candidate?" AND t.name NOT IN(N'finance_accounts',N'finance_account_movements',N'desktop_finance_requests')":'';return `${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}\n${MASTER_V3_SECURITY_SNAPSHOT_SQL}\n${business}\nSET @m=@local_master_manifest;SET @s=@v3_security_json;SET @b=@v3_data_json;SET @i=(${ids}${filter} ORDER BY t.name FOR JSON PATH,INCLUDE_NULL_VALUES);SET @o=(${objects}${filter} ORDER BY t.name FOR JSON PATH,INCLUDE_NULL_VALUES);`;}
function runCapture(business,candidate,suffix){return `EXEC sys.sp_executesql ${quote(capture(business,candidate))},N'@m nvarchar(max) OUTPUT,@s nvarchar(max) OUTPUT,@b nvarchar(max) OUTPUT,@i nvarchar(max) OUTPUT,@o nvarchar(max) OUTPUT',@m=@m${suffix} OUTPUT,@s=@s${suffix} OUTPUT,@b=@b${suffix} OUTPUT,@i=@i${suffix} OUTPUT,@o=@o${suffix} OUTPUT;`;}
const locks=`DECLARE @table sysname,@lockSql nvarchar(max),@n bigint;DECLARE v7_locks CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo') ORDER BY name;OPEN v7_locks;FETCH NEXT FROM v7_locks INTO @table;WHILE @@FETCH_STATUS=0 BEGIN SET @lockSql=N'SELECT @n=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@table)+N' WITH(TABLOCKX,HOLDLOCK);';EXEC sys.sp_executesql @lockSql,N'@n bigint OUTPUT',@n=@n OUTPUT;FETCH NEXT FROM v7_locks INTO @table;END;CLOSE v7_locks;DEALLOCATE v7_locks;`;
export function compileDesktopFinanceV7Trial({baseline}={}){
 if(arguments.length!==1||Object.keys(arguments[0]??{}).sort().join(',')!=='baseline')fail();assertDesktopFinanceV6Baseline(baseline);const f=compileDesktopFinanceV7MutationFragments({mode:'rollback'});
 const equal=(v,h)=>`LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),${v})),2)) COLLATE Latin1_General_100_BIN2='${h}'`;
 const baselineCheck=['metadataSha256','securitySha256','businessRowsSha256','identitiesSha256','objectIdsSha256'].map((k,i)=>equal(['@m0','@s0','@b0','@i0','@o0'][i],baseline[k])).join(' AND ');
 const sql=`SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET ANSI_NULLS ON;SET ANSI_PADDING ON;SET ANSI_WARNINGS ON;SET ARITHABORT ON;SET CONCAT_NULL_YIELDS_NULL ON;SET QUOTED_IDENTIFIER ON;SET NUMERIC_ROUNDABORT OFF;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V7_EXISTING_TRANSACTION',1;${identity}
 DECLARE @owner int,@operatorRole bigint,@imp bit=0,@identityOn bit=0,@newObjects nvarchar(max),@m0 nvarchar(max),@s0 nvarchar(max),@b0 nvarchar(max),@i0 nvarchar(max),@o0 nvarchar(max),@m1 nvarchar(max),@s1 nvarchar(max),@b1 nvarchar(max),@i1 nvarchar(max),@o1 nvarchar(max),@m2 nvarchar(max),@s2 nvarchar(max),@b2 nvarchar(max),@i2 nvarchar(max),@o2 nvarchar(max);
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;IF @owner<0 THROW 51995,'MASTER_V7_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}\n${locks}\n${identity}
 IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=6) THROW 51995,'MASTER_V7_BASELINE_VERSION',1;${DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL}
 EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @imp=1;${DESKTOP_GOODS_V6_PERMISSION_GUARD_SQL}\nREVERT;SET @imp=0;
 ${runCapture(baseBusiness,false,'0')} IF @m0 IS NULL OR @s0 IS NULL OR @b0 IS NULL OR @i0 IS NULL OR @o0 IS NULL OR NOT (${baselineCheck}) THROW 51995,'MASTER_V7_BASELINE_DRIFT',1;
 SELECT @operatorRole=id FROM dbo.roles WHERE code=N'desktop_first_sale_operator';IF @operatorRole IS NULL THROW 51995,'MASTER_V7_OPERATOR_MISSING',1;
 ${f.permissionPrecondition}\nEXEC sys.sp_executesql ${quote(f.ddl)};\nEXEC sys.sp_executesql ${quote(f.grants)};
 SET IDENTITY_INSERT dbo.permissions ON;SET @identityOn=1;${f.permissionInsert}\nSET IDENTITY_INSERT dbo.permissions OFF;SET @identityOn=0;
 EXEC sys.sp_executesql ${quote(DESKTOP_FINANCE_V7_SCHEMA_GUARD_CANDIDATE)};
 EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @imp=1;EXEC sys.sp_executesql ${quote(DESKTOP_FINANCE_V7_PERMISSION_GUARD_SQL)};REVERT;SET @imp=0;
 SET @newObjects=(SELECT t.name name,t.object_id objectId FROM sys.tables t WHERE t.schema_id=SCHEMA_ID(N'dbo') AND t.name IN(N'finance_accounts',N'finance_account_movements',N'desktop_finance_requests') ORDER BY t.name FOR JSON PATH,INCLUDE_NULL_VALUES);
 EXEC sys.sp_executesql N'IF (SELECT COUNT_BIG(*) FROM dbo.finance_accounts)<>1 OR (SELECT COUNT_BIG(*) FROM dbo.finance_accounts WHERE id>0 AND DATALENGTH(account_code)=DATALENGTH(N''KASA-TRY'') AND CONVERT(varbinary(max),account_code)=CONVERT(varbinary(max),N''KASA-TRY'') AND DATALENGTH(account_name)=DATALENGTH(N''TRY Ana Kasa'') AND CONVERT(varbinary(max),account_name)=CONVERT(varbinary(max),N''TRY Ana Kasa'') AND DATALENGTH(account_type)=DATALENGTH(N''cash'') AND CONVERT(varbinary(max),account_type)=CONVERT(varbinary(max),N''cash'') AND DATALENGTH(currency_code)=DATALENGTH(N''TRY'') AND CONVERT(varbinary(max),currency_code)=CONVERT(varbinary(max),N''TRY'') AND opening_balance=0 AND current_balance=0 AND is_active=1 AND created_at IS NOT NULL AND updated_at IS NULL)<>1 OR EXISTS(SELECT 1 FROM dbo.finance_account_movements) OR EXISTS(SELECT 1 FROM dbo.desktop_finance_requests) THROW 51995,''MASTER_V7_SEED_REJECTED'',1;';
 ${runCapture(candidateBusiness,true,'1')}
 IF @newObjects IS NULL OR @m1 IS NULL OR @s1 IS NULL OR @b1 IS NULL OR @i1 IS NULL OR @o1 IS NULL OR HASHBYTES('SHA2_256',CONVERT(varbinary(max),@b1))<>HASHBYTES('SHA2_256',CONVERT(varbinary(max),@b0)) OR HASHBYTES('SHA2_256',CONVERT(varbinary(max),@i1))<>HASHBYTES('SHA2_256',CONVERT(varbinary(max),@i0)) OR HASHBYTES('SHA2_256',CONVERT(varbinary(max),@o1))<>HASHBYTES('SHA2_256',CONVERT(varbinary(max),@o0)) THROW 51995,'MASTER_V7_OLD_ROWS_OR_IDENTITY_DRIFT',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD} IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 OR @identityOn<>0 THROW 51995,'MASTER_V7_TRANSACTION_DRIFT',1;
 ROLLBACK TRANSACTION;${runCapture(baseBusiness,false,'2')}
 IF @m2 IS NULL OR @s2 IS NULL OR @b2 IS NULL OR @i2 IS NULL OR @o2 IS NULL OR HASHBYTES('SHA2_256',CONVERT(varbinary(max),@m2))<>HASHBYTES('SHA2_256',CONVERT(varbinary(max),@m0)) OR HASHBYTES('SHA2_256',CONVERT(varbinary(max),@s2))<>HASHBYTES('SHA2_256',CONVERT(varbinary(max),@s0)) OR HASHBYTES('SHA2_256',CONVERT(varbinary(max),@b2))<>HASHBYTES('SHA2_256',CONVERT(varbinary(max),@b0)) OR HASHBYTES('SHA2_256',CONVERT(varbinary(max),@i2))<>HASHBYTES('SHA2_256',CONVERT(varbinary(max),@i0)) OR HASHBYTES('SHA2_256',CONVERT(varbinary(max),@o2))<>HASHBYTES('SHA2_256',CONVERT(varbinary(max),@o0)) THROW 51995,'MASTER_V7_ROLLBACK_DRIFT',1;
 SELECT N'MASTER_V7_ROLLED_BACK_SOURCE_TRIAL' state,@m1 candidateMetadataJson,@s1 candidateSecurityJson,@b1 oldBusinessJson,@i1 oldIdentitiesJson,@o1 oldObjectIdsJson,@newObjects newObjectIdsJson;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;IF @imp=1 REVERT;IF @identityOn=1 SET IDENTITY_INSERT dbo.permissions OFF;THROW;END CATCH;`;
 return Object.freeze({mode:'rollback',sql,sha256:sha(sql),target:MASTER_V3_TARGET,baselineProofSha256:baseline.proofSha256,admissionAllowed:false,sqlTested:false,requiresIndependentReadback:true,requiresExternalTargetAndOriginProof:true});
}
