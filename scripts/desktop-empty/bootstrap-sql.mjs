// Offline compiler only. Importing or calling this module never opens SQL,
// writes files, creates credentials, or authorizes execution.
import {createHash} from 'node:crypto';
import {
 DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_DATABASE,DESKTOP_EMPTY_ENVIRONMENT_ID,
 desktopEmptyTargetGuard,compileDesktopEmptySchema,
} from './schema.mjs';

const LOCK_RESOURCE='melisa-desktop-empty-schema-eb2888c2-51cb-4570-a933-397cf7e62806';
// Read-only observation of this new, empty SQL Express instance and database.
// A changed build, DB settings, principal metadata, or any grant must fail
// closed until a new exact baseline has been independently reviewed.
const PERMISSIONS_BASELINE=Object.freeze({
 count:220,
 sha256:'D17EA3A14B33F2089EEDAD8AF381DC1A2000F9D87933C0EE00C79D7C2276A3D1',
 productVersion:'16.0.1000.6',compatibility:160,collation:'Turkish_CI_AS',
});
const expectedTables=Object.freeze([
 'audit_logs','auth_refresh_tokens','catalog_items','catalogs','currency_rates',
 'customer_movements','customers','desktop_empty_installation','permissions',
 'product_barcodes','product_images','products','purchase_invoice_items',
 'purchase_invoices','roles','sales_invoice_items','sales_invoices','stock_movements',
 'supplier_movements','suppliers','system_settings','terminal_devices',
 'terminal_sync_queue','users',
]);
const builtinPrincipals=Object.freeze([
 'public','dbo','guest','INFORMATION_SCHEMA','sys','db_owner','db_accessadmin',
 'db_securityadmin','db_ddladmin','db_backupoperator','db_datareader','db_datawriter',
 'db_denydatareader','db_denydatawriter',
]);
const builtinSchemas=Object.freeze(builtinPrincipals.filter(name=>name!=='public'));
const reject=code=>{throw Object.assign(new Error(code),{code});};
const sha256=value=>createHash('sha256').update(value,'utf8').digest('hex');
const unicodeLiteral=value=>{
 if(typeof value!=='string'||value.includes('\0'))reject('DESKTOP_BOOTSTRAP_LITERAL_REJECTED');
 return "N'"+value.replaceAll("'","''")+"'";
};

// This metadata is an explicit mandatory requirement on a future executor.
// A rolled-back attempt leaves no in-database evidence, so this compiler alone
// cannot distinguish that attempt from a fresh one and cannot authorize retry.
export const DESKTOP_BOOTSTRAP_EXECUTION_REQUIREMENTS=Object.freeze({
 executionAuthorized:false,
 requiresReviewedExecutor:true,
 requiresDurableSingleUseAttemptFence:true,
 requiresExclusiveTargetOwnership:true,
 retryAfterDispatch:'REJECT_UNTIL_INDEPENDENT_OUTCOME_RESOLUTION',
 commercialData:'NONE',
});

export function compileDesktopEmptyBootstrap({server=DESKTOP_EMPTY_SERVER,database=DESKTOP_EMPTY_DATABASE,sources}={}){
 // This function checks exact supplied target values before it creates any SQL.
 const guard=desktopEmptyTargetGuard({server,database});
 const schema=compileDesktopEmptySchema({server,database,sources});
 const found=schema.batches.flatMap(({sql})=>[...sql.matchAll(/CREATE TABLE dbo\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map(match=>match[1])).sort();
 if(schema.server!==DESKTOP_EMPTY_SERVER||schema.database!==DESKTOP_EMPTY_DATABASE
   ||schema.environmentId!==DESKTOP_EMPTY_ENVIRONMENT_ID||schema.batches.length!==35
   ||JSON.stringify(found)!==JSON.stringify(expectedTables))reject('DESKTOP_BOOTSTRAP_SCHEMA_REJECTED');
 const firstNewline=guard.indexOf('\n');
 if(firstNewline<0)reject('DESKTOP_BOOTSTRAP_GUARD_REJECTED');
 const recheck=`SELECT @desktop_empty_db=DB_NAME(), @desktop_empty_server=CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'));\n${guard.slice(firstNewline+1)}`;
 const values=expectedTables.map(name=>`(${unicodeLiteral(name)})`).join(',');
 const principalValues=builtinPrincipals.map(name=>`(${unicodeLiteral(name)})`).join(',');
 const schemaValues=builtinSchemas.map(name=>`(${unicodeLiteral(name)})`).join(',');
 const environmentCheck=`IF CONVERT(varbinary(256),ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ProductVersion')),N''))<>CONVERT(varbinary(256),${unicodeLiteral(PERMISSIONS_BASELINE.productVersion)})
 OR NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=DB_ID()
  AND compatibility_level=${PERMISSIONS_BASELINE.compatibility}
  AND CONVERT(varbinary(256),collation_name)=CONVERT(varbinary(256),${unicodeLiteral(PERMISSIONS_BASELINE.collation)})
  AND is_trustworthy_on=0 AND is_db_chaining_on=0)
 THROW 51995, 'DESKTOP_BOOTSTRAP_ENVIRONMENT_BASELINE_REJECTED', 1;`;
 // Keep this SELECT exactly aligned with the observed, ordered SQL JSON
 // baseline. All database_permissions columns and the joined grantee/grantor
 // identity fields are included; NULL and binary SID representation are fixed.
 const permissionsRows=`SELECT p.[class] AS [class],p.class_desc AS [class_desc],p.major_id AS [major_id],p.minor_id AS [minor_id],p.grantee_principal_id AS [grantee_principal_id],p.grantor_principal_id AS [grantor_principal_id],p.[type] AS [type],p.permission_name AS [permission_name],p.[state] AS [state],p.state_desc AS [state_desc],g.name AS [grantee_name],g.[type] AS [grantee_type],g.type_desc AS [grantee_type_desc],g.is_fixed_role AS [grantee_is_fixed_role],g.authentication_type AS [grantee_authentication_type],CONVERT(varchar(max),g.sid,2) AS [grantee_sid_hex],r.name AS [grantor_name],r.[type] AS [grantor_type],r.type_desc AS [grantor_type_desc],r.is_fixed_role AS [grantor_is_fixed_role],r.authentication_type AS [grantor_authentication_type],CONVERT(varchar(max),r.sid,2) AS [grantor_sid_hex] FROM sys.database_permissions p LEFT JOIN sys.database_principals g ON g.principal_id=p.grantee_principal_id LEFT JOIN sys.database_principals r ON r.principal_id=p.grantor_principal_id ORDER BY p.[class],p.major_id,p.minor_id,p.grantee_principal_id,p.grantor_principal_id,p.[type] COLLATE Latin1_General_100_BIN2,p.[state] COLLATE Latin1_General_100_BIN2 FOR JSON PATH, INCLUDE_NULL_VALUES`;
 const permissionsCheck=`SET @desktop_permissions_json=(${permissionsRows});
 IF @desktop_permissions_json IS NULL OR (SELECT COUNT_BIG(*) FROM sys.database_permissions)<>${PERMISSIONS_BASELINE.count}
  OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@desktop_permissions_json)),2),'') COLLATE Latin1_General_100_BIN2<>${unicodeLiteral(PERMISSIONS_BASELINE.sha256)}
  THROW 51995, 'DESKTOP_BOOTSTRAP_PERMISSIONS_BASELINE_REJECTED', 1;`;
 const executeBatches=schema.batches.map(({sql})=>`EXEC sys.sp_executesql ${unicodeLiteral(sql)};`).join('\n');
 // Compile marker access only after its CREATE TABLE batch has succeeded.
 // Otherwise SQL Server can resolve the not-yet-created table at outer-batch
 // compilation time, outside the intended DDL order and CATCH boundary.
 const markerSql=`INSERT dbo.desktop_empty_installation(id,environment_id,schema_version,actual_t1,external_operations,read_only)
VALUES(1,CONVERT(uniqueidentifier,${unicodeLiteral(DESKTOP_EMPTY_ENVIRONMENT_ID)}),1,0,0,1);
IF (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1
  AND environment_id=CONVERT(uniqueidentifier,${unicodeLiteral(DESKTOP_EMPTY_ENVIRONMENT_ID)})
  AND schema_version=1 AND actual_t1=0 AND external_operations=0 AND read_only=1)
 THROW 51995, 'DESKTOP_BOOTSTRAP_MARKER_REJECTED', 1;`;
 const sql=`SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
IF @@TRANCOUNT<>0 THROW 51995, 'DESKTOP_BOOTSTRAP_EXISTING_TRANSACTION', 1;
${guard}
DECLARE @desktop_expected_sid varbinary(85)=SUSER_SID(N'SEMIH\\Xaser');
IF @desktop_expected_sid IS NULL OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL
 OR SUSER_SID()<>@desktop_expected_sid OR SUSER_SID(ORIGINAL_LOGIN())<>@desktop_expected_sid
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 THROW 51995, 'DESKTOP_BOOTSTRAP_SETUP_PERMISSION', 1;
IF ISNULL(CONVERT(nvarchar(60),DATABASEPROPERTYEX(DB_NAME(),N'Updateability')),N'')<>N'READ_WRITE'
 THROW 51995, 'DESKTOP_BOOTSTRAP_DATABASE_NOT_WRITABLE', 1;
${environmentCheck}
DECLARE @desktop_permissions_json nvarchar(max);
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @desktop_bootstrap_lock int;
 EXEC @desktop_bootstrap_lock=sys.sp_getapplock @Resource=${unicodeLiteral(LOCK_RESOURCE)},@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @desktop_bootstrap_lock<0 THROW 51995, 'DESKTOP_BOOTSTRAP_LOCK_REJECTED', 1;
 ${recheck}
 IF SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL
  OR SUSER_SID()<>@desktop_expected_sid OR SUSER_SID(ORIGINAL_LOGIN())<>@desktop_expected_sid
  OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 THROW 51995, 'DESKTOP_BOOTSTRAP_SETUP_PERMISSION', 1;
 -- Refuse any previously created application object, custom principal or type.
 -- Server/system objects owned by SQL Server are not application data.
 IF EXISTS(SELECT 1 FROM sys.objects WHERE is_ms_shipped=0)
  OR EXISTS(SELECT 1 FROM sys.synonyms WHERE is_ms_shipped=0)
  OR EXISTS(SELECT 1 FROM sys.triggers WHERE parent_class=0 AND is_ms_shipped=0)
  OR EXISTS(SELECT 1 FROM sys.server_triggers WHERE is_ms_shipped=0)
  OR EXISTS(SELECT 1 FROM sys.types WHERE is_user_defined=1)
  OR EXISTS(SELECT 1 FROM sys.assemblies WHERE is_user_defined=1)
  OR EXISTS(SELECT 1 FROM sys.xml_schema_collections WHERE NOT(xml_collection_id=1 AND schema_id=4 AND name=N'sys'))
  OR EXISTS(SELECT 1 FROM sys.database_scoped_credentials)
  OR EXISTS(SELECT 1 FROM sys.external_data_sources)
  OR EXISTS(SELECT 1 FROM sys.external_file_formats)
  OR EXISTS(SELECT 1 FROM sys.partition_functions)
  OR EXISTS(SELECT 1 FROM sys.certificates)
  OR EXISTS(SELECT 1 FROM sys.asymmetric_keys)
  OR EXISTS(SELECT 1 FROM sys.symmetric_keys)
  OR EXISTS(SELECT 1 FROM sys.database_role_members)
  OR EXISTS(SELECT 1 FROM sys.schemas AS existing WHERE NOT EXISTS
   (SELECT 1 FROM (VALUES ${schemaValues}) AS builtin(name)
    WHERE CONVERT(varbinary(256),existing.name)=CONVERT(varbinary(256),builtin.name)))
  OR NOT EXISTS(SELECT 1 FROM sys.schemas WHERE name=N'dbo' AND principal_id=USER_ID(N'dbo'))
  OR EXISTS(SELECT 1 FROM sys.database_principals AS existing WHERE NOT EXISTS
   (SELECT 1 FROM (VALUES ${principalValues}) AS builtin(name)
    WHERE CONVERT(varbinary(256),existing.name)=CONVERT(varbinary(256),builtin.name)))
  THROW 51995, 'DESKTOP_BOOTSTRAP_TARGET_NOT_EMPTY_OR_ALREADY_APPLIED', 1;
 ${environmentCheck}
 ${permissionsCheck}
 ${executeBatches}
 -- Verify the complete expected user-table set before inserting the sole
 -- system marker; no customer, product, price, stock, or finance row is seeded.
 IF EXISTS(SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND SCHEMA_NAME(schema_id)=N'dbo'
   EXCEPT SELECT expected.name FROM (VALUES ${values}) AS expected(name))
  OR EXISTS(SELECT expected.name FROM (VALUES ${values}) AS expected(name)
   EXCEPT SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND SCHEMA_NAME(schema_id)=N'dbo')
  OR EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0 AND SCHEMA_NAME(schema_id)<>N'dbo')
  THROW 51995, 'DESKTOP_BOOTSTRAP_TABLE_SET_REJECTED', 1;
 EXEC sys.sp_executesql ${unicodeLiteral(markerSql)};
 ${environmentCheck}
 ${permissionsCheck}
 COMMIT TRANSACTION;
 SELECT N'DESKTOP_EMPTY_SCHEMA_APPLIED' AS outcome;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;`;
 return Object.freeze({scope:'desktop-empty-schema-bootstrap-offline-v1',server,database,
  environmentId:DESKTOP_EMPTY_ENVIRONMENT_ID,sourceSchemaSha256:sha256(JSON.stringify(schema)),
  sqlSha256:sha256(sql),batchCount:schema.batches.length,expectedTables,permissionsBaseline:PERMISSIONS_BASELINE,
  executionRequirements:DESKTOP_BOOTSTRAP_EXECUTION_REQUIREMENTS,sql});
}
