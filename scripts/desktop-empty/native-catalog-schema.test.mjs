import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_DATABASE,desktopEmptyTargetGuard} from './schema.mjs';
import {compileDesktopNativeCatalogSchema,readDesktopNativeCatalogSources,DESKTOP_NATIVE_CATALOG_REQUIREMENTS} from './native-catalog-schema.mjs';

const migration='apps/api/scripts/vega-native-migration-store.mjs';
const fixtureFile='scripts/canonical/fixtures/night-20261006-before.json';
const normalize=text=>text.replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');

test('native catalog is a source-bound, exact-target DDL proposal, never execution authority',()=>{
 const result=compileDesktopNativeCatalogSchema();
 assert.equal(result.scope,'desktop-native-catalog-source-only-v1');
 assert.equal(result.server,DESKTOP_EMPTY_SERVER);assert.equal(result.database,DESKTOP_EMPTY_DATABASE);
 assert.equal(result.requirements,DESKTOP_NATIVE_CATALOG_REQUIREMENTS);
 assert.equal(result.requirements.executionAuthorized,false);
 assert.equal(result.requirements.commercialData,'NONE');
 assert.equal(result.requirements.requiresIndependentReview,true);
 assert.equal(result.requirements.requiresTargetSpecificTransactionalInstaller,true);
 assert.equal(result.requirements.requiresActualSqlMetadataVerification,true);
 assert.match(result.requirements.fixtureLimitation,/party_entities absent/);
 assert.deepEqual(result.batches.map(({table,kind})=>[table,kind]),[
  ['party_entities','TABLE'],['party_entities','INDEX'],
  ['party_currency_accounts','TABLE'],['party_currency_accounts','INDEX'],
  ['product_prices','TABLE'],['product_prices','INDEX'],
 ]);
 const guard=desktopEmptyTargetGuard();
 for(const batch of result.batches){
  assert.ok(Object.isFrozen(batch));assert.ok(batch.sql.startsWith(guard+'\n'));
  assert.doesNotMatch(batch.sql,/\b(?:INSERT|UPDATE|DELETE|MERGE|DROP|TRUNCATE|EXEC(?:UTE)?|GRANT|DENY|REVOKE|BACKUP|RESTORE|ALTER)\b/i);
  assert.doesNotMatch(batch.sql,/\bCREATE\s+(?:DATABASE|USER|LOGIN|PROCEDURE|TRIGGER)\b/i);
  assert.doesNotMatch(batch.sql,/SYNTHETIC|ORNEK|VEGA2026/i);
 }
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.batches)&&Object.isFrozen(result.sourceHashes));
 assert.deepEqual(compileDesktopNativeCatalogSchema(),result);
});

test('native price and currency-account SQL columns match the separate observed metadata fixture',()=>{
 const sources=readDesktopNativeCatalogSources(),fixture=JSON.parse(normalize(sources[fixtureFile]));
 const result=compileDesktopNativeCatalogSchema({sources});
 const all=fixture.exported.resultSets[1];
 for(const table of ['party_currency_accounts','product_prices']){
  const rows=all.filter(row=>row.table_name===table);
  assert.equal(rows.length,13);
  const batch=result.batches.find(entry=>entry.table===table&&entry.kind==='TABLE');
  assert.equal(batch.evidence,'pinned-native-source-and-column-fixture');
  assert.match(batch.sql,/\(id bigint IDENTITY PRIMARY KEY,/);
  let last=0;
  for(const row of rows.slice(1)){
   const type=row.type_name==='nvarchar'?`nvarchar(${row.max_length===-1?'max':row.max_length/2})`:
    row.type_name==='char'?`char(${row.max_length})`:
    row.type_name==='decimal'?`decimal(${row.precision},${row.scale})`:row.type_name;
   const needle=`[${row.column_name}] ${type} NULL`;
   const position=batch.sql.indexOf(needle);
   assert.ok(position>last,`${table}.${row.column_name}`);last=position;
   assert.equal(row.is_nullable,true);assert.equal(row.is_identity,false);
  }
  assert.equal(rows[0].column_name,'id');assert.equal(rows[0].is_identity,true);assert.equal(rows[0].is_nullable,false);
 }
 const entity=result.batches.find(entry=>entry.table==='party_entities'&&entry.kind==='TABLE');
 assert.equal(entity.evidence,'pinned-native-source');
 assert.equal(all.filter(row=>row.table_name==='party_entities').length,0);
});

test('each emitted index is the migration source filtered unique source-record index only',()=>{
 const result=compileDesktopNativeCatalogSchema();
 for(const batch of result.batches.filter(entry=>entry.kind==='INDEX')){
  assert.equal(batch.evidence,'pinned-native-source');
  assert.ok(batch.sql.endsWith(`CREATE UNIQUE INDEX [UX_${batch.table}_source_record] ON dbo.[${batch.table}](source_record_key) WHERE source_record_key IS NOT NULL;`));
 }
 for(const batch of result.batches.filter(entry=>entry.kind==='TABLE')){
  assert.equal((batch.sql.match(/PRIMARY KEY/g)||[]).length,1);
  assert.doesNotMatch(batch.sql,/\b(?:FOREIGN KEY|REFERENCES|CHECK|UNIQUE)\b/i);
 }
});

test('wrong targets, unknown options and seeds fail closed before any output',()=>{
 for(const options of [null,[],{server:'Semih\\MELISADEV'}, {server:'Semih\\MELISAERP '},
  {server:null},{server:undefined},{database:'master'},{database:DESKTOP_EMPTY_DATABASE.toLowerCase()},
  {database:DESKTOP_EMPTY_DATABASE+"';DROP DATABASE master;--"},{database:null},{database:undefined},
  {seed:[]},{seedData:false},{allowWrites:true},{[Symbol('hidden')]:true}]){
  assert.throws(()=>compileDesktopNativeCatalogSchema(options),/DESKTOP_(?:EMPTY_TARGET|CATALOG_OPTIONS)_REJECTED/);
 }
 let called=false;
 const accessor={get server(){called=true;return DESKTOP_EMPTY_SERVER;}};
 assert.throws(()=>compileDesktopNativeCatalogSchema(accessor),/DESKTOP_CATALOG_OPTIONS_REJECTED/);
 assert.equal(called,false);
 const hidden={};Object.defineProperty(hidden,'seed',{value:[],enumerable:false});
 assert.throws(()=>compileDesktopNativeCatalogSchema(hidden),/DESKTOP_CATALOG_OPTIONS_REJECTED/);
});

test('both complete source files are pinned and altered, seeded or missing inputs are rejected',()=>{
 const sources=readDesktopNativeCatalogSources(),result=compileDesktopNativeCatalogSchema({sources});
 for(const name of [migration,fixtureFile]){
  assert.equal(result.sourceHashes[name],sha(normalize(sources[name])));
  for(const changed of [sources[name]+'\nINSERT dbo.products(id) VALUES(1);',normalize(sources[name]).slice(0,-1)]){
   assert.throws(()=>compileDesktopNativeCatalogSchema({sources:{...sources,[name]:changed}}),/DESKTOP_CATALOG_SOURCE_HASH_REJECTED/);
  }
  const missing={...sources};delete missing[name];
  assert.throws(()=>compileDesktopNativeCatalogSchema({sources:missing}),/DESKTOP_CATALOG_SOURCE_ALLOWLIST_REJECTED/);
 }
 assert.throws(()=>compileDesktopNativeCatalogSchema({sources:{...sources,'seed.sql':'INSERT dbo.products(id) VALUES(1)'}}),/DESKTOP_CATALOG_SOURCE_ALLOWLIST_REJECTED/);
 assert.throws(()=>compileDesktopNativeCatalogSchema({sources:{...sources,[fixtureFile]:null}}),/DESKTOP_CATALOG_SOURCE_TYPE_REJECTED/);
 assert.throws(()=>compileDesktopNativeCatalogSchema({sources:undefined}),/DESKTOP_CATALOG_SOURCE_ALLOWLIST_REJECTED/);
 let called=false;const accessor={...sources};Object.defineProperty(accessor,fixtureFile,{get(){called=true;return sources[fixtureFile];},enumerable:true});
 assert.throws(()=>compileDesktopNativeCatalogSchema({sources:accessor}),/DESKTOP_CATALOG_SOURCE_ALLOWLIST_REJECTED/);assert.equal(called,false);
 const crlf=Object.fromEntries(Object.entries(sources).map(([name,text])=>[name,'\uFEFF'+normalize(text).replaceAll('\n','\r\n')]));
 assert.deepEqual(compileDesktopNativeCatalogSchema({sources:crlf}),result);
});
