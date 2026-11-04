import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import express from 'express';

const env={port:4146,auth:{jwtSecret:'fixture',refreshSecret:'fixture'},sql:{enabled:true,server:'127.0.0.1',port:1433,
 database:'MELISA_ERP_SIRKET_TEST_20260929_01',user:'melisa_sirket_test_20260929_01',password:'fixture',
 readOnly:true,trustedConnection:false,odbcDriver:'fixture',encrypt:false,trustServerCertificate:true}};
const state={constructs:0,queries:[],readCalls:0,closeDuringVerify:false};let db;
class Pool {
 constructor(){state.constructs++;this.connected=false;}
 async connect(){this.connected=true;return this;}
 async close(){this.connected=false;}
 request(){return {input(){return this;},async query(sql){
  state.queries.push(sql);
  if(sql.includes('FROM dbo.users u')) return {recordset:[{id:17,username:'fixture-user',display_name:'Fixture',password_hash:'fixture',role_id:17,role_code:'fixture-role',role_name:'Fixture',role_is_active:true,is_active:true}]};
  if(sql.includes('FROM dbo.permissions'))return {recordset:[{permission_key:'audit.view',can_view:1}]};
  throw Error('unexpected fixture query');
 }}};
}
const driver={ConnectionPool:Pool,BigInt:'fixture'};
mock.module('mssql',{defaultExport:driver});mock.module('mssql/msnodesqlv8.js',{defaultExport:driver});
mock.module('bcrypt',{defaultExport:{}});
mock.module('jsonwebtoken',{defaultExport:{verify:()=>{if(state.closeDuringVerify)state.closing=db.closeSqlPool();return {sub:'17'};}}});
mock.module('../config/env.js',{namedExports:{env}});
mock.module('../config/isolatedOperationCopyRuntime.mjs',{namedExports:{isIsolatedOperationCopyRuntime:()=>false,getIsolatedOperationCopyConfig:()=>null,isIsolatedCopyReadonlyRuntime:()=>false,getIsolatedCopyReadonlyRuntime:()=>null}});
mock.module('../services/isolatedOperationCopyContext.mjs',{namedExports:{isolatedCopyTopology:()=>null}});
mock.module('../services/crmOrderCurrentContext.mjs',{namedExports:{getCrmOrderCurrentContext:()=>null,assertCrmOrderCurrentIdentity:()=>{}}});
mock.module('../services/cleanSyntheticContext.mjs',{namedExports:{getCleanContext:()=>null,assertRegisteredCleanContext:()=>{},assertCleanIdentity:()=>{},CLEAN_IDENTITY_SQL:''}});
mock.module('../services/canonicalBusinessSessionContext.mjs',{namedExports:{getCanonicalBusinessSession:()=>null,businessSessionFingerprintWitness:()=>null,assertBusinessSessionPermissionRows:()=>{},getCanonicalBusinessSigningKey:()=>null,validateBusinessSessionProfile:()=>{}}});
mock.module('../services/permissionCatalog.js',{namedExports:{applyRolePermissionDefaults:permissions=>permissions,expandPermissions:rows=>rows.map(r=>r.permission_key)}});
mock.module('../services/writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{throw Error('unexpected write');}}});
mock.module('../services/sharedCopyAuthClaims.mjs',{namedExports:{sharedCopyAuthClaims:()=>({})}});
mock.module('../services/normalTestRefreshSession.mjs',{namedExports:{bindNormalTestFingerprint:user=>user,configuredNormalTestRefreshStore:()=>null}});
mock.module('../services/semihTestIdentityPolicy.mjs',{namedExports:{allowsProtectedNormalTestUser:()=>false,configuredSemihTestIdentity:()=>null,matchesSemihTestUser:()=>false,requiresCleanPersonalNormalWitness:()=>false,bindCleanPersonalNormalTestUser:()=>{}}});
db=await import('../config/database.js');
const {createC06SaleReadonlyMetadataRoutes}=await import('./c06SaleReadonlyMetadataRoutes.mjs');
const path='/api/maintenance/sale-metadata';
test('real requireAuth/getUserById uses existing-only pool in the route async chain',async()=>{
 process.env.MELISA_CANONICAL_TEST='true';const pool=await db.getSqlPool();
 const app=express();app.use('/api',createC06SaleReadonlyMetadataRoutes({reader:async()=>{state.readCalls++;return {modules:[]};}}));
 app.use((error,_req,res,_next)=>res.status(error.statusCode??500).end());
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const call=()=>new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'127.0.0.1:4146',authorization:'Bearer fixture'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
 try{
  assert.equal(await call(),200);assert.equal(state.readCalls,1);assert.equal(state.queries.length,2);assert.equal(state.constructs,1);
  state.queries=[];state.closeDuringVerify=true;
  assert.equal(await call(),503);await state.closing;assert.equal(state.queries.length,0);assert.equal(state.readCalls,1);assert.equal(state.constructs,1);
  assert.equal(await call(),503);assert.equal(state.constructs,1);
  state.closeDuringVerify=false;const next=await db.getSqlPool();assert.notEqual(next,pool);assert.equal(state.constructs,2);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.closeSqlPool();}
});
