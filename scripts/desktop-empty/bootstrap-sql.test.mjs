import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileDesktopEmptySchema,DESKTOP_EMPTY_DATABASE,DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_ENVIRONMENT_ID} from './schema.mjs';
import {readEmptyLocalSchemaSources} from '../empty-local/schema.mjs';
import {compileDesktopEmptyBootstrap,DESKTOP_BOOTSTRAP_EXECUTION_REQUIREMENTS} from './bootstrap-sql.mjs';

test('each of the 35 verified DDL batches runs in a distinct dynamic SQL scope inside one transaction',()=>{
 const schema=compileDesktopEmptySchema(),result=compileDesktopEmptyBootstrap(),sql=result.sql;
 const parts=[...sql.matchAll(/EXEC sys\.sp_executesql N'((?:''|[^'])*)';/g)].map(match=>match[1].replaceAll("''","'"));
 assert.equal(parts.length,36);
 assert.deepEqual(parts.slice(0,35),schema.batches.map(batch=>batch.sql));
 assert.match(parts[35],/^INSERT dbo\.desktop_empty_installation\(/);
 assert.match(parts[35],/DESKTOP_BOOTSTRAP_MARKER_REJECTED/);
 assert.equal(result.batchCount,35);
 assert.equal(result.expectedTables.length,24);
 assert.equal(result.sqlSha256,createHash('sha256').update(sql,'utf8').digest('hex'));
 assert.equal(result.sourceSchemaSha256,createHash('sha256').update(JSON.stringify(schema),'utf8').digest('hex'));
 assert.equal((sql.match(/\bBEGIN TRANSACTION;/g)||[]).length,1);
 assert.equal((sql.match(/\bCOMMIT TRANSACTION;/g)||[]).length,1);
 assert.ok(sql.indexOf('BEGIN TRANSACTION;')<sql.indexOf('sys.sp_getapplock'));
 assert.ok(sql.indexOf('sys.sp_getapplock')<sql.indexOf('DESKTOP_BOOTSTRAP_TARGET_NOT_EMPTY_OR_ALREADY_APPLIED'));
 assert.ok(sql.indexOf('DESKTOP_BOOTSTRAP_TARGET_NOT_EMPTY_OR_ALREADY_APPLIED')<sql.indexOf('EXEC sys.sp_executesql'));
 assert.ok(sql.lastIndexOf('EXEC sys.sp_executesql')<sql.indexOf('INSERT dbo.desktop_empty_installation'));
 assert.ok(sql.indexOf('INSERT dbo.desktop_empty_installation')<sql.indexOf('COMMIT TRANSACTION;'));
 assert.match(sql,/BEGIN CATCH\s+IF XACT_STATE\(\)<>0 ROLLBACK TRANSACTION;\s+THROW;\s+END CATCH;/);
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.expectedTables));
});

test('before any effect exact target, standalone session, administrator and writable database are mandatory',()=>{
 const sql=compileDesktopEmptyBootstrap().sql;
 for(const input of [{server:'Semih\\MELISADEV'},{server:'Semih\\MELISAERP '},{server:null},
  {database:'master'},{database:'MELISA_ERP_EMPTY_TEST_20261105'},
  {database:DESKTOP_EMPTY_DATABASE.toLowerCase()},{database:null}]){
  assert.throws(()=>compileDesktopEmptyBootstrap(input),/DESKTOP_EMPTY_TARGET_REJECTED/);
 }
 assert.ok(sql.indexOf('DESKTOP_EMPTY_TARGET_REJECTED')<sql.indexOf('BEGIN TRANSACTION;'));
 assert.ok(sql.indexOf('DESKTOP_BOOTSTRAP_SETUP_PERMISSION')<sql.indexOf('BEGIN TRANSACTION;'));
 assert.match(sql,/IF @@TRANCOUNT<>0 THROW 51995, 'DESKTOP_BOOTSTRAP_EXISTING_TRANSACTION'/);
 assert.match(sql,/ISNULL\(IS_SRVROLEMEMBER\(N'sysadmin'\),0\)<>1/);
 assert.match(sql,/SUSER_SID\(N'SEMIH\\Xaser'\)/);
 assert.match(sql,/SUSER_SID\(\)<>@desktop_expected_sid OR SUSER_SID\(ORIGINAL_LOGIN\(\)\)<>@desktop_expected_sid/);
 assert.match(sql,/DATABASEPROPERTYEX\(DB_NAME\(\),N'Updateability'\)/);
 assert.match(sql,/SET XACT_ABORT ON/);
 assert.match(sql,/@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0/);
 assert.match(sql,/IF @desktop_bootstrap_lock<0 THROW/);
 assert.match(sql,/SELECT @desktop_empty_db=DB_NAME\(\)/);
 assert.match(sql,/CONVERT\(varbinary\(256\),@desktop_empty_server\)/);
});

test('a nonempty or previously applied database is rejected and no commercial records are seeded',()=>{
 const {sql}=compileDesktopEmptyBootstrap();
 for(const catalog of ['sys.objects','sys.synonyms','sys.triggers','sys.server_triggers','sys.types','sys.assemblies',
  'sys.xml_schema_collections','sys.database_scoped_credentials','sys.external_data_sources','sys.external_file_formats',
  'sys.partition_functions','sys.certificates','sys.asymmetric_keys','sys.symmetric_keys','sys.database_role_members',
  'sys.schemas','sys.database_principals']){
  assert.ok(sql.indexOf(catalog)<sql.indexOf('DESKTOP_BOOTSTRAP_TARGET_NOT_EMPTY_OR_ALREADY_APPLIED'));
 }
 assert.match(sql,/existing\.name\)=CONVERT\(varbinary\(256\),builtin\.name\)/);
 assert.match(sql,/DESKTOP_BOOTSTRAP_TABLE_SET_REJECTED/);
 const inserts=[...sql.matchAll(/\bINSERT\s+(?:INTO\s+)?dbo\.([a-z_]+)/gi)].map(match=>match[1]);
 assert.deepEqual(inserts,['desktop_empty_installation']);
 assert.match(sql,new RegExp(DESKTOP_EMPTY_ENVIRONMENT_ID));
 assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|MERGE|DELETE|UPDATE|BACKUP|RESTORE)\s+(?:DATABASE|TABLE|dbo\.)/i);
 assert.doesNotMatch(sql,/\bCREATE\s+(?:DATABASE|LOGIN|USER)\b/i);
});

test('unknown outcome and any dispatch require a durable external fence, never a fresh retry assertion',()=>{
 const result=compileDesktopEmptyBootstrap();
 assert.equal(result.executionRequirements,DESKTOP_BOOTSTRAP_EXECUTION_REQUIREMENTS);
 assert.equal(result.executionRequirements.executionAuthorized,false);
 assert.equal(result.executionRequirements.requiresReviewedExecutor,true);
 assert.equal(result.executionRequirements.requiresDurableSingleUseAttemptFence,true);
 assert.equal(result.executionRequirements.requiresExclusiveTargetOwnership,true);
 assert.equal(result.executionRequirements.retryAfterDispatch,'REJECT_UNTIL_INDEPENDENT_OUTCOME_RESOLUTION');
 assert.ok(Object.isFrozen(result.executionRequirements));
 assert.deepEqual(compileDesktopEmptyBootstrap(),result);
});

test('a changed upstream source cannot be recompiled into bootstrap SQL',()=>{
 const sources=readEmptyLocalSchemaSources(),first=Object.keys(sources)[0];
 assert.throws(()=>compileDesktopEmptyBootstrap({sources:{...sources,[first]:sources[first]+"\nINSERT dbo.products(id) VALUES(1);"}}),/EMPTY_LOCAL_SCHEMA_SOURCE_HASH_REJECTED/);
 const missing={...sources};delete missing[first];
 assert.throws(()=>compileDesktopEmptyBootstrap({sources:missing}),/EMPTY_LOCAL_SCHEMA_ALLOWLIST_REJECTED/);
});

test('permissions baseline pins every catalog field and both principals before DDL and commit',()=>{
 const {sql,permissionsBaseline}=compileDesktopEmptyBootstrap();
 assert.deepEqual(permissionsBaseline,{count:220,sha256:'D17EA3A14B33F2089EEDAD8AF381DC1A2000F9D87933C0EE00C79D7C2276A3D1',productVersion:'16.0.1000.6',compatibility:160,collation:'Turkish_CI_AS'});
 assert.ok(Object.isFrozen(permissionsBaseline));
 const queries=[...sql.matchAll(/SET @desktop_permissions_json=\((SELECT .*?FOR JSON PATH, INCLUDE_NULL_VALUES)\);/gs)].map(match=>match[1]);
 assert.equal(queries.length,2);
 assert.equal(queries[0],queries[1]);
 const fields=['class','class_desc','major_id','minor_id','grantee_principal_id','grantor_principal_id','type','permission_name','state','state_desc','grantee_name','grantee_type','grantee_type_desc','grantee_is_fixed_role','grantee_authentication_type','grantee_sid_hex','grantor_name','grantor_type','grantor_type_desc','grantor_is_fixed_role','grantor_authentication_type','grantor_sid_hex'];
 const aliases=[...queries[0].matchAll(/\bAS \[([^\]]+)\]/g)].map(match=>match[1]);
 assert.deepEqual(aliases,fields);
 assert.match(queries[0],/LEFT JOIN sys\.database_principals g ON g\.principal_id=p\.grantee_principal_id/);
 assert.match(queries[0],/LEFT JOIN sys\.database_principals r ON r\.principal_id=p\.grantor_principal_id/);
 assert.match(queries[0],/CONVERT\(varchar\(max\),g\.sid,2\) AS \[grantee_sid_hex\]/);
 assert.match(queries[0],/CONVERT\(varchar\(max\),r\.sid,2\) AS \[grantor_sid_hex\]/);
 assert.match(queries[0],/ORDER BY p\.\[class\],p\.major_id,p\.minor_id,p\.grantee_principal_id,p\.grantor_principal_id,p\.\[type\] COLLATE Latin1_General_100_BIN2,p\.\[state\] COLLATE Latin1_General_100_BIN2 FOR JSON PATH, INCLUDE_NULL_VALUES$/);
 const checks=[...sql.matchAll(/DESKTOP_BOOTSTRAP_PERMISSIONS_BASELINE_REJECTED/g)].map(match=>match.index);
 assert.equal(checks.length,2);
 assert.ok(checks[0]<sql.indexOf('EXEC sys.sp_executesql'));
 assert.ok(checks[1]>sql.lastIndexOf('EXEC sys.sp_executesql')&&checks[1]<sql.indexOf('COMMIT TRANSACTION;'));
 assert.equal((sql.match(/COUNT_BIG\(\*\) FROM sys\.database_permissions\)<>220/g)||[]).length,2);
 assert.equal((sql.match(/HASHBYTES\('SHA2_256',CONVERT\(varbinary\(max\),@desktop_permissions_json\)\)/g)||[]).length,2);
 assert.equal((sql.match(/D17EA3A14B33F2089EEDAD8AF381DC1A2000F9D87933C0EE00C79D7C2276A3D1/g)||[]).length,2);
 assert.equal((sql.match(/DESKTOP_BOOTSTRAP_ENVIRONMENT_BASELINE_REJECTED/g)||[]).length,3);
 assert.match(sql,/compatibility_level=160/);
 assert.match(sql,/N'Turkish_CI_AS'/);
 assert.match(sql,/N'16\.0\.1000\.6'/);
 assert.match(sql,/is_trustworthy_on=0 AND is_db_chaining_on=0/);
});

test('same-count permission fixtures change their full-field snapshot on a grant or principal mutation',()=>{
 // Synthetic fixture only. This checks the sensitivity of the complete
 // UTF-16 JSON contract; it is not a SQL Server execution or a live baseline.
 const fields=['class','class_desc','major_id','minor_id','grantee_principal_id','grantor_principal_id','type','permission_name','state','state_desc','grantee_name','grantee_type','grantee_type_desc','grantee_is_fixed_role','grantee_authentication_type','grantee_sid_hex','grantor_name','grantor_type','grantor_type_desc','grantor_is_fixed_role','grantor_authentication_type','grantor_sid_hex'];
 const rows=Array.from({length:220},(_,index)=>Object.fromEntries(fields.map((name,column)=>[name,`${name}-${column}-${index}`])));
 const digest=value=>createHash('sha256').update(Buffer.from(JSON.stringify(value),'utf16le')).digest('hex');
 const baseline=digest(rows);
 for(const field of fields){
  const changed=rows.map(row=>({...row}));
  changed[100][field]+='-different';
  assert.equal(changed.length,rows.length);
  assert.notEqual(digest(changed),baseline,field);
 }
 const reordered=rows.slice();[reordered[0],reordered[1]]=[reordered[1],reordered[0]];
 assert.notEqual(digest(reordered),baseline);
});
