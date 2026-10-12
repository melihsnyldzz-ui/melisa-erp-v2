// Exercise actual normal auth service dispatch, with synthetic SQL reads and
// existing protected refresh store. No deployment, SQL writes, or JWT bypass.
import test,{mock,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import * as sessions from './normalTestRefreshSession.mjs';
import {matchesSemihTestUser,validateSemihTestIdentity} from './semihTestIdentityPolicy.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'semih-auth-proof-'));
after(()=>fs.rmSync(root,{recursive:true,force:true}));
let state,store;
const copy={copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},actualT1:false};
const env={sql:{readOnly:true},auth:{jwtSecret:randomBytes(32).toString('hex'),refreshSecret:randomBytes(32).toString('hex'),accessExpiresIn:'15m',refreshExpiresIn:'7d'}};
class Request {args={};input(key,type,value){this.args[key]=value;return this;}async query(q){
 state.queries.push(q);assert.doesNotMatch(q,/\b(?:INSERT|UPDATE|DELETE)\b/i);
 if(q.includes('is_ready'))return {recordset:[{is_ready:1}]};
 if(q.includes('FROM dbo.terminal_devices'))return {recordset:[{device_code:'SYNTHETIC',device_name:'Fixture',is_active:1}]};
 if(q.includes('INNER JOIN dbo.employees'))return {recordset:[{id:17,username:'erp-semih-test-20261012',display_name:'Semih TEST',role_code:'admin'}]};
 if(q.includes('FROM dbo.users u'))return {recordset:[{id:17,username:'erp-semih-test-20261012',display_name:'Semih TEST',role_id:2,role_code:state.role,role_name:'Admin',role_is_active:state.roleActive,password_hash:state.passwordHash,is_active:state.active}]};
 if(q.includes('FROM dbo.permissions'))return {recordset:state.permissionRows};
 throw Error('Unexpected query');
}}
mock.module('mssql',{defaultExport:{BigInt:0,NVarChar:()=>0}});
mock.module('bcrypt',{defaultExport:{compare:async(password,hash)=>password==='fixture-password-only'&&hash==='fixture-bcrypt-only'}});
mock.module('../config/env.js',{namedExports:{env}});
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request:()=>new Request()})}});
mock.module('../config/isolatedOperationCopyRuntime.mjs',{namedExports:{isIsolatedOperationCopyRuntime:()=>true,getIsolatedOperationCopyConfig:()=>copy}});
mock.module('./sharedCopyAuthClaims.mjs',{namedExports:{sharedCopyAuthClaims:()=>({database:copy.target.database,isolatedOperationCopy:copy.copyId})}});
mock.module('./normalTestRefreshSession.mjs',{namedExports:{...sessions,configuredNormalTestRefreshStore:()=>store}});
mock.module('./semihTestIdentityPolicy.mjs',{namedExports:{configuredSemihTestIdentity:()=>state.identity,matchesSemihTestUser,allowsProtectedNormalTestUser:user=>[15,16].includes(user.id)||matchesSemihTestUser(user,state.identity)}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{state.guardCalls++;throw Object.assign(Error('Writes disabled'),{code:'MELISA_WRITE_DISABLED'});}}});
const auth=await import('./authService.js');
beforeEach(async()=>{
 state={active:true,roleActive:true,role:'admin',passwordHash:'fixture-bcrypt-only',permissionRows:[],identity:null,queries:[],guardCalls:0};
 store=sessions.createNormalTestRefreshStore({file:path.join(root,randomBytes(8).toString('hex')+'.json')});
 const user=await auth.getUserById(17);
 state.identity=validateSemihTestIdentity({schemaVersion:'melisa-semih-test-identity.v1',copyId:copy.copyId,target:copy.target,userId:'17',username:user.username,displayName:user.displayName,role:{id:'2',code:'admin'},fingerprint:user[sessions.normalTestFingerprint]},copy);
 state.queries=[];
});
const credentials={username:'erp-semih-test-20261012',password:'fixture-password-only'};
test('normal password login, fresh me, refresh rotation and logout/revoke use real Semih identity and no SQL writes',async()=>{
 const a=await auth.login(credentials);assert.equal(a.user.id,17);assert.equal(a.user.role.code,'admin');
 const p=auth.verifyAccessToken(a.accessToken);assert.equal(p.sub,'17');assert.equal(p.role,'admin');assert.equal(p.nativeTerminalCode,undefined);assert.equal(p.isolatedOperationCopy,copy.copyId);
 auth.verifyNormalTestAccessSession(p,await auth.getUserById(17));
 const b=await auth.refreshAccessToken(a.refreshToken);assert.notEqual(b.refreshToken,a.refreshToken);assert.equal(b.user.id,17);
 await assert.rejects(auth.refreshAccessToken(a.refreshToken),{code:'AUTH_REFRESH_INVALID'});
 await auth.logout(a.refreshToken);await assert.rejects(auth.refreshAccessToken(b.refreshToken),{code:'AUTH_REFRESH_INVALID'});
 assert.throws(()=>auth.verifyNormalTestAccessSession(p,b.user),{code:'AUTH_REFRESH_INVALID'});assert.equal(state.guardCalls,0);
});
test('inactive or changed credential/role rejects refresh and existing access authority',async()=>{
 for(const change of [()=>state.passwordHash='changed-fixture',()=>state.role='terminal_user',()=>state.active=false]){
  const a=await auth.login(credentials),p=auth.verifyAccessToken(a.accessToken);change();
  await assert.rejects(auth.refreshAccessToken(a.refreshToken));
  if(state.active){const fresh=await auth.getUserById(17);assert.throws(()=>auth.verifyNormalTestAccessSession(p,fresh),{code:'AUTH_REFRESH_INVALID'});}
  state.active=true;state.role='admin';state.passwordHash='fixture-bcrypt-only';
 }
});
test('wrong password, missing pin or protected store never issues a dedicated grant',async()=>{
 await assert.rejects(auth.login({...credentials,password:'wrong-fixture'}),{code:'AUTH_INVALID_CREDENTIALS'});
 state.identity=null;await assert.rejects(auth.login(credentials),{code:'AUTH_REFRESH_INVALID'});
 const user=await auth.getUserById(17);state.identity=validateSemihTestIdentity({schemaVersion:'melisa-semih-test-identity.v1',copyId:copy.copyId,target:copy.target,userId:'17',username:user.username,displayName:user.displayName,role:{id:'2',code:'admin'},fingerprint:user[sessions.normalTestFingerprint]},copy);
 store=null;await assert.rejects(auth.login(credentials),{code:'AUTH_REFRESH_INVALID'});
 assert.equal(state.guardCalls,0);
});
test('dedicated Semih is rejected for native refresh and normal/native personnel terminal login',async()=>{
 const a=await auth.login(credentials);
 for(const options of [{nativeTerminal:true},{terminalCode:'SYNTHETIC'}])await assert.rejects(auth.refreshAccessToken(a.refreshToken,options),{code:'AUTH_REFRESH_INVALID'});
 for(const nativeTerminal of [false,true])await assert.rejects(auth.terminalLogin({...credentials,terminalCode:'SYNTHETIC'},'',{nativeTerminal}),{code:'TERMINAL_USER_NOT_ALLOWED'});
 assert.equal(state.guardCalls,0);assert.equal(store.userId(a.refreshToken),'17');
});
test('disabled existing admin role rejects normal login, fresh me and protected refresh',async()=>{
 const a=await auth.login(credentials);state.roleActive=false;
 await assert.rejects(auth.login(credentials),{code:'AUTH_INVALID_CREDENTIALS'});
 await assert.rejects(auth.getUserById(17),{code:'AUTH_USER_INACTIVE'});
 await assert.rejects(auth.refreshAccessToken(a.refreshToken),{code:'AUTH_USER_INACTIVE'});
 assert.equal(state.guardCalls,0);
});
test('actual protected pair confirmation is readonly, rejects another grant and detects revocation or identity drift',async()=>{
 const a=await auth.login(credentials),b=await auth.login(credentials),before=JSON.stringify(store);
 const result=await auth.confirmProtectedNormalSession(a.accessToken,a.refreshToken);assert.equal(result.confirmed,true);assert.equal(result.user.id,17);assert.equal(Number.isSafeInteger(result.expiresAt),true);assert.deepEqual(Object.keys(result).sort(),['confirmed','expiresAt','user']);
 await assert.rejects(auth.confirmProtectedNormalSession(a.accessToken,b.refreshToken),{code:'AUTH_REFRESH_INVALID'});
 await assert.rejects(auth.confirmProtectedNormalSession(a.accessToken,'invalid'),{code:'AUTH_REFRESH_INVALID'});
 assert.equal(JSON.stringify(store),before);assert.equal(store.userId(a.refreshToken),'17');
 for(const change of [()=>state.passwordHash='changed-fixture',()=>state.role='terminal_user',()=>state.active=false,()=>state.roleActive=false]){change();await assert.rejects(auth.confirmProtectedNormalSession(a.accessToken,a.refreshToken));state.passwordHash='fixture-bcrypt-only';state.role='admin';state.active=true;state.roleActive=true;}
 await auth.logout(a.refreshToken);await assert.rejects(auth.confirmProtectedNormalSession(a.accessToken,a.refreshToken),{code:'AUTH_REFRESH_INVALID'});assert.equal(state.guardCalls,0);
});
async function browserRun(fn){const old=process.env.MELISA_TEST_SEMIH_BROWSER_SESSION_ENABLED;process.env.MELISA_TEST_SEMIH_BROWSER_SESSION_ENABLED='true';try{return await fn();}finally{old===undefined?delete process.env.MELISA_TEST_SEMIH_BROWSER_SESSION_ENABLED:process.env.MELISA_TEST_SEMIH_BROWSER_SESSION_ENABLED=old;}}
test('browser transport uses existing normal pair, rotation, metadata inspection and retired own logout',async()=>browserRun(async()=>{
 const a=await auth.login(credentials),b=await auth.login(credentials);
 assert.equal(auth.semihBrowserSessionEnabled(),true);
 const enrolled=await auth.enrollSemihBrowserSession(a.accessToken,a.refreshToken);assert.equal(enrolled.user.id,17);assert.equal(enrolled.refreshToken,a.refreshToken);
 const remembered=await auth.rememberedSemihBrowserUser(a.refreshToken);assert.equal(remembered.user.id,17);assert.equal(Object.hasOwn(remembered,'refreshToken'),false);
 await assert.rejects(auth.enrollSemihBrowserSession(a.accessToken,b.refreshToken),{code:'AUTH_REFRESH_INVALID'});assert.equal(store.userId(a.refreshToken),'17');
 const rotated=await auth.restoreSemihBrowserSession(a.refreshToken);assert.notEqual(rotated.refreshToken,a.refreshToken);assert.equal(rotated.user.id,17);
 // Enrollment of a rotated token from the same family does not revoke itself.
 await auth.enrollSemihBrowserSession(rotated.accessToken,rotated.refreshToken,a.refreshToken);assert.equal(store.userId(rotated.refreshToken),'17');
 await auth.logoutSemihBrowserSession(a.refreshToken);await assert.rejects(auth.restoreSemihBrowserSession(rotated.refreshToken));
 assert.equal((await auth.logoutSemihBrowserSession(rotated.refreshToken)).loggedOut,true);assert.equal(state.guardCalls,0);
}));
test('foreign current or retired 15/16 tokens are rejected before lookup, rotate or revoke',async()=>browserRun(async()=>{
 for(const id of [15,16]){
  const foreign=sessions.bindNormalTestFingerprint({id,username:'other',role:{id:4,code:'personel'},permissions:['sales.view']},{password_hash:'fixture'}),a=store.issue(foreign),rotated=store.rotate(a.refreshToken,foreign);
  state.queries=[];
  await assert.rejects(auth.restoreSemihBrowserSession(rotated.refreshToken),{code:'AUTH_REFRESH_INVALID'});
  await assert.rejects(auth.rememberedSemihBrowserUser(rotated.refreshToken),{code:'AUTH_REFRESH_INVALID'});
  for(const token of [a.refreshToken,rotated.refreshToken])await assert.rejects(auth.logoutSemihBrowserSession(token),{code:'AUTH_REFRESH_INVALID'});
  assert.equal(state.queries.length,0);assert.equal(store.verify(a.sid,foreign),true);assert.equal(store.userId(rotated.refreshToken),String(id));
 }
 const a=await auth.login(credentials);state.roleActive=false;await assert.rejects(auth.restoreSemihBrowserSession(a.refreshToken),{code:'AUTH_USER_INACTIVE'});
 assert.equal((await auth.logoutSemihBrowserSession(a.refreshToken)).loggedOut,true);assert.equal(state.guardCalls,0);
}));
test('browser opt-in and exact configured17 are mandatory while ordinary engine remains unchanged',async()=>{
 const old=process.env.MELISA_TEST_SEMIH_BROWSER_SESSION_ENABLED;delete process.env.MELISA_TEST_SEMIH_BROWSER_SESSION_ENABLED;
 try{const a=await auth.login(credentials);assert.equal(auth.semihBrowserSessionEnabled(),false);assert.deepEqual(await auth.rememberedSemihBrowserUser(a.refreshToken),{enabled:false,user:null});await assert.rejects(auth.restoreSemihBrowserSession(a.refreshToken),{code:'AUTH_SEMIH_BROWSER_DISABLED'});assert.equal(store.userId(a.refreshToken),'17');}finally{if(old!==undefined)process.env.MELISA_TEST_SEMIH_BROWSER_SESSION_ENABLED=old;}
 await browserRun(async()=>{state.identity=null;assert.equal(auth.semihBrowserSessionEnabled(),false);await assert.rejects(auth.logoutSemihBrowserSession(null),{code:'AUTH_SEMIH_BROWSER_DISABLED'});});
});
