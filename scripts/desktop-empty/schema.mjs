// Source/offline only. This module creates neither a connection nor a database.
// It is the read-list foundation, not the writable ERP/sales profile.
import {createHash} from 'node:crypto';
import {compileEmptyLocalSchema,emptyLocalSchemaTargetGuard} from '../empty-local/schema.mjs';

export const DESKTOP_EMPTY_SERVER='Semih\\MELISAERP';
export const DESKTOP_EMPTY_DATABASE='MELISA_ERP_DESKTOP_TEST_20261105';
export const DESKTOP_EMPTY_ENVIRONMENT_ID='eb2888c2-51cb-4570-a933-397cf7e62806';

// Pin the entire previously reviewed compiler result, including batch order,
// complete SQL, migration fingerprints, extensions, and the old profile.
// The old compiler itself continues to reject every target except its own.
const REVIEWED_FOUNDATION_SHA256='6bc941efef220dd831a400cc86ef47ab5630f7477c61ea7d53ffaeb1d38554e0';
const sha256=value=>createHash('sha256').update(value,'utf8').digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};

export function desktopEmptyTargetGuard({server=DESKTOP_EMPTY_SERVER,database=DESKTOP_EMPTY_DATABASE}={}){
 if(server!==DESKTOP_EMPTY_SERVER||database!==DESKTOP_EMPTY_DATABASE)fail('DESKTOP_EMPTY_TARGET_REJECTED');
 // SQL Server character comparisons ignore trailing spaces, even with BIN2.
 // Binary comparison plus explicit NULL checks preserves the exact identity.
 return `DECLARE @desktop_empty_db nvarchar(128)=DB_NAME(), @desktop_empty_server nvarchar(128)=CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'));
IF @desktop_empty_db IS NULL OR @desktop_empty_server IS NULL
 OR CONVERT(varbinary(256),@desktop_empty_db)<>CONVERT(varbinary(256),N'${DESKTOP_EMPTY_DATABASE}')
 OR CONVERT(varbinary(256),@desktop_empty_server)<>CONVERT(varbinary(256),N'${DESKTOP_EMPTY_SERVER}')
 THROW 51994, 'DESKTOP_EMPTY_TARGET_REJECTED', 1;`;
}

// Separate marker: an eventual installer must create the matching reference
// row and prove the environment before it opens any application endpoint.
// No INSERT or seed is produced by this compiler.
const desktopMarker=`CREATE TABLE dbo.desktop_empty_installation (
 id tinyint NOT NULL CONSTRAINT PK_desktop_empty_installation PRIMARY KEY CONSTRAINT CK_desktop_empty_installation_id CHECK(id=1),
 environment_id uniqueidentifier NOT NULL CONSTRAINT UQ_desktop_empty_installation_environment UNIQUE CONSTRAINT CK_desktop_empty_installation_environment CHECK(environment_id='${DESKTOP_EMPTY_ENVIRONMENT_ID}'),
 schema_version int NOT NULL CONSTRAINT CK_desktop_empty_installation_version CHECK(schema_version=1),
 actual_t1 bit NOT NULL CONSTRAINT CK_desktop_empty_installation_t1 CHECK(actual_t1=0),
 external_operations bit NOT NULL CONSTRAINT CK_desktop_empty_installation_external CHECK(external_operations=0),
 read_only bit NOT NULL CONSTRAINT CK_desktop_empty_installation_readonly CHECK(read_only=1),
 created_at datetime2 NOT NULL CONSTRAINT DF_desktop_empty_installation_created DEFAULT SYSUTCDATETIME()
);`;

export function compileDesktopEmptySchema({server=DESKTOP_EMPTY_SERVER,database=DESKTOP_EMPTY_DATABASE,sources}={}){
 const guard=desktopEmptyTargetGuard({server,database});
 const foundation=sources===undefined?compileEmptyLocalSchema():compileEmptyLocalSchema({sources});
 if(sha256(JSON.stringify(foundation))!==REVIEWED_FOUNDATION_SHA256
   ||foundation.batches.length!==35
   ||foundation.batches.at(-1)?.source!=='empty-local-installation-marker-v1')fail('DESKTOP_EMPTY_FOUNDATION_REJECTED');
 const oldGuard=emptyLocalSchemaTargetGuard()+'\n';
 const batches=foundation.batches.slice(0,-1).map(({source,index,sql})=>{
  if(!sql.startsWith(oldGuard)||sql.indexOf(oldGuard,oldGuard.length)!==-1)fail('DESKTOP_EMPTY_FOUNDATION_GUARD_REJECTED');
  return Object.freeze({source,index,sql:guard+'\n'+sql.slice(oldGuard.length)});
 });
 batches.push(Object.freeze({source:'desktop-empty-installation-marker-v1',index:0,sql:guard+'\n'+desktopMarker}));
 return Object.freeze({scope:'desktop-empty-normal-auth-read-lists-v1',schemaVersion:1,
  server:DESKTOP_EMPTY_SERVER,database:DESKTOP_EMPTY_DATABASE,environmentId:DESKTOP_EMPTY_ENVIRONMENT_ID,
  foundationSha256:REVIEWED_FOUNDATION_SHA256,markerSha256:sha256(desktopMarker),
  sources:foundation.sources,batches:Object.freeze(batches)});
}
