// Offline renderer ONLY. No database driver, process, filesystem, or network imports.
import {createHash} from 'node:crypto';
import {getDesktopFinanceV7GuardSql} from '../../../apps/api/src/config/desktopFinanceV7Policy.mjs';
import {WAREHOUSE_LIFECYCLE_TARGET as T,WAREHOUSE_TABLE_KEYS as TABLES,WAREHOUSE_LIFECYCLE_PARAMETER_TYPES as TYPES,requireWarehouseAction} from './lifecycle-contract.mjs';
const digest=s=>createHash('sha256').update(s,'utf8').digest('hex');
const q=s=>"N'"+s.replaceAll("'","''")+"'";
const hash=s=>`HASHBYTES('SHA2_256',CONVERT(varbinary(max),${s}))`;
const fullUser="(SELECT u.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)";
const protectedUser=`JSON_MODIFY(JSON_MODIFY(${fullUser},'$.is_active',NULL),'$.row_version',NULL)`;
const permissionRows="(SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FOR JSON PATH,INCLUDE_NULL_VALUES)";
const memberships="(SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)";
const principals="(SELECT principal_id,name,type,sid,default_schema_name,owning_principal_id FROM sys.database_principals WHERE principal_id>4 OR principal_id=0 ORDER BY principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)";
const target=`SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'WH_AMBIENT_TRANSACTION',1;
IF DB_ID() IS NULL OR DB_ID()<>5 OR DB_NAME() IS NULL OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),${q(T.database)}) OR SERVERPROPERTY('ServerName') IS NULL OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),${q(T.server)}) OR ISNULL(CONVERT(int,SERVERPROPERTY('ProcessID')),0)<>5240 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory' OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(${q(T.owner)}) IS NULL OR SUSER_SID()<>SUSER_SID(${q(T.owner)}) OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(${q(T.owner)}) OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='${T.databaseGuid}') THROW 51995,'WH_TARGET',1;
IF (SELECT COUNT_BIG(*) FROM sys.tables WHERE is_ms_shipped=0)<>43 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='${T.environmentId}' AND schema_version=7 AND read_only=0 AND actual_t1=0 AND external_operations=0) THROW 51995,'WH_PROFILE',1;
IF (SELECT COUNT_BIG(*) FROM sys.database_permissions)<>404 OR NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE principal_id=6 AND name=N'desktop_local_writer_v2' AND type=N'R' AND owning_principal_id=1) OR NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE principal_id=7 AND name=${q(T.writerLogin)} AND type=N'S' AND sid=0x${T.writerSid} AND default_schema_name=N'dbo') OR NOT EXISTS(SELECT 1 FROM sys.database_role_members WHERE role_principal_id=6 AND member_principal_id=7) OR SUSER_SID(${q(T.writerLogin)}) IS NULL OR SUSER_SID(${q(T.writerLogin)})<>0x${T.writerSid} THROW 51995,'WH_WRITER404',1;`;
function writerGuard(){return `EXECUTE AS LOGIN=${q(T.writerLogin)};SET @impersonating=1;
${getDesktopFinanceV7GuardSql()}
REVERT;SET @impersonating=0;
IF SUSER_SID()<>SUSER_SID(${q(T.owner)}) OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 THROW 51995,'WH_REVERT',1;`;}
// Every existing table is covered. Hashes of users/tokens remain inside SQL;
// neither full user JSON nor credential/token fields appear in any result/audit.
function capture(variable){return Object.entries(TABLES).map(([name,keys])=>{
 const count=`@wh_${variable}_${name}_n`,json=`@wh_${variable}_${name}_json`;
 const exactEmpty=`DATALENGTH(${json})=DATALENGTH(N'[]') AND CONVERT(varbinary(max),${json})=CONVERT(varbinary(max),N'[]')`;
 return `-- WH_CAPTURE_BEGIN ${variable} ${name}
DECLARE ${count} bigint;DECLARE ${json} nvarchar(max);
SELECT ${count}=COUNT_BIG(*) FROM dbo.[${name}] WITH(TABLOCKX,HOLDLOCK);
SET ${json}=(SELECT * FROM dbo.[${name}] WITH(TABLOCKX,HOLDLOCK) ORDER BY ${keys.map(k=>'['+k+']').join(',')} FOR JSON PATH,INCLUDE_NULL_VALUES);
IF ${count} IS NULL OR ${count}<0 THROW 51995,'WH_CAPTURE_COUNT',1;
IF ${count}>0 AND (${json} IS NULL OR (${exactEmpty})) THROW 51995,'WH_CAPTURE_NONEMPTY_JSON',1;
IF ${count}=0 BEGIN
 IF ${json} IS NOT NULL AND NOT(${exactEmpty}) THROW 51995,'WH_CAPTURE_EMPTY_JSON',1;
 SET ${json}=N'[]';
END;
INSERT @${variable}(name,n,h) VALUES(${q(name)},${count},${hash(json)});
SET ${json}=NULL;
-- WH_CAPTURE_END ${variable} ${name}`;
 }).join('\n');}
const inventoryHash=variable=>hash(`(SELECT name,n,CONVERT(varchar(64),h,2) h FROM @${variable} ORDER BY name FOR JSON PATH,INCLUDE_NULL_VALUES)`);
const roleGuard=`IF (SELECT COUNT_BIG(*) FROM dbo.users)<>7 OR (SELECT COUNT_BIG(*) FROM dbo.roles)<>6 OR (SELECT COUNT_BIG(*) FROM dbo.permissions)<>39 OR (SELECT COUNT_BIG(*) FROM dbo.system_settings)<>3 OR NOT EXISTS(SELECT 1 FROM dbo.roles WHERE id=10 AND CONVERT(varbinary(160),code)=CONVERT(varbinary(160),N'desktop_warehouse_operator') AND is_active=1 AND is_system_role=0 AND row_version=0x000000000010E051) OR (SELECT COUNT_BIG(*) FROM dbo.users WHERE role_id=10)<>1 OR (SELECT COUNT_BIG(*) FROM dbo.permissions WHERE role_id=10)<>3 OR EXISTS(SELECT CONVERT(varbinary(240),permission_key),CONVERT(int,can_view),CONVERT(int,can_create),CONVERT(int,can_update),CONVERT(int,can_delete),CONVERT(int,can_approve) FROM dbo.permissions WHERE role_id=10 EXCEPT SELECT * FROM (VALUES (CONVERT(varbinary(240),N'warehouse.pack'),1,0,0,0,0),(CONVERT(varbinary(240),N'warehouse.prepare'),1,0,0,0,0),(CONVERT(varbinary(240),N'warehouse.view'),1,0,0,0,0)) e(k,v,c,u,d,a)) THROW 51995,'WH_ROLE_SCOPE',1;`;
const transactionStart=`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
DECLARE @impersonating bit=0;
BEGIN TRY BEGIN TRANSACTION;
DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=0;
IF @lock<0 OR ISNULL(APPLOCK_MODE(N'public',N'melisa-desktop-local-master-schema-v1',N'Transaction'),N'')<>N'Exclusive' THROW 51995,'WH_SQL_OWNER_LOCK',1;
IF EXISTS(SELECT 1 FROM sys.triggers WHERE is_ms_shipped=0 AND is_disabled=0) THROW 51995,'WH_TRIGGER',1;
DECLARE @before TABLE(name sysname PRIMARY KEY,n bigint NOT NULL,h varbinary(32) NOT NULL);
${capture('before')}
${roleGuard}
${writerGuard()}`;
const catchSql=`END TRY BEGIN CATCH IF @impersonating=1 BEGIN REVERT;SET @impersonating=0;END;IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;`;
const publicUser=`CONVERT(varchar(20),u.id) userId,CONVERT(varchar(20),u.role_id) roleId,u.is_active active,CONVERT(varchar(18),CONVERT(binary(8),u.row_version),1) userRowVersion,CONVERT(varchar(64),${hash(protectedUser)},2) protectedUserSha256`;
const inputs=()=>Object.entries(TYPES).map(([name,type])=>type.startsWith('binary')?`@${name} IS NULL OR DATALENGTH(@${name})<>${type==='binary(8)'?8:32}`:name==='expectedAuditCount'?`@${name} IS NULL OR @${name}<223`:`@${name} IS NULL`).join(' OR ');
function observeSql(){return `${target}
${transactionStart}
SELECT N'WAREHOUSE_LIFECYCLE_READ_ONLY_PHASE_OBSERVATION' state,${publicUser},CONVERT(varchar(64),${inventoryHash('before')},2) inventorySha256,CONVERT(varchar(64),${hash(permissionRows)},2) permissionRowsSha256,CONVERT(varchar(64),${hash(memberships)},2) membershipsSha256,CONVERT(varchar(64),${hash(principals)},2) principalsSha256,(SELECT COUNT_BIG(*) FROM dbo.audit_logs) auditCount,DATEDIFF_BIG(millisecond,CONVERT(datetime2,N'1970-01-01'),SYSUTCDATETIME()) observedAtMs FROM dbo.users u WHERE id=30007 AND role_id=10 AND CONVERT(varbinary(160),username)=CONVERT(varbinary(160),N'erp_depo_deneme');
IF @@ROWCOUNT<>1 THROW 51995,'WH_OBSERVATION_IDENTITY',1;
IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'WH_OBSERVATION_TRANSACTION',1;
ROLLBACK TRANSACTION;
${catchSql}`;}
function mutateSql(action){const activate=action==='activate',from=activate?0:1,to=activate?1:0,actionName=activate?'test_persona_activated':'test_persona_deactivated',reason='actor:SEMIH\\Xaser; K10-WH-CONT-20261109-01:'+(activate?'ACTIVATE':'DEACTIVATE');return `${target}
IF ${inputs()} OR @userId<>30007 OR @roleId<>10 OR @proposalSha256<>0x${T.proposalSha256} OR @decisionSha256=CONVERT(binary(32),0x00) OR @phaseBindingSha256=CONVERT(binary(32),0x00) OR @expectedProtectedUserSha256<>0x${T.protectedUserSha256} ${activate?'OR @expectedUserVersion<>0x000000000011BB11':''} THROW 51995,'WH_TYPED_BINDING',1;
${transactionStart}
IF ${inventoryHash('before')}<>@expectedInventorySha256 OR (SELECT COUNT_BIG(*) FROM dbo.audit_logs)<>@expectedAuditCount OR ${hash(permissionRows)}<>@expectedPermissionRowsSha256 OR ${hash(memberships)}<>@expectedMembershipsSha256 OR ${hash(principals)}<>@expectedPrincipalsSha256 THROW 51995,'WH_PHASE_DRIFT',1;
IF NOT EXISTS(SELECT 1 FROM dbo.users u WHERE id=30007 AND role_id=10 AND CONVERT(varbinary(160),username)=CONVERT(varbinary(160),N'erp_depo_deneme') AND is_active=${from} AND row_version=@expectedUserVersion AND ${hash(protectedUser)}=@expectedProtectedUserSha256) THROW 51995,'WH_USER_CAS',1;
IF EXISTS(SELECT 1 FROM dbo.audit_logs WHERE source=${q(T.auditSource)} AND CONVERT(varbinary(max),reason)=CONVERT(varbinary(max),${q(reason)}) AND action=${q(actionName)}) THROW 51995,'WH_LIFECYCLE_ALREADY_SENT',1;
DECLARE @users TABLE(id bigint PRIMARY KEY,h varbinary(32) NOT NULL);DECLARE @audits TABLE(id bigint PRIMARY KEY,h varbinary(32) NOT NULL);
INSERT @users SELECT u.id,${hash(fullUser)} FROM dbo.users u WHERE u.id<>30007;
INSERT @audits SELECT a.id,${hash('(SELECT a.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)')} FROM dbo.audit_logs a;
DECLARE @changed TABLE(id bigint PRIMARY KEY,rv binary(8) NOT NULL);DECLARE @newAudit TABLE(id bigint PRIMARY KEY);
UPDATE dbo.users SET is_active=${to} OUTPUT inserted.id,inserted.row_version INTO @changed(id,rv) WHERE id=@userId AND role_id=@roleId AND is_active=${from} AND row_version=@expectedUserVersion;
IF (SELECT COUNT_BIG(*) FROM @changed)<>1 THROW 51995,'WH_CAS_CHANGED_COUNT',1;
DECLARE @afterVersion binary(8)=(SELECT rv FROM @changed);
IF @afterVersion IS NULL OR @afterVersion<=@expectedUserVersion OR NOT EXISTS(SELECT 1 FROM dbo.users u WHERE id=30007 AND is_active=${to} AND row_version=@afterVersion AND ${hash(protectedUser)}=@expectedProtectedUserSha256) THROW 51995,'WH_USER_OTHER_FIELDS',1;
DECLARE @beforeJson nvarchar(max)=(SELECT 1 version,LOWER(CONVERT(varchar(36),@lifecycleId)) lifecycleId,N'30007' userId,N'10' roleId,CONVERT(bit,${from}) active,CONVERT(varchar(18),@expectedUserVersion,1) userRowVersion FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
DECLARE @afterJson nvarchar(max)=(SELECT 1 version,LOWER(CONVERT(varchar(36),@lifecycleId)) lifecycleId,N'30007' userId,N'10' roleId,CONVERT(bit,${to}) active,CONVERT(varchar(18),@afterVersion,1) userRowVersion,LOWER(CONVERT(varchar(64),@decisionSha256,2)) decisionSha256,LOWER(CONVERT(varchar(64),@proposalSha256,2)) proposalSha256,LOWER(CONVERT(varchar(64),@phaseBindingSha256,2)) phaseBindingSha256 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,reason,before_json,after_json,source) OUTPUT inserted.id INTO @newAudit VALUES(NULL,${q(actionName)},N'user',@userId,${q(reason)},@beforeJson,@afterJson,${q(T.auditSource)});
IF (SELECT COUNT_BIG(*) FROM @newAudit)<>1 OR (SELECT COUNT_BIG(*) FROM dbo.audit_logs)<>@expectedAuditCount+1 THROW 51995,'WH_AUDIT_COUNT',1;
IF EXISTS(SELECT b.id,b.h FROM @users b EXCEPT SELECT u.id,${hash(fullUser)} FROM dbo.users u WHERE u.id<>30007) OR (SELECT COUNT_BIG(*) FROM dbo.users WHERE id<>30007)<>(SELECT COUNT_BIG(*) FROM @users) THROW 51995,'WH_OTHER_USERS',1;
IF EXISTS(SELECT b.id,b.h FROM @audits b EXCEPT SELECT a.id,${hash('(SELECT a.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)')} FROM dbo.audit_logs a JOIN @audits b ON b.id=a.id) THROW 51995,'WH_OLD_AUDITS',1;
DECLARE @after TABLE(name sysname PRIMARY KEY,n bigint NOT NULL,h varbinary(32) NOT NULL);
${capture('after')}
IF EXISTS(SELECT name,n,h FROM @before WHERE name NOT IN(N'users',N'audit_logs') EXCEPT SELECT name,n,h FROM @after WHERE name NOT IN(N'users',N'audit_logs')) OR EXISTS(SELECT name,n,h FROM @after WHERE name NOT IN(N'users',N'audit_logs') EXCEPT SELECT name,n,h FROM @before WHERE name NOT IN(N'users',N'audit_logs')) THROW 51995,'WH_OTHER_TABLES',1;
${roleGuard}
IF (SELECT COUNT_BIG(*) FROM sys.database_permissions)<>404 OR ${hash(permissionRows)}<>@expectedPermissionRowsSha256 OR ${hash(memberships)}<>@expectedMembershipsSha256 OR ${hash(principals)}<>@expectedPrincipalsSha256 THROW 51995,'WH_SECURITY404_POST',1;
IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'WH_TRANSACTION',1;
COMMIT TRANSACTION;
SELECT N'WAREHOUSE_LIFECYCLE_COMMITTED_PENDING_INDEPENDENT_READBACK' state,${q(action)} action,LOWER(CONVERT(varchar(36),@lifecycleId)) lifecycleId,N'30007' userId,N'10' roleId,CONVERT(bit,${to}) active,CONVERT(varchar(18),@expectedUserVersion,1) oldUserVersion,CONVERT(varchar(18),@afterVersion,1) userRowVersion,CONVERT(varchar(20),(SELECT id FROM @newAudit)) auditId,@expectedAuditCount+1 auditCount,LOWER(CONVERT(varchar(64),@decisionSha256,2)) decisionSha256,LOWER(CONVERT(varchar(64),@proposalSha256,2)) proposalSha256,LOWER(CONVERT(varchar(64),@phaseBindingSha256,2)) phaseBindingSha256,CONVERT(varchar(64),${inventoryHash('after')},2) inventorySha256;
${catchSql}`;}
export function compileWarehouseLifecycle({action='observe'}={}){
 requireWarehouseAction(action);const sql=action==='observe'?observeSql():mutateSql(action),guardSql=getDesktopFinanceV7GuardSql();
 return {state:'WAREHOUSE_LIFECYCLE_OFFLINE_COMPILED_PLAN',version:1,preparationOnly:true,executionAuthorized:false,action,target:T,parameterTypes:action==='observe'?{}:TYPES,guardSqlSha256:digest(guardSql),sqlSha256:digest(sql),sql};
}
// Emission is public SQL text only; it cannot open a connection or activate users.
if(process.argv[1]?.replaceAll('\\','/').endsWith('/warehouse-continuation/lifecycle-sql.mjs')){
 if(process.argv.length!==4||process.argv[2]!=='--emit-plan')throw Error('WAREHOUSE_RENDER_CLI');
 console.log(JSON.stringify(compileWarehouseLifecycle({action:process.argv[3]})));
}
