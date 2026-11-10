import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import express from 'express';
import {GRANULAR_PERMISSIONS} from '../services/permissionCatalog.js';

const env={port:4146,auth:{jwtSecret:'fixture',refreshSecret:'fixture'},sql:{enabled:true,server:'127.0.0.1',port:1433,
 database:'MELISA_ERP_SIRKET_TEST_20260929_01',user:'melisa_sirket_test_20260929_01',password:'fixture',
 readOnly:true,trustedConnection:false,odbcDriver:'fixture',encrypt:false,trustServerCertificate:true}};
const state={constructs:0,queries:[],readCalls:0,closeDuringVerify:false,session:'valid',authDataReads:0,permissions:['audit.view']};let db;
class Pool {
 constructor(){state.constructs++;this.connected=false;}
 async connect(){this.connected=true;return this;}
 async close(){this.connected=false;}
 request(){return {input(){return this;},async query(sql){
  state.queries.push(sql);
  const guarded=sql.startsWith('IF ISNULL(DB_ID(),-1)<>18')&&sql.includes("ISNULL(HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01'),-1)<>0")&&sql.includes('ELSE BEGIN');
  // Driver double only: this models rejection by the guard branch. It does
  // not execute T-SQL or prove actual SQL Server semantics.
  const session=state.sessionQueue?.length?state.sessionQueue.shift():state.session;
  if(guarded&&session!=='valid')throw Error('private SQL identity rejection');
  state.authDataReads++;
  if(state.closeAfterQuery){state.closeAfterQuery=false;await db.closeSqlPool();}
  if(sql.includes('FROM dbo.users u')) return {recordset:[{id:17,username:'fixture-user',display_name:'Fixture',password_hash:'fixture',role_id:17,role_code:'fixture-role',role_name:'Fixture',role_is_active:true,is_active:true}]};
  if(sql.includes('FROM dbo.permissions'))return {recordset:state.permissions.map(permission_key=>({permission_key,can_view:1}))};
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
mock.module('../services/permissionCatalog.js',{namedExports:{GRANULAR_PERMISSIONS,applyRolePermissionDefaults:permissions=>permissions,expandPermissions:rows=>rows.map(r=>r.permission_key)}});
mock.module('../services/writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{throw Error('unexpected write');}}});
mock.module('../services/sharedCopyAuthClaims.mjs',{namedExports:{sharedCopyAuthClaims:()=>({})}});
mock.module('../services/normalTestRefreshSession.mjs',{namedExports:{bindNormalTestFingerprint:user=>user,configuredNormalTestRefreshStore:()=>null}});
mock.module('../services/semihTestIdentityPolicy.mjs',{namedExports:{allowsProtectedNormalTestUser:()=>false,configuredSemihTestIdentity:()=>null,matchesSemihTestUser:()=>false,requiresCleanPersonalNormalWitness:()=>false,bindCleanPersonalNormalTestUser:()=>{}}});
db=await import('../config/database.js');
const {createC06SaleReadonlyMetadataRoutes}=await import('./c06SaleReadonlyMetadataRoutes.mjs');
const path='/api/maintenance/sale-metadata';
test('real requireAuth/getUserById guards each physical-session batch before auth data',async()=>{
 process.env.MELISA_CANONICAL_TEST='true';const pool=await db.getSqlPool();
 const app=express();app.use('/api',createC06SaleReadonlyMetadataRoutes({reader:async()=>{state.readCalls++;return {modules:[]};}}));
 app.use((error,_req,res,_next)=>res.status(error.statusCode??500).end());
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const call=()=>new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'127.0.0.1:4146',authorization:'Bearer fixture'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
 try{
  for(const session of ['wrong-database','wrong-server','wrong-machine','wrong-instance','wrong-login','wrong-user','sysadmin','database-control','write-permission','live-access','unknown-identity']){
   state.session=session;state.queries=[];state.authDataReads=0;
   assert.equal(await call(),503);assert.equal(state.authDataReads,0);assert.equal(state.readCalls,0);assert.equal(state.constructs,1);
  }
  state.session='valid';state.queries=[];
  assert.equal(await call(),200);assert.equal(state.readCalls,1);assert.equal(state.queries.length,2);assert.equal(state.constructs,1);
  for(const sql of state.queries){
   assert.ok(sql.startsWith('IF ISNULL(DB_ID(),-1)<>18'));
   for(const required of ["SERVERPROPERTY('ServerName')","SERVERPROPERTY('MachineName')","SERVERPROPERTY('InstanceName')","SUSER_SNAME()","USER_NAME()","IS_SRVROLEMEMBER('sysadmin')","HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01')","sys.fn_my_permissions"])
    assert.ok(sql.indexOf(required)<sql.indexOf('ELSE BEGIN'));
   assert.ok(sql.indexOf('ELSE BEGIN')<sql.indexOf('FROM dbo.'));
   assert.ok(sql.endsWith('\nEND;'));
  }
  state.session='valid';state.sessionQueue=['valid','wrong-login'];state.authDataReads=0;
  assert.equal(await call(),503);assert.equal(state.authDataReads,1);assert.equal(state.readCalls,1);
  state.permissions=[];
  assert.equal(await call(),403);assert.equal(state.readCalls,1);state.permissions=['audit.view'];
  state.queries=[];state.closeAfterQuery=true;
  assert.equal(await call(),503);assert.equal(state.queries.length,1);assert.equal(state.readCalls,1);assert.equal(state.constructs,1);
  await db.getSqlPool();const beforeCloseConstructs=state.constructs;
  state.queries=[];state.closeDuringVerify=true;
  assert.equal(await call(),503);await state.closing;assert.equal(state.queries.length,0);assert.equal(state.readCalls,1);assert.equal(state.constructs,beforeCloseConstructs);
  assert.equal(await call(),503);assert.equal(state.constructs,beforeCloseConstructs);
  state.closeDuringVerify=false;const next=await db.getSqlPool();assert.notEqual(next,pool);assert.equal(state.constructs,beforeCloseConstructs+1);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.closeSqlPool();}
});
