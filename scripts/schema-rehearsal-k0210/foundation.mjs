// Source preview only. It does not create or connect to a database.
import {createHash} from 'node:crypto';
import {compileDesktopEmptySchema,desktopEmptyTargetGuard} from '../desktop-empty/schema.mjs';
import {compileDesktopNativeCatalogSchema} from '../desktop-empty/native-catalog-schema.mjs';
import {LOCAL_MASTER_BASE_TABLES,LOCAL_MASTER_BASELINE_SNAPSHOT_SQL,LOCAL_MASTER_CONCURRENCY_GUARD} from '../desktop-empty/local-master-schema-proposal.mjs';
import {REHEARSAL_SERVER,REHEARSAL_DATABASE,validateRehearsalIdentity} from './identity.mjs';
const hash=x=>createHash('sha256').update(x,'utf8').digest('hex');
if(hash(JSON.stringify(LOCAL_MASTER_BASE_TABLES))!=='698380437c256c434b82d3440819b50cb31909f80ab1fbaf33ad92ee9ff6dd77'||hash(LOCAL_MASTER_BASELINE_SNAPSHOT_SQL)!=='e05ace7359016a36583fba72b72ec7432866b668fe5026a14e5eeedb7cd2a9e1'||hash(LOCAL_MASTER_CONCURRENCY_GUARD)!=='939d8cd2137f6c37ffeeb0a59e4585b9a855a026b8722774beca66bb17bf2992')throw Error('K0210_SOURCE_PIN_REJECTED');
const sourcePins=Object.freeze({foundation:'430875068915660487e1a843865d1d0a0963dafd656e461d9c31ced25c5fd626',catalog:'945e3f250a040e27dfebe5fc6727f9ac22c908c3e3a5c52a4070dcc33e6372bb',legacyGuard:'11430b7be2db34490d3a8ac1732b658d29bfab07903e91cc14ded3bbcd1c3727'});
const fail=()=>{throw Error('K0210_FOUNDATION_SOURCE_REJECTED');};
const q=s=>`N'${s.replaceAll("'","''")}'`;
// HOST_ID can be caller-supplied; an eventual executor must independently pin
// the real process/handle and session. This predicate alone is not authority.
export function rehearsalTargetGuard(identity){
 const m=validateRehearsalIdentity(identity);
 return `IF DB_ID() IS NULL OR DB_NAME() IS NULL OR SERVERPROPERTY('ProcessID') IS NULL OR SERVERPROPERTY('ServerName') IS NULL OR DB_ID()<>${m.databaseId} OR CONVERT(int,SERVERPROPERTY('ProcessID'))<>${m.sqlProcessId}
 OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),${q(REHEARSAL_DATABASE)}) OR DATALENGTH(DB_NAME())<>DATALENGTH(${q(REHEARSAL_DATABASE)})
 OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),${q(REHEARSAL_SERVER)}) OR DATALENGTH(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>DATALENGTH(${q(REHEARSAL_SERVER)})
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid=CONVERT(uniqueidentifier,${q(m.databaseGuid)}))
 OR NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=DB_ID() AND CONVERT(varbinary(23),CONVERT(char(19),create_date,126)+'.'+RIGHT('000'+CONVERT(varchar(3),DATEPART(millisecond,create_date)),3))=CONVERT(varbinary(23),CONVERT(varchar(23),${q(m.databaseCreateTime)})))
 OR NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=DB_ID() AND state_desc=N'ONLINE' AND user_access_desc=N'RESTRICTED_USER' AND compatibility_level=160 AND is_trustworthy_on=0 AND is_db_chaining_on=0 AND is_auto_close_on=0 AND is_auto_shrink_on=0 AND is_read_only=0 AND owner_sid=${m.adminSid} AND CONVERT(varbinary(256),collation_name)=CONVERT(varbinary(256),N'Turkish_CI_AS') AND DATALENGTH(collation_name)=DATALENGTH(N'Turkish_CI_AS'))
 OR (SELECT COUNT(*) FROM sys.database_files)<>2
 OR NOT EXISTS(SELECT 1 FROM sys.database_files WHERE file_id=1 AND type=0 AND name=N'MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210_data' AND CONVERT(varbinary(520),physical_name)=CONVERT(varbinary(520),N'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.MELISAERP\\MSSQL\\DATA\\MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210.mdf') AND size>=8192 AND max_size=65536 AND growth=4096 AND is_percent_growth=0)
 OR NOT EXISTS(SELECT 1 FROM sys.database_files WHERE file_id=2 AND type=1 AND name=N'MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210_log' AND CONVERT(varbinary(520),physical_name)=CONVERT(varbinary(520),N'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.MELISAERP\\MSSQL\\DATA\\MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210_log.ldf') AND size>=4096 AND max_size=32768 AND growth=4096 AND is_percent_growth=0)
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR SUSER_SID()<>${m.adminSid} OR SUSER_SID(ORIGINAL_LOGIN())<>${m.adminSid} OR SUSER_SID(N'SEMIH\\Xaser')<>${m.adminSid}
 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\\Xaser') IS NULL OR TRY_CONVERT(int,HOST_ID())<>${m.adminPid} OR TRY_CONVERT(int,HOST_ID()) IS NULL
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory' THROW 51995,'K0210_TARGET_REJECTED',1;`;
}
function unguard(batch,guard){
 const prefix=guard+'\n';if(!batch.sql.startsWith(prefix)||batch.sql.indexOf(prefix,prefix.length)!==-1)fail();
 const body=batch.sql.slice(prefix.length);
 if(!/^(?:CREATE TABLE dbo\.|CREATE (?:UNIQUE )?INDEX |IF (?:OBJECT_ID|COL_LENGTH)\()/i.test(body.trim())||/\bUSE\s+|MELISA_ERP_DESKTOP_TEST_20261105|eb2888c2-51cb-4570-a933-397cf7e62806/i.test(body))fail();
 return body;
}
function foundationBodies(identity){
 const m=validateRehearsalIdentity(identity),foundation=compileDesktopEmptySchema(),catalog=compileDesktopNativeCatalogSchema(),legacy=desktopEmptyTargetGuard();
 if(hash(JSON.stringify(foundation))!==sourcePins.foundation||hash(JSON.stringify(catalog))!==sourcePins.catalog||hash(legacy)!==sourcePins.legacyGuard||foundation.batches.length!==35||catalog.batches.length!==6||foundation.batches.at(-1).source!=='desktop-empty-installation-marker-v1')fail();
 const raw=[...foundation.batches.slice(0,-1),...catalog.batches].map(b=>unguard(b,legacy));
 const marker=`CREATE TABLE dbo.desktop_empty_installation (
 id tinyint NOT NULL CONSTRAINT PK_desktop_empty_installation PRIMARY KEY CONSTRAINT CK_desktop_empty_installation_id CHECK(id=1),
 environment_id uniqueidentifier NOT NULL CONSTRAINT UQ_desktop_empty_installation_environment UNIQUE CONSTRAINT CK_desktop_empty_installation_environment CHECK(environment_id='${m.environmentId}'),
 schema_version int NOT NULL CONSTRAINT CK_desktop_empty_installation_version CHECK(schema_version=1),
 actual_t1 bit NOT NULL CONSTRAINT CK_desktop_empty_installation_t1 CHECK(actual_t1=0),
 external_operations bit NOT NULL CONSTRAINT CK_desktop_empty_installation_external CHECK(external_operations=0),
 read_only bit NOT NULL CONSTRAINT CK_desktop_empty_installation_readonly CHECK(read_only=1),
 created_at datetime2 NOT NULL CONSTRAINT DF_desktop_empty_installation_created DEFAULT SYSUTCDATETIME());`;
 const bodies=[...raw,marker];const found=bodies.flatMap(body=>[...body.matchAll(/CREATE TABLE dbo\.(?:\[([A-Za-z_][A-Za-z0-9_]*)\]|([A-Za-z_][A-Za-z0-9_]*))\s*\(/g)].map(x=>x[1]??x[2])).sort();if(JSON.stringify(found)!==JSON.stringify([...LOCAL_MASTER_BASE_TABLES].sort()))fail();return {m,bodies};
}
export function compileRehearsalFoundation(identity){
 const {m,bodies}=foundationBodies(identity),guard=rehearsalTargetGuard(m);
 return Object.freeze({kind:'K0210_FOUNDATION_SOURCE_INVENTORY',executionAuthorized:false,sqlTested:false,requiresIndependentProcessIdentity:true,requiresNewBaseline:true,identity:m,sourcePins,targetGuardSha256:hash(guard),bodies:Object.freeze(bodies.map((body,index)=>Object.freeze({index,sha256:hash(body),tableNames:Object.freeze([...body.matchAll(/CREATE TABLE dbo\.(?:\[([A-Za-z_][A-Za-z0-9_]*)\]|([A-Za-z_][A-Za-z0-9_]*))\s*\(/g)].map(x=>x[1]??x[2]))})))});
}
const principals=['public','dbo','guest','INFORMATION_SCHEMA','sys','db_owner','db_accessadmin','db_securityadmin','db_ddladmin','db_backupoperator','db_datareader','db_datawriter','db_denydatareader','db_denydatawriter'];
const coldSecurity=`DECLARE @coldSecurity nvarchar(max)=(SELECT JSON_QUERY((SELECT principal_id,name,type,sid,authentication_type,default_schema_name,owning_principal_id,is_fixed_role FROM sys.database_principals ORDER BY principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)) principals,JSON_QUERY((SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH,INCLUDE_NULL_VALUES)) members,JSON_QUERY((SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FOR JSON PATH,INCLUDE_NULL_VALUES)) permissions FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES); IF @coldSecurity IS NULL THROW 51995,'K0210_EMPTY_SECURITY_MISSING',1;`;
function coldPreamble(m){return `SET NOCOUNT ON; SET XACT_ABORT ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET QUOTED_IDENTIFIER ON; SET NUMERIC_ROUNDABORT OFF;
IF @@TRANCOUNT<>0 OR (@@OPTIONS&2)<>0 THROW 51995,'K0210_EXISTING_TRANSACTION',1;
${rehearsalTargetGuard(m)}
BEGIN TRY BEGIN TRANSACTION; DECLARE @owner int; EXEC @owner=sys.sp_getapplock @Resource=N'melisa-k0210-rehearsal-${m.environmentId}',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0; IF @owner<0 THROW 51995,'K0210_LOCK_REJECTED',1;
${LOCAL_MASTER_CONCURRENCY_GUARD}
IF NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=DB_ID() AND user_access_desc=N'RESTRICTED_USER' AND compatibility_level=160) OR EXISTS(SELECT 1 FROM sys.objects WHERE is_ms_shipped=0) OR EXISTS(SELECT 1 FROM sys.synonyms) OR EXISTS(SELECT 1 FROM sys.types WHERE is_user_defined=1) OR EXISTS(SELECT 1 FROM sys.database_principals WHERE name NOT IN(${principals.map(q).join(',')})) OR EXISTS(SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id=DATABASE_PRINCIPAL_ID(N'guest') AND permission_name=N'CONNECT' AND state IN(N'G',N'W')) THROW 51995,'K0210_EMPTY_DATABASE_REJECTED',1;
${LOCAL_MASTER_BASELINE_SNAPSHOT_SQL}\n${coldSecurity}
DECLARE @coldMetadataHash varchar(64)=LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@local_master_manifest)),2)),@coldSecurityHash varchar(64)=LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@coldSecurity)),2));`;}
export function compileRehearsalEmptyObserver(identity){const m=validateRehearsalIdentity(identity),sql=`${coldPreamble(m)}\nSELECT N'K0210_EMPTY_OBSERVED' state,@coldMetadataHash metadataSha256,@coldSecurityHash securitySha256; COMMIT TRANSACTION; END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;`;return Object.freeze({kind:'K0210_EMPTY_OBSERVER_PREVIEW',sql,sha256:hash(sql),identity:m,identitySha256:hash(JSON.stringify(m)),executionAuthorized:false,sqlTested:false,requiresSeparateProcess:true,requiresOsProcessBirthReceipt:true});}
export function compileRehearsalBootstrap(identity,emptyBaseline){
 const {m,bodies}=foundationBodies(identity);if(!emptyBaseline||Object.getPrototypeOf(emptyBaseline)!==Object.prototype||Reflect.ownKeys(emptyBaseline).length!==2)fail();const d=Object.getOwnPropertyDescriptors(emptyBaseline);if(Reflect.ownKeys(emptyBaseline).some(k=>typeof k!=='string'||!['metadataSha256','securitySha256'].includes(k)||!d[k].enumerable||!Object.hasOwn(d[k],'value')||typeof d[k].value!=='string'||!/^[a-f0-9]{64}$/.test(d[k].value)))fail();
 const sql=`${coldPreamble(m)}\nIF @coldMetadataHash<>${q(d.metadataSha256.value)} OR @coldSecurityHash<>${q(d.securitySha256.value)} THROW 51995,'K0210_EMPTY_BASELINE_CHANGED',1;
${bodies.map(x=>`EXEC sys.sp_executesql ${q(x)};`).join('\n')}
INSERT dbo.desktop_empty_installation(id,environment_id,schema_version,actual_t1,external_operations,read_only) VALUES(1,CONVERT(uniqueidentifier,${q(m.environmentId)}),1,0,0,1);
IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>27 OR ${LOCAL_MASTER_BASE_TABLES.map(n=>`OBJECT_ID(${q('dbo.'+n)},N'U') IS NULL`).join(' OR ')} OR ${LOCAL_MASTER_BASE_TABLES.filter(n=>n!=='desktop_empty_installation').map(n=>`EXISTS(SELECT 1 FROM dbo.[${n}])`).join(' OR ')} THROW 51995,'K0210_FOUNDATION_RESULT_REJECTED',1;
DECLARE @securityAfter nvarchar(max); EXEC sys.sp_executesql ${q(coldSecurity+' SET @out=@coldSecurity;')},N'@out nvarchar(max) OUTPUT',@out=@securityAfter OUTPUT; IF @securityAfter IS NULL OR HASHBYTES('SHA2_256',CONVERT(varbinary(max),@securityAfter))<>HASHBYTES('SHA2_256',CONVERT(varbinary(max),@coldSecurity)) THROW 51995,'K0210_BOOTSTRAP_SECURITY_CHANGED',1;
${LOCAL_MASTER_CONCURRENCY_GUARD}
IF @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51995,'K0210_TRANSACTION_REJECTED',1; COMMIT TRANSACTION; SELECT N'K0210_FOUNDATION_CREATED' state; END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;`;
 return Object.freeze({kind:'K0210_BOOTSTRAP_SOURCE_PREVIEW',sql,sha256:hash(sql),identity:m,identitySha256:hash(JSON.stringify(m)),executionAuthorized:false,sqlTested:false,requiresSeparateProcess:true,requiresOsProcessBirthReceipt:true,requiresReviewedEmptyBaseline:true});
}
