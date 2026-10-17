import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {crmPackageSourcePath} from '../../scripts/canonical/build-crm-order-package.mjs';
import {currentFixtureInput,extendedFixtureInput} from '../../scripts/canonical/crm-order-current.test-fixture.mjs';
import {crmPriceFixture} from './src/services/__tests__/crmOrderPriceFixture.mjs';

const repository=fileURLToPath(new URL('../../',import.meta.url));
const guard=path.join(repository,'scripts','ci','offline-guard.cjs');
const prefix='crm-projected-bootstrap-';

// This deliberately uses the release source allowlist, not a checkout symlink:
// every ERP SQL compiler is absent, so repository imports cannot hide a gap.
function withProjection(run){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),prefix));
 try{
  for(const directory of ['apps/api','packages/shared','scripts/canonical']){
   const walk=relative=>{for(const row of fs.readdirSync(path.join(repository,relative),{withFileTypes:true})){
    if(row.name==='node_modules'||row.name==='.git')continue;
    const name=relative+'/'+row.name;
    if(row.isDirectory())walk(name);
    else if(row.isFile()&&crmPackageSourcePath(name)){
     const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(repository,name),target);
    }
   }};walk(directory);
  }
  fs.symlinkSync(path.join(repository,'apps/api/node_modules'),path.join(root,'apps/api/node_modules'),process.platform==='win32'?'junction':'dir');
  assert.deepEqual(fs.readdirSync(path.join(root,'scripts/canonical')),['shared-crm-price-contract.mjs']);
  return run(root);
 }finally{
  // Only the freshly created test tree is removed; detach its dependency link
  // before recursive removal so Windows cannot traverse the checkout junction.
  assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
  assert(path.basename(root).startsWith(prefix));assert(!fs.lstatSync(root).isSymbolicLink());
  const link=path.join(root,'apps/api/node_modules');if(fs.existsSync(link)){assert(fs.lstatSync(link).isSymbolicLink());fs.unlinkSync(link);}
  fs.rmSync(root,{recursive:true,force:true});
 }
}

const childSource=String.raw`
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const fixture=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),api=process.cwd(),require=createRequire(path.join(api,'package.json'));
const sql=require('mssql'),express=require('express');let connects=0,closes=0,listens=0,app;
const input=fixture.input,identity={databaseName:input.target.database,serverName:input.target.server,loginName:input.target.login,databaseUser:input.target.databaseUser,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0};
const execute=fixture.price?['dbo.usp_shared_crm_order_customers','dbo.usp_shared_crm_order_read','dbo.usp_shared_crm_price_create_v1','dbo.usp_shared_crm_price_proof_v1','dbo.usp_shared_crm_price_read_v1']:['dbo.usp_shared_crm_order_create','dbo.usp_shared_crm_order_customers','dbo.usp_shared_crm_order_read'];
let priceProofs=0;
sql.ConnectionPool.prototype.connect=async function(){connects++;return this;};
sql.ConnectionPool.prototype.close=async function(){closes++;};
sql.ConnectionPool.prototype.request=function(){return {query:async text=>{
 if(text.startsWith('EXEC dbo.usp_shared_crm_price_proof_v1')){priceProofs++;return structuredClone(fixture.price.result);}
 if(text.includes('proofDefinitionHash'))return {recordset:[fixture.price.identity]};
 if(text.includes('sys.fn_my_permissions'))return {recordset:[]};
 if(text.includes('FROM sys.procedures p'))return {recordset:execute.toSorted().map(name=>({name}))};
 assert(text.startsWith('SELECT DB_NAME()'),'Unexpected SQL in offline bootstrap');return {recordset:[identity]};
 }};};
express.application.listen=function(port,host,ready){listens++;app=this;assert.equal(port,input.nativePort);assert.equal(host,'127.0.0.1');ready();return {on(){return this;},close(fn){fn?.();}};};
if(fixture.mode==='env-only'){
 Object.assign(process.env,{MELISA_CRM_SHARED_TEST:'true',SQL_DATABASE:input.target.database,SQL_USER:input.target.login,SQL_READ_ONLY:'false',API_PORT:String(input.nativePort)});
 await assert.rejects(import('./src/config/database.js'),error=>error.code==='ERR_MODULE_NOT_FOUND'&&/shared-business-(?:product-price-sale|selected-sale-revision)-bootstrap\.mjs$/.test(error.url??''));
 assert.equal(connects,0);assert.equal(listens,0);console.log('PROJECTED_PASS');
}else{
 const config={crmOrderCurrentContext:input,database:input.target.database,sqlUser:input.target.login,server:'127.0.0.1',sqlPort:1433,host:'127.0.0.1',nativePort:input.nativePort,sqlPassword:'OFFLINE_SYNTHETIC',jwtAccessSecret:'a'.repeat(64),jwtRefreshSecret:'b'.repeat(64),...(fixture.price?{crmOrderPriceContext:fixture.price.revision}:{})};
 const configPath=path.resolve('../../synthetic-config.json');fs.writeFileSync(configPath,JSON.stringify(config));fs.writeFileSync(path.resolve('../../release-manifest.json'),JSON.stringify({schemaVersion:4,sharedCurrentTest:true,database:input.target.database,port:input.nativePort,sourceCommit:'a'.repeat(40),packageId:'offline-projection'}));
 process.argv=[process.execPath,path.join(api,'start-crm-order-test.mjs'),'--shared-current-test',configPath];
 if(fixture.mode==='bad-proof'){
  await assert.rejects(import('./start-crm-order-test.mjs'),{code:'CRM_V2_TARGET_UNAVAILABLE'});
  const {getCrmOrderCurrentContext}=await import('./src/services/crmOrderCurrentContext.mjs');assert.equal(getCrmOrderCurrentContext(),null);assert.equal(listens,0);assert.equal(connects,1);assert.equal(closes,1);
 }else{
  await import('./start-crm-order-test.mjs');assert.equal(listens,1);assert.equal(connects,2);assert.equal(closes,1);assert.equal(priceProofs,fixture.price?2:0);
  const healthRoute=(app._router?.stack??app.router?.stack).find(layer=>layer.route?.path==='/test-health');let health;healthRoute.route.stack[0].handle({}, {json:value=>{health=value;}});assert.equal(health.database,input.target.database);assert.equal(health.copyId,input.copyId);assert.equal(health.port,input.nativePort);for(const field of ['actualT1','stockEffect','ledgerEffect','reservationEffect','externalOperations','automaticJobs'])assert.equal(health[field],false);assert.equal(health.ok,true);
  const database=await import('./src/config/database.js');assert.strictEqual(database.getSqlDriver(),sql);assert(!(database.getSqlDriver() instanceof Promise));
  assert(Object.keys(require.cache).every(p=>!/[\\/]mssql[\\/]lib[\\/]msnodesqlv8[\\/]/.test(p)));
  const runtime=await import('./src/config/isolatedOperationCopyRuntime.mjs');assert.equal(runtime.isIsolatedOperationCopyRuntime(),false);assert.equal(runtime.isIsolatedCopyReadonlyRuntime(),false);
  for(const [method,code] of [['registerIsolatedOperationCopyRuntime','ISOLATED_COPY_RUNTIME_REJECTED'],['registerIsolatedCopyReadonlyRuntime','ISOLATED_COPY_READER_REJECTED'],['getIsolatedOperationCopyConfig','ISOLATED_COPY_RUNTIME_REQUIRED'],['getIsolatedCopyReadonlyRuntime','ISOLATED_COPY_READER_REQUIRED']])assert.throws(()=>runtime[method]({},{}),{code,statusCode:503});
  const {sharedCopyAuthClaims}=await import('./src/services/sharedCopyAuthClaims.mjs');assert.deepEqual(sharedCopyAuthClaims(null),{});assert.throws(()=>sharedCopyAuthClaims(input),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED',statusCode:503});
  const {canonicalTestAdminContext,resolveTestAdminUser}=await import('./src/services/canonicalTestAdminSession.mjs');assert.throws(()=>canonicalTestAdminContext({}),{code:'TEST_ADMIN_SCOPE'});const user={id:15,permissions:['crm.view']};assert.strictEqual(resolveTestAdminUser({}, {},user),user);assert.throws(()=>resolveTestAdminUser({}, {canonicalTestAdmin:true,sub:'16'},user),{code:'TEST_ADMIN_SCOPE'});
  const {requirePermission}=await import('./src/middleware/authMiddleware.js');let error;requirePermission('crm.send')({user},null,e=>{error=e;});assert.equal(error.code,'AUTH_PERMISSION_DENIED');assert.equal(error.statusCode,403);
  const {assertMelisaWriteEnabled}=await import('./src/services/writeGuardService.js');assert.throws(assertMelisaWriteEnabled,{code:'SQL_WRITE_TARGET_INVALID',statusCode:403});
  const {env}=await import('./src/config/env.js');env.sql.database='MELISA_ERP_PROD_CANDIDATE_20260917_01';env.sql.readOnly=false;assert.throws(assertMelisaWriteEnabled,{code:'SQL_WRITE_TARGET_INVALID',statusCode:403});await assert.rejects(database.getSqlPool(),{code:'CRM_SHARED_SQL_IDENTITY_CHANGED',statusCode:403});
  await database.closeSqlPool();assert.equal(closes,2);assert(app);
 }
 console.log('PROJECTED_PASS');
}
`;

function runProjection(input,{priced=false,mode='valid'}={}){
 return withProjection(root=>{
  const price=priced?crmPriceFixture():null;
  if(mode==='bad-proof')price.result.recordsets[8][0].transactionId='999';
  const fixture={input,mode,price:price&&{revision:price.revision,result:price.result,identity:price.identity}};
  const fixturePath=path.join(root,'fixture.json'),runner=path.join(root,'apps/api/offline-runner.mjs');fs.writeFileSync(fixturePath,JSON.stringify(fixture));fs.writeFileSync(runner,childSource);
  const output=execFileSync(process.execPath,['--require',guard,runner,fixturePath],{cwd:path.join(root,'apps/api'),encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
  assert(output.trim().endsWith('PROJECTED_PASS'));
 });
}

test('projected DB01 native bootstrap reaches actual middleware, routes and listener registration without ERP compilers',()=>runProjection(currentFixtureInput()));
test('projected DB02 price bootstrap earns two independent nine-set proofs and reaches normal listener imports',()=>runProjection(extendedFixtureInput(),{priced:true}));
test('projected price bootstrap refuses malformed native proof before context or listener registration',()=>runProjection(extendedFixtureInput(),{priced:true,mode:'bad-proof'}));
test('environment-only CRM flags cannot bypass missing ERP dependencies or manufacture startup health',()=>runProjection(extendedFixtureInput(),{mode:'env-only'}));

test('ordinary ERP imports retain registered-copy authority only inside the real operation scope',()=>{
 const source=String.raw`
  import assert from 'node:assert/strict';import {mock} from 'node:test';
  mock.module(new URL('./apps/api/node_modules/mssql/msnodesqlv8.js',import.meta.url).href,{defaultExport:{ConnectionPool:class{constructor(){throw Error('No SQL connection in an import regression');}}}});
  const {fixtureContext,fixtureIdentity,fixtureProof}=await import('./apps/api/src/services/isolatedOperationCopyContext.test.mjs');
  const {validateIsolatedOperationCopyContext,isolatedCopyTopology}=await import('./apps/api/src/services/isolatedOperationCopyContext.mjs');
  const copy=validateIsolatedOperationCopyContext(fixtureContext()),topology=isolatedCopyTopology(copy);
  Object.assign(process.env,{SQL_DATABASE:copy.target.database,SQL_SERVER:copy.target.server,SQL_USER:copy.target.login,SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:String(topology.apiPort)});
  const runtime=await import('./apps/api/src/config/isolatedOperationCopyRuntime.mjs');
  runtime.registerIsolatedOperationCopyRuntime(copy,{database:copy.target.database,server:copy.target.server,user:copy.target.login,readOnly:false,trustedConnection:false,port:topology.apiPort,externalProvidersDisabled:true});
  assert.strictEqual(runtime.getIsolatedOperationCopyConfig(),copy);assert.equal(runtime.isIsolatedOperationCopyRuntime(),true);
  const {assertMelisaWriteEnabled}=await import('./apps/api/src/services/writeGuardService.js');assert.throws(assertMelisaWriteEnabled,{code:'SQL_WRITE_TARGET_INVALID',statusCode:403});
  const {withIsolatedOperationCopyScope}=await import('./apps/api/src/services/isolatedOperationCopyScope.mjs');
  await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),transaction:{},readProof:fixtureProof(copy),write:true},()=>assert.doesNotThrow(assertMelisaWriteEnabled));
  assert.throws(assertMelisaWriteEnabled,{code:'SQL_WRITE_TARGET_INVALID',statusCode:403});console.log('ERP_IMPORT_PASS');`;
 const output=execFileSync(process.execPath,['--require',guard,'--experimental-test-module-mocks','--input-type=module','-e',source],{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
 assert(output.trim().endsWith('ERP_IMPORT_PASS'));
});
