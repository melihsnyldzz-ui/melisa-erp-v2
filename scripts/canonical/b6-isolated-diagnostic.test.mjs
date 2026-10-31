import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {capturedTableDDL,diagnosticCommand,buildB6IsolatedDiagnostic} from './b6-isolated-diagnostic.mjs';
import {B6_ISOLATED_SCHEMA_REVISION,B6_ISOLATED_RELATIONS,B6_ISOLATED_BATCH_IDS,extractB6IsolatedSourceTables,buildB6IsolatedSchemaMap} from './b6-isolated-schema-map.mjs';
test('schema-only capture preserves types, identity and indexes without fabricating rows',()=>{
 const cols=[{schemaName:'dbo',tableName:'items',columnName:'id',columnId:1,typeName:'bigint',is_identity:true,is_nullable:false},{schemaName:'dbo',tableName:'items',columnName:'barcode',columnId:2,typeName:'nvarchar',max_length:80,is_nullable:true,collation_name:'Turkish_CI_AS'},{schemaName:'dbo',tableName:'items',columnName:'quantity',columnId:3,typeName:'decimal',precision:28,scale:8,is_nullable:true}];
 const [table]=capturedTableDDL(cols,[{tableName:'items',indexName:'PK_items',is_unique:true,key_ordinal:1,columnName:'id'}]);
 assert.match(table.sql,/IDENTITY\(1,1\)/);assert.match(table.sql,/\[barcode\] nvarchar\(40\) COLLATE Turkish_CI_AS NULL/);assert.match(table.sql,/decimal\(28,8\)/);assert.match(table.sql,/UNIQUE \(\[id\]\)/);assert(!table.sql.includes('INSERT'));
 assert.throws(()=>capturedTableDDL([{...cols[0],is_computed:true}]),/COLUMN_SCOPE/);
 assert.throws(()=>capturedTableDDL([{...cols[0],tableName:'items;DROP'}]),/IDENTIFIER/);
 assert.throws(()=>capturedTableDDL([{...cols[1],max_length:'80);DROP'}]),/TYPE_LENGTH/);
 assert.throws(()=>capturedTableDDL([{...cols[1],max_length:3}]),/TYPE_LENGTH/);
 assert.throws(()=>capturedTableDDL([{...cols[2],precision:39}]),/TYPE_PRECISION/);
 assert.throws(()=>capturedTableDDL([{...cols[2],scale:29}]),/TYPE_PRECISION/);
 assert.throws(()=>capturedTableDDL([{...cols[0],typeName:'datetime2',scale:8}]),/TYPE_SCALE/);
});
test('diagnostic command preserves exact payload and reports raw SQL location without messages or secrets',()=>{
 const sql="SELECT N'example';";const text=diagnosticCommand({phase:'ApplyCompile',index:7,id:'create-dbo.usp_b6_fixture',sql});
 const decode=t=>Buffer.from([...t.matchAll(/CONVERT\(nvarchar\(max\),0x([a-f0-9]+)\)/g)].map(m=>m[1]).join(''),'hex').toString('utf16le');
 assert.equal(decode(text),"SET XACT_ABORT ON; DECLARE @b6_ddl nvarchar(max);\nSELECT N'example';");
 const expected=createHash('sha256').update(decode(text),'utf16le').digest('hex').toUpperCase();
 assert(text.includes("HASHBYTES('SHA2_256',@diag_ApplyCompile_7),2)<>N'"+expected+"'"));
 assert(text.includes("'B6_DIAG_PAYLOAD_CHANGED'"));
 assert(text.includes('ERROR_NUMBER()'));assert(text.includes('ERROR_PROCEDURE()'));assert(text.includes('ERROR_LINE()'));assert(!text.includes('ERROR_MESSAGE'));
 assert.throws(()=>diagnosticCommand({phase:'ApplyCompile',index:7,id:'injected\nSQL',sql}),/BATCH_ID/);
 assert.throws(()=>diagnosticCommand({phase:'ApplyCompile',index:'0;DROP',id:'fixture',sql}),/BATCH_INDEX/);
 assert.throws(()=>diagnosticCommand({phase:'Other',index:0,id:'fixture',sql}),/BATCH_PHASE/);
 const baseline=diagnosticCommand({phase:'Baseline',index:0,id:'dbo.usp_fixture',sql:'CREATE PROCEDURE dbo.usp_fixture AS SELECT 1;'});
 assert.equal(decode(baseline),'CREATE PROCEDURE dbo.usp_fixture AS SELECT 1;');
});
test('incomplete or install-authorized artifacts cannot become an isolated diagnosis fixture',()=>{
 assert.throws(()=>buildB6IsolatedDiagnostic({artifact:{installable:true}}),/ARTIFACT_SCOPE/);
 assert.throws(()=>buildB6IsolatedDiagnostic({artifact:{installable:false,executeAllowed:false,newModules:[],changedModules:[]}}),/ARTIFACT_SCOPE/);
});
test('large quoted Unicode SQL payloads survive bounded transport without changing their bytes',()=>{
 const sql="/* comment ' */\nSELECT N'İı😀"+'x'.repeat(90000)+"';\n-- final comment";
 const text=diagnosticCommand({phase:'InverseCompile',index:89,id:'original-cas',sql});
 const chunks=[...text.matchAll(/CONVERT\(nvarchar\(max\),0x([a-f0-9]+)\)/g)].map(m=>m[1]);
 assert(chunks.length>80);assert(chunks.every(c=>c.length<=4000));
 assert.equal(Buffer.from(chunks.join(''),'hex').toString('utf16le'),'SET XACT_ABORT ON; DECLARE @b6_ddl nvarchar(max);\n'+sql);
});
test('source map keeps the exact existing scope and never extracts trailing row writes',()=>{
 assert.equal(B6_ISOLATED_RELATIONS.length,32);assert.equal(B6_ISOLATED_BATCH_IDS.apply.length,108);assert.equal(B6_ISOLATED_BATCH_IDS.inverse.length,90);
 assert.equal(B6_ISOLATED_BATCH_IDS.apply[10],'seed-owner-scope');
 const map=buildB6IsolatedSchemaMap({schemaVersion:'melisa-canonical-business-sale-revision.v1',revisionHash:B6_ISOLATED_SCHEMA_REVISION,applyBatches:B6_ISOLATED_BATCH_IDS.apply.map(id=>({id,kind:'FIXTURE'})),inverseBatches:B6_ISOLATED_BATCH_IDS.inverse.map(id=>({id,kind:'FIXTURE'}))});
 assert.equal(map.batches.apply[0].index,0);assert.equal(map.batches.apply[75].index,75);assert.equal(map.batches.inverse[89].index,89);
 const source={file:'infra/sql/migrations/0001_melisa_erp_v2_initial_schema.sql',text:"CREATE TABLE dbo.suppliers(id bigint, note nvarchar(30) DEFAULT N'a)b'); INSERT dbo.suppliers VALUES(1,N'private');"};
 const found=extractB6IsolatedSourceTables([source]);const table=found.tables.find(t=>t.relation==='dbo.suppliers');
 assert(table);assert(!table.sql.includes('INSERT'));assert(!table.sql.includes('private'));assert.equal(table.exactNativeBaselineProved,false);
 const unresolved=extractB6IsolatedSourceTables([{...source,text:'CREATE TABLE dbo.suppliers(id ${unknown});'}]);
 assert(!unresolved.tables.some(t=>t.relation==='dbo.suppliers'));
});
