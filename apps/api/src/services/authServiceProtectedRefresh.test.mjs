// Actual auth service refresh dispatch; synthetic SQL read adapter and private store.
import test,{mock,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import * as sessions from './normalTestRefreshSession.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'protected-auth-refresh-'));
after(()=>fs.rmSync(root,{recursive:true,force:true}));
let state,store;
const copy={copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'}};
const env={sql:{readOnly:true},auth:{jwtSecret:randomBytes(32).toString('hex'),refreshSecret:randomBytes(32).toString('hex'),accessExpiresIn:'15m',refreshExpiresIn:'7d'}};
const row=id=>({id,username:'synthetic.'+id,display_name:'Fixture',role_id:id,role_code:id===15?'isolated_test_sales':'isolated_test_ilker',role_name:'Fixture',password_hash:'synthetic-fingerprint',is_active:state.active});
class Request{args={};input(key,type,value){this.args[key]=value;return this;}async query(q){state.queries.push(q);assert.doesNotMatch(q,/\b(?:INSERT|UPDATE|DELETE)\b/i,'No SQL auth writes permitted');if(q.includes('FROM dbo.users u'))return{recordset:[row(this.args.userId)]};if(q.includes('FROM dbo.permissions'))return{recordset:[]};throw Error('Unexpected SQL');}}
mock.module('mssql',{defaultExport:{BigInt:0,NVarChar:()=>0}});
mock.module('../config/env.js',{namedExports:{env}});
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request:()=>new Request()})}});
mock.module('../config/isolatedOperationCopyRuntime.mjs',{namedExports:{isIsolatedOperationCopyRuntime:()=>state.copy!==null,getIsolatedOperationCopyConfig:()=>state.copy}});
mock.module('./sharedCopyAuthClaims.mjs',{namedExports:{sharedCopyAuthClaims:current=>{assert.deepEqual(current,copy);return{database:current.target.database,isolatedOperationCopy:current.copyId};}}});
mock.module('./normalTestRefreshSession.mjs',{namedExports:{...sessions,configuredNormalTestRefreshStore:({copy:current})=>{if(!current)return null;assert.deepEqual(current,copy);return store;}}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{state.guardCalls++;throw Object.assign(Error('Commercial writes disabled'),{code:'MELISA_WRITE_DISABLED',statusCode:403});}}});
const {refreshAccessToken,getUserById,verifyAccessToken}=await import('./authService.js');
beforeEach(()=>{state={copy,active:true,queries:[],guardCalls:0};store=sessions.createNormalTestRefreshStore({file:path.join(root,randomBytes(8).toString('hex')+'.json')});});
test('protected normal actors15/16 rotate successfully with commercial writes disabled and SQL reads only',async()=>{
 for(const id of [15,16]){const user=await getUserById(id),grant=store.issue(user),result=await refreshAccessToken(grant.refreshToken);assert.equal(result.user.id,id);assert.notEqual(result.refreshToken,grant.refreshToken);assert.equal(verifyAccessToken(result.accessToken).normalTestSessionId,grant.sid);assert.equal(store.verify(grant.sid,result.user),true);await assert.rejects(refreshAccessToken(grant.refreshToken),{code:'AUTH_REFRESH_INVALID'});}
 assert.equal(state.guardCalls,0);assert.ok(state.queries.length>0);
});
test('protected token cannot opt into native mode or terminal code',async()=>{
 const grant=store.issue(await getUserById(15));for(const options of [{nativeTerminal:true},{terminalCode:'TEST-TC21'}])await assert.rejects(refreshAccessToken(grant.refreshToken,options),{code:'AUTH_REFRESH_INVALID'});assert.equal(state.guardCalls,0);assert.equal(store.userId(grant.refreshToken),'15');
});
test('inactive, wrong actor and invalid protected token reject without SQL mutation',async()=>{
 const grant=store.issue(await getUserById(15));state.active=false;await assert.rejects(refreshAccessToken(grant.refreshToken),{code:'AUTH_USER_INACTIVE'});state.active=true;const other=store.issue(await getUserById(14));await assert.rejects(refreshAccessToken(other.refreshToken),{code:'AUTH_REFRESH_INVALID'});await assert.rejects(refreshAccessToken('A'.repeat(43)),{code:'AUTH_REFRESH_INVALID'});assert.equal(state.guardCalls,0);
});
test('unconfigured/default and malformed tokens retain commercial write guard before SQL',async()=>{
 state.copy=null;await assert.rejects(refreshAccessToken('A'.repeat(43)),{code:'MELISA_WRITE_DISABLED'});state.copy=copy;await assert.rejects(refreshAccessToken('legacy-token'),{code:'MELISA_WRITE_DISABLED'});assert.equal(state.guardCalls,2);assert.equal(state.queries.length,0);
});
