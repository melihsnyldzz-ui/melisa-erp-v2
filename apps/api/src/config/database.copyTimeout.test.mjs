import test,{mock} from 'node:test';
import assert from 'node:assert/strict';

const env={port:4200,sql:{}},state={writer:false,reader:false},created=[];
const copy={target:{database:'isolated_fixture',server:'fixture_server',login:'fixture_writer'}};
const readerRuntime={database:copy.target.database,server:copy.target.server,user:'fixture_reader'};
class ConnectionPool{
 constructor(config){this.config=config;created.push(this);}
 async connect(){return this;}
 async close(){}
 request(){throw Error('Configuration tests must not query SQL');}
}
const trusted={ConnectionPool},tds={ConnectionPool};
mock.module('mssql',{defaultExport:tds});
mock.module('mssql/msnodesqlv8.js',{defaultExport:trusted});
mock.module('./env.js',{namedExports:{env}});
mock.module('./isolatedOperationCopyRuntime.mjs',{namedExports:{
 isIsolatedOperationCopyRuntime:()=>state.writer,
 getIsolatedOperationCopyConfig:()=>copy,
 isIsolatedCopyReadonlyRuntime:()=>state.reader,
 getIsolatedCopyReadonlyRuntime:()=>({runtime:readerRuntime,context:copy}),
}});
mock.module('../services/isolatedOperationCopyContext.mjs',{namedExports:{isolatedCopyTopology:()=>({apiPort:4200,nativePort:4201})}});
mock.module('../services/crmOrderCurrentContext.mjs',{namedExports:{getCrmOrderCurrentContext:()=>null,assertCrmOrderCurrentIdentity:()=>{throw Error('No CRM context in this test');}}});
const {getSqlConfig,getSqlDriver,getSqlPool,closeSqlPool}=await import('./database.js');
function reset(){
 state.writer=false;state.reader=false;env.port=4200;
 env.sql={enabled:true,database:'ordinary_fixture',server:'fixture_server',user:'fixture_user',password:'test-only',readOnly:true,trustedConnection:false,odbcDriver:'{Fixture Driver}',encrypt:true,trustServerCertificate:false,port:1433};
}

test('ordinary TDS, trusted ODBC, canonical DB01 and production candidate retain 10s budgets',()=>{
 reset();
 const canonicalBefore=process.env.MELISA_CANONICAL_TEST;
 try{
  process.env.MELISA_CANONICAL_TEST='true';
  for(const configure of [()=>{},()=>{env.sql.trustedConnection=true;},()=>{env.sql.database='MELISA_ERP_SIRKET_TEST_20260929_01';env.sql.user='melisa_sirket_test_20260929_01';},()=>{env.sql.database='MELISA_ERP_PROD_CANDIDATE_20260917_01';}]){
   reset();configure();const config=getSqlConfig();
   assert.equal(config.requestTimeout,10000);assert.equal(config.connectionTimeout,10000);
  }
 }finally{if(canonicalBefore===undefined)delete process.env.MELISA_CANONICAL_TEST;else process.env.MELISA_CANONICAL_TEST=canonicalBefore;}
});

test('registered copy writer and reader pass identity gates with 60s requests and unchanged connection/pool settings',async()=>{
 for(const mode of ['writer','reader']){
  reset();state[mode]=true;env.sql.database=copy.target.database;
  env.sql.user=mode==='writer'?copy.target.login:readerRuntime.user;
  env.sql.readOnly=mode==='reader';env.port=mode==='writer'?4200:4201;
  const config=getSqlConfig();assert.equal(config.requestTimeout,60000);assert.equal(config.connectionTimeout,10000);
  assert.equal(getSqlDriver(),trusted);assert.match(config.connectionString,/Trusted_Connection=No/);
  if(mode==='writer')assert.deepEqual(config.pool,{max:10,min:1,idleTimeoutMillis:30000});else assert.equal(config.pool,undefined);
  const pool=await getSqlPool();assert.equal(pool.config.requestTimeout,60000);await closeSqlPool();
 }
});

test('copy-like environment without registration has no longer timeout or write grant',async()=>{
 reset();env.sql.database=copy.target.database;env.sql.user=copy.target.login;env.sql.readOnly=false;
 assert.equal(getSqlConfig().requestTimeout,10000);
 const count=created.length;await assert.rejects(getSqlPool(),{code:'SQL_WRITE_TARGET_INVALID'});assert.equal(created.length,count);
});

test('longer copy timeout does not bypass writer or reader identity gates',async()=>{
 for(const mode of ['writer','reader'])for(const change of [()=>{env.sql.database='other_fixture';},()=>{env.sql.server='other_server';},()=>{env.sql.user='other_user';},()=>{env.sql.readOnly=!env.sql.readOnly;},()=>{env.sql.trustedConnection=true;},()=>{env.port=4999;}]){
  reset();state[mode]=true;env.sql.database=copy.target.database;env.sql.user=mode==='writer'?copy.target.login:readerRuntime.user;env.sql.readOnly=mode==='reader';env.port=mode==='writer'?4200:4201;change();
  const count=created.length;
  await assert.rejects(getSqlPool(),{code:mode==='writer'?'ISOLATED_COPY_RUNTIME_REJECTED':'ISOLATED_COPY_READER_REJECTED'});
  assert.equal(created.length,count,'invalid copy identity must fail before constructing a pool');
 }
});
