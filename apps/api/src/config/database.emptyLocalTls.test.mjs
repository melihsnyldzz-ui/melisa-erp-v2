import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {
  EMPTY_LOCAL_PROFILE,buildEmptyLocalEnvironment,assertEmptyLocalEnvironment,emptyLocalSqlOptions,
} from '../services/emptyLocalContext.mjs';

const secrets=()=>({sqlPassword:'fixture-only-password',jwtAccessSecret:'A'.repeat(48),jwtRefreshSecret:'B'.repeat(48)});
const normalized=()=>({
  port:4294,sql:{
    enabled:true,server:'127.0.0.1',port:1433,database:EMPTY_LOCAL_PROFILE.database,
    user:EMPTY_LOCAL_PROFILE.login,password:'fixture-only-password',readOnly:true,
    trustedConnection:false,encrypt:true,trustServerCertificate:false,hostNameInCertificate:'SEMIH',
    odbcDriver:'Fixture Driver',
  },
});
const databaseSource=await readFile(new URL('./database.js',import.meta.url),'utf8');
const configurationStart=databaseSource.indexOf('export function getSqlConfig()');
const configurationEnd=databaseSource.indexOf('export function getSafeSqlInfo()',configurationStart);
assert.ok(configurationStart>=0&&configurationEnd>configurationStart);
const configurationFunction=databaseSource.slice(configurationStart,configurationEnd).replace('export function','function');
// Only the pure configuration function is evaluated. No mssql module,
// ConnectionPool constructor, connection factory, connect() or SQL query is loaded.
assert.doesNotMatch(configurationFunction,/ConnectionPool|\.connect\s*\(|\.query\s*\(/);
function configured(environment,{registered=true,profileSelected=true}={}){
  const calls=[];
  const scope={
    env:environment,process:{env:profileSelected?{MELISA_EMPTY_LOCAL:'20261105'}:{}},
    getEmptyLocalContext:()=>registered?{profile:EMPTY_LOCAL_PROFILE.id}:null,
    assertRegisteredEmptyLocalContext:()=>{calls.push('registered');if(!registered)throw Object.assign(Error('registration required'),{code:'EMPTY_LOCAL_PROFILE_REJECTED'});},
    emptyLocalSqlOptions,
    isCanonicalTest:()=>{calls.push('canonical');return false;},
    isIsolatedOperationCopyRuntime:()=>false,
    isIsolatedCopyReadonlyRuntime:()=>false,
  };
  vm.runInNewContext(configurationFunction+';globalThis.result=getSqlConfig();',scope);
  return {config:scope.result,calls};
}

test('registered empty SQL config verifies SEMIH while preserving loopback TCP and strict TLS',()=>{
  const {config}=configured(normalized());
  assert.equal(config.server,'127.0.0.1');assert.equal(config.port,1433);
  assert.equal(config.database,EMPTY_LOCAL_PROFILE.database);assert.equal(config.user,EMPTY_LOCAL_PROFILE.login);
  assert.equal(config.options.serverName,'SEMIH');
  assert.equal(config.options.encrypt,true);assert.equal(config.options.trustServerCertificate,false);
  assert.equal(config.options.readOnlyIntent,true);
  assert.equal(config.connectionTimeout,5000);assert.equal(config.requestTimeout,5000);
  assert.equal(config.connectionString,undefined);
});

test('hostname overrides, trust downgrade, changed transport and writable target fail before branch return',()=>{
  const mutations={
    hostNameInCertificate:[undefined,'semih','other','127.0.0.1','SEMIH\\MELISADEV'],
    server:['other','localhost'],port:[1434],database:['MELISA_ERP_SIRKET_TEST_20260929_01'],
    user:['sa'],readOnly:[false],trustedConnection:[true],encrypt:[false],trustServerCertificate:[true],
    serverName:['other'],options:[{serverName:'other'},{trustServerCertificate:true}],
  };
  for(const [key,values]of Object.entries(mutations))for(const value of values){
    const input=normalized();input.sql[key]=value;
    assert.throws(()=>configured(input),{code:'EMPTY_LOCAL_PROFILE_REJECTED'},key);
  }
  assert.throws(()=>configured({...normalized(),port:4144}),{code:'EMPTY_LOCAL_PROFILE_REJECTED'});
  assert.throws(()=>configured({...normalized(),options:{serverName:'other'}}),{code:'EMPTY_LOCAL_PROFILE_REJECTED'});
});

test('a selected but unregistered profile cannot construct even a trusted configuration',()=>{
  const input=normalized();input.sql.trustedConnection=true;
  assert.throws(()=>configured(input,{registered:false}),{code:'EMPTY_LOCAL_PROFILE_REJECTED'});
});

test('legacy TDS and ODBC configuration retain their existing name and trust behavior',()=>{
  const input=normalized();
  input.port=4100;input.sql.database='legacy_fixture';input.sql.user='legacy_fixture';
  input.sql.hostNameInCertificate='unrelated-legacy-value';
  input.sql.encrypt=false;input.sql.trustServerCertificate=true;
  const {config}=configured(input,{registered:false,profileSelected:false});
  assert.equal(config.options.serverName,undefined);
  assert.equal(config.options.encrypt,false);assert.equal(config.options.trustServerCertificate,true);
  assert.equal(config.connectionTimeout,10000);assert.equal(config.requestTimeout,10000);
  input.sql.trustedConnection=true;
  const trusted=configured(input,{registered:false,profileSelected:false}).config;
  assert.match(trusted.connectionString,/Trusted_Connection=Yes/);
  assert.match(trusted.connectionString,/TrustServerCertificate=Yes/);
  assert.equal(trusted.options,undefined);
});

test('env mapping exposes the certificate name only to the empty profile without reading dotenv',async()=>{
  let source=await readFile(new URL('./env.js',import.meta.url),'utf8');
  source=source.replace("import dotenv from 'dotenv';",'')
    .replace('export const env =','const env =')
    .replace('export function getStartupWarnings()','function getStartupWarnings()');
  function read(environment){
    let dotenvCalls=0;
    const scope={process:{env:environment,platform:'win32'},dotenv:{config(){dotenvCalls++;}}};
    vm.runInNewContext(source+';globalThis.result=env;',scope);
    return {env:scope.result,dotenvCalls};
  }
  const empty=read(buildEmptyLocalEnvironment(secrets()));
  assert.equal(empty.dotenvCalls,0);assert.equal(empty.env.sql.hostNameInCertificate,'SEMIH');
  const legacy=read({SQL_HOST_NAME_IN_CERTIFICATE:'unrelated-legacy-value'});
  assert.equal(legacy.dotenvCalls,2);assert.equal(Object.hasOwn(legacy.env.sql,'hostNameInCertificate'),false);
});

test('environment fixes SEMIH, discards inherited overrides and rejects runtime TLS bypass values',()=>{
  const environment=buildEmptyLocalEnvironment(secrets(),{
    SQL_HOST_NAME_IN_CERTIFICATE:'other',SQL_SERVER_NAME:'other',
    NODE_TLS_REJECT_UNAUTHORIZED:'0',NODE_EXTRA_CA_CERTS:'fixture-only.pem',
  });
  assert.equal(environment.SQL_HOST_NAME_IN_CERTIFICATE,'SEMIH');
  for(const key of ['SQL_SERVER_NAME','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS'])assert.equal(environment[key],undefined);
  assert.doesNotThrow(()=>assertEmptyLocalEnvironment(environment));
  for(const [key,values]of Object.entries({
    SQL_HOST_NAME_IN_CERTIFICATE:[undefined,'','semih','other','127.0.0.1'],
    SQL_SERVER_NAME:['other'],SQL_HOSTNAME_IN_CERTIFICATE:['other'],
    NODE_TLS_REJECT_UNAUTHORIZED:['0'],NODE_EXTRA_CA_CERTS:['fixture-only.pem'],
    SQL_SERVER:['localhost','other'],SQL_PORT:['1434'],
    SQL_ENCRYPT:['false'],SQL_TRUST_SERVER_CERTIFICATE:['true'],
  }))for(const value of values)assert.throws(()=>assertEmptyLocalEnvironment({...environment,[key]:value}),{code:'EMPTY_LOCAL_PROFILE_REJECTED'},key);
});

test('the startup probe uses the same verified TLS options before any pool construction',async()=>{
  const source=await readFile(new URL('../emptyLocalServer.mjs',import.meta.url),'utf8');
  const validation=source.indexOf('const probeSqlOptions=emptyLocalSqlOptions(');
  const driver=source.indexOf("await import('mssql')");
  const pool=source.indexOf('new sql.ConnectionPool(');
  assert.ok(validation>=0&&validation<driver&&driver<pool);
  assert.match(source,/hostNameInCertificate:process\.env\.SQL_HOST_NAME_IN_CERTIFICATE/);
  assert.match(source,/options:probeSqlOptions/);
  assert.match(source,/server:EMPTY_LOCAL_PROFILE\.host,port:EMPTY_LOCAL_PROFILE\.sqlPort/);
  assert.ok(source.indexOf('assertEmptyLocalEnvironment();')<validation);
});
