// Fixed isolated TEST account activation, independent of CREATE LOGIN.
// Verification never enables credentials. No password enters this module.
// ODBC autocommit can report XACT_STATE=1 with @@TRANCOUNT=0. Reject explicit
// or implicit user transactions and doomed state; exact 1/1 is required before
// COMMIT. Persistence is independently read from a new process after exit.
import {createHash} from 'node:crypto';
import {DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopLifecyclePermissionPolicy.mjs';
const login='melisa_desktop_test_writer_20261105';
const operatorKeys=['customer.view','customer.edit','product.view','product.edit','supplier.view','sales.view','sales.create','sales.edit','sales.finalize'];
const operatorExpected=operatorKeys.map(k=>`(CONVERT(varbinary(240),N'${k}'),1,${['customer.edit','product.edit','sales.create'].includes(k)?1:0},${['customer.edit','product.edit','sales.edit'].includes(k)?1:0},0,${k==='sales.finalize'?1:0})`).join(',');
const operatorGuard=`DECLARE @operatorRole bigint=(SELECT id FROM dbo.roles WITH(UPDLOCK,HOLDLOCK) WHERE code=N'desktop_first_sale_operator');
DECLARE @operatorUsers bigint,@operatorPermissions bigint;SELECT @operatorUsers=COUNT_BIG(*) FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE role_id=@operatorRole;SELECT @operatorPermissions=COUNT_BIG(*) FROM dbo.permissions WITH(UPDLOCK,HOLDLOCK) WHERE role_id=@operatorRole;
IF @operatorRole IS NULL OR @operatorUsers<>1 OR @operatorPermissions<>9 OR EXISTS(SELECT CONVERT(varbinary(240),permission_key),CONVERT(int,can_view),CONVERT(int,can_create),CONVERT(int,can_update),CONVERT(int,can_delete),CONVERT(int,can_approve) FROM dbo.permissions WHERE role_id=@operatorRole EXCEPT SELECT * FROM (VALUES ${operatorExpected}) e(k,v,c,u,d,a)) OR EXISTS(SELECT * FROM (VALUES ${operatorExpected}) e(k,v,c,u,d,a) EXCEPT SELECT CONVERT(varbinary(240),permission_key),CONVERT(int,can_view),CONVERT(int,can_create),CONVERT(int,can_update),CONVERT(int,can_delete),CONVERT(int,can_approve) FROM dbo.permissions WHERE role_id=@operatorRole) THROW 51995,'FIRST_SALE_OPERATOR_PERMISSION_DRIFT',1;`;
const target=`IF ISNULL(DB_ID(),-1)<>5 OR ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISAERP' COLLATE Latin1_General_100_BIN2 OR ISNULL(CONVERT(int,SERVERPROPERTY('ProcessID')),-1)<>5240 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1') OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\\Xaser') IS NULL OR SUSER_SID()<>SUSER_SID(N'SEMIH\\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\\Xaser') OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory' THROW 51995,'FIRST_SALE_ACTIVATION_TARGET',1;
IF (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version=2 AND read_only=0 AND actual_t1=0 AND external_operations=0) THROW 51995,'FIRST_SALE_ACTIVATION_PROFILE',1;`;
const state=`IF NOT EXISTS(SELECT 1 FROM sys.sql_logins WHERE name=N'${login}' AND is_disabled=1 AND is_policy_checked=1 AND default_database_name=N'MELISA_ERP_DESKTOP_TEST_20261105') OR (SELECT COUNT(*) FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.username=N'erp_deneme' AND u.is_active=0 AND r.code=N'desktop_first_sale_operator' AND r.is_active=1 AND r.is_system_role=0)<>1 OR EXISTS(SELECT 1 FROM sys.server_role_members WHERE member_principal_id=SUSER_ID(N'${login}')) OR (SELECT COUNT(*) FROM sys.database_role_members WHERE member_principal_id=USER_ID(N'${login}'))<>1 OR NOT EXISTS(SELECT 1 FROM sys.database_role_members WHERE member_principal_id=USER_ID(N'${login}') AND role_principal_id=DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2')) THROW 51995,'FIRST_SALE_ACTIVATION_STATE',1;`;
const effective=`DECLARE @catalog TABLE(id int PRIMARY KEY,name sysname,state tinyint);
INSERT @catalog SELECT database_id,name,state FROM sys.databases WHERE database_id>4 AND database_id<>DB_ID();
IF EXISTS(SELECT 1 FROM @catalog WHERE state<>0) THROW 51995,'FIRST_SALE_OFFLINE_DATABASE_UNVERIFIED',1;
SET @stage=20;EXECUTE AS LOGIN=N'${login}';SET @impersonating=1;SET @stage=30;
${DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL}
IF EXISTS(SELECT 1 FROM @catalog WHERE ISNULL(HAS_DBACCESS(name),1)<>0) THROW 51995,'FIRST_SALE_OTHER_DATABASE_ACCESS',1;
SET @stage=40;REVERT;SET @impersonating=0;
IF EXISTS(SELECT database_id,CONVERT(varbinary(256),name),state FROM sys.databases WHERE database_id>4 AND database_id<>DB_ID() EXCEPT SELECT id,CONVERT(varbinary(256),name),state FROM @catalog) OR EXISTS(SELECT id,CONVERT(varbinary(256),name),state FROM @catalog EXCEPT SELECT database_id,CONVERT(varbinary(256),name),state FROM sys.databases WHERE database_id>4 AND database_id<>DB_ID()) THROW 51995,'FIRST_SALE_DATABASE_CATALOG_CHANGED',1;`;
const catchSql=`END TRY BEGIN CATCH DECLARE @n int=ERROR_NUMBER(),@cleanup int=0,@label nvarchar(128)=N'UNCLASSIFIED';
IF ERROR_NUMBER()=51995 AND LEN(ERROR_MESSAGE()) BETWEEN 1 AND 100 AND ERROR_MESSAGE() COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Z_]%' COLLATE Latin1_General_100_BIN2 SET @label=ERROR_MESSAGE();
IF @@TRANCOUNT>0 AND XACT_STATE()<>0 ROLLBACK TRANSACTION;IF @impersonating=1 BEGIN TRY REVERT; END TRY BEGIN CATCH SET @cleanup=ERROR_NUMBER();END CATCH;DECLARE @msg nvarchar(2048)=CONCAT(N'FIRST_SALE_ACTIVATION_FAILURE stage=',@stage,N' error=',@n,N' cleanup=',@cleanup,N' label=',@label);THROW 51996,@msg,1;END CATCH;`;
function plan(sql,kind){return Object.freeze({kind,sql,sqlSha256:createHash('sha256').update(sql).digest('hex'),targetDatabase:'MELISA_ERP_DESKTOP_TEST_20261105',existingUserModified:false});}
export function compileFirstSaleDisabledVerification(){return plan(`SET NOCOUNT ON;SET XACT_ABORT ON;IF @@TRANCOUNT<>0 OR XACT_STATE()=-1 OR (@@OPTIONS&2)<>0 THROW 51995,'FIRST_SALE_ACTIVATION_EXISTING_TRANSACTION',1;DECLARE @stage int=0,@impersonating bit=0;
${target}
BEGIN TRY
${state}
${operatorGuard}
${effective}
SELECT CONVERT(varchar(130),SUSER_SID(N'${login}'),1) loginSid,CONVERT(varchar(20),u.id) operatorId FROM dbo.users u WHERE u.username=N'erp_deneme' AND u.is_active=0 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
${catchSql}`,'VERIFY_DISABLED');}
function identity(value){if(!value||Object.keys(value).sort().join(',')!=='loginSid,operatorId'||!/^0x[0-9A-F]{32}$/.test(value.loginSid)||!/^[1-9]\d{0,15}$/.test(value.operatorId))throw Error('FIRST_SALE_ACTIVATION_IDENTITY');return value;}
export function compileFirstSaleActivation(expected){const v=identity(expected);return plan(`SET NOCOUNT ON;SET XACT_ABORT ON;IF @@TRANCOUNT<>0 OR XACT_STATE()=-1 OR (@@OPTIONS&2)<>0 THROW 51995,'FIRST_SALE_ACTIVATION_EXISTING_TRANSACTION',1;DECLARE @stage int=0,@impersonating bit=0;
${target}
BEGIN TRY BEGIN TRANSACTION;
DECLARE @owner int;EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;IF @owner<0 THROW 51995,'FIRST_SALE_ACTIVATION_OWNER',1;
${state}
${operatorGuard}
IF SUSER_SID(N'${login}') IS NULL OR SUSER_SID(N'${login}')<>${v.loginSid} OR NOT EXISTS(SELECT 1 FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE id=${v.operatorId} AND username=N'erp_deneme' AND is_active=0) THROW 51995,'FIRST_SALE_ACTIVATION_IDENTITY',1;
${effective}
SET @stage=50;ALTER LOGIN [${login}] ENABLE;UPDATE dbo.users SET is_active=1,updated_at=SYSDATETIME() WHERE id=${v.operatorId} AND username=N'erp_deneme' AND is_active=0;IF @@ROWCOUNT<>1 THROW 51995,'FIRST_SALE_ACTIVATION_UPDATE',1;
IF NOT EXISTS(SELECT 1 FROM sys.sql_logins WHERE name=N'${login}' AND sid=${v.loginSid} AND is_disabled=0) THROW 51995,'FIRST_SALE_ACTIVATION_LOGIN',1;
IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'FIRST_SALE_ACTIVATION_TRANSACTION',1;COMMIT TRANSACTION;IF @@TRANCOUNT<>0 OR XACT_STATE()=-1 THROW 51995,'FIRST_SALE_ACTIVATION_COMMIT_UNVERIFIED',1;SELECT N'FIRST_SALE_ACTIVATED';
${catchSql}`,'ACTIVATE_VERIFIED');}
export function compileFirstSaleDisableCompensation(expected){const v=identity(expected);return plan(`SET NOCOUNT ON;SET XACT_ABORT ON;IF @@TRANCOUNT<>0 OR XACT_STATE()=-1 OR (@@OPTIONS&2)<>0 THROW 51995,'FIRST_SALE_COMPENSATION_EXISTING_TRANSACTION',1;${target}
IF SUSER_SID(N'${login}') IS NULL OR SUSER_SID(N'${login}')<>${v.loginSid} OR NOT EXISTS(SELECT 1 FROM dbo.users WHERE id=${v.operatorId} AND username=N'erp_deneme') THROW 51995,'FIRST_SALE_ACTIVATION_IDENTITY',1;
BEGIN TRY BEGIN TRANSACTION;DECLARE @owner int;EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;IF @owner<0 THROW 51995,'FIRST_SALE_COMPENSATION_OWNER',1;
ALTER LOGIN [${login}] DISABLE;UPDATE dbo.users SET is_active=0,updated_at=SYSDATETIME() WHERE id=${v.operatorId} AND username=N'erp_deneme';IF @@ROWCOUNT<>1 THROW 51995,'FIRST_SALE_COMPENSATION_UPDATE',1;IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'FIRST_SALE_COMPENSATION_TRANSACTION',1;COMMIT TRANSACTION;IF @@TRANCOUNT<>0 OR XACT_STATE()=-1 THROW 51995,'FIRST_SALE_COMPENSATION_COMMIT_UNVERIFIED',1;
IF EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND security_id=${v.loginSid}) THROW 51995,'FIRST_SALE_DISABLED_EXISTING_SESSION',1;
SELECT N'FIRST_SALE_DISABLED';END TRY BEGIN CATCH IF @@TRANCOUNT>0 AND XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;`,'DISABLE_COMPENSATION');}
function independentState(expected,disabled){const v=identity(expected);return plan(`SET NOCOUNT ON;IF @@TRANCOUNT<>0 OR XACT_STATE()=-1 OR (@@OPTIONS&2)<>0 THROW 51995,'FIRST_SALE_STATE_EXISTING_TRANSACTION',1;
${target}
IF SUSER_SID(N'${login}') IS NULL OR SUSER_SID(N'${login}')<>${v.loginSid} THROW 51995,'FIRST_SALE_STATE_IDENTITY',1;
${operatorGuard}
SELECT CASE WHEN EXISTS(SELECT 1 FROM sys.sql_logins WHERE name=N'${login}' AND sid=${v.loginSid} AND is_disabled=${disabled?1:0}) AND EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=${v.operatorId} AND u.username=N'erp_deneme' AND u.is_active=${disabled?0:1} AND r.code=N'desktop_first_sale_operator' AND r.is_active=1 AND r.is_system_role=0) AND NOT EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND security_id=${v.loginSid}) THEN 1 ELSE 0 END;
`,'INDEPENDENT_STATE');}
export function compileFirstSaleActiveState(expected){return independentState(expected,false);}
export function compileFirstSaleInactiveState(expected){return independentState(expected,true);}
export function compileFirstSaleAdminObservation(){return plan(`SET NOCOUNT ON;IF @@TRANCOUNT<>0 OR XACT_STATE()=-1 OR (@@OPTIONS&2)<>0 THROW 51995,'FIRST_SALE_OBSERVATION_TRANSACTION',1;
${target}
SELECT CONVERT(varchar(36),connection_id) connectionId,@@SPID sessionId FROM sys.dm_exec_connections WHERE session_id=@@SPID FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;`,'ADMIN_OBSERVATION');}
