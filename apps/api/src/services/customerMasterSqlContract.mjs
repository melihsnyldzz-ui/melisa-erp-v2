// SOURCE ONLY. No connection, executor, grants or startup registration.
// New metadata tables, not a second commercial customer database. Native source,
// accounts, ledger, documents, contact and existing guards remain untouched.
const columns={
 customer_master_local_v1:[['copy_id','uniqueidentifier',16],['customer_id','bigint',8],['identity_hash','char',64],['customer_code','nvarchar',100],['customer_name','nvarchar',500],['customer_type','nvarchar',60],['version','bigint',8],['updated_by','bigint',8]],
 customer_master_requests_v1:[['copy_id','uniqueidentifier',16],['request_id','uniqueidentifier',16],['customer_id','bigint',8],['actor_id','bigint',8],['identity_hash','char',64],['payload_hash','char',64],['payload_json','nvarchar',-1],['committed_version','bigint',8]],
 customer_master_audit_v1:[['copy_id','uniqueidentifier',16],['request_id','uniqueidentifier',16],['actor_id','bigint',8],['customer_id','bigint',8],['payload_hash','char',64],['before_json','nvarchar',-1,true],['after_json','nvarchar',-1],['created_at','datetime2',8]],
};
const schemaChecks=Object.entries(columns).map(([table,cols])=>`AND (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.${table}'))=${cols.length}
 AND NOT EXISTS(SELECT 1 FROM (VALUES ${cols.map(([n,t,l,nullable])=>`(N'${n}',TYPE_ID(N'${t}'),${l},${nullable?1:0})`).join(',')}) e(n,t,l,z) LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.${table}') AND c.name=e.n WHERE c.column_id IS NULL OR c.system_type_id<>e.t OR c.user_type_id<>c.system_type_id OR c.max_length<>e.l OR c.is_nullable<>e.z OR c.is_computed<>0 OR c.is_identity<>0)
 AND EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.${table}') AND is_primary_key=1 AND is_disabled=0 AND INDEX_COL(N'dbo.${table}',index_id,1)=N'copy_id' AND INDEX_COL(N'dbo.${table}',index_id,2)=N'${table==='customer_master_local_v1'?'customer_id':'request_id'}' AND INDEX_COL(N'dbo.${table}',index_id,3) IS NULL)
 AND NOT EXISTS(SELECT 1 FROM sys.triggers WHERE parent_id=OBJECT_ID(N'dbo.${table}'))`).join('\n');
const foreignKeys=[['customer_master_local_v1','customers',[['customer_id','id']]],['customer_master_local_v1','stage4_copy_manifest',[['copy_id','copy_id']]],['customer_master_requests_v1','customer_master_local_v1',[['copy_id','copy_id'],['customer_id','customer_id']]],['customer_master_audit_v1','customer_master_requests_v1',[['copy_id','copy_id'],['request_id','request_id']]]].map(([from,to,pairs])=>`AND EXISTS(SELECT 1 FROM sys.foreign_keys f WHERE f.parent_object_id=OBJECT_ID(N'dbo.${from}') AND f.referenced_object_id=OBJECT_ID(N'dbo.${to}') AND f.is_disabled=0 AND f.is_not_trusted=0 AND f.delete_referential_action=0 AND f.update_referential_action=0 AND (SELECT COUNT(*) FROM sys.foreign_key_columns WHERE constraint_object_id=f.object_id)=${pairs.length} ${pairs.map(([a,b],i)=>`AND EXISTS(SELECT 1 FROM sys.foreign_key_columns k WHERE k.constraint_object_id=f.object_id AND k.constraint_column_id=${i+1} AND COL_NAME(k.parent_object_id,k.parent_column_id)=N'${a}' AND COL_NAME(k.referenced_object_id,k.referenced_column_id)=N'${b}')`).join(' ')})`).join('\n');
export const CUSTOMER_MASTER_DDL=`
CREATE TABLE dbo.customer_master_local_v1(
 copy_id uniqueidentifier NOT NULL,customer_id bigint NOT NULL,
 identity_hash char(64) NOT NULL,customer_code nvarchar(50) NOT NULL,
 customer_name nvarchar(250) NOT NULL,customer_type nvarchar(30) NOT NULL,
 version bigint NOT NULL CHECK(version>0),updated_by bigint NOT NULL,
 PRIMARY KEY(copy_id,customer_id),UNIQUE(copy_id,customer_code),
 FOREIGN KEY(customer_id) REFERENCES dbo.customers(id),
 FOREIGN KEY(copy_id) REFERENCES dbo.stage4_copy_manifest(copy_id),
 CHECK(customer_type IN(N'customer',N'wholesale',N'retail',N'mixed')));
CREATE TABLE dbo.customer_master_requests_v1(
 copy_id uniqueidentifier NOT NULL,request_id uniqueidentifier NOT NULL,
 customer_id bigint NOT NULL,actor_id bigint NOT NULL,identity_hash char(64) NOT NULL,
 payload_hash char(64) NOT NULL,payload_json nvarchar(max) NOT NULL,
 committed_version bigint NOT NULL CHECK(committed_version>0),
 PRIMARY KEY(copy_id,request_id),FOREIGN KEY(copy_id,customer_id) REFERENCES dbo.customer_master_local_v1(copy_id,customer_id));
CREATE TABLE dbo.customer_master_audit_v1(
 copy_id uniqueidentifier NOT NULL,request_id uniqueidentifier NOT NULL,
 actor_id bigint NOT NULL,customer_id bigint NOT NULL,payload_hash char(64) NOT NULL,
 before_json nvarchar(max) NULL,after_json nvarchar(max) NOT NULL,
 created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 PRIMARY KEY(copy_id,request_id),FOREIGN KEY(copy_id,request_id) REFERENCES dbo.customer_master_requests_v1(copy_id,request_id));`;

export const MASTER_FRAME_SQL=`/* customer-master:frame */
SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,
 SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,
 HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,
 HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,
 HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,
 @@SPID sessionId,CONVERT(varchar(30),CURRENT_TRANSACTION_ID()) transactionId,
 @@TRANCOUNT transactionCount,XACT_STATE() transactionState,
 (SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,
 APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,
 (SELECT profile_json FROM dbo.stage4_copy_manifest WHERE copy_id=@copy_id AND sealed=1 AND seal_hash=@seal_hash) profileJson,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_shared_customer_cards'))),2) sourceReaderHash,
 (SELECT u.id,u.role_id roleId,r.code roleCode,CONVERT(bit,p.can_view) canView,CONVERT(bit,p.can_update) canUpdate
  FROM dbo.users u WITH(HOLDLOCK) JOIN dbo.roles r WITH(HOLDLOCK) ON r.id=u.role_id JOIN dbo.permissions p WITH(HOLDLOCK) ON p.role_id=r.id AND p.permission_key=N'customer.update'
  WHERE u.id=@actor_id AND u.is_active=1 AND r.is_active=1 FOR JSON PATH) actorJson,
 CONVERT(bit,CASE WHEN
 EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.customers') AND name=N'customer_code' AND system_type_id=TYPE_ID(N'nvarchar') AND max_length=100 AND is_nullable=0)
 AND EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.customers') AND name=N'name' AND system_type_id=TYPE_ID(N'nvarchar') AND max_length=500 AND is_nullable=0)
 AND EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.customers') AND name=N'customer_type' AND system_type_id=TYPE_ID(N'nvarchar') AND max_length=60 AND is_nullable=0)
 AND EXISTS(SELECT 1 FROM sys.columns c JOIN sys.columns p ON p.object_id=OBJECT_ID(N'dbo.customer_master_local_v1') AND p.name=N'customer_code' WHERE c.object_id=OBJECT_ID(N'dbo.customers') AND c.name=N'customer_code' AND c.collation_name=p.collation_name AND c.max_length=p.max_length AND p.is_nullable=0)
 AND EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.customer_master_local_v1') AND is_unique=1 AND is_disabled=0 AND has_filter=0 AND INDEX_COL(N'dbo.customer_master_local_v1',index_id,1)=N'copy_id' AND INDEX_COL(N'dbo.customer_master_local_v1',index_id,2)=N'customer_code' AND INDEX_COL(N'dbo.customer_master_local_v1',index_id,3) IS NULL)
 AND OBJECT_ID(N'dbo.customer_master_requests_v1',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.customer_master_audit_v1',N'U') IS NOT NULL
 ${schemaChecks}
 ${foreignKeys}
 THEN 1 ELSE 0 END) schemaValid;`;

export const MASTER_SOURCE_SQL=`/* customer-master:source */
SELECT c.customer_type baseType,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT c.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) sourceRevision,
 (SELECT LOWER(CONVERT(varchar(36),p.copy_id)) copyId,CONVERT(varchar(20),p.customer_id) customerId,
 p.identity_hash identityHash,p.customer_code customerCode,p.customer_name customerName,p.customer_type customerType,CONVERT(int,p.version) version
 FROM dbo.customer_master_local_v1 p WITH(UPDLOCK,HOLDLOCK) WHERE p.copy_id=@copy_id AND p.customer_id=@customer_id FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) projectionJson
FROM dbo.customers c WITH(UPDLOCK,HOLDLOCK) WHERE c.id=@customer_id;`;

// Effective display search/count/page are computed together, before reading
// selected C06 rows. Original code remains a search alias, never a second card.
const held=`(h.entity=N'customer' AND h.native_id=c.id) OR (h.native_entity_id=c.party_entity_id AND c.party_entity_id IS NOT NULL) OR EXISTS(SELECT 1 FROM dbo.party_source_links hl WHERE hl.customer_id=c.id AND hl.source_company=h.source_company AND CONVERT(varchar(20),hl.source_id)=h.source_id)`;
export const MASTER_LIST_SQL=`/* customer-master:list */
DECLARE @pattern nvarchar(500)=N'%'+REPLACE(REPLACE(REPLACE(REPLACE(@search,N'~',N'~~'),N'%',N'~%'),N'_',N'~_'),N'[',N'~[')+N'%';
SELECT c.id INTO #MasterPageCandidates FROM dbo.customers c
LEFT JOIN dbo.customer_master_local_v1 p ON p.copy_id=@copy_id AND p.customer_id=c.id
WHERE c.is_deleted=0 AND (@status=N'all' OR (@status=N'active' AND c.is_active=1) OR (@status=N'passive' AND c.is_active=0))
AND (@search=N'' OR COALESCE(p.customer_code,c.customer_code) LIKE @pattern ESCAPE N'~' OR COALESCE(p.customer_name,c.name) LIKE @pattern ESCAPE N'~' OR c.customer_code LIKE @pattern ESCAPE N'~' OR c.phone LIKE @pattern ESCAPE N'~')
AND (@quarantine=N'all' OR (@quarantine=N'included' AND EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE ${held})) OR (@quarantine=N'excluded' AND NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE ${held})));
SELECT (SELECT COUNT(*) FROM #MasterPageCandidates) total,
(SELECT CONVERT(varchar(20),id) id FROM #MasterPageCandidates ORDER BY id OFFSET ((@page-1)*@limit) ROWS FETCH NEXT @limit ROWS ONLY FOR JSON PATH) idsJson;`;

export const MASTER_UPDATE_SQL=`/* customer-master:update */
SET XACT_ABORT ON;
IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 OR APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction')<>N'Exclusive' THROW 52110,'CUSTOMER_MASTER_UNAVAILABLE',1;
IF @payload_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',@payload_json),2) OR JSON_VALUE(@payload_json,'$.customerId')<>CONVERT(varchar(20),@customer_id) OR JSON_VALUE(@payload_json,'$.requestId')<>LOWER(CONVERT(varchar(36),@request_id)) THROW 52114,'CUSTOMER_MASTER_REQUEST_CONFLICT',1;
IF EXISTS(SELECT 1 FROM dbo.customer_master_requests_v1 WITH(UPDLOCK,HOLDLOCK) WHERE copy_id=@copy_id AND request_id=@request_id) BEGIN
 IF NOT EXISTS(SELECT 1 FROM dbo.customer_master_requests_v1 r JOIN dbo.customer_master_audit_v1 a ON a.copy_id=r.copy_id AND a.request_id=r.request_id JOIN dbo.customer_master_local_v1 p ON p.copy_id=r.copy_id AND p.customer_id=r.customer_id WHERE r.copy_id=@copy_id AND r.request_id=@request_id AND r.actor_id=@actor_id AND r.customer_id=@customer_id AND r.identity_hash=@identity_hash AND p.identity_hash=r.identity_hash AND p.version>=r.committed_version AND r.payload_hash=@payload_hash AND r.payload_json COLLATE Latin1_General_100_BIN2=@payload_json COLLATE Latin1_General_100_BIN2 AND a.actor_id=r.actor_id AND a.customer_id=r.customer_id AND a.payload_hash=r.payload_hash) THROW 52114,'CUSTOMER_MASTER_REQUEST_CONFLICT',1;
 SELECT CAST(1 AS bit) replayed;RETURN;END;
DECLARE @source char(64),@version bigint=0,@before nvarchar(max);
SELECT @source=CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT c.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) FROM dbo.customers c WITH(UPDLOCK,HOLDLOCK) WHERE c.id=@customer_id;
SELECT @version=version,@before=(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) FROM dbo.customer_master_local_v1 p WITH(UPDLOCK,HOLDLOCK) WHERE copy_id=@copy_id AND customer_id=@customer_id;
IF @source IS NULL OR @expected_revision<>CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(nvarchar(max),@source)+N'|'+CONVERT(nvarchar(20),@version)+N'|'+CONVERT(nvarchar(64),@identity_hash)),2) THROW 52113,'CUSTOMER_MASTER_STALE',1;
-- Native original codes remain reserved, even when a local display code exists.
IF EXISTS(SELECT 1 FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE id<>@customer_id AND customer_code=@customer_code)
 OR EXISTS(SELECT 1 FROM dbo.customer_master_local_v1 WITH(UPDLOCK,HOLDLOCK) WHERE copy_id=@copy_id AND customer_id<>@customer_id AND customer_code=@customer_code) THROW 52116,'CUSTOMER_MASTER_CODE_CONFLICT',1;
IF EXISTS(SELECT 1 FROM dbo.customer_master_local_v1 WHERE copy_id=@copy_id AND customer_id=@customer_id)
 UPDATE dbo.customer_master_local_v1 SET customer_code=@customer_code,customer_name=@customer_name,customer_type=@customer_type,version=version+1,updated_by=@actor_id WHERE copy_id=@copy_id AND customer_id=@customer_id AND identity_hash=@identity_hash;
ELSE INSERT dbo.customer_master_local_v1(copy_id,customer_id,identity_hash,customer_code,customer_name,customer_type,version,updated_by) VALUES(@copy_id,@customer_id,@identity_hash,@customer_code,@customer_name,@customer_type,1,@actor_id);
IF @@ROWCOUNT<>1 THROW 52110,'CUSTOMER_MASTER_UNAVAILABLE',1;
INSERT dbo.customer_master_requests_v1(copy_id,request_id,customer_id,actor_id,identity_hash,payload_hash,payload_json,committed_version) VALUES(@copy_id,@request_id,@customer_id,@actor_id,@identity_hash,@payload_hash,@payload_json,@version+1);
INSERT dbo.customer_master_audit_v1(copy_id,request_id,actor_id,customer_id,payload_hash,before_json,after_json) SELECT @copy_id,@request_id,@actor_id,@customer_id,@payload_hash,@before,(SELECT p.* FROM dbo.customer_master_local_v1 p WHERE copy_id=@copy_id AND customer_id=@customer_id FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
SELECT CAST(0 AS bit) replayed;`;

export const MASTER_RECOVERY_SQL=`/* customer-master:recover */
IF EXISTS(SELECT 1 FROM dbo.customer_master_requests_v1 WHERE copy_id=@copy_id AND request_id=@request_id) AND NOT EXISTS(
 SELECT 1 FROM dbo.customer_master_requests_v1 r JOIN dbo.customer_master_audit_v1 a ON a.copy_id=r.copy_id AND a.request_id=r.request_id JOIN dbo.customer_master_local_v1 p ON p.copy_id=r.copy_id AND p.customer_id=r.customer_id
 WHERE r.copy_id=@copy_id AND r.request_id=@request_id AND r.actor_id=@actor_id AND r.customer_id=@customer_id AND r.identity_hash=@identity_hash AND p.identity_hash=r.identity_hash AND p.version>=r.committed_version
 AND a.actor_id=r.actor_id AND a.customer_id=r.customer_id AND a.payload_hash=r.payload_hash AND r.payload_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',r.payload_json),2)) THROW 52114,'CUSTOMER_MASTER_REQUEST_CONFLICT',1;
SELECT CONVERT(bit,CASE WHEN EXISTS(SELECT 1 FROM dbo.customer_master_requests_v1 WHERE copy_id=@copy_id AND request_id=@request_id) THEN 1 ELSE 0 END) replayed;`;
