// Real auth service, bcrypt, JWT and existing private grant store. SQL reads are
// synthetic; no server, database, real account, terminal or provider is touched.
import test,{beforeEach,after,mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import {randomBytes} from 'node:crypto';
import * as sessions from './normalTestRefreshSession.mjs';
import * as context from './cleanSyntheticContext.mjs';
import {CLEAN_PERSONNEL_WORK_ROLES} from './cleanPersonnelManagement.mjs';
import {allowsProtectedNormalTestUser} from './semihTestIdentityPolicy.mjs';

const clean={environment:'CLEAN_SYNTHETIC_TEST',environmentId:context.CLEAN_ENVIRONMENT_ID,database:context.CLEAN_DATABASE,synthetic:true,actualT1:false,externalOperations:false};
const configuration={MELISA_TEST_PROTECTED_SESSION_PATH:'C:\\Sirket\\ERP\\clean\\20261022\\runtime\\protected-erp-sessions\\grants.json',MELISA_CLEAN_TEST:'20261022',SQL_DATABASE:clean.database,API_PORT:'4194'};
const previous=Object.fromEntries(Object.keys(configuration).map(k=>[k,process.env[k]]));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'b5-personal-session-'));
const password='fixture-password-only',passwordHash=await bcrypt.hash(password,4),changedHash=await bcrypt.hash('different-fixture-password',4);
let state,store,file;
const version=n=>'0x'+n.toString(16).padStart(16,'0');
function permissionRows(){
 const role=CLEAN_PERSONNEL_WORK_ROLES[state.user.role_id];
 if(!role)return [];
 return [...new Set([...role.view,...role.create,...role.approve])].sort().map((key,i)=>({permission_key:key,can_view:role.view.includes(key),can_create:role.create.includes(key),can_update:false,can_delete:false,can_approve:role.approve.includes(key),version:version(1000+state.permissionVersion+i),...(state.permissionPatch??{})}));
}
function witness(){return {actorId:state.user.id,employeeId:state.employeeId,employeeUserId:state.user.id,username:state.user.username,passwordHash:state.user.password_hash,roleId:state.user.role_id,roleCode:state.user.role_code,userActive:state.user.is_active,roleActive:state.user.role_is_active,employeeActive:state.employeeActive,userVersion:version(state.userVersion),roleVersion:version(state.roleVersion),employeeVersion:version(state.employeeVersion),memberCreatedAt:state.memberCreatedAt,databaseName:clean.database,serverName:'Semih\\MELISADEV',loginName:context.CLEAN_LOGIN,databaseUser:context.CLEAN_LOGIN,environmentId:clean.environmentId,synthetic:true,actualT1:false,externalOperations:false,permissionState:JSON.stringify(permissionRows()),...state.witnessPatch};}
class Request{
 inputs={};input(name,...args){this.inputs[name]=args.at(-1);return this;}
 async query(sql){
  state.queries.push(sql);assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|MERGE|EXEC)\b/i,'session must perform SQL reads only');
  if(sql.includes('FROM dbo.clean_personnel_members')){
   assert.equal(this.inputs.personalSessionUserId,state.user.id);
   assert.match(sql,/p\.id=m\.employee_id AND p\.user_id=m\.user_id/);
   if(state.missingSchema)throw Object.assign(Error('synthetic absent table'),{number:208});
   return {recordset:state.enrolled?[witness()]:[]};
  }
  if(sql.includes('FROM dbo.users u'))return {recordset:(this.inputs.username===undefined||this.inputs.username===state.user.username)&&(this.inputs.userId===undefined||Number(this.inputs.userId)===state.user.id)?[{...state.user}]:[]};
  if(sql.includes('FROM dbo.permissions'))return {recordset:permissionRows()};
  throw Error('Unexpected synthetic SQL');
 }
}
mock.module('mssql',{defaultExport:{BigInt:'BigInt',NVarChar:()=> 'NVarChar'}});
mock.module('../config/env.js',{namedExports:{env:{auth:{jwtSecret:randomBytes(32).toString('hex'),refreshSecret:randomBytes(32).toString('hex'),accessExpiresIn:'15m',refreshExpiresIn:'30d'},sql:{readOnly:false}}}});
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request:()=>new Request()})}});
mock.module('./cleanSyntheticContext.mjs',{namedExports:{...context,getCleanContext:()=>state.clean,assertRegisteredCleanContext:()=>state.clean}});
mock.module('../config/isolatedOperationCopyRuntime.mjs',{namedExports:{isIsolatedOperationCopyRuntime:()=>false,getIsolatedOperationCopyConfig:()=>null}});
mock.module('./sharedCopyAuthClaims.mjs',{namedExports:{sharedCopyAuthClaims:()=>({})}});
mock.module('./normalTestRefreshSession.mjs',{namedExports:{...sessions,configuredNormalTestRefreshStore:options=>sessions.normalTestRefreshTarget(options)?store:null}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{throw Error('No write capability in personal-session fixture');}}});
const auth=await import('./authService.js');
beforeEach(()=>{
 Object.assign(process.env,configuration);
 state={clean,user:{id:40101,username:'synthetic-personnel-one',display_name:'Synthetic staff',password_hash:passwordHash,role_id:30,role_code:CLEAN_PERSONNEL_WORK_ROLES[30].code,role_name:'Synthetic',is_active:true,role_is_active:true},employeeId:50101,employeeActive:true,enrolled:true,memberCreatedAt:'2026-10-24T09:00:00.0000000',userVersion:1,roleVersion:2,employeeVersion:3,permissionVersion:100,queries:[],witnessPatch:{}};
 file=path.join(directory,randomBytes(8).toString('hex')+'.json');store=sessions.createNormalTestRefreshStore({file});
});
after(()=>{for(const[k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}fs.rmSync(directory,{recursive:true,force:true});});
const credentials=()=>({username:state.user.username,password});
const family=grant=>auth.verifyAccessToken(grant.accessToken).normalTestSessionId;

test('personal staff/manager/finance log in normally and rotate, confirm and read the same protected family after store reopening',async()=>{
 for(const roleId of [30,31,32]){
  state.user={...state.user,role_id:roleId,role_code:CLEAN_PERSONNEL_WORK_ROLES[roleId].code};state.userVersion++;
  const first=await auth.login(credentials()),sid=family(first);assert.equal(typeof sid,'string');assert.equal(first.user.id,40101);assert.equal(first.user.isAdmin,undefined);
  assert.equal((await auth.confirmProtectedNormalSession(first.accessToken,first.refreshToken)).normalTestSessionId,sid);
  store=sessions.createNormalTestRefreshStore({file});
  assert.equal((await auth.readProtectedNormalSession(40101,sid)).normalTestSessionId,sid);
  const next=await auth.refreshAccessToken(first.refreshToken);assert.equal(family(next),sid);assert.notEqual(next.refreshToken,first.refreshToken);
  await assert.rejects(auth.refreshAccessToken(first.refreshToken),{code:'AUTH_REFRESH_INVALID'});
  assert.equal((await auth.confirmProtectedNormalSession(next.accessToken,next.refreshToken)).user.role.id,roleId);
  assert(!fs.readFileSync(file,'utf8').includes(next.refreshToken));
  for(const text of [password,passwordHash,'employeeVersion','memberCreatedAt'])assert(!JSON.stringify(next.user).includes(text));
 }
 assert(state.queries.filter(q=>q.includes('FROM dbo.clean_personnel_members')).length>=12);
});
test('real password check, missing membership/schema, inactive employee and wrong linked identity reject before a grant exists',async()=>{
 await assert.rejects(auth.login({...credentials(),password:'incorrect'}),{code:'AUTH_INVALID_CREDENTIALS'});
 for(const patch of [{enrolled:false},{missingSchema:true},{employeeActive:false},{witnessPatch:{employeeUserId:40102}},{witnessPatch:{actorId:40102}},{witnessPatch:{roleId:31}},{witnessPatch:{passwordHash:changedHash}},{witnessPatch:{userVersion:null}},{witnessPatch:{permissionState:'not-json'}},{permissionPatch:{can_delete:true}}]){
  const saved={...state};Object.assign(state,patch);
  await assert.rejects(auth.login(credentials()),{code:'AUTH_REFRESH_INVALID'});state=saved;
 }
 assert.equal(fs.existsSync(file),false);
});
test('client DTO, role, confirmed or family fields never manufacture a server witness',async()=>{
 const grant=await auth.login(credentials()),options={clean,config:configuration};
 assert.equal(allowsProtectedNormalTestUser(grant.user,options),true);
 for(const claimed of [JSON.parse(JSON.stringify(grant.user)),{...grant.user,confirmed:true,employeeId:50101,normalTestSessionId:family(grant)}]){
  sessions.bindNormalTestFingerprint(claimed,{password_hash:passwordHash});
  assert.equal(allowsProtectedNormalTestUser(claimed,options),false);
  assert.throws(()=>auth.verifyNormalTestAccessSession(auth.verifyAccessToken(grant.accessToken),claimed),{code:'AUTH_REFRESH_INVALID'});
 }
 await assert.rejects(auth.readProtectedNormalSession(40102,family(grant)),{code:'AUTH_USER_INACTIVE'});
 const another=await auth.login(credentials());await assert.rejects(auth.confirmProtectedNormalSession(grant.accessToken,another.refreshToken),{code:'AUTH_REFRESH_INVALID'});
});
test('wrong/default target and native opt-in cannot use the personal protected path',async()=>{
 const grant=await auth.login(credentials());
 for(const edit of [{databaseName:'LIVE'},{environmentId:'different'},{serverName:'other'},{loginName:'sa'},{databaseUser:'dbo'},{synthetic:false},{actualT1:true},{externalOperations:true}]){
  state.witnessPatch=edit;await assert.rejects(auth.readProtectedNormalSession(40101,family(grant)),{code:'AUTH_REFRESH_INVALID'});
 }
 state.witnessPatch={};
 for(const edit of [{API_PORT:'4196'},{SQL_DATABASE:'LIVE'},{MELISA_CLEAN_TEST:'other'},{MELISA_TEST_PROTECTED_SESSION_PATH:'C:\\wrong\\grants.json'}]){
  Object.assign(process.env,edit);await assert.rejects(auth.refreshAccessToken(grant.refreshToken));Object.assign(process.env,configuration);
 }
 delete process.env.MELISA_TEST_PROTECTED_SESSION_PATH;
 assert.equal(allowsProtectedNormalTestUser(await auth.getUserById(40101),{clean}),false);
 await assert.rejects(auth.readProtectedNormalSession(40101,family(grant)),{code:'AUTH_REFRESH_INVALID'});
 Object.assign(process.env,configuration);
 for(const options of [{nativeTerminal:true},{terminalCode:'SYNTHETIC'}])await assert.rejects(auth.refreshAccessToken(grant.refreshToken,options),{code:'AUTH_REFRESH_INVALID'});
});
test('password, role, user, employee and permission changes invalidate the old family even after values are restored',async()=>{
 const transitions=[
  ()=>{state.user.password_hash=changedHash;state.userVersion++;return()=>{state.user.password_hash=passwordHash;state.userVersion++;};},
  ()=>{state.user.role_id=99;state.user.role_code='not-approved';state.userVersion++;return()=>{state.user.role_id=30;state.user.role_code=CLEAN_PERSONNEL_WORK_ROLES[30].code;state.userVersion++;};},
  ()=>{state.user.is_active=false;state.userVersion++;return()=>{state.user.is_active=true;state.userVersion++;};},
  ()=>{state.user.role_is_active=false;state.roleVersion++;return()=>{state.user.role_is_active=true;state.roleVersion++;};},
  ()=>{state.employeeActive=false;state.employeeVersion++;return()=>{state.employeeActive=true;state.employeeVersion++;};},
  ()=>{state.witnessPatch={employeeUserId:40102};state.employeeVersion++;return()=>{state.witnessPatch={};state.employeeVersion++;};},
  ()=>{state.enrolled=false;return()=>{state.enrolled=true;state.memberCreatedAt='2026-10-24T09:00:00.'+String(state.userVersion++).padStart(7,'0');};},
  ()=>{state.permissionPatch={can_delete:true};state.permissionVersion++;return()=>{state.permissionPatch=null;state.permissionVersion++;};},
 ];
 for(const change of transitions){
  const grant=await auth.login(credentials()),sid=family(grant),restore=change();
  await assert.rejects(auth.refreshAccessToken(grant.refreshToken));await assert.rejects(auth.readProtectedNormalSession(40101,sid));
  restore();await assert.rejects(auth.refreshAccessToken(grant.refreshToken),{code:'AUTH_REFRESH_INVALID'});await assert.rejects(auth.confirmProtectedNormalSession(grant.accessToken,grant.refreshToken),{code:'AUTH_REFRESH_INVALID'});await assert.rejects(auth.readProtectedNormalSession(40101,sid),{code:'AUTH_REFRESH_INVALID'});
  const fresh=await auth.login(credentials());assert.notEqual(family(fresh),sid);assert.equal((await auth.confirmProtectedNormalSession(fresh.accessToken,fresh.refreshToken)).confirmed,true);
 }
});
test('a change and restoration between requests still invalidate the old family through row versions',async()=>{
 const grant=await auth.login(credentials());state.userVersion+=2;state.employeeVersion+=2;state.roleVersion+=2;state.permissionVersion+=2;
 await assert.rejects(auth.refreshAccessToken(grant.refreshToken),{code:'AUTH_REFRESH_INVALID'});
 await assert.rejects(auth.readProtectedNormalSession(40101,family(grant)),{code:'AUTH_REFRESH_INVALID'});
});
test('logout with the pre-rotation token revokes the complete personal family and fresh login cannot revive it',async()=>{
 const first=await auth.login(credentials()),next=await auth.refreshAccessToken(first.refreshToken),sid=family(next);
 await auth.logout(first.refreshToken);
 await assert.rejects(auth.refreshAccessToken(next.refreshToken),{code:'AUTH_REFRESH_INVALID'});await assert.rejects(auth.confirmProtectedNormalSession(next.accessToken,next.refreshToken),{code:'AUTH_REFRESH_INVALID'});await assert.rejects(auth.readProtectedNormalSession(40101,sid),{code:'AUTH_REFRESH_INVALID'});
 const fresh=await auth.login(credentials());assert.notEqual(family(fresh),sid);
});
