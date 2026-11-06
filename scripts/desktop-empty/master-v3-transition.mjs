// Offline compiler only. Execution requires the fixed desktop owner runner,
// an independently captured baseline and an independently observed outcome.
import {createHash} from 'node:crypto';
import {LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,LOCAL_MASTER_CONCURRENCY_GUARD} from './local-master-schema-proposal.mjs';
import {DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS,DESKTOP_MASTER_V3_PERMISSION_MANIFEST,DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopMasterV3Policy.mjs';
import {DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopLifecyclePermissionPolicy.mjs';
import {MASTER_V3_OPERATION_CHECK_SQL} from './master-v3-journal-sql.mjs';

export const MASTER_V3_TARGET=Object.freeze({
 server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',serverProcessId:5240,databaseId:5,
 databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',
 transport:'Shared memory',admin:'SEMIH\\Xaser',writerLogin:'melisa_desktop_test_writer_20261105',
 writerSid:'0x417717302D2EFA478380226433A0BCA6',writerRole:'desktop_local_writer_v2',
 operator:'erp_deneme',operatorId:30002,operatorRole:'desktop_first_sale_operator',
});
export const MASTER_V3_TRANSITION_SCOPE=Object.freeze({
 fromSchemaVersion:2,toSchemaVersion:3,expectedTableCount:36,
 expectedPermissionCountBefore:9,expectedPermissionCountAfter:10,
 newPermission:'supplier.edit',
 permittedSchemaChanges:Object.freeze([
  'nullable supplier party_entity_id and trusted party entity foreign key',
  'unique filtered supplier party entity index',
  'trusted supplier account foreign key and unique filtered supplier account index',
  'extend local master request operation check with the reviewed V3 expression',
  'extend existing marker version check to permit version 3',
 ]),
 addedSqlGrants:Object.freeze(['INSERT dbo.suppliers','UPDATE dbo.suppliers(party_entity_id)']),
 preserve:Object.freeze(['sales','customers','products','receipts','existing principals','credentials','original V2 installer']),
});
export const MASTER_V3_REQUIRED_PROOFS=Object.freeze([
 'exact server database process GUID environment administrator SID and shared-memory identity',
 '36 table metadata SHA-256 and finite security metadata SHA-256 observed independently',
 'PK-ordered deterministic business row SHA-256 excluding only marker roles permissions',
 'supplier table empty and no supplier-linked accounts before change',
 'exclusive transaction-owned application lock and current concurrency guard',
 'exact existing writer SID membership effective V2 permissions and no other database access',
 'exact nine V2 operator permission rows and active operator before transition',
 'trusted schema changes, exact V3 effective permissions and exact ten operator permission rows',
 'one transaction, preserved business rows, post-change metadata and readback',
 'rollback observation on a separate connection with source hashes restored',
 'unknown outcome preserved without automatic replay',
]);
const fail=code=>{throw Object.assign(Error(code),{code});};
export function compileMasterV3Transition(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||!['rollback','apply'].includes(options.mode))fail('MASTER_V3_OPTIONS_REJECTED');
 for(const name of ['metadataSha256','securitySha256','businessRowsSha256'])if(typeof options[name]!=='string'||!/^[0-9a-f]{64}$/.test(options[name]))fail('MASTER_V3_OPTIONS_REJECTED');
 if(Object.keys(options).sort().join(',')!=='businessRowsSha256,metadataSha256,mode,securitySha256')fail('MASTER_V3_OPTIONS_REJECTED');
 const sql=transitionSql(options);
 return Object.freeze({mode:options.mode,sql,sha256:createHash('sha256').update(sql).digest('hex'),target:MASTER_V3_TARGET,sqlTested:false,
  requiresExternalOwnerLock:true,requiresIndependentReadback:true,credentialsChanged:false});
}
export function masterV3PolicyConsistency(){
 const permission=DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS.filter(p=>p.key==='supplier.edit');
 const added=DESKTOP_MASTER_V3_PERMISSION_MANIFEST.filter(p=>p.name==='suppliers'&&
  (p.permission==='INSERT'&&p.column===null||p.permission==='UPDATE'&&p.column==='party_entity_id'));
 return permission.length===1&&JSON.stringify(permission[0])===JSON.stringify({key:'supplier.edit',view:1,create:1,update:0,delete:0,approve:0})&&
  DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS.length===10&&added.length===2;
}
// Read-only, exact-target snapshot source. SQL Server hashes UTF-16LE JSON;
// only digests and counts leave SQL, not customer or transaction payloads.
// Existing SQL test execution and independent observer wiring remain pending.
export const MASTER_V3_BUSINESS_SNAPSHOT_SQL=`
DECLARE @v3_data TABLE(table_name sysname NOT NULL PRIMARY KEY,row_count bigint NOT NULL,row_hash char(64) NOT NULL);
DECLARE @v3_table sysname,@v3_keys nvarchar(max),@v3_query nvarchar(max),@v3_rows nvarchar(max),@v3_count bigint;
IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>36 OR (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo'))<>36 THROW 51995,'MASTER_V3_TABLE_SET_REJECTED',1;
DECLARE v3_tables CURSOR LOCAL FAST_FORWARD FOR SELECT t.name FROM sys.tables t WHERE t.is_ms_shipped=0 AND t.schema_id=SCHEMA_ID(N'dbo') AND t.name NOT IN(N'desktop_empty_installation',N'roles',N'permissions') ORDER BY t.name;
OPEN v3_tables; FETCH NEXT FROM v3_tables INTO @v3_table;
WHILE @@FETCH_STATUS=0 BEGIN
 SELECT @v3_keys=STRING_AGG(CONVERT(nvarchar(max),QUOTENAME(c.name)),N',') WITHIN GROUP(ORDER BY ic.key_ordinal)
 FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id AND i.is_primary_key=1 JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0 JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE t.schema_id=SCHEMA_ID(N'dbo') AND t.name=@v3_table;
 IF @v3_keys IS NULL THROW 51995,'MASTER_V3_PRIMARY_KEY_REQUIRED',1;
 SET @v3_query=N'SELECT @n=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@v3_table)+N'; SELECT @j=(SELECT * FROM dbo.'+QUOTENAME(@v3_table)+N' ORDER BY '+@v3_keys+N' FOR JSON PATH,INCLUDE_NULL_VALUES);';
 SET @v3_rows=NULL; SET @v3_count=NULL;
 EXEC sys.sp_executesql @v3_query,N'@n bigint OUTPUT,@j nvarchar(max) OUTPUT',@n=@v3_count OUTPUT,@j=@v3_rows OUTPUT;
 -- SQL Server can yield a NULL scalar JSON subquery for an empty table.
 -- Canonicalize only independently counted emptiness; nonempty NULL fails.
 IF @v3_count=0 AND @v3_rows IS NULL SET @v3_rows=N'[]';
 IF @v3_rows IS NULL OR @v3_count IS NULL BEGIN
 DECLARE @rowError nvarchar(128)=CONCAT(N'MASTER_V3_ROW_SNAPSHOT_REJECTED_',UPPER(@v3_table COLLATE Latin1_General_100_BIN2),N'_R',CASE WHEN @v3_rows IS NULL THEN 1 ELSE 0 END,N'_C',CASE WHEN @v3_count IS NULL THEN 1 ELSE 0 END);
 THROW 51995,@rowError,1;END;
 INSERT @v3_data VALUES(@v3_table,@v3_count,CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@v3_rows)),2));
 FETCH NEXT FROM v3_tables INTO @v3_table;
END; CLOSE v3_tables; DEALLOCATE v3_tables;
IF (SELECT COUNT(*) FROM @v3_data)<>33 THROW 51995,'MASTER_V3_ROW_SCOPE_REJECTED',1;
DECLARE @v3_data_json nvarchar(max)=(SELECT table_name,row_count,row_hash FROM @v3_data ORDER BY table_name FOR JSON PATH,INCLUDE_NULL_VALUES);
DECLARE @v3_business_sha char(64)=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@v3_data_json)),2));`;
// Fixed metadata/security snapshot components for a later compiled transition.
// This query captures permission metadata only, never credentials or row values.
export const MASTER_V3_SECURITY_SNAPSHOT_SQL=`
DECLARE @v3_security_json nvarchar(max)=(SELECT
 JSON_QUERY((SELECT principal_id,name,type,sid,default_schema_name,owning_principal_id FROM sys.database_principals WHERE principal_id>4 OR name=N'public' ORDER BY principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)) principals,
 JSON_QUERY((SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)) role_members,
 JSON_QUERY((SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FOR JSON PATH,INCLUDE_NULL_VALUES)) permissions,
 JSON_QUERY((SELECT p.permission_key,p.can_view,p.can_create,p.can_update,p.can_delete,p.can_approve FROM dbo.permissions p JOIN dbo.roles r ON r.id=p.role_id WHERE r.code=N'desktop_first_sale_operator' ORDER BY p.permission_key,p.id FOR JSON PATH,INCLUDE_NULL_VALUES)) operator_permissions
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
IF @v3_security_json IS NULL THROW 51995,'MASTER_V3_SECURITY_SNAPSHOT_REJECTED',1;
DECLARE @v3_security_sha char(64)=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@v3_security_json)),2));`;
export const MASTER_V3_TARGET_IDENTITY_SQL=`
IF DB_ID() IS NULL OR DB_ID()<>5 OR DB_NAME() IS NULL OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'MELISA_ERP_DESKTOP_TEST_20261105')
 OR SERVERPROPERTY('ServerName') IS NULL OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\\MELISAERP')
 OR ISNULL(CONVERT(int,SERVERPROPERTY('ProcessID')),-1)<>5240
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\\Xaser') IS NULL
 OR SUSER_SID()<>SUSER_SID(N'SEMIH\\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\\Xaser')
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory'
 THROW 51995,'MASTER_V3_IDENTITY_REJECTED',1;
IF (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version IN(2,3) AND read_only=0 AND actual_t1=0 AND external_operations=0) THROW 51995,'MASTER_V3_MARKER_REJECTED',1;`;

// Only hash/count results are returned. The caller must hold the external
// desktop owner locks and use a new connection for independent observation.
export function compileMasterV3Snapshot(){
 const sql=`SET NOCOUNT ON; SET XACT_ABORT ON; SET LOCK_TIMEOUT 5000;
 IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V3_EXISTING_TRANSACTION',1;
 ${MASTER_V3_TARGET_IDENTITY_SQL}
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE; BEGIN TRANSACTION;
 DECLARE @snapshotOwner int;EXEC @snapshotOwner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @snapshotOwner<0 THROW 51995,'MASTER_V3_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 DECLARE @v3_lock_table sysname,@v3_lock_sql nvarchar(max),@v3_lock_count bigint;
 DECLARE v3_lock_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo') ORDER BY name;
 OPEN v3_lock_cursor; FETCH NEXT FROM v3_lock_cursor INTO @v3_lock_table;
 WHILE @@FETCH_STATUS=0 BEGIN
 SET @v3_lock_sql=N'SELECT @n=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@v3_lock_table)+N' WITH(TABLOCK,HOLDLOCK);';
 EXEC sys.sp_executesql @v3_lock_sql,N'@n bigint OUTPUT',@n=@v3_lock_count OUTPUT;
 FETCH NEXT FROM v3_lock_cursor INTO @v3_lock_table; END;
 CLOSE v3_lock_cursor; DEALLOCATE v3_lock_cursor;
 ${MASTER_V3_TARGET_IDENTITY_SQL}
 ${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}
 ${MASTER_V3_SECURITY_SNAPSHOT_SQL}
 ${MASTER_V3_BUSINESS_SNAPSHOT_SQL}
 SELECT LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2)) metadataSha256,@v3_security_sha securitySha256,@v3_business_sha businessRowsSha256,(SELECT schema_version FROM dbo.desktop_empty_installation WHERE id=1) schemaVersion;
 COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;`;
 return Object.freeze({sql,sha256:createHash('sha256').update(sql).digest('hex'),readOnly:true,sqlTested:false,requiresExternalOwnerLock:true});
}

const quote=value=>`N'${value.replaceAll("'","''")}'`;
function hashesSql(){
 const body=`${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}\n${MASTER_V3_SECURITY_SNAPSHOT_SQL}\n${MASTER_V3_BUSINESS_SNAPSHOT_SQL}
 SET @metadata=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2));
 SET @security=@v3_security_sha; SET @business=@v3_business_sha;`;
 return `EXEC sys.sp_executesql ${quote(body)},N'@metadata char(64) OUTPUT,@security char(64) OUTPUT,@business char(64) OUTPUT',@metadata=@metadata OUTPUT,@security=@security OUTPUT,@business=@business OUTPUT;`;
}
const lockTables=`DECLARE @lockTable sysname,@lockSql nvarchar(max),@lockCount bigint;
 DECLARE lock_tables CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo') ORDER BY name;
 OPEN lock_tables; FETCH NEXT FROM lock_tables INTO @lockTable;
 WHILE @@FETCH_STATUS=0 BEGIN
 SET @lockSql=N'SELECT @n=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@lockTable)+N' WITH(TABLOCKX,HOLDLOCK);';
 EXEC sys.sp_executesql @lockSql,N'@n bigint OUTPUT',@n=@lockCount OUTPUT;
 FETCH NEXT FROM lock_tables INTO @lockTable; END; CLOSE lock_tables; DEALLOCATE lock_tables;`;
function operatorGuard(version){
 const rows=DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS.filter(p=>version===3||p.key!=='supplier.edit');
 const values=rows.map(p=>`(CONVERT(varbinary(240),N'${p.key}'),${p.view},${p.create},${p.update},${p.delete},${p.approve})`).join(',');
 return `IF (SELECT COUNT_BIG(*) FROM dbo.roles WHERE id=@operatorRole AND code=N'desktop_first_sale_operator' AND is_active=1 AND is_system_role=0)<>1
 OR (SELECT COUNT_BIG(*) FROM dbo.users WHERE role_id=@operatorRole)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.users WHERE id=30002 AND username=N'erp_deneme' AND role_id=@operatorRole AND is_active=1)
 OR (SELECT COUNT_BIG(*) FROM dbo.permissions WHERE role_id=@operatorRole)<>${rows.length}
 OR EXISTS(SELECT CONVERT(varbinary(240),permission_key),CONVERT(int,can_view),CONVERT(int,can_create),CONVERT(int,can_update),CONVERT(int,can_delete),CONVERT(int,can_approve) FROM dbo.permissions WHERE role_id=@operatorRole EXCEPT SELECT * FROM (VALUES ${values}) e(k,v,c,u,d,a))
 OR EXISTS(SELECT * FROM (VALUES ${values}) e(k,v,c,u,d,a) EXCEPT SELECT CONVERT(varbinary(240),permission_key),CONVERT(int,can_view),CONVERT(int,can_create),CONVERT(int,can_update),CONVERT(int,can_delete),CONVERT(int,can_approve) FROM dbo.permissions WHERE role_id=@operatorRole)
 THROW 51995,'MASTER_V3_OPERATOR_DRIFT',1;`;
}
const writerGuard=`IF (SELECT COUNT_BIG(*) FROM sys.sql_logins WHERE name=N'melisa_desktop_test_writer_20261105' AND sid=0x417717302D2EFA478380226433A0BCA6 AND is_disabled=0 AND is_policy_checked=1 AND default_database_name=N'MELISA_ERP_DESKTOP_TEST_20261105')<>1
 OR NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'melisa_desktop_test_writer_20261105' AND sid=0x417717302D2EFA478380226433A0BCA6 AND type=N'S')
 OR EXISTS(SELECT 1 FROM sys.server_role_members WHERE member_principal_id=SUSER_ID(N'melisa_desktop_test_writer_20261105'))
 OR (SELECT COUNT_BIG(*) FROM sys.database_role_members WHERE member_principal_id=USER_ID(N'melisa_desktop_test_writer_20261105'))<>1
 OR NOT EXISTS(SELECT 1 FROM sys.database_role_members WHERE member_principal_id=USER_ID(N'melisa_desktop_test_writer_20261105') AND role_principal_id=DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2'))
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND security_id=0x417717302D2EFA478380226433A0BCA6)
 THROW 51995,'MASTER_V3_WRITER_DRIFT',1;`;
function effectiveGuard(version){return `EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105'; SET @impersonating=1;
 ${version===3?DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL:DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL}
 REVERT; SET @impersonating=0;`;}
const ddl=`ALTER TABLE dbo.suppliers WITH CHECK ADD CONSTRAINT FK_desktop_v3_supplier_entity FOREIGN KEY(party_entity_id) REFERENCES dbo.party_entities(id);
 CREATE UNIQUE INDEX UX_desktop_v3_supplier_entity ON dbo.suppliers(party_entity_id) WHERE party_entity_id IS NOT NULL;
 ALTER TABLE dbo.party_currency_accounts WITH CHECK ADD CONSTRAINT FK_desktop_v3_account_supplier FOREIGN KEY(supplier_id) REFERENCES dbo.suppliers(id);
 CREATE UNIQUE INDEX UX_desktop_v3_supplier_account ON dbo.party_currency_accounts(supplier_id,currency_code) WHERE supplier_id IS NOT NULL AND customer_id IS NULL;
 ALTER TABLE dbo.desktop_local_master_requests DROP CONSTRAINT CK_desktop_local_requests_operation;
 ALTER TABLE dbo.desktop_local_master_requests WITH CHECK ADD CONSTRAINT CK_desktop_local_requests_operation CHECK ${MASTER_V3_OPERATION_CHECK_SQL};
 ALTER TABLE dbo.desktop_empty_installation DROP CONSTRAINT CK_desktop_profile_version_mode;
 ALTER TABLE dbo.desktop_empty_installation WITH CHECK ADD CONSTRAINT CK_desktop_profile_version_mode CHECK((schema_version=1 AND read_only=1) OR (schema_version IN(2,3) AND read_only=0));
 UPDATE dbo.desktop_empty_installation SET schema_version=3 WHERE id=1 AND schema_version=2 AND read_only=0;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V3_MARKER_UPDATE',1;
 GRANT INSERT ON OBJECT::dbo.suppliers TO desktop_local_writer_v2;
 GRANT UPDATE ON OBJECT::dbo.suppliers(party_entity_id) TO desktop_local_writer_v2;
 INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve)
 SELECT id,N'supplier.edit',1,1,0,0,0 FROM dbo.roles WHERE code=N'desktop_first_sale_operator' AND is_active=1 AND is_system_role=0;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V3_PERMISSION_INSERT',1;
 UPDATE dbo.roles SET updated_at=SYSUTCDATETIME() WHERE code=N'desktop_first_sale_operator' AND is_active=1 AND is_system_role=0;
 IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V3_ROLE_UPDATE',1;`;
const schemaReadback=`IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>36
 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=3 AND read_only=0 AND actual_t1=0 AND external_operations=0)
 OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.suppliers') AND name=N'party_entity_id' AND system_type_id=127 AND is_nullable=1)
 OR (SELECT COUNT(*) FROM sys.foreign_keys WHERE name IN(N'FK_desktop_v3_supplier_entity',N'FK_desktop_v3_account_supplier') AND is_disabled=0 AND is_not_trusted=0)<>2
 OR (SELECT COUNT(*) FROM sys.indexes WHERE name IN(N'UX_desktop_v3_supplier_entity',N'UX_desktop_v3_supplier_account') AND is_unique=1 AND has_filter=1 AND is_disabled=0)<>2
 OR (SELECT COUNT(*) FROM sys.check_constraints WHERE name IN(N'CK_desktop_local_requests_operation',N'CK_desktop_profile_version_mode') AND is_disabled=0 AND is_not_trusted=0)<>2
 THROW 51995,'MASTER_V3_SCHEMA_READBACK',1;`;
function transitionSql(v){
 return `SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
 SET ANSI_NULLS ON;SET ANSI_PADDING ON;SET ANSI_WARNINGS ON;SET ARITHABORT ON;SET CONCAT_NULL_YIELDS_NULL ON;SET QUOTED_IDENTIFIER ON;SET NUMERIC_ROUNDABORT OFF;
 IF @@TRANCOUNT<>0 OR XACT_STATE()=-1 OR (@@OPTIONS&2)<>0 THROW 51995,'MASTER_V3_EXISTING_TRANSACTION',1;
 ${MASTER_V3_TARGET_IDENTITY_SQL}
 DECLARE @impersonating bit=0,@metadata char(64),@security char(64),@business char(64),@operatorRole bigint,@owner int,@stage int=0;
 BEGIN TRY SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;
 EXEC @owner=sys.sp_getapplock @Resource=N'melisa-desktop-local-master-schema-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @owner<0 THROW 51995,'MASTER_V3_OWNER_REJECTED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 ${lockTables}
 ${MASTER_V3_TARGET_IDENTITY_SQL}
 IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=2)
 OR COL_LENGTH(N'dbo.suppliers',N'party_entity_id') IS NOT NULL
 OR COL_LENGTH(N'dbo.products',N'supplier_id') IS NULL OR COL_LENGTH(N'dbo.products',N'brand') IS NULL OR COL_LENGTH(N'dbo.products',N'category') IS NULL
 OR EXISTS(SELECT 1 FROM dbo.suppliers) OR EXISTS(SELECT 1 FROM dbo.party_currency_accounts WHERE supplier_id IS NOT NULL)
 THROW 51995,'MASTER_V3_PRECONDITION',1;
 SET @operatorRole=(SELECT id FROM dbo.roles WITH(UPDLOCK,HOLDLOCK) WHERE code=N'desktop_first_sale_operator');
 ${operatorGuard(2)}
 ${writerGuard}
 ${effectiveGuard(2)}
 ${hashesSql()}
 IF @metadata COLLATE Latin1_General_100_BIN2<>'${v.metadataSha256}' OR @security COLLATE Latin1_General_100_BIN2<>'${v.securitySha256}' OR @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}' THROW 51995,'MASTER_V3_BASELINE_DRIFT',1;
 DECLARE @principals nvarchar(max)=(SELECT principal_id,name,type,sid,default_schema_name,owning_principal_id FROM sys.database_principals WHERE principal_id>4 OR name=N'public' ORDER BY principal_id FOR JSON PATH,INCLUDE_NULL_VALUES);
 DECLARE @members nvarchar(max)=(SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH,INCLUDE_NULL_VALUES);
 DECLARE @expectedGrants TABLE(class int,major_id int,minor_id int,grantee_principal_id int,grantor_principal_id int,type char(4),state char(1));
 INSERT @expectedGrants SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.database_permissions;
 SET @stage=10;EXEC sys.sp_executesql N'ALTER TABLE dbo.suppliers ADD party_entity_id bigint NULL;';
 SET @stage=20;EXEC sys.sp_executesql ${quote(ddl)};
 SET @stage=30;
 ${schemaReadback}
 ${operatorGuard(3)}
 ${writerGuard}
 INSERT @expectedGrants VALUES(1,OBJECT_ID(N'dbo.suppliers'),0,DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2'),DATABASE_PRINCIPAL_ID(N'dbo'),'IN','G'),(1,OBJECT_ID(N'dbo.suppliers'),COLUMNPROPERTY(OBJECT_ID(N'dbo.suppliers'),N'party_entity_id','ColumnId'),DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2'),DATABASE_PRINCIPAL_ID(N'dbo'),'UP','G');
 IF EXISTS(SELECT * FROM @expectedGrants EXCEPT SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type COLLATE Latin1_General_100_BIN2,state COLLATE Latin1_General_100_BIN2 FROM sys.database_permissions)
 OR EXISTS(SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type COLLATE Latin1_General_100_BIN2,state COLLATE Latin1_General_100_BIN2 FROM sys.database_permissions EXCEPT SELECT * FROM @expectedGrants)
 OR CONVERT(varbinary(max),@principals)<>CONVERT(varbinary(max),(SELECT principal_id,name,type,sid,default_schema_name,owning_principal_id FROM sys.database_principals WHERE principal_id>4 OR name=N'public' ORDER BY principal_id FOR JSON PATH,INCLUDE_NULL_VALUES))
 OR CONVERT(varbinary(max),@members)<>CONVERT(varbinary(max),(SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)) THROW 51995,'MASTER_V3_SECURITY_DIFF',1;
 ${effectiveGuard(3)}
 ${hashesSql()}
 IF @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}' THROW 51995,'MASTER_V3_BUSINESS_ROWS_CHANGED',1;
 ${LOCAL_MASTER_CONCURRENCY_GUARD}
 IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'MASTER_V3_TRANSACTION_REJECTED',1;
 ${v.mode==='rollback'?`ROLLBACK TRANSACTION;
 ${hashesSql()}
 IF @metadata COLLATE Latin1_General_100_BIN2<>'${v.metadataSha256}' OR @security COLLATE Latin1_General_100_BIN2<>'${v.securitySha256}' OR @business COLLATE Latin1_General_100_BIN2<>'${v.businessRowsSha256}' THROW 51995,'MASTER_V3_ROLLBACK_DRIFT',1;
 SELECT N'MASTER_V3_ROLLED_BACK' state,@metadata metadataSha256,@security securitySha256,@business businessRowsSha256;`:
 `COMMIT TRANSACTION;IF @@TRANCOUNT<>0 OR XACT_STATE()=-1 THROW 51995,'MASTER_V3_COMMIT_UNVERIFIED',1;
 SELECT N'MASTER_V3_COMMITTED_UNVERIFIED' state,@metadata metadataSha256,@security securitySha256,@business businessRowsSha256;`}
 END TRY BEGIN CATCH
 DECLARE @number int=ERROR_NUMBER(),@label nvarchar(128)=N'UNCLASSIFIED',@cleanup int=0;
 IF ERROR_NUMBER()=51995 AND LEN(ERROR_MESSAGE()) BETWEEN 1 AND 100 AND ERROR_MESSAGE() COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Z0-9_]%' COLLATE Latin1_General_100_BIN2 SET @label=ERROR_MESSAGE();
 IF @@TRANCOUNT>0 AND XACT_STATE()<>0 ROLLBACK TRANSACTION;
 IF @impersonating=1 BEGIN TRY REVERT;END TRY BEGIN CATCH SET @cleanup=ERROR_NUMBER();END CATCH;
 DECLARE @message nvarchar(2048)=CONCAT(N'MASTER_V3_FAILURE number=',@number,N' cleanup=',@cleanup,N' label=',@label,N' stage=',@stage);THROW 51996,@message,1;
 END CATCH;`;
}
