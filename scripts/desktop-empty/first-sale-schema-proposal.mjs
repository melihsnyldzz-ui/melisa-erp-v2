// SOURCE ONLY. Compilation is not authorization or execution. This fixed-target
// stage changes schema only; it creates no login, secret, membership or GRANT.
import {createHash} from 'node:crypto';
import {desktopEmptyTargetGuard,DESKTOP_EMPTY_DATABASE} from './schema.mjs';
import {LOCAL_MASTER_BASE_TABLES,LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,LOCAL_MASTER_CONCURRENCY_GUARD,LOCAL_MASTER_DDL_SOURCE} from './local-master-schema-proposal.mjs';
import {SALE_WORKFLOW_SCHEMA_PROPOSAL} from './sale-workflow-schema-proposal.mjs';
const quote=v=>`N'${v.replaceAll("'","''")}'`;
const added=['desktop_local_product_units','desktop_local_price_units','desktop_local_master_requests','desktop_sale_request_resolutions','desktop_sale_workflows','desktop_sale_reservations','desktop_sale_cartons','desktop_sale_carton_items','desktop_sale_workflow_requests'];
export function compileFirstSaleSchemaProposal({reviewedBaselineSha256,mode}={}){
 if(typeof reviewedBaselineSha256!=='string'||!/^[0-9a-f]{64}$/.test(reviewedBaselineSha256)||!['rollback','apply'].includes(mode))throw Error('FIRST_SALE_SCHEMA_OPTIONS_REJECTED');
 const business=LOCAL_MASTER_BASE_TABLES.filter(n=>!['desktop_empty_installation','roles','permissions','users','audit_logs'].includes(n));
 const sql=`SET NOCOUNT ON; SET XACT_ABORT ON;
 SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET QUOTED_IDENTIFIER ON; SET NUMERIC_ROUNDABORT OFF;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'FIRST_SALE_EXISTING_TRANSACTION',1;
 ${desktopEmptyTargetGuard()}
 IF DB_ID()<>5 OR CONVERT(int,SERVERPROPERTY('ProcessID'))<>5240 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\\Xaser') IS NULL OR SUSER_SID()<>SUSER_SID(N'SEMIH\\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\\Xaser') OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory' THROW 51995,'FIRST_SALE_TARGET_REJECTED',1;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @owner int; EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @owner<0 THROW 51995,'FIRST_SALE_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>27 OR EXISTS(SELECT 1 FROM sys.objects WHERE schema_id=SCHEMA_ID(N'dbo') AND name IN(${added.map(quote).join(',')})) OR EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'desktop_local_writer_v2') THROW 51995,'FIRST_SALE_SCHEMA_NOT_BASELINE',1;
 IF (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=1 AND read_only=1 AND actual_t1=0 AND external_operations=0) THROW 51995,'FIRST_SALE_MARKER_REJECTED',1;
 DECLARE @lockCount bigint;
 ${LOCAL_MASTER_BASE_TABLES.map(n=>`SELECT @lockCount=COUNT_BIG(*) FROM dbo.[${n}] WITH(TABLOCKX,HOLDLOCK);`).join('\n')}
 IF ${business.map(n=>`EXISTS(SELECT 1 FROM dbo.[${n}])`).join(' OR ')} THROW 51995,'FIRST_SALE_BUSINESS_DATA_PRESENT',1;
 ${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}
 IF CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2) COLLATE Latin1_General_100_BIN2<>UPPER('${reviewedBaselineSha256}') COLLATE Latin1_General_100_BIN2 THROW 51995,'FIRST_SALE_BASELINE_DRIFT',1;
 ${[...LOCAL_MASTER_DDL_SOURCE,...SALE_WORKFLOW_SCHEMA_PROPOSAL].map(q=>`EXEC sys.sp_executesql ${quote(q)};`).join('\n')}
 ALTER TABLE dbo.desktop_empty_installation DROP CONSTRAINT CK_desktop_empty_installation_version;
 ALTER TABLE dbo.desktop_empty_installation DROP CONSTRAINT CK_desktop_empty_installation_readonly;
 ALTER TABLE dbo.desktop_empty_installation WITH CHECK ADD CONSTRAINT CK_desktop_profile_version_mode CHECK((schema_version=1 AND read_only=1) OR (schema_version=2 AND read_only=0));
 UPDATE dbo.desktop_empty_installation SET schema_version=2,read_only=0 WHERE id=1 AND schema_version=1 AND read_only=1;
 IF @@ROWCOUNT<>1 THROW 51995,'FIRST_SALE_MARKER_UPDATE_REJECTED',1;
 EXEC sys.sp_executesql N'CREATE ROLE [desktop_local_writer_v2] AUTHORIZATION [dbo];';
 IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>36 OR ${added.map(n=>`OBJECT_ID(N'dbo.${n}',N'U') IS NULL`).join(' OR ')} OR EXISTS(SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2')) OR EXISTS(SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id=DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2')) THROW 51995,'FIRST_SALE_SCHEMA_READBACK_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'FIRST_SALE_TRANSACTION_REJECTED',1;
 ${mode==='rollback'?"THROW 51990,'FIRST_SALE_CONTROLLED_ROLLBACK',1;":"COMMIT TRANSACTION; SELECT N'FIRST_SALE_SCHEMA_APPLIED';"}
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;`;
 return Object.freeze({database:DESKTOP_EMPTY_DATABASE,mode,reviewedBaselineSha256,sql,sqlSha256:createHash('sha256').update(sql).digest('hex'),addedTables:Object.freeze([...added]),executionAuthorized:false,sqlTested:false,createsEmptyUnassignedRole:true,createsLogin:false,grantsPermissions:false,requiresIndependentReadback:true});
}
export function compileFirstSaleRollbackReadback({reviewedBaselineSha256}={}){
 if(typeof reviewedBaselineSha256!=='string'||!/^[0-9a-f]{64}$/.test(reviewedBaselineSha256))throw Error('READBACK_BASELINE_REJECTED');
 const predicate='dt.database_id=DB_ID()\n  AND NOT EXISTS';
 if(!LOCAL_MASTER_CONCURRENCY_GUARD.includes(predicate))throw Error('READBACK_CONCURRENCY_SOURCE_REJECTED');
 // Only this read-only observer distinguishes its own implicit read tx by
 // exact current-session transaction ID. NULL retains all foreign candidates.
 // The write guard and prior UNKNOWN attempts are deliberately unchanged.
 const readConcurrency=LOCAL_MASTER_CONCURRENCY_GUARD.replace(predicate,'dt.database_id=DB_ID()\n  AND (CURRENT_TRANSACTION_ID() IS NULL OR dt.transaction_id<>CURRENT_TRANSACTION_ID())\n  AND NOT EXISTS');
 const sql=`SET NOCOUNT ON;
 ${desktopEmptyTargetGuard()}
 IF DB_ID()<>5 OR ISNULL(CONVERT(int,SERVERPROPERTY('ProcessID')),-1)<>5240 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1') OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\\Xaser') IS NULL OR SUSER_SID()<>SUSER_SID(N'SEMIH\\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\\Xaser') OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory' THROW 51995,'ROLLBACK_READBACK_TARGET_REJECTED',1;
 IF @@TRANCOUNT<>0 OR XACT_STATE()<>0 THROW 51995,'READBACK_TRANSACTION_REJECTED',1;
 DECLARE @childPid int=__SQL_CHILD_PID__;
 IF EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND host_process_id=@childPid AND session_id<>@@SPID) THROW 51995,'READBACK_CHILD_SESSION_REJECTED',1;
 ${readConcurrency}
 IF (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id=CONVERT(uniqueidentifier,N'eb2888c2-51cb-4570-a933-397cf7e62806') AND schema_version=1 AND read_only=1 AND actual_t1=0 AND external_operations=0) OR EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'desktop_local_writer_v2') OR (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>27 THROW 51995,'READBACK_BASELINE_STATE_REJECTED',1;
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.desktop_empty_installation') AND name=N'CK_desktop_empty_installation_version' AND is_disabled=0 AND is_not_trusted=0) OR NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.desktop_empty_installation') AND name=N'CK_desktop_empty_installation_readonly' AND is_disabled=0 AND is_not_trusted=0) THROW 51995,'READBACK_CONSTRAINTS_REJECTED',1;
 ${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}
 IF CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2) COLLATE Latin1_General_100_BIN2<>UPPER('${reviewedBaselineSha256}') COLLATE Latin1_General_100_BIN2 THROW 51995,'READBACK_COMPLETE_METADATA_DRIFT',1;
 SELECT N'FIRST_SALE_ROLLBACK_READBACK_VERIFIED';`;
 return Object.freeze({sql,sha256:createHash('sha256').update(sql).digest('hex'),placeholder:'__SQL_CHILD_PID__',executionAuthorized:false});
}
