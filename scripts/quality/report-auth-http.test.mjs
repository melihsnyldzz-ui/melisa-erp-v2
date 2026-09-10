import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from '../../node_modules/typescript/lib/typescript.js';
const root=fileURLToPath(new URL('../../apps/api/src/',import.meta.url));
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const express=require('express'),jwt=require('jsonwebtoken');

// Actual route/auth/JWT/permission/controller/service. Only data/config boundaries are fixtures.
// Separate from network-denied commerce suite: binds loopback ephemeral port only.
test('periodic report HTTP authorization uses current user and permissions before report reads',async()=>{
 const env={nodeEnv:'test',auth:{jwtSecret:'isolated-test-only-not-a-live-secret',refreshSecret:'isolated-test-refresh'}};
 let active=true, exists=true, granted=true, failDb=false, reportReads=0, authReads=0;
 const pool={request(){return{input(){return this;},async query(q){
  assert.ok(!/\b(INSERT|UPDATE|DELETE|MERGE|EXEC)\b/i.test(q),'no SQL mutations');
  if(q.includes('FROM dbo.users')){authReads++;if(failDb)throw Error('fixture unavailable');return{recordset:exists?[{id:1,username:'fixture',display_name:'Fixture',role_id:12,role_code:'REPORT_FIXTURE',role_name:'Fixture',is_active:active}]:[]};}
  if(q.includes('FROM dbo.permissions')){authReads++;return{recordset:granted?[{permission_key:'dashboard.view',can_view:true}]:[]};}
  reportReads++;return{recordset:[]};
 }}}};
 const allowed=new Set(['routes/dashboardRoutes.js','controllers/dashboardController.js','services/dashboardService.js','services/reportPeriod.js','services/reportMoney.js','services/authService.js','services/permissionCatalog.js','middleware/authMiddleware.js','middleware/errorHandler.js','utils/response.js']);
 const cache=new Map();
 function load(file){
  assert.ok(allowed.has(file),'unreviewed module '+file);
  if(cache.has(file))return cache.get(file);
  const exports={};cache.set(file,exports);
  const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{exports,require(id){
   if(['express','jsonwebtoken','node:crypto'].includes(id))return require(id);
   if(id==='bcrypt')return{};
   if(id==='mssql')return{BigInt:'BigInt',Date:'Date'};
   if(id.endsWith('/env.js'))return{env};
   if(id.endsWith('/database.js'))return{getSqlPool:async()=>pool};
   if(id.endsWith('/logger.js'))return{logger:{error(){}}};
   if(id.endsWith('/writeGuardService.js'))return{assertMelisaWriteEnabled(){throw Error('writes denied');}};
   if(/vegaSalesComparisonClientService|vegaSalesPerformanceClientService|vegaProductProfitabilityClientService/.test(id))return{};
   return load(path.posix.normalize(path.posix.join(path.posix.dirname(file),id)));
  }},{filename:file});return exports;
 }
 const app=express();app.use('/api',load('routes/dashboardRoutes.js').dashboardRoutes);app.use(load('middleware/errorHandler.js').errorHandler);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const url=`http://127.0.0.1:${server.address().port}/api/dashboard/periodic-accounting?dateFrom=2099-01-01&dateTo=2099-01-31`;
 const token=(patch={},secret=env.auth.jwtSecret)=>jwt.sign({sub:'1',role:'ADMIN',...patch},secret,{expiresIn:60});
 async function check(name,authorization,status,code){const before=reportReads;const response=await fetch(url,{headers:authorization?{authorization}:{}});const body=await response.json();assert.equal(response.status,status,name);if(code)assert.equal(body.error.code,code,name);if(status!==200)assert.equal(reportReads,before,name+' must not query report');return body;}
 try{
  await check('missing','',401,'AUTH_TOKEN_REQUIRED');
  await check('invalid','Bearer invalid',401,'AUTH_TOKEN_INVALID');
  await check('wrong signature','Bearer '+token({},'wrong-test-secret'),401,'AUTH_TOKEN_INVALID');
  const expired=jwt.sign({sub:'1',exp:1},env.auth.jwtSecret);
  await check('expired','Bearer '+expired,401,'AUTH_TOKEN_EXPIRED');assert.equal(authReads,0);
  const bearer='Bearer '+token();
  active=false;await check('inactive',bearer,401,'AUTH_USER_INACTIVE');active=true;
  exists=false;await check('missing user',bearer,401,'AUTH_USER_INACTIVE');exists=true;
  granted=false;await check('no grant despite ADMIN JWT claim',bearer,403,'AUTH_PERMISSION_DENIED');
  granted=true;const valid=await check('granted',bearer,200);assert.deepEqual(valid.data.dailyCash,[]);assert.ok(reportReads>0);
  granted=false;await check('grant revoked with same JWT',bearer,403,'AUTH_PERMISSION_DENIED');
  failDb=true;await check('database unavailable',bearer,500,'INTERNAL_ERROR');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
