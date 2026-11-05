import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 compileEmptyLocalSchema,emptyLocalSchemaTargetGuard,readEmptyLocalSchemaSources,
} from '../empty-local/schema.mjs';
import {
 DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_DATABASE,DESKTOP_EMPTY_ENVIRONMENT_ID,
 desktopEmptyTargetGuard,compileDesktopEmptySchema,
} from './schema.mjs';

test('desktop output retains the exact reviewed DDL, but only its own target and marker',()=>{
 const original=compileEmptyLocalSchema();
 const result=compileDesktopEmptySchema();
 assert.equal(result.server,DESKTOP_EMPTY_SERVER);
 assert.equal(result.database,DESKTOP_EMPTY_DATABASE);
 assert.equal(result.environmentId,DESKTOP_EMPTY_ENVIRONMENT_ID);
 assert.equal(result.batches.length,35);
 assert.equal(result.foundationSha256,createHash('sha256').update(JSON.stringify(original)).digest('hex'));
 assert.deepEqual(result.sources,original.sources);
 const originalGuard=emptyLocalSchemaTargetGuard()+'\n',desktopGuard=desktopEmptyTargetGuard()+'\n';
 for(let index=0;index<34;index++){
  const oldBatch=original.batches[index],newBatch=result.batches[index];
  assert.equal(newBatch.source,oldBatch.source);
  assert.equal(newBatch.index,oldBatch.index);
  assert.ok(oldBatch.sql.startsWith(originalGuard));
  assert.ok(newBatch.sql.startsWith(desktopGuard));
  assert.equal(newBatch.sql.slice(desktopGuard.length),oldBatch.sql.slice(originalGuard.length));
 }
 const marker=result.batches.at(-1);
 assert.equal(marker.source,'desktop-empty-installation-marker-v1');
 assert.match(marker.sql,/CREATE TABLE dbo\.desktop_empty_installation/);
 assert.match(marker.sql,new RegExp(DESKTOP_EMPTY_ENVIRONMENT_ID));
 assert.match(marker.sql,/CHECK\(read_only=1\)/);
 assert.match(marker.sql,/CHECK\(actual_t1=0\)/);
 assert.match(marker.sql,/CHECK\(external_operations=0\)/);
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.batches)&&result.batches.every(Object.isFrozen));
});

test('exact server and database guard rejects alternate targets and SQL-injection values',()=>{
 for(const target of [
  {server:'Semih\\MELISADEV'}, {server:'semih\\MELISAERP'}, {server:'Semih\\MELISAERP '},
  {server:null}, {database:'MELISA_ERP_EMPTY_TEST_20261105'}, {database:'master'},
  {database:DESKTOP_EMPTY_DATABASE.toLowerCase()}, {database:DESKTOP_EMPTY_DATABASE+' '},
  {database:DESKTOP_EMPTY_DATABASE+"'; DROP DATABASE master;--"}, {database:null},
 ]){
  assert.throws(()=>desktopEmptyTargetGuard(target),/DESKTOP_EMPTY_TARGET_REJECTED/);
  assert.throws(()=>compileDesktopEmptySchema(target),/DESKTOP_EMPTY_TARGET_REJECTED/);
 }
 // Binary identity comparisons are required: SQL string equality can pad spaces.
 const guard=desktopEmptyTargetGuard();
 assert.match(guard,/@desktop_empty_db IS NULL OR @desktop_empty_server IS NULL/);
 assert.match(guard,/CONVERT\(varbinary\(256\),@desktop_empty_db\)<>CONVERT\(varbinary\(256\),N'MELISA_ERP_DESKTOP_TEST_20261105'\)/);
 assert.match(guard,/CONVERT\(varbinary\(256\),@desktop_empty_server\)<>CONVERT\(varbinary\(256\),N'Semih\\MELISAERP'\)/);
 assert.match(guard,/THROW 51994, 'DESKTOP_EMPTY_TARGET_REJECTED', 1/);
 assert.throws(()=>compileEmptyLocalSchema({targetDatabase:DESKTOP_EMPTY_DATABASE}),/EMPTY_LOCAL_SCHEMA_TARGET_REJECTED/);
});

test('all output batches are guarded DDL only, without seed or permissions',()=>{
 const result=compileDesktopEmptySchema(),guard=desktopEmptyTargetGuard()+'\n';
 for(const {sql} of result.batches){
  assert.ok(sql.startsWith(guard));
  const ddl=sql.slice(guard.length).replace(/\/\*[\s\S]*?\*\//g,'').replace(/--[^\n]*/g,'');
  assert.doesNotMatch(ddl,/\b(?:INSERT|MERGE|UPDATE|DELETE|DROP|TRUNCATE|EXEC(?:UTE)?|USE|GRANT|DENY|REVOKE|BACKUP|RESTORE)\b/i);
  assert.doesNotMatch(ddl,/\b(?:CREATE|ALTER)\s+(?:DATABASE|LOGIN|USER|PROCEDURE|TRIGGER|FUNCTION|VIEW|ASSEMBLY|SERVER)\b/i);
  assert.doesNotMatch(ddl,/MELISA_ERP_V2|ORNEK|SYNTHETIC|20261022|N'admin'/i);
 }
});

test('changed, missing or extra upstream source is rejected before output is produced',()=>{
 const sources=readEmptyLocalSchemaSources(),first=Object.keys(sources)[0];
 for(const suffix of ['\n-- changed input','\nINSERT dbo.products(id) VALUES(1);','\nDROP TABLE dbo.products;']){
  assert.throws(()=>compileDesktopEmptySchema({sources:{...sources,[first]:sources[first]+suffix}}),/EMPTY_LOCAL_SCHEMA_SOURCE_HASH_REJECTED/);
 }
 const missing={...sources};delete missing[first];
 assert.throws(()=>compileDesktopEmptySchema({sources:missing}),/EMPTY_LOCAL_SCHEMA_ALLOWLIST_REJECTED/);
 assert.throws(()=>compileDesktopEmptySchema({sources:{...sources,'extra.sql':'CREATE TABLE dbo.extra(id int);'}}),/EMPTY_LOCAL_SCHEMA_ALLOWLIST_REJECTED/);
});
