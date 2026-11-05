import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileDesktopEmptySchema,DESKTOP_EMPTY_DATABASE,DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_ENVIRONMENT_ID} from './schema.mjs';
import {readEmptyLocalSchemaSources} from '../empty-local/schema.mjs';
import {compileDesktopNativeCatalogSchema,readDesktopNativeCatalogSources,DESKTOP_NATIVE_CATALOG_REQUIREMENTS} from './native-catalog-schema.mjs';
import {compileDesktopEmptyBootstrap,DESKTOP_BOOTSTRAP_EXECUTION_REQUIREMENTS} from './bootstrap-sql.mjs';

function readSqlJsonLiteral(sql,variable){
 const match=new RegExp(`DECLARE @${variable} nvarchar\\(max\\)=N'((?:''|[^'])*)';`,'s').exec(sql);
 assert.ok(match,variable);
 return JSON.parse(match[1].replaceAll("''","'"));
}

test('41 pinned DDL batches are selected from the checked source snapshots in one transaction',()=>{
 const schema=compileDesktopEmptySchema(),catalog=compileDesktopNativeCatalogSchema(),result=compileDesktopEmptyBootstrap(),sql=result.sql;
 const parts=[...sql.matchAll(/EXEC sys\.sp_executesql N'((?:''|[^'])*)';/g)].map(match=>match[1].replaceAll("''","'"));
 assert.equal(parts.length,2);
 assert.match(parts[0],/^INSERT dbo\.desktop_empty_installation\(/);
 assert.match(parts[0],/DESKTOP_BOOTSTRAP_MARKER_REJECTED/);
 assert.match(parts[1],/DESKTOP_BOOTSTRAP_COMMERCIAL_DATA_REJECTED/);
 const schemaSnapshot=readSqlJsonLiteral(sql,'desktop_schema_json'),catalogSnapshot=readSqlJsonLiteral(sql,'desktop_catalog_json');
 assert.deepEqual(schemaSnapshot,schema);assert.deepEqual(catalogSnapshot,catalog);
 assert.equal(result.batchCount,41);
 assert.equal(result.expectedTables.length,27);
 assert.equal(result.sqlSha256,createHash('sha256').update(sql,'utf8').digest('hex'));
 assert.equal(result.sourceSchemaSha256,createHash('sha256').update(JSON.stringify(schema),'utf8').digest('hex'));
 assert.equal(result.sourceCatalogSha256,createHash('sha256').update(JSON.stringify(catalog),'utf8').digest('hex'));
 assert.equal(result.sourceSchemaUtf16Sha256,createHash('sha256').update(Buffer.from(JSON.stringify(schema),'utf16le')).digest('hex').toUpperCase());
 assert.equal(result.sourceCatalogUtf16Sha256,createHash('sha256').update(Buffer.from(JSON.stringify(catalog),'utf16le')).digest('hex').toUpperCase());
 assert.match(sql,/WHILE @desktop_batch_index<41/);
 assert.match(sql,/IF @desktop_batch_index<35/);
 assert.match(sql,/OPENJSON\(@desktop_schema_json,'\$\.batches'\)/);
 assert.match(sql,/OPENJSON\(@desktop_catalog_json,'\$\.batches'\)/);
 assert.match(sql,/EXEC sys\.sp_executesql @desktop_batch_sql/);
 assert.match(sql,/DESKTOP_BOOTSTRAP_BATCH_MISSING/);
 const sourceChecks=[...sql.matchAll(/DESKTOP_BOOTSTRAP_SOURCE_CHECKSUM_REJECTED/g)].map(match=>match.index);
 assert.equal(sourceChecks.length,2);
 assert.ok(sourceChecks[0]<sql.indexOf('WHILE @desktop_batch_index<41'));
 assert.ok(sourceChecks[1]>sql.lastIndexOf('EXEC sys.sp_executesql N\'')&&sourceChecks[1]<sql.indexOf('COMMIT TRANSACTION;'));
 assert.equal((sql.match(/\bBEGIN TRANSACTION;/g)||[]).length,1);
 assert.equal((sql.match(/\bCOMMIT TRANSACTION;/g)||[]).length,1);
 assert.ok(sql.indexOf('BEGIN TRANSACTION;')<sql.indexOf('sys.sp_getapplock'));
 assert.ok(sql.indexOf('sys.sp_getapplock')<sql.indexOf('DESKTOP_BOOTSTRAP_TARGET_NOT_EMPTY_OR_ALREADY_APPLIED'));
 assert.ok(sql.indexOf('DESKTOP_BOOTSTRAP_TARGET_NOT_EMPTY_OR_ALREADY_APPLIED')<sql.indexOf('EXEC sys.sp_executesql'));
 assert.ok(sql.indexOf('EXEC sys.sp_executesql @desktop_batch_sql')<sql.indexOf('INSERT dbo.desktop_empty_installation'));
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

test('empty target requires exactly the verified db_owner to Windows dbo role membership',()=>{
 const {sql}=compileDesktopEmptyBootstrap();
 const guard=sql.slice(sql.indexOf('IF EXISTS(SELECT 1 FROM sys.objects'),sql.indexOf('DESKTOP_BOOTSTRAP_TARGET_NOT_EMPTY_OR_ALREADY_APPLIED'));
 assert.match(guard,/\(SELECT COUNT_BIG\(\*\) FROM sys\.database_role_members\)<>1/);
 assert.match(guard,/OR NOT EXISTS\(SELECT 1 FROM sys\.database_role_members AS membership/);
 assert.match(guard,/membership\.role_principal_id=16384 AND membership\.member_principal_id=1/);
 assert.match(guard,/role_principal\.name\)=CONVERT\(varbinary\(256\),N'db_owner'\)/);
 assert.match(guard,/role_principal\.type='R' AND role_principal\.is_fixed_role=1/);
 assert.match(guard,/member_principal\.name\)=CONVERT\(varbinary\(256\),N'dbo'\)/);
 assert.match(guard,/member_principal\.type='U' AND member_principal\.is_fixed_role=0/);
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

test('catalog fixtures, missing batches and any execution authority drift fail the pinned snapshots',()=>{
 const sources=readDesktopNativeCatalogSources(),keys=Object.keys(sources),result=compileDesktopEmptyBootstrap();
 assert.equal(result.catalogRequirements,DESKTOP_NATIVE_CATALOG_REQUIREMENTS);
 assert.equal(result.catalogRequirements.executionAuthorized,false);
 assert.equal(result.catalogRequirements.commercialData,'NONE');
 assert.match(result.catalogRequirements.fixtureLimitation,/party_entities absent/);
 assert.equal(result.catalogRequirements.requiresActualSqlMetadataVerification,true);
 for(const key of keys){
  assert.throws(()=>compileDesktopEmptyBootstrap({catalogSources:{...sources,[key]:sources[key]+"\nINSERT dbo.products(id) VALUES(1);"}}),/DESKTOP_CATALOG_SOURCE_HASH_REJECTED/);
  const missing={...sources};delete missing[key];
  assert.throws(()=>compileDesktopEmptyBootstrap({catalogSources:missing}),/DESKTOP_CATALOG_SOURCE_ALLOWLIST_REJECTED/);
 }
 for(const input of [{seed:[]},{seedData:false},{allowWrites:true},{catalogSources:undefined},{sources:undefined},null,[]]){
  assert.throws(()=>compileDesktopEmptyBootstrap(input),/DESKTOP_BOOTSTRAP_OPTIONS_REJECTED/);
 }
 let called=false;const accessor={get catalogSources(){called=true;return sources;}};
 assert.throws(()=>compileDesktopEmptyBootstrap(accessor),/DESKTOP_BOOTSTRAP_OPTIONS_REJECTED/);assert.equal(called,false);
 const catalog=readSqlJsonLiteral(result.sql,'desktop_catalog_json');
 const digest=json=>createHash('sha256').update(Buffer.from(JSON.stringify(json),'utf16le')).digest('hex').toUpperCase();
 assert.equal(digest(catalog),result.sourceCatalogUtf16Sha256);
 const removed=structuredClone(catalog);removed.batches.pop();assert.notEqual(digest(removed),result.sourceCatalogUtf16Sha256);
 const injected=structuredClone(catalog);injected.batches[0].sql+='\nINSERT dbo.products(id) VALUES(1);';assert.notEqual(digest(injected),result.sourceCatalogUtf16Sha256);
 const authorized=structuredClone(catalog);authorized.requirements.executionAuthorized=true;assert.notEqual(digest(authorized),result.sourceCatalogUtf16Sha256);
});

test('catalog reference SQL covers the full proposed columns and source indexes and checks zero business rows',()=>{
 const result=compileDesktopEmptyBootstrap(),sql=result.sql;
 const sourceRows=JSON.parse(readDesktopNativeCatalogSources()['scripts/canonical/fixtures/night-20261006-before.json']).exported.resultSets[1];
 const colInsert=/INSERT @desktop_expected_columns VALUES ([\s\S]*?);/.exec(sql);assert.ok(colInsert);
 const tuples=[...colInsert[1].matchAll(/\(N'([^']+)',(\d+),N'([^']+)',N'([^']+)',(-?\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/g)].map(m=>({table_name:m[1],column_id:Number(m[2]),column_name:m[3],type_name:m[4],max_length:Number(m[5]),precision:Number(m[6]),scale:Number(m[7]),is_nullable:Number(m[8])===1,is_identity:Number(m[9])===1,default_expression:Number(m[10])===0?null:'unexpected'}));
 assert.equal(tuples.length,37);
 for(const table of ['party_currency_accounts','product_prices'])assert.deepEqual(tuples.filter(row=>row.table_name===table),sourceRows.filter(row=>row.table_name===table));
 assert.equal(sourceRows.filter(row=>row.table_name==='party_entities').length,0);
 assert.equal(tuples.filter(row=>row.table_name==='party_entities').length,11);
 for(const table of ['party_entities','party_currency_accounts','product_prices']){
  assert.match(sql,new RegExp('UX_'+table+'_source_record'));
  assert.match(sql,new RegExp(`EXISTS\\(SELECT 1 FROM dbo\\.\\[${table}\\]\\)`));
 }
 assert.match(sql,/DESKTOP_BOOTSTRAP_CATALOG_COLUMNS_REJECTED/);
 assert.match(sql,/DESKTOP_BOOTSTRAP_CATALOG_INDEXES_REJECTED/);
 assert.match(sql,/sys\.index_columns/);assert.match(sql,/sys\.foreign_keys/);assert.match(sql,/sys\.check_constraints/);
 const noData=[...sql.matchAll(/EXISTS\(SELECT 1 FROM dbo\.\[([a-z_]+)\]\)/g)].map(match=>match[1]);
 assert.deepEqual(noData,result.expectedTables.filter(name=>name!=='desktop_empty_installation'));
 assert.equal(noData.length,26);
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
