import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compileQuery,compileAggregate} from './compiler.js';
import {sealCursor,openCursor} from './cursor.js';
import {fieldPolicy,excludedObject,secretName} from './policy.js';
import {createAudit} from './audit.js';
import {applySemantics} from './semantics.js';

process.env.MCP_READ_ONLY_TOKEN='test-only-cursor-key-not-a-live-secret-123456789';
const column=(name,dataType,extra={})=>({name,dataType,precision:20,scale:6,nullable:false,personal:false,aggregate:[],...extra});
const d={id:'vega.dbo.test',source:'vega',from:'[dbo].[test]',primaryKey:['id'],schemaVersion:'unit-v1',readable:true,registered:true,defaultFields:['id','name'],fields:[
  column('id','bigint'),column('name','nvarchar'),column('currency','nvarchar',{nullable:true}),column('unit','nvarchar'),column('quantity','decimal',{aggregate:['sum'],requiredGroups:['unit']}),
  column('amount','decimal',{aggregate:['sum'],requiredGroups:['currency']}),column('raw_price','decimal'),column('email','nvarchar',{personal:true}),column('date','datetime'),column('active','bit')],objects:[]};
const error=(fn,code)=>assert.throws(fn,e=>e.code===code);

test('SQL and executable identifier injection are rejected; values remain parameters',()=>{
  error(()=>compileQuery(d,{dataset:d.id,fields:['id]; DELETE FROM test;--']}),'FIELD_NOT_ALLOWED');
  error(()=>compileQuery(d,{dataset:d.id,sql:'SELECT 1'}),'INVALID_ARGUMENTS');
  error(()=>compileQuery(d,{dataset:d.id,filters:[{field:'id',op:'constructor',value:1}]}),'INVALID_FILTER_OPERATOR');
  const payload="x'; DELETE FROM test;--";
  const q=compileQuery(d,{dataset:d.id,filters:[{field:'name',op:'eq',value:payload}]});
  assert.ok(q.statement.startsWith('SELECT TOP (51)'));assert.ok(!q.statement.includes(payload));assert.equal(q.parameters[0].value,payload);
});
test('contains escapes wildcard characters and remains parameterized',()=>{
  const q=compileQuery(d,{dataset:d.id,filters:[{field:'name',op:'contains',value:'50%_[a~'}]});
  assert.equal(q.parameters[0].value,'%50~%~_~[a~~%');assert.match(q.statement,/ESCAPE '~'/);
});
test('unit and currency context is read even when omitted from selected fields',()=>{
  const q=compileQuery(d,{dataset:d.id,fields:['id','amount']});
  assert.ok(q.contextFields.includes('currency'));assert.ok(q.contextFields.includes('unit'));
  assert.match(q.statement,/AS \[currency\]/);assert.match(q.statement,/AS \[unit\]/);
  assert.deepEqual(q.requested,['id','amount']);
});
test('page is capped, not total access; keyset cursor is query-bound and tamper-resistant',()=>{
  error(()=>compileQuery(d,{dataset:d.id,limit:51}),'INVALID_PAGE_LIMIT');
  const first=compileQuery(d,{dataset:d.id,limit:50});const cursor=sealCursor(first.binding,['9007199254740993']);
  const next=compileQuery(d,{dataset:d.id,limit:50,cursor});assert.match(next.statement,/\[id\] > CONVERT\(bigint,@p0\)/);
  assert.equal(next.parameters[0].value,'9007199254740993');
  error(()=>compileQuery(d,{dataset:d.id,cursor,fields:['name']}),'INVALID_OR_EXPIRED_CURSOR');
  error(()=>openCursor(cursor.slice(0,-3)+'abc',first.binding),'INVALID_OR_EXPIRED_CURSOR');
  assert.ok(!cursor.includes('9007199254740993'));
});
test('unknown and revoked datasets fail closed; unique row identity is required',()=>{
  error(()=>compileQuery({...d,readable:false},{dataset:d.id}),'DATASET_READ_PERMISSION_MISSING');
  error(()=>compileQuery({...d,primaryKey:[]},{dataset:d.id}),'NO_SAFE_UNIQUE_KEY');
  assert.ok(compileAggregate({...d,primaryKey:[]},{dataset:d.id,metrics:[{op:'count',as:'total'}]}).statement.includes('COUNT_BIG(*)'));
});
test('decimal filters preserve precision; invalid dates/types/limits are rejected',()=>{
  const q=compileQuery(d,{dataset:d.id,filters:[{field:'amount',op:'eq',value:'999999999999.123456'}]});
  assert.equal(q.parameters[0].value,'999999999999.123456');
  error(()=>compileQuery(d,{dataset:d.id,filters:[{field:'amount',op:'eq',value:1.1}]}),'DECIMAL_REQUIRES_STRING');
  error(()=>compileQuery(d,{dataset:d.id,filters:[{field:'id',op:'eq',value:9007199254740992}]}),'INVALID_INTEGER');
  error(()=>compileQuery(d,{dataset:d.id,filters:[{field:'date',op:'eq',value:'tomorrow'}]}),'INVALID_DATE');
  error(()=>compileQuery(d,{dataset:d.id,filters:[{field:'active',op:'eq',value:'true'}]}),'INVALID_BOOLEAN');
});
test('aggregates cover the entire filter before page limits; unknown measures are closed',()=>{
  const q=compileAggregate(d,{dataset:d.id,groupBy:['currency'],filters:[{field:'active',op:'eq',value:true}],metrics:[{op:'sum',field:'amount',as:'total'}],limit:1});
  assert.match(q.statement,/FROM \(SELECT \[currency\],/);assert.match(q.statement,/GROUP BY \[currency\]/);assert.match(q.statement,/COUNT_BIG\(\[amount\]\) = COUNT_BIG\(\*\)/);
  assert.equal((q.statement.match(/TOP/g)||[]).length,1);
  error(()=>compileAggregate(d,{dataset:d.id,metrics:[{op:'sum',field:'amount',as:'total'}]}),'CURRENCY_OR_UNIT_SCOPE_REQUIRED');
  error(()=>compileAggregate(d,{dataset:d.id,metrics:[{op:'sum',field:'quantity',as:'total'}]}),'CURRENCY_OR_UNIT_SCOPE_REQUIRED');
  error(()=>compileAggregate(d,{dataset:d.id,metrics:[{op:'sum',field:'raw_price',as:'total'}]}),'MEASURE_NOT_VERIFIED');
});
test('aggregate cursor handles null group first without losing later groups',()=>{
  const args={dataset:d.id,groupBy:['currency'],metrics:[{op:'count',as:'total'}],limit:1};
  const q=compileAggregate(d,args),cursor=sealCursor(q.binding,[null]);
  assert.match(compileAggregate(d,{...args,cursor}).statement,/WHERE \(\(\[currency\] IS NOT NULL\)\)/);
});
test('personal contact fields require explicit single-record purpose, not bulk browsing',()=>{
  error(()=>compileQuery(d,{dataset:d.id,fields:['email']}),'PERSONAL_DATA_REQUIRES_SINGLE_RECORD_AND_PURPOSE');
  assert.ok(compileQuery(d,{dataset:d.id,fields:['email'],includePersonalData:true,purpose:'Read contact for the requested invoice',filters:[{field:'id',op:'eq',value:'1'}]}));
  error(()=>compileQuery(d,{dataset:d.id,filters:[{field:'email',op:'contains',value:'@'}]}),'PERSONAL_DATA_FILTER_NOT_ALLOWED');
});
test('secrets, opaque blobs and security objects cannot become fields/datasets',()=>{
  for(const name of ['password','password_hash','API_KEY','session_token','PAROLA','storage_key','ISTIHBARAT','ACIKLAMA'])assert.equal(fieldPolicy(column(name,'nvarchar'),{source:'vega',template:'TBLSTOKLAR'}),null);
  assert.equal(fieldPolicy(column('unknown_blob','varbinary'),{}),null);
  assert.equal(fieldPolicy(column('unknown_text','nvarchar'),{family:'unclassified'}),null);
  assert.ok(excludedObject.test('auth_refresh_tokens'));assert.ok(!excludedObject.test('catalogs'));
  assert.ok(!secretName.test('F0102D0007TBLSTOKENVANTER'));assert.ok(secretName.test('JWT_TOKEN'));assert.ok(secretName.test('TokenValue'));
});
test('audit stores only technical metadata and is mandatory',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'commercial-audit-test-'));
  try {const audit=createAudit(dir);audit({requestId:'unit-id',tool:'query_dataset',event:'completed',durationMs:1,rowCount:2,password:'never-log',arguments:{email:'never-log'}});
    const data=fs.readFileSync(path.join(dir,'commercial-mcp.jsonl'),'utf8');assert.ok(!data.includes('never-log'));assert.equal(JSON.parse(data).rowCount,2);
    error(()=>createAudit('relative'),'AUDIT_DIRECTORY_REQUIRED');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('all company/period virtual definitions retain source identity and documented ERP rules',()=>{
  const raw={source:'vega',company:'F0102',period:'D0007',year:2026,template:'TBLCARIHAREKETLERI',objectName:'F0102D0007TBLCARIHAREKETLERI',readable:true,from:'[dbo].[movement]',objects:[],fields:[]};
  const account={source:'vega',objectName:'F0102TBLCARI',readable:true,from:'[dbo].[account]',objects:[],fields:[]};
  const result=applySemantics([raw,account]).find(v=>v.virtual);
  assert.equal(result.company,'F0102');assert.equal(result.period,'D0007');
  assert.match(result.from,/NOT IN \(N'30',N'31'\)/);assert.match(result.from,/NULLIF\(h.KUR,0\)/);
  assert.ok(result.fields.find(f=>f.name==='balance_effect').requiredGroups.includes('currency'));
});
