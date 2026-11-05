import test from 'node:test';
import assert from 'node:assert/strict';
import {
 EMPTY_LOCAL_DATABASE,EMPTY_LOCAL_ENVIRONMENT_ID,EMPTY_LOCAL_SCHEMA_SOURCES,
 EMPTY_LOCAL_VIEW_PERMISSIONS,readEmptyLocalSchemaSources,compileEmptyLocalSchema,
 buildEmptyLocalReferenceSql,emptyLocalSchemaTargetGuard,
} from './schema.mjs';

test('pinned source DDL builds only the first normal-auth/read-list schema',()=>{
 const result=compileEmptyLocalSchema();
 assert.equal(result.scope,'normal-auth-read-lists-v1');
 assert.equal(result.database,EMPTY_LOCAL_DATABASE);
 assert.equal(result.environmentId,EMPTY_LOCAL_ENVIRONMENT_ID);
 assert.equal(result.batches.length,35);
 assert.equal(result.sources.length,8);
 const sql=result.batches.map(b=>b.sql).join('\n');
 for(const table of ['users','roles','permissions','products','customers','suppliers','product_images','auth_refresh_tokens','system_settings','empty_local_installation']){
  assert.match(sql,new RegExp('CREATE TABLE dbo\\.'+table+' \\('));
 }
 assert.match(sql,/ADD purchase_discount_rate/);
 assert.match(sql,/ALTER TABLE dbo\.products ADD supplier_id BIGINT NULL/);
 assert.match(sql,/CONSTRAINT FK_empty_local_products_supplier\s+FOREIGN KEY\(supplier_id\) REFERENCES dbo\.suppliers\(id\)/);
 assert.match(sql,/CREATE INDEX IX_empty_local_products_supplier ON dbo\.products\(supplier_id\)/);
 assert.equal(result.extensions.length,2);
 assert.ok(result.extensions.every(e=>/^[a-f0-9]{64}$/.test(e.sha256)));
 assert.doesNotMatch(sql,/\b(?:INSERT|MERGE|UPDATE|DELETE|DROP|TRUNCATE|EXEC(?:UTE)?|USE|GRANT|DENY|REVOKE)\b/i);
 assert.doesNotMatch(sql,/\b(?:CREATE|ALTER)\s+(?:DATABASE|LOGIN|USER)\b/i);
 assert.doesNotMatch(sql,/MELISA_ERP_V2|ORNEK|SYNTHETIC|20261022|N'admin'/i);
 for(const batch of result.batches)assert.ok(batch.sql.startsWith(emptyLocalSchemaTargetGuard()));
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.batches));
});

test('reviewed index DDL is retained without admitting mutation statements',()=>{
 const sql=compileEmptyLocalSchema().batches.map(b=>b.sql).join('\n');
 assert.match(sql,/CREATE UNIQUE INDEX UX_product_barcodes_active_barcode\s+ON dbo\.product_barcodes/);
 assert.match(sql,/CREATE INDEX IX_products_name ON dbo\.products/);
 assert.match(sql,/CREATE UNIQUE INDEX UX_auth_refresh_tokens_hash ON dbo\.auth_refresh_tokens/);
 assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE|INSERT|MERGE|DROP|TRUNCATE|EXEC(?:UTE)?)\b/i);
});

test('installation marker pins actual empty SQL identity and read-only flags',()=>{
 const marker=compileEmptyLocalSchema().batches.at(-1).sql;
 for(const pattern of [/id tinyint/,/environment_id uniqueidentifier/,/schema_version int/,/CHECK\(schema_version=1\)/,/CHECK\(actual_t1=0\)/,/CHECK\(external_operations=0\)/,/CHECK\(read_only=1\)/,/DEFAULT SYSUTCDATETIME\(\)/])assert.match(marker,pattern);
 assert.doesNotMatch(marker,/synthetic|INSERT/i);
});

test('reference SQL creates exactly a reader role and four view permissions',()=>{
 const sql=buildEmptyLocalReferenceSql();
 const inserts=[...sql.matchAll(/\bINSERT\s+dbo\.([a-z_]+)/gi)].map(m=>m[1]);
 assert.deepEqual(inserts,['roles','permissions']);
 assert.deepEqual([...sql.matchAll(/N'([^']+\.view)'/g)].map(m=>m[1]),[...EMPTY_LOCAL_VIEW_PERMISSIONS]);
 assert.match(sql,/SELECT r\.id,p\.permission_key,1,0,0,0,0/);
 assert.match(sql,/EMPTY_LOCAL_REFERENCE_ROLE_EXISTS/);
 assert.ok(sql.startsWith(emptyLocalSchemaTargetGuard()));
 assert.match(sql,new RegExp(EMPTY_LOCAL_ENVIRONMENT_ID));
 assert.doesNotMatch(sql,/\b(?:MERGE|UPDATE|DELETE|DROP|TRUNCATE|EXEC(?:UTE)?|USE)\b/i);
 assert.doesNotMatch(sql,/password|bcrypt|credential|INSERT\s+(?:INTO\s+)?dbo\.(?:users|products|customers|suppliers|product_images|stock_movements|finance_accounts)/i);
});

test('wrong and legacy target databases are rejected before compiling',()=>{
 for(const targetDatabase of ['MELISA_ERP_V2','MELISA_ERP_CLEAN_TEST_20261022','master',EMPTY_LOCAL_DATABASE.toLowerCase(),EMPTY_LOCAL_DATABASE+"';DROP DATABASE x;--"]){
  assert.throws(()=>compileEmptyLocalSchema({targetDatabase}),/EMPTY_LOCAL_SCHEMA_TARGET_REJECTED/);
  assert.throws(()=>buildEmptyLocalReferenceSql({targetDatabase}),/EMPTY_LOCAL_SCHEMA_TARGET_REJECTED/);
 }
});

test('unexpected upstream DDL or data, including discarded legacy sections, fails closed',()=>{
 const sources=readEmptyLocalSchemaSources();
 for(const entry of EMPTY_LOCAL_SCHEMA_SOURCES){
  for(const mutation of [s=>s+'\nCREATE TABLE dbo.unreviewed(id int);\n',s=>s+'\nINSERT dbo.products(stock_code,name) VALUES(N\'x\',N\'x\');\n',s=>s.replace(/CREATE TABLE/,'DROP TABLE')]){
   const changed=mutation(sources[entry.path]);
   if(changed===sources[entry.path])continue;
   assert.throws(()=>compileEmptyLocalSchema({sources:{...sources,[entry.path]:changed}}),/EMPTY_LOCAL_SCHEMA_SOURCE_HASH_REJECTED/);
  }
 }
 const auth=EMPTY_LOCAL_SCHEMA_SOURCES.find(e=>e.path.includes('0006_')).path;
 assert.throws(()=>compileEmptyLocalSchema({sources:{...sources,[auth]:sources[auth]+'\n-- changed excluded legacy seed\n'}}),/EMPTY_LOCAL_SCHEMA_SOURCE_HASH_REJECTED/);
});

test('allowlist rejects missing or additional sources; newline style preserves reviewed text',()=>{
 const sources=readEmptyLocalSchemaSources(),first=EMPTY_LOCAL_SCHEMA_SOURCES[0].path;
 const missing={...sources};delete missing[first];
 assert.throws(()=>compileEmptyLocalSchema({sources:missing}),/EMPTY_LOCAL_SCHEMA_ALLOWLIST_REJECTED/);
 assert.throws(()=>compileEmptyLocalSchema({sources:{...sources,'unreviewed.sql':'CREATE TABLE dbo.x(id int);'}}),/EMPTY_LOCAL_SCHEMA_ALLOWLIST_REJECTED/);
 const normalized=Object.fromEntries(Object.entries(sources).map(([path,text])=>[path,text.replace(/^\uFEFF/,'').replaceAll('\r\n','\n')]));
 assert.deepEqual(compileEmptyLocalSchema({sources:normalized}),compileEmptyLocalSchema({sources}));
});
