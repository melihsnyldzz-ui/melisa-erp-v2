// Offline proposal only. No SQL execution, connection, seed or permission.
// A separately reviewed installer and same-connection SQL adapter are required.
import {createHash} from 'node:crypto';
import {desktopEmptyTargetGuard,DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_DATABASE,DESKTOP_EMPTY_ENVIRONMENT_ID} from './schema.mjs';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const fail=()=>{throw new Error('LOCAL_MASTER_SCHEMA_PROPOSAL_REJECTED');};
const quote=s=>`N'${s.replaceAll("'","''")}'`;
const tables=Object.freeze(compileDesktopEmptyBootstrap().expectedTables);
if(tables.length!==27||tables.some(name=>!/^[a-z_]+$/.test(name)))fail();
export const LOCAL_MASTER_BASE_TABLES=tables;
// The value is an independently reviewed SHA-256 of the *complete* metadata
// snapshot below, encoded as SQL Server UTF-16LE. It is not inferred from the
// current database or from the old partial 45-DDL readback. Acquisition and
// approval of this evidence is a separate, as-yet-unimplemented step.
export const LOCAL_MASTER_BASELINE_SNAPSHOT_SQL=`DECLARE @local_master_manifest nvarchar(max)=(
 SELECT JSON_QUERY((SELECT s.name FROM sys.schemas s WHERE s.name NOT IN(N'sys',N'INFORMATION_SCHEMA')
  ORDER BY s.name FOR JSON PATH,INCLUDE_NULL_VALUES)) AS schemas,
 JSON_QUERY((SELECT SCHEMA_NAME(o.schema_id) AS schema_name,o.name,o.type,o.parent_object_id AS parent_object_id,
  CONVERT(nvarchar(max),m.definition) AS module_definition,m.uses_ansi_nulls,m.uses_quoted_identifier,m.is_schema_bound
  FROM sys.objects o LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE o.is_ms_shipped=0
  ORDER BY SCHEMA_NAME(o.schema_id),o.name,o.type FOR JSON PATH,INCLUDE_NULL_VALUES)) AS objects,
 JSON_QUERY((SELECT SCHEMA_NAME(s.schema_id) AS schema_name,s.name,s.base_object_name FROM sys.synonyms s
  ORDER BY SCHEMA_NAME(s.schema_id),s.name FOR JSON PATH,INCLUDE_NULL_VALUES)) AS synonyms,
 JSON_QUERY((SELECT SCHEMA_NAME(t.schema_id) AS schema_name,t.name,t.system_type_id,t.max_length,t.precision,t.scale,t.is_nullable
  FROM sys.types t WHERE t.is_user_defined=1 ORDER BY SCHEMA_NAME(t.schema_id),t.name FOR JSON PATH,INCLUDE_NULL_VALUES)) AS user_types,
 JSON_QUERY((SELECT s.name AS schema_name,t.name AS table_name,t.temporal_type,t.is_memory_optimized,t.is_tracked_by_cdc
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0
  ORDER BY s.name,t.name FOR JSON PATH,INCLUDE_NULL_VALUES)) AS tables,
 JSON_QUERY((SELECT SCHEMA_NAME(t.schema_id) AS schema_name,t.name AS table_name,c.column_id,c.name AS column_name,
  SCHEMA_NAME(y.schema_id) AS type_schema,y.name AS type_name,c.max_length,c.precision,c.scale,c.collation_name,c.is_nullable,c.is_identity,c.is_computed,c.is_sparse,c.is_rowguidcol,
  CONVERT(nvarchar(max),dc.definition) AS default_definition,CONVERT(nvarchar(max),cc.definition) AS computed_definition,cc.is_persisted,
  CONVERT(nvarchar(100),ic.seed_value) AS identity_seed,CONVERT(nvarchar(100),ic.increment_value) AS identity_increment
  FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types y ON y.user_type_id=c.user_type_id
  LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id
  LEFT JOIN sys.identity_columns ic ON ic.object_id=c.object_id AND ic.column_id=c.column_id WHERE t.is_ms_shipped=0
  ORDER BY SCHEMA_NAME(t.schema_id),t.name,c.column_id FOR JSON PATH,INCLUDE_NULL_VALUES)) AS columns,
 JSON_QUERY((SELECT SCHEMA_NAME(t.schema_id) AS schema_name,t.name AS table_name,k.name,k.type,k.is_system_named,i.name AS index_name
  FROM sys.key_constraints k JOIN sys.tables t ON t.object_id=k.parent_object_id JOIN sys.indexes i ON i.object_id=t.object_id AND i.index_id=k.unique_index_id
  WHERE t.is_ms_shipped=0 ORDER BY SCHEMA_NAME(t.schema_id),t.name,k.name FOR JSON PATH,INCLUDE_NULL_VALUES)) AS keys,
 JSON_QUERY((SELECT SCHEMA_NAME(t.schema_id) AS schema_name,t.name AS table_name,i.name,i.type,i.is_unique,i.is_primary_key,i.is_unique_constraint,i.is_disabled,i.has_filter,i.filter_definition,
  JSON_QUERY((SELECT c.name AS column_name,ic.key_ordinal,ic.index_column_id,ic.is_descending_key,ic.is_included_column
   FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
   WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id ORDER BY ic.index_column_id FOR JSON PATH,INCLUDE_NULL_VALUES)) AS index_columns
  FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id WHERE t.is_ms_shipped=0 AND i.index_id>0
  ORDER BY SCHEMA_NAME(t.schema_id),t.name,i.index_id FOR JSON PATH,INCLUDE_NULL_VALUES)) AS indexes,
 JSON_QUERY((SELECT SCHEMA_NAME(t.schema_id) AS schema_name,t.name AS table_name,f.name,SCHEMA_NAME(rt.schema_id) AS referenced_schema,rt.name AS referenced_table,
  f.delete_referential_action,f.update_referential_action,f.is_disabled,f.is_not_trusted,f.is_not_for_replication,
  JSON_QUERY((SELECT fkc.constraint_column_id,pc.name AS parent_column,rc.name AS referenced_column FROM sys.foreign_key_columns fkc
   JOIN sys.columns pc ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id
   JOIN sys.columns rc ON rc.object_id=fkc.referenced_object_id AND rc.column_id=fkc.referenced_column_id
   WHERE fkc.constraint_object_id=f.object_id ORDER BY fkc.constraint_column_id FOR JSON PATH,INCLUDE_NULL_VALUES)) AS columns
  FROM sys.foreign_keys f JOIN sys.tables t ON t.object_id=f.parent_object_id JOIN sys.tables rt ON rt.object_id=f.referenced_object_id
  WHERE t.is_ms_shipped=0 ORDER BY SCHEMA_NAME(t.schema_id),t.name,f.name FOR JSON PATH,INCLUDE_NULL_VALUES)) AS foreign_keys,
 JSON_QUERY((SELECT SCHEMA_NAME(t.schema_id) AS schema_name,t.name AS table_name,c.name,c.definition,c.is_disabled,c.is_not_trusted,c.is_not_for_replication
  FROM sys.check_constraints c JOIN sys.tables t ON t.object_id=c.parent_object_id WHERE t.is_ms_shipped=0
  ORDER BY SCHEMA_NAME(t.schema_id),t.name,c.name FOR JSON PATH,INCLUDE_NULL_VALUES)) AS checks,
 JSON_QUERY((SELECT SCHEMA_NAME(t.schema_id) AS schema_name,t.name AS table_name,d.name,d.definition,c.name AS column_name,d.is_system_named
  FROM sys.default_constraints d JOIN sys.tables t ON t.object_id=d.parent_object_id JOIN sys.columns c ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id
  WHERE t.is_ms_shipped=0 ORDER BY SCHEMA_NAME(t.schema_id),t.name,d.name FOR JSON PATH,INCLUDE_NULL_VALUES)) AS defaults
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
IF @local_master_manifest IS NULL THROW 51995,'LOCAL_MASTER_BASELINE_SNAPSHOT_REJECTED',1;`;
export const LOCAL_MASTER_BASELINE_HASH_SQL=`SET NOCOUNT ON;
${desktopEmptyTargetGuard()}
IF DB_ID()<>5 OR CONVERT(int,SERVERPROPERTY('ProcessID'))<>5240
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR SUSER_SID() IS NULL OR SUSER_SID(N'SEMIH\\Xaser') IS NULL
 OR SUSER_SID()<>SUSER_SID(N'SEMIH\\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\\Xaser')
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory'
 THROW 51995,'LOCAL_MASTER_BASELINE_TARGET_REJECTED',1;
${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}\nSELECT LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2)) AS baseline_sha256;`;
export const LOCAL_MASTER_CONCURRENCY_GUARD=`IF CONVERT(varbinary(256),ISNULL(CONVERT(nvarchar(128),DATABASEPROPERTYEX(DB_NAME(),'Collation')),N''))<>CONVERT(varbinary(256),N'Turkish_CI_AS')
 THROW 51995,'LOCAL_MASTER_DATABASE_COLLATION_REJECTED',1;
IF EXISTS(SELECT 1 FROM sys.server_triggers WHERE is_ms_shipped=0)
 OR EXISTS(SELECT 1 FROM sys.triggers WHERE is_ms_shipped=0)
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_tran_locks l WHERE l.resource_database_id=DB_ID() AND l.request_session_id<>@@SPID
  AND (l.request_session_id<=0 OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_sessions s WHERE s.session_id=l.request_session_id)
   OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions s WHERE s.session_id=l.request_session_id AND s.is_user_process=1)))
 OR EXISTS(SELECT 1 FROM sys.dm_tran_database_transactions dt WHERE dt.database_id=DB_ID()
  AND NOT EXISTS(SELECT 1 FROM sys.dm_tran_session_transactions st WHERE st.transaction_id=dt.transaction_id AND st.session_id=@@SPID)
  AND (NOT EXISTS(SELECT 1 FROM sys.dm_tran_session_transactions st WHERE st.transaction_id=dt.transaction_id)
   OR EXISTS(SELECT 1 FROM sys.dm_tran_session_transactions st WHERE st.transaction_id=dt.transaction_id AND NOT EXISTS(SELECT 1 FROM sys.dm_exec_sessions s WHERE s.session_id=st.session_id))
   OR EXISTS(SELECT 1 FROM sys.dm_tran_session_transactions st JOIN sys.dm_exec_sessions s ON s.session_id=st.session_id WHERE st.transaction_id=dt.transaction_id AND s.is_user_process=1)))
 THROW 51995,'LOCAL_MASTER_CONCURRENT_OR_TRIGGER_REJECTED',1;`;
// Binary comparison alone can be affected by SQL binary padding. Require the
// exact UTF-16 byte length as well as case-sensitive byte equality.
const validOperation=expr=>`((DATALENGTH(${expr})=DATALENGTH(N'customer.create') AND CONVERT(varbinary(48),${expr})=CONVERT(varbinary(48),N'customer.create')) OR (DATALENGTH(${expr})=DATALENGTH(N'product.create') AND CONVERT(varbinary(48),${expr})=CONVERT(varbinary(48),N'product.create')))`;
const units=`CREATE TABLE dbo.desktop_local_product_units (
 id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_desktop_local_product_units PRIMARY KEY,
 product_id bigint NOT NULL, label nvarchar(20) NOT NULL, factor decimal(28,8) NOT NULL, is_main bit NOT NULL,
 CONSTRAINT FK_desktop_local_units_product FOREIGN KEY(product_id) REFERENCES dbo.products(id),
 CONSTRAINT UQ_desktop_local_units_id_product UNIQUE(id,product_id),
 CONSTRAINT UQ_desktop_local_units_label UNIQUE(product_id,label),
 CONSTRAINT CK_desktop_local_units_label CHECK(LEN(LTRIM(RTRIM(label)))>0),
 CONSTRAINT CK_desktop_local_units_factor CHECK(factor>0 AND (is_main=0 OR factor=1))
);`;
const oneMain=`CREATE UNIQUE INDEX UX_desktop_local_units_main ON dbo.desktop_local_product_units(product_id) WHERE is_main=1;`;
const prices=`CREATE UNIQUE INDEX UX_desktop_local_price_identity ON dbo.product_prices(id,product_id);`;
const link=`CREATE TABLE dbo.desktop_local_price_units (
 price_id bigint NOT NULL CONSTRAINT PK_desktop_local_price_units PRIMARY KEY,
 product_id bigint NOT NULL, unit_id bigint NOT NULL,
 CONSTRAINT FK_desktop_local_price_units_price FOREIGN KEY(price_id,product_id) REFERENCES dbo.product_prices(id,product_id),
 CONSTRAINT FK_desktop_local_price_units_unit FOREIGN KEY(unit_id,product_id) REFERENCES dbo.desktop_local_product_units(id,product_id)
);`;
const journal=`CREATE TABLE dbo.desktop_local_master_requests (
 request_id uniqueidentifier NOT NULL CONSTRAINT PK_desktop_local_master_requests PRIMARY KEY,
 operation nvarchar(24) NOT NULL, actor_id bigint NOT NULL, payload_hash binary(32) NOT NULL,
 response_json nvarchar(max) NOT NULL, created_at datetime2(7) NOT NULL CONSTRAINT DF_desktop_local_requests_created DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_desktop_local_requests_actor FOREIGN KEY(actor_id) REFERENCES dbo.users(id),
 CONSTRAINT CK_desktop_local_requests_operation CHECK(${validOperation('operation')}),
 CONSTRAINT CK_desktop_local_requests_response CHECK(ISJSON(response_json)=1 AND DATALENGTH(response_json)<=16384)
);`;
export const LOCAL_MASTER_SCHEMA_LIMITS=Object.freeze({executionAuthorized:false,commercialData:'NONE',ddlOnly:true,
 migrationRequiresIndependentReview:true,requiresSingleOwner:true,requiresWritableProfileAndRole:true,
 requiresIndependentlyReviewedBaselineDigest:true,baselineEvidenceNotAuthenticatedByCompiler:true,
 requiresActualSqlConcurrencyAndRollbackProof:true,noncooperatingDdlRaceNotEliminated:true,
 sqlAdapterImplemented:false,apiRoutesImplemented:false,unknownCommitRequiresSameRequest:true,
 responseMustBeVerified:true,readOnlyMarkerStillSet:true,fullErpReady:false});

export function compileLocalMasterSchema(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||![Object.prototype,null].includes(Object.getPrototypeOf(options)))fail();
 const descriptors=Object.getOwnPropertyDescriptors(options),keys=Reflect.ownKeys(options);
 if(keys.length!==1||keys[0]!=='reviewedBaselineSha256'||!descriptors.reviewedBaselineSha256.enumerable
  ||!Object.hasOwn(descriptors.reviewedBaselineSha256,'value')||typeof descriptors.reviewedBaselineSha256.value!=='string'
  ||!/^[0-9a-f]{64}$/.test(descriptors.reviewedBaselineSha256.value))fail();
 const expectedBaseline=descriptors.reviewedBaselineSha256.value;
 const guard=desktopEmptyTargetGuard();
 const sql=`SET NOCOUNT ON; SET XACT_ABORT ON;
SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON; SET QUOTED_IDENTIFIER ON; SET NUMERIC_ROUNDABORT OFF;
IF @@TRANCOUNT<>0 OR (@@OPTIONS & 2)<>0 THROW 51995,'LOCAL_MASTER_EXISTING_TRANSACTION',1;
${guard}
IF DB_ID()<>5 OR CONVERT(int,SERVERPROPERTY('ProcessID'))<>5240
 OR NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=DB_ID() AND CONVERT(varchar(19),create_date,126)+'.'+RIGHT('000'+CONVERT(varchar(3),DATEPART(millisecond,create_date)),3)='2026-11-05T16:03:46.263')
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\\Xaser') IS NULL
 OR SUSER_SID()<>SUSER_SID(N'SEMIH\\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\\Xaser')
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory'
 THROW 51995,'LOCAL_MASTER_TARGET_REJECTED',1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @l int; EXEC @l=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @l<0 THROW 51995,'LOCAL_MASTER_LOCK_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 IF (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation
  WHERE id=1 AND environment_id=CONVERT(uniqueidentifier,N'${DESKTOP_EMPTY_ENVIRONMENT_ID}') AND schema_version=1 AND actual_t1=0 AND external_operations=0 AND read_only=1)
  THROW 51995,'LOCAL_MASTER_MARKER_REJECTED',1;
 IF EXISTS(SELECT 1 FROM sys.objects WHERE schema_id=SCHEMA_ID(N'dbo') AND name IN(N'desktop_local_product_units',N'desktop_local_price_units',N'desktop_local_master_requests'))
  OR EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.product_prices',N'U') AND name=N'UX_desktop_local_price_identity')
  OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.products',N'U') AND name=N'id' AND TYPE_NAME(system_type_id)=N'bigint' AND is_nullable=0)
  OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.users',N'U') AND name=N'id' AND TYPE_NAME(system_type_id)=N'bigint' AND is_nullable=0)
  OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.product_prices',N'U') AND name=N'id' AND TYPE_NAME(system_type_id)=N'bigint' AND is_nullable=0)
  OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.product_prices',N'U') AND name=N'product_id' AND TYPE_NAME(system_type_id)=N'bigint')
  THROW 51995,'LOCAL_MASTER_SCHEMA_PRECONDITION_REJECTED',1;
 -- Hold database-table locks until commit. This only coordinates table access;
 -- a separately verified exclusive installer owner remains mandatory.
 DECLARE @local_master_lock_count bigint;
 ${tables.map(name=>`SELECT @local_master_lock_count=COUNT_BIG(*) FROM dbo.[${name}] WITH(TABLOCKX,HOLDLOCK);`).join('\n ')}
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 ${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}
 IF CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2) COLLATE Latin1_General_100_BIN2
  <> UPPER('${expectedBaseline}') COLLATE Latin1_General_100_BIN2
  THROW 51995,'LOCAL_MASTER_BASELINE_DRIFT_REJECTED',1;
 ${[units,oneMain,prices,link,journal].map(s=>`EXEC sys.sp_executesql ${quote(s)};`).join('\n ')}
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'LOCAL_MASTER_TRANSACTION_REJECTED',1;
 COMMIT TRANSACTION;
 IF @@TRANCOUNT<>0 OR XACT_STATE()<>0 THROW 51995,'LOCAL_MASTER_TRANSACTION_REJECTED',1;
 SELECT N'LOCAL_MASTER_SCHEMA_APPLIED';
END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;`;
 return Object.freeze({server:DESKTOP_EMPTY_SERVER,database:DESKTOP_EMPTY_DATABASE,environmentId:DESKTOP_EMPTY_ENVIRONMENT_ID,
  sql,sqlSha256:hash(sql),reviewedBaselineSha256:expectedBaseline,ddlBatchCount:5,requirements:LOCAL_MASTER_SCHEMA_LIMITS});
}

// The adapter binds typed @requestId uniqueidentifier, @actorId bigint,
// @operation nvarchar(24), @payloadHash binary(32), @responseJson nvarchar(max).
// One UUID is locked across operations; never put the operation in lock key.
// Transaction ownership and verified actor/permission remain the adapter's job.
export const LOCAL_MASTER_DDL_SOURCE=Object.freeze([units,oneMain,prices,link,journal]);
export const LOCAL_MASTER_RESERVE_SQL=`IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'LOCAL_MASTER_TRANSACTION_REQUIRED',1;
IF @requestId IS NULL OR @actorId IS NULL OR @actorId<1 OR @payloadHash IS NULL OR @operation IS NULL OR NOT ${validOperation('@operation')}
 THROW 51995,'LOCAL_MASTER_REQUEST_REJECTED',1;
DECLARE @lockResult int,@resource nvarchar(255)=N'melisa-desktop-master-request:'+LOWER(CONVERT(nvarchar(36),@requestId));
EXEC @lockResult=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
IF @lockResult<0 THROW 51995,'LOCAL_MASTER_REQUEST_LOCKED',1;
IF EXISTS(SELECT 1 FROM dbo.desktop_local_master_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@requestId
 AND (actor_id<>@actorId OR CONVERT(varbinary(48),operation)<>CONVERT(varbinary(48),@operation) OR payload_hash<>@payloadHash))
 THROW 51995,'LOCAL_MASTER_REQUEST_CONFLICT',1;
SELECT response_json FROM dbo.desktop_local_master_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@requestId;`;
export const LOCAL_MASTER_FINISH_SQL=`IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'LOCAL_MASTER_TRANSACTION_REQUIRED',1;
IF @requestId IS NULL OR @actorId IS NULL OR @actorId<1 OR @payloadHash IS NULL OR @operation IS NULL OR NOT ${validOperation('@operation')}
 OR @responseJson IS NULL OR ISJSON(@responseJson)<>1 OR DATALENGTH(@responseJson)>16384
 THROW 51995,'LOCAL_MASTER_REQUEST_REJECTED',1;
DECLARE @resource nvarchar(255)=N'melisa-desktop-master-request:'+LOWER(CONVERT(nvarchar(36),@requestId));
IF ISNULL(APPLOCK_MODE('public',@resource,'Transaction'),N'')<>N'Exclusive' THROW 51995,'LOCAL_MASTER_REQUEST_LOCK_REQUIRED',1;
INSERT dbo.desktop_local_master_requests(request_id,operation,actor_id,payload_hash,response_json)
 VALUES(@requestId,@operation,@actorId,@payloadHash,@responseJson);
SELECT response_json FROM dbo.desktop_local_master_requests WHERE request_id=@requestId AND actor_id=@actorId
 AND CONVERT(varbinary(48),operation)=CONVERT(varbinary(48),@operation) AND payload_hash=@payloadHash;`;
