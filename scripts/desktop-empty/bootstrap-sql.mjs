// Offline compiler only. Importing or calling this module never opens SQL,
// writes files, creates credentials, or authorizes execution.
import {createHash} from 'node:crypto';
import {
 DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_DATABASE,DESKTOP_EMPTY_ENVIRONMENT_ID,
 desktopEmptyTargetGuard,compileDesktopEmptySchema,
} from './schema.mjs';
import {compileDesktopNativeCatalogSchema,DESKTOP_NATIVE_CATALOG_REQUIREMENTS} from './native-catalog-schema.mjs';

const LOCK_RESOURCE='melisa-desktop-empty-schema-eb2888c2-51cb-4570-a933-397cf7e62806';
const SCHEMA_SHA256='430875068915660487e1a843865d1d0a0963dafd656e461d9c31ced25c5fd626';
const CATALOG_SHA256='945e3f250a040e27dfebe5fc6727f9ac22c908c3e3a5c52a4070dcc33e6372bb';
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
 'customer_movements','customers','desktop_empty_installation','party_currency_accounts',
 'party_entities','permissions','product_barcodes','product_images','product_prices','products','purchase_invoice_items',
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
const catalogTables=Object.freeze(['party_entities','party_currency_accounts','product_prices']);
const catalogCommon=Object.freeze([
 ['source_record_key','nvarchar(250)'],['migration_run_id','nvarchar(80)'],['source_payload_hash','char(64)'],
 ['source_payload_json','nvarchar(max)'],['source_document_key','nvarchar(250)'],['original_document_date','nvarchar(40)'],
].map(Object.freeze));
// These describe the emitted desktop proposal, not independent proof of every
// original native constraint. The native compiler's provenance limits remain.
const catalogColumns=Object.freeze({
 party_entities:Object.freeze([['role','nvarchar(20)'],['name','nvarchar(250)'],['identity_rule','nvarchar(100)'],['country','nvarchar(100)']].map(Object.freeze)),
 party_currency_accounts:Object.freeze([['party_entity_id','bigint'],['currency_code','nvarchar(3)'],['customer_id','bigint'],['supplier_id','bigint'],['current_balance','decimal(28,8)'],['balance_status','nvarchar(100)']].map(Object.freeze)),
 product_prices:Object.freeze([['product_id','bigint'],['price_type','nvarchar(20)'],['price_tier','int'],['currency_code','nvarchar(3)'],['price','decimal(28,8)'],['source_unit_id','int']].map(Object.freeze)),
});
const reject=code=>{throw Object.assign(new Error(code),{code});};
const sha256=value=>createHash('sha256').update(value,'utf8').digest('hex');
const sha256Utf16=value=>createHash('sha256').update(Buffer.from(value,'utf16le')).digest('hex').toUpperCase();
function assertOptions(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))reject('DESKTOP_BOOTSTRAP_OPTIONS_REJECTED');
 const allowed=['server','database','sources','catalogSources'],descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(value).some(key=>typeof key!=='string'||!allowed.includes(key)||!descriptors[key].enumerable
   ||!Object.hasOwn(descriptors[key],'value')||descriptors[key].value===undefined))reject('DESKTOP_BOOTSTRAP_OPTIONS_REJECTED');
}
const unicodeLiteral=value=>{
 if(typeof value!=='string'||value.includes('\0'))reject('DESKTOP_BOOTSTRAP_LITERAL_REJECTED');
 return "N'"+value.replaceAll("'","''")+"'";
};
function columnMetadata(type){
 if(type==='bigint')return ['bigint',8,19,0];
 if(type==='int')return ['int',4,10,0];
 if(type==='decimal(28,8)')return ['decimal',13,28,8];
 const match=/^(nvarchar|char)\((max|[1-9][0-9]*)\)$/.exec(type);
 if(!match||match[1]==='char'&&match[2]==='max')reject('DESKTOP_BOOTSTRAP_CATALOG_TYPE_REJECTED');
 return [match[1],match[2]==='max'?-1:Number(match[2])*(match[1]==='nvarchar'?2:1),0,0];
}
function expectedCatalogColumnRows(){
 return catalogTables.flatMap(table=>[['id','bigint'],...catalogColumns[table],...catalogCommon].map(([name,type],index)=>{
  const [typeName,maxLength,precision,scale]=columnMetadata(type);
  return `(${unicodeLiteral(table)},${index+1},${unicodeLiteral(name)},${unicodeLiteral(typeName)},${maxLength},${precision},${scale},${index===0?0:1},${index===0?1:0},0)`;
 })).join(',');
}

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

export function compileDesktopEmptyBootstrap(options={}){
 assertOptions(options);
 const server=Object.hasOwn(options,'server')?options.server:DESKTOP_EMPTY_SERVER;
 const database=Object.hasOwn(options,'database')?options.database:DESKTOP_EMPTY_DATABASE;
 // This function checks exact supplied target values before it creates any SQL.
 const guard=desktopEmptyTargetGuard({server,database});
 const schema=Object.hasOwn(options,'sources')?compileDesktopEmptySchema({server,database,sources:options.sources}):compileDesktopEmptySchema({server,database});
 const catalog=Object.hasOwn(options,'catalogSources')?compileDesktopNativeCatalogSchema({server,database,sources:options.catalogSources}):compileDesktopNativeCatalogSchema({server,database});
 const schemaJson=JSON.stringify(schema),catalogJson=JSON.stringify(catalog);
 const allBatches=[...schema.batches,...catalog.batches];
 const found=allBatches.flatMap(({sql})=>[...sql.matchAll(/CREATE TABLE dbo\.(?:\[([A-Za-z_][A-Za-z0-9_]*)\]|([A-Za-z_][A-Za-z0-9_]*))\s*\(/g)].map(match=>match[1]??match[2])).sort();
 if(schema.server!==DESKTOP_EMPTY_SERVER||schema.database!==DESKTOP_EMPTY_DATABASE
   ||schema.environmentId!==DESKTOP_EMPTY_ENVIRONMENT_ID||schema.batches.length!==35
   ||sha256(schemaJson)!==SCHEMA_SHA256||JSON.stringify(found)!==JSON.stringify(expectedTables))reject('DESKTOP_BOOTSTRAP_SCHEMA_REJECTED');
 if(catalog.scope!=='desktop-native-catalog-source-only-v1'||catalog.server!==server||catalog.database!==database
   ||catalog.batches.length!==6||catalog.requirements!==DESKTOP_NATIVE_CATALOG_REQUIREMENTS
   ||catalog.requirements.executionAuthorized!==false||catalog.requirements.commercialData!=='NONE'
   ||sha256(catalogJson)!==CATALOG_SHA256)reject('DESKTOP_BOOTSTRAP_CATALOG_REJECTED');
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
 const schemaUtf16Sha=sha256Utf16(schemaJson),catalogUtf16Sha=sha256Utf16(catalogJson);
 const sourceCheck=`IF @desktop_schema_json IS NULL OR @desktop_catalog_json IS NULL
 OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@desktop_schema_json)),2),'') COLLATE Latin1_General_100_BIN2<>${unicodeLiteral(schemaUtf16Sha)}
 OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@desktop_catalog_json)),2),'') COLLATE Latin1_General_100_BIN2<>${unicodeLiteral(catalogUtf16Sha)}
 OR (SELECT COUNT_BIG(*) FROM OPENJSON(@desktop_schema_json,'$.batches'))<>35
 OR (SELECT COUNT_BIG(*) FROM OPENJSON(@desktop_catalog_json,'$.batches'))<>6
 THROW 51995, 'DESKTOP_BOOTSTRAP_SOURCE_CHECKSUM_REJECTED', 1;`;
 const executeBatches=`DECLARE @desktop_batch_index int=0, @desktop_batch_sql nvarchar(max);
WHILE @desktop_batch_index<41
BEGIN
 SET @desktop_batch_sql=NULL;
 IF @desktop_batch_index<35
  SELECT @desktop_batch_sql=[batch_entry].[sql] FROM OPENJSON(@desktop_schema_json,'$.batches') AS [batch_json]
   CROSS APPLY OPENJSON([batch_json].[value]) WITH ([sql] nvarchar(max) '$.sql') AS [batch_entry]
   WHERE [batch_json].[key]=CONVERT(nvarchar(10),@desktop_batch_index);
 ELSE
  SELECT @desktop_batch_sql=[batch_entry].[sql] FROM OPENJSON(@desktop_catalog_json,'$.batches') AS [batch_json]
   CROSS APPLY OPENJSON([batch_json].[value]) WITH ([sql] nvarchar(max) '$.sql') AS [batch_entry]
   WHERE [batch_json].[key]=CONVERT(nvarchar(10),@desktop_batch_index-35);
 IF @desktop_batch_sql IS NULL OR DATALENGTH(@desktop_batch_sql)=0
  THROW 51995, 'DESKTOP_BOOTSTRAP_BATCH_MISSING', 1;
 EXEC sys.sp_executesql @desktop_batch_sql;
 SET @desktop_batch_index+=1;
END;`;
 const catalogNames=catalogTables.map(unicodeLiteral).join(',');
 const catalogIndexes=catalogTables.map(name=>`(${unicodeLiteral(name)},${unicodeLiteral('UX_'+name+'_source_record')})`).join(',');
 const catalogMetadataCheck=`DECLARE @desktop_expected_columns TABLE(table_name sysname,column_id int,column_name sysname,type_name sysname,max_length int,numeric_precision int,numeric_scale int,is_nullable int,is_identity int,default_object_id int,PRIMARY KEY(table_name,column_id));
 INSERT @desktop_expected_columns VALUES ${expectedCatalogColumnRows()};
 IF EXISTS(SELECT CONVERT(varbinary(256),table_name),column_id,CONVERT(varbinary(256),column_name),CONVERT(varbinary(256),type_name),max_length,numeric_precision,numeric_scale,is_nullable,is_identity,default_object_id FROM @desktop_expected_columns
   EXCEPT SELECT CONVERT(varbinary(256),t.name),c.column_id,CONVERT(varbinary(256),c.name),CONVERT(varbinary(256),ty.name),CONVERT(int,c.max_length),CONVERT(int,c.precision),CONVERT(int,c.scale),CONVERT(int,c.is_nullable),CONVERT(int,c.is_identity),c.default_object_id
    FROM sys.tables t JOIN sys.schemas sc ON sc.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
    WHERE sc.name=N'dbo' AND t.name IN(${catalogNames}))
  OR EXISTS(SELECT CONVERT(varbinary(256),t.name),c.column_id,CONVERT(varbinary(256),c.name),CONVERT(varbinary(256),ty.name),CONVERT(int,c.max_length),CONVERT(int,c.precision),CONVERT(int,c.scale),CONVERT(int,c.is_nullable),CONVERT(int,c.is_identity),c.default_object_id
    FROM sys.tables t JOIN sys.schemas sc ON sc.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
    WHERE sc.name=N'dbo' AND t.name IN(${catalogNames})
   EXCEPT SELECT CONVERT(varbinary(256),table_name),column_id,CONVERT(varbinary(256),column_name),CONVERT(varbinary(256),type_name),max_length,numeric_precision,numeric_scale,is_nullable,is_identity,default_object_id FROM @desktop_expected_columns)
  THROW 51995, 'DESKTOP_BOOTSTRAP_CATALOG_COLUMNS_REJECTED', 1;
 DECLARE @desktop_expected_indexes TABLE(table_name sysname,index_name sysname,PRIMARY KEY(table_name,index_name));
 INSERT @desktop_expected_indexes VALUES ${catalogIndexes};
 IF EXISTS(SELECT 1 FROM @desktop_expected_indexes e WHERE NOT EXISTS(
   SELECT 1 FROM sys.tables t JOIN sys.schemas sc ON sc.schema_id=t.schema_id JOIN sys.indexes i ON i.object_id=t.object_id
   WHERE CONVERT(varbinary(256),sc.name)=CONVERT(varbinary(256),N'dbo') AND CONVERT(varbinary(256),t.name)=CONVERT(varbinary(256),e.table_name)
    AND CONVERT(varbinary(256),i.name)=CONVERT(varbinary(256),e.index_name) AND i.is_unique=1 AND i.is_primary_key=0
    AND i.type=2 AND i.is_disabled=0 AND i.has_filter=1
    AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(i.filter_definition,N'[',N''),N']',N''),N'(',N''),N')',N''),N' ',N''),NCHAR(9),N''),NCHAR(10),N''),NCHAR(13),N'') COLLATE Latin1_General_100_CI_AS) COLLATE Latin1_General_100_BIN2=N'SOURCE_RECORD_KEYISNOTNULL'
    AND (SELECT COUNT_BIG(*) FROM sys.index_columns ic WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id)=1
    AND EXISTS(SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
     WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal=1 AND ic.is_included_column=0
      AND CONVERT(varbinary(256),c.name)=CONVERT(varbinary(256),N'source_record_key'))))
  OR EXISTS(SELECT 1 FROM sys.tables t JOIN sys.schemas sc ON sc.schema_id=t.schema_id JOIN sys.indexes i ON i.object_id=t.object_id
   WHERE sc.name=N'dbo' AND t.name IN(${catalogNames}) AND i.index_id>0 AND i.is_primary_key=0
    AND NOT EXISTS(SELECT 1 FROM @desktop_expected_indexes e WHERE CONVERT(varbinary(256),e.table_name)=CONVERT(varbinary(256),t.name)
     AND CONVERT(varbinary(256),e.index_name)=CONVERT(varbinary(256),i.name)))
  OR EXISTS(SELECT 1 FROM sys.tables t JOIN sys.schemas sc ON sc.schema_id=t.schema_id
   WHERE sc.name=N'dbo' AND t.name IN(${catalogNames}) AND NOT EXISTS(
    SELECT 1 FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
    JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
    WHERE i.object_id=t.object_id AND i.is_primary_key=1 AND i.is_unique=1 AND i.is_disabled=0 AND i.type=1
     AND ic.key_ordinal=1 AND ic.is_included_column=0 AND CONVERT(varbinary(256),c.name)=CONVERT(varbinary(256),N'id')
     AND (SELECT COUNT_BIG(*) FROM sys.index_columns allc WHERE allc.object_id=i.object_id AND allc.index_id=i.index_id)=1))
  OR EXISTS(SELECT 1 FROM sys.foreign_keys fk JOIN sys.tables t ON t.object_id=fk.parent_object_id
   JOIN sys.schemas sc ON sc.schema_id=t.schema_id WHERE sc.name=N'dbo' AND t.name IN(${catalogNames}))
  OR EXISTS(SELECT 1 FROM sys.check_constraints ck JOIN sys.tables t ON t.object_id=ck.parent_object_id
   JOIN sys.schemas sc ON sc.schema_id=t.schema_id WHERE sc.name=N'dbo' AND t.name IN(${catalogNames}))
  THROW 51995, 'DESKTOP_BOOTSTRAP_CATALOG_INDEXES_REJECTED', 1;`;
 const noCommercialDataSql=`IF ${expectedTables.filter(name=>name!=='desktop_empty_installation').map(name=>`EXISTS(SELECT 1 FROM dbo.[${name}])`).join(' OR ')}
 THROW 51995, 'DESKTOP_BOOTSTRAP_COMMERCIAL_DATA_REJECTED', 1;`;
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
DECLARE @desktop_schema_json nvarchar(max)=${unicodeLiteral(schemaJson)};
DECLARE @desktop_catalog_json nvarchar(max)=${unicodeLiteral(catalogJson)};
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
  -- The verified empty target has exactly one built-in db_owner -> dbo membership.
  OR (SELECT COUNT_BIG(*) FROM sys.database_role_members)<>1
  OR NOT EXISTS(SELECT 1 FROM sys.database_role_members AS membership
   JOIN sys.database_principals AS role_principal ON role_principal.principal_id=membership.role_principal_id
   JOIN sys.database_principals AS member_principal ON member_principal.principal_id=membership.member_principal_id
   WHERE membership.role_principal_id=16384 AND membership.member_principal_id=1
    AND CONVERT(varbinary(256),role_principal.name)=CONVERT(varbinary(256),N'db_owner')
    AND role_principal.type='R' AND role_principal.is_fixed_role=1
    AND CONVERT(varbinary(256),member_principal.name)=CONVERT(varbinary(256),N'dbo')
    AND member_principal.type='U' AND member_principal.is_fixed_role=0)
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
 ${sourceCheck}
 ${executeBatches}
 -- Verify the complete expected user-table set before inserting the sole
 -- system marker; no customer, product, price, stock, or finance row is seeded.
 IF EXISTS(SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND SCHEMA_NAME(schema_id)=N'dbo'
   EXCEPT SELECT expected.name FROM (VALUES ${values}) AS expected(name))
  OR EXISTS(SELECT expected.name FROM (VALUES ${values}) AS expected(name)
   EXCEPT SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND SCHEMA_NAME(schema_id)=N'dbo')
  OR EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0 AND SCHEMA_NAME(schema_id)<>N'dbo')
  THROW 51995, 'DESKTOP_BOOTSTRAP_TABLE_SET_REJECTED', 1;
 ${catalogMetadataCheck}
 EXEC sys.sp_executesql ${unicodeLiteral(markerSql)};
 EXEC sys.sp_executesql ${unicodeLiteral(noCommercialDataSql)};
 ${environmentCheck}
 ${permissionsCheck}
 ${sourceCheck}
 COMMIT TRANSACTION;
 SELECT N'DESKTOP_EMPTY_SCHEMA_APPLIED' AS outcome;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;`;
 return Object.freeze({scope:'desktop-empty-schema-bootstrap-offline-v1',server,database,
  environmentId:DESKTOP_EMPTY_ENVIRONMENT_ID,sourceSchemaSha256:SCHEMA_SHA256,sourceCatalogSha256:CATALOG_SHA256,
  sourceSchemaUtf16Sha256:schemaUtf16Sha,sourceCatalogUtf16Sha256:catalogUtf16Sha,
  catalogRequirements:catalog.requirements,catalogSourceHashes:catalog.sourceHashes,
  sqlSha256:sha256(sql),batchCount:allBatches.length,expectedTables,permissionsBaseline:PERMISSIONS_BASELINE,
  executionRequirements:DESKTOP_BOOTSTRAP_EXECUTION_REQUIREMENTS,sql});
}
