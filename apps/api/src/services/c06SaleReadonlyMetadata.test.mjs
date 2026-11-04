import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';

const env={port:4146,sql:{enabled:true,server:'127.0.0.1',port:1433,database:'MELISA_ERP_SIRKET_TEST_20260929_01',
  user:'melisa_sirket_test_20260929_01',readOnly:true,trustedConnection:false}};
let state;
mock.module('../config/env.js',{namedExports:{env}});
const missingDatabase=mock.module('../config/database.js',{namedExports:{isCanonicalTest:()=>state.canonical,
  getSqlPool:async()=>{throw Error('must not open a pool');}}});
const missingReader=(await import('./c06SaleReadonlyMetadata.mjs?missing')).readC06SaleReadonlyMetadata;
missingDatabase.restore();
mock.module('../config/database.js',{namedExports:{isCanonicalTest:()=>state.canonical,
  getExistingCanonicalReadonlyPool:async()=>{state.pool++;return {connected:state.connected,request:()=>({query:async sql=>{
    state.queries.push(sql);if(state.error) throw Error('private driver detail');return {recordset:state.rows};
  }})};}}});
const {readC06SaleReadonlyMetadata:read}=await import('./c06SaleReadonlyMetadata.mjs');
const names=['usp_canonical_business_sale_resolve_v1','usp_canonical_business_sale_context_v1','usp_canonical_business_sale_begin_v1'];
const row=name=>({objectName:name,definitionHash:'A'.repeat(64),usesAnsiNulls:true,usesQuotedIdentifier:1,
  executeAsPrincipalId:-2,isSchemaBound:false,usesNativeCompilation:0});
beforeEach(()=>{state={canonical:true,pool:0,queries:[],connected:true,rows:names.map(row)};
  env.port=4146;Object.assign(env.sql,{enabled:true,server:'127.0.0.1',port:1433,database:'MELISA_ERP_SIRKET_TEST_20260929_01',
    user:'melisa_sirket_test_20260929_01',readOnly:true,trustedConnection:false});});

test('fixed read returns only hash and options, with no assumed current expected hash',async()=>{
  const result=await read();assert.equal(state.pool,1);assert.equal(state.queries.length,1);
  assert.deepEqual(result.modules.map(x=>x.name),names);assert.equal(result.modules[2].definitionHash,'A'.repeat(64));
  assert.equal(result.modules[0].options.executeAsPrincipalId,-2);
  assert.equal(result.modules[0].options.signatureCount,null);
  assert.deepEqual(Object.keys(result.modules[0]).sort(),['definitionHash','name','options','status']);
  const q=state.queries[0];assert.match(q,/^SELECT /);assert.doesNotMatch(q,/\b(?:EXEC(?:UTE)?|INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|GRANT|REVOKE)\b/i);
  for(const fixed of ["DB_ID()=18","SERVERPROPERTY('ServerName')","SERVERPROPERTY('MachineName')","SERVERPROPERTY('InstanceName')",
    "SUSER_SNAME()","USER_NAME()","IS_SRVROLEMEMBER('sysadmin')=0","HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL')=0"])
    assert.ok(q.includes(fixed));
  assert.deepEqual([...new Set([...q.matchAll(/sys\.[a-z_]+/gi)].map(m=>m[0].toLowerCase()))].sort(),['sys.objects','sys.sql_modules']);
  for(const n of names) assert.equal(q.split(`N'${n}'`).length-1,1);
});
test('wrong environment cannot get a pool or issue SQL',async()=>{
  const cases=[()=>state.canonical=false,()=>env.port=4144,()=>env.sql.readOnly=false,()=>env.sql.trustedConnection=true,
    ()=>env.sql.enabled=false,()=>env.sql.server='other',()=>env.sql.port=1434,()=>env.sql.database='other',()=>env.sql.user='other'];
  for(const mutate of cases){before();mutate();await assert.rejects(read(),{code:'C06_SALE_METADATA_UNAVAILABLE'});assert.equal(state.pool,0);}
  function before(){state.canonical=true;state.pool=0;env.port=4146;Object.assign(env.sql,{enabled:true,server:'127.0.0.1',port:1433,database:'MELISA_ERP_SIRKET_TEST_20260929_01',user:'melisa_sirket_test_20260929_01',readOnly:true,trustedConnection:false});}
});
test('missing existing-only accessor or disconnected pool cannot issue SQL',async()=>{
  await assert.rejects(missingReader(),{code:'C06_SALE_METADATA_UNAVAILABLE'});assert.equal(state.pool,0);assert.equal(state.queries.length,0);
  state.connected=false;await assert.rejects(read(),{code:'C06_SALE_METADATA_UNAVAILABLE'});assert.equal(state.queries.length,0);
});
test('missing or invisible modules stay UNKNOWN rather than a fabricated zero/hash',async()=>{
  state.rows=[row(names[0]),{objectName:names[1],definitionHash:null}];
  const result=await read();assert.deepEqual(result.modules.slice(1),names.slice(1).map(name=>({name,status:'UNKNOWN'})));
});
test('duplicate, foreign and malformed metadata fail closed',async()=>{
  for(const rows of [[row(names[0]),row(names[0])],[row('unexpected')],[{...row(names[0]),definitionHash:'bad'}],
    [{...row(names[0]),usesAnsiNulls:null}],[{...row(names[0]),executeAsPrincipalId:'-2'}]]){
    state.rows=rows;await assert.rejects(read(),{code:'C06_SALE_METADATA_UNAVAILABLE'});
  }
});
test('SQL failures expose no driver detail or body',async()=>{
  state.error=true;await assert.rejects(read(),e=>e.code==='C06_SALE_METADATA_UNAVAILABLE'&&!e.message.includes('private'));
});
