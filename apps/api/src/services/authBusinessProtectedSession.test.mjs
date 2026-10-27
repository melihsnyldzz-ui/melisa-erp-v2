import {test,after,mock} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import * as normal from './normalTestRefreshSession.mjs';import * as businessModule from './canonicalBusinessSessionContext.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-business-auth-')),file=path.join(root,'grants.json');after(()=>fs.rmSync(root,{recursive:true,force:true}));
let store=normal.createNormalTestRefreshStore({file});const business={environment:'CANONICAL_BUSINESS_TEST',username:'unified-semih-test',userId:17,roleId:17,roleCode:'unified_test_semih',permissions:['product.view']};
let row={id:17,username:'unified-semih-test',display_name:'Semih TEST',password_hash:'fixture-bcrypt-value',role_id:17,role_code:'unified_test_semih',role_name:'Semih TEST',role_is_active:true,is_active:true,user_version:'0x0000000000000001',role_version:'0x0000000000000002'};
const queries=[];
mock.module('bcrypt',{defaultExport:{compare:async(p,h)=>p==='fixture-password'&&h===row.password_hash}});
mock.module('mssql',{defaultExport:{BigInt:'BigInt',NVarChar:()=> 'NVarChar'}});
mock.module('../config/env.js',{namedExports:{env:{auth:{jwtSecret:'synthetic-business-jwt-fixture-only',refreshSecret:'synthetic-business-refresh-fixture-only',accessExpiresIn:'15m',refreshExpiresIn:'30d'},sql:{readOnly:false}}}});
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request(){const inputs={};return{input(n,...a){inputs[n]=a.at(-1);return this;},async query(q){queries.push(q);assert.doesNotMatch(q,/\b(?:INSERT|UPDATE|DELETE|EXEC)\b/i);if(q.includes('dbo.permissions'))return{recordset:[{permission_key:'product.view',can_view:true}]};if(q.includes('dbo.users'))return{recordset:(inputs.username===undefined||inputs.username===row.username)&&(inputs.userId===undefined||inputs.userId===row.id)?[{...row}]:[]};throw Error('Unexpected SQL');}};}})}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{throw Error('Generic write guard stays closed');}}});
mock.module('../config/isolatedOperationCopyRuntime.mjs',{namedExports:{isIsolatedOperationCopyRuntime:()=>false,getIsolatedOperationCopyConfig:()=>{throw Error('No shared copy');}}});
mock.module('./sharedCopyAuthClaims.mjs',{namedExports:{sharedCopyAuthClaims:()=>({})}});
mock.module('./canonicalBusinessSessionContext.mjs',{namedExports:{...businessModule,getCanonicalBusinessSession:()=>business,businessSessionFingerprintWitness:(u,r)=>{assert.equal(u.id,17);assert.equal(u.username,business.username);return[r.user_version,r.role_version];},businessSessionUserAllowed:(u,c,f)=>c===business&&u.id===17&&u.username===business.username&&u.role.id===17&&u.role.code===business.roleCode&&JSON.stringify(u.permissions)===JSON.stringify(business.permissions)&&typeof f==='string'}});
mock.module('./normalTestRefreshSession.mjs',{namedExports:{...normal,configuredNormalTestRefreshStore:o=>{assert.deepEqual(o,{business});return store;}}});
const auth=await import('./authService.js');
test('business normal login renews after store reopening, rejects replay and revokes the entire family on logout',async()=>{
 const g=await auth.login({username:row.username,password:'fixture-password'});assert.equal(g.user.id,17);assert.equal(g.user.role.code,business.roleCode);assert.equal(typeof g.refreshToken,'string');assert(!fs.readFileSync(file,'utf8').includes(g.refreshToken));
 const sid=auth.verifyAccessToken(g.accessToken).normalTestSessionId;assert(sid);store=normal.createNormalTestRefreshStore({file});
 const next=await auth.refreshAccessToken(g.refreshToken);assert.notEqual(next.refreshToken,g.refreshToken);await assert.rejects(()=>auth.refreshAccessToken(g.refreshToken));assert.equal((await auth.confirmProtectedNormalSession(next.accessToken,next.refreshToken)).confirmed,true);assert.equal(auth.verifyAccessToken(next.accessToken).normalTestSessionId,sid);
 await auth.logout(g.refreshToken);await assert.rejects(()=>auth.confirmProtectedNormalSession(next.accessToken,next.refreshToken));assert.throws(()=>auth.verifyNormalTestAccessSession(auth.verifyAccessToken(next.accessToken),next.user));assert(queries.length>0);
});
test('normal credentials, active role and row versions remain mandatory without any SQL writes',async()=>{
 await assert.rejects(()=>auth.login({username:row.username,password:'wrong'}),{code:'AUTH_INVALID_CREDENTIALS'});
 const g=await auth.login({username:row.username,password:'fixture-password'});row.user_version='0x0000000000000003';await assert.rejects(()=>auth.refreshAccessToken(g.refreshToken),{code:'AUTH_REFRESH_INVALID'});
 row.role_is_active=false;await assert.rejects(()=>auth.getUserById(17),{code:'AUTH_USER_INACTIVE'});await assert.rejects(()=>auth.login({username:row.username,password:'fixture-password'}),{code:'AUTH_INVALID_CREDENTIALS'});row.role_is_active=true;row.role_version='0x0000000000000004';await assert.rejects(()=>auth.refreshAccessToken(g.refreshToken));
});
