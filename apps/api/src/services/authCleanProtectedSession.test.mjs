import {test,after,mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as normal from './normalTestRefreshSession.mjs';
import * as cleanContext from './cleanSyntheticContext.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-clean-auth-')),file=path.join(root,'grants.json');
after(()=>fs.rmSync(root,{recursive:true,force:true}));
const store=normal.createNormalTestRefreshStore({file}),clean={environment:'CLEAN_SYNTHETIC_TEST',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67',database:'MELISA_ERP_CLEAN_TEST_20261022',synthetic:true,actualT1:false,externalOperations:false};
let row={id:18,username:'ornek-depo',display_name:'Örnek depo personeli',password_hash:'synthetic-bcrypt-hash',role_id:23,role_code:'clean_test_warehouse',role_name:'Örnek depo',role_is_active:true,is_active:true};
const queries=[],factoryOptions=[];
mock.module('bcrypt',{defaultExport:{compare:async(password,hash)=>password==='fixture-password'&&hash===row.password_hash}});
mock.module('mssql',{defaultExport:{BigInt:'BigInt',NVarChar:()=> 'NVarChar'}});
mock.module('../config/env.js',{namedExports:{env:{auth:{jwtSecret:'synthetic-clean-jwt-secret-for-unit-only',refreshSecret:'synthetic-clean-refresh-secret-for-unit-only',accessExpiresIn:'15m',refreshExpiresIn:'30d'},sql:{readOnly:false}}}});
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request(){const inputs={};return {input(name,...args){inputs[name]=args.at(-1);return this;},async query(sql){queries.push(sql);assert(!/\b(?:INSERT|UPDATE|DELETE|EXEC)\b/i.test(sql),'protected clean auth must not mutate SQL');if(sql.includes('dbo.permissions'))return {recordset:[{permission_key:'product.view',can_view:true}]};if(sql.includes('dbo.users'))return {recordset:(inputs.username===undefined||inputs.username===row.username)&&(inputs.userId===undefined||inputs.userId===row.id)?[{...row}]:[]};throw Error('Unexpected SQL fixture');}};}})}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{throw Error('Legacy write guard must not be bypassed');}}});
mock.module('../config/isolatedOperationCopyRuntime.mjs',{namedExports:{isIsolatedOperationCopyRuntime:()=>false,getIsolatedOperationCopyConfig:()=>{throw Error('No shared copy');}}});
mock.module('./sharedCopyAuthClaims.mjs',{namedExports:{sharedCopyAuthClaims:context=>{assert.equal(context,null);return {};}}});
mock.module('./cleanSyntheticContext.mjs',{namedExports:{...cleanContext,getCleanContext:()=>clean,assertRegisteredCleanContext:()=>clean}});
mock.module('./normalTestRefreshSession.mjs',{namedExports:{...normal,configuredNormalTestRefreshStore:options=>{factoryOptions.push(options);assert.deepEqual(options,{clean});return store;}}});
const auth=await import('./authService.js');

test('existing normal clean login refresh pair confirmation and logout reuse one hashed store without SQL writes',async()=>{
 const grant=await auth.login({username:row.username,password:'fixture-password'});
 assert.equal(grant.user.id,18);assert.equal(grant.user.role.code,'clean_test_warehouse');assert.equal(typeof grant.refreshToken,'string');assert(!fs.readFileSync(file,'utf8').includes(grant.refreshToken));assert(!JSON.stringify(grant.user).includes(row.password_hash));
 const confirmed=await auth.confirmProtectedNormalSession(grant.accessToken,grant.refreshToken);assert.equal(confirmed.confirmed,true);assert.equal(confirmed.user.id,18);
 const signedFamily=auth.verifyAccessToken(grant.accessToken).normalTestSessionId;
 assert.equal(typeof confirmed.normalTestSessionId,'string');assert.equal(confirmed.normalTestSessionId,signedFamily);
 const described=await auth.readProtectedNormalSession(18,signedFamily);assert.equal(described.normalTestSessionId,signedFamily);assert.equal(described.user.id,18);assert(described.expiresAt>confirmed.expiresAt);
 await assert.rejects(()=>auth.readProtectedNormalSession(19,signedFamily));
 for(const secret of [grant.accessToken,grant.refreshToken,row.password_hash])assert(!JSON.stringify(confirmed).includes(secret));
 const next=await auth.refreshAccessToken(grant.refreshToken);assert.notEqual(next.refreshToken,grant.refreshToken);await assert.rejects(()=>auth.refreshAccessToken(grant.refreshToken));
 assert.equal((await auth.confirmProtectedNormalSession(next.accessToken,next.refreshToken)).normalTestSessionId,signedFamily);
 await auth.logout(grant.refreshToken);await assert.rejects(()=>auth.confirmProtectedNormalSession(next.accessToken,next.refreshToken));assert(factoryOptions.length>0);assert(queries.length>0);
 await assert.rejects(()=>auth.readProtectedNormalSession(18,signedFamily));
});

test('clean normal login requires real matching credentials and active role; stale password fingerprint revokes refresh',async()=>{
 await assert.rejects(()=>auth.login({username:row.username,password:'wrong'}),{code:'AUTH_INVALID_CREDENTIALS'});
 const grant=await auth.login({username:row.username,password:'fixture-password'});row.password_hash='changed-synthetic-hash';await assert.rejects(()=>auth.refreshAccessToken(grant.refreshToken),{code:'AUTH_REFRESH_INVALID'});
 row.role_is_active=false;await assert.rejects(()=>auth.login({username:row.username,password:'fixture-password'}),{code:'AUTH_INVALID_CREDENTIALS'});await assert.rejects(()=>auth.getUserById(18),{code:'AUTH_USER_INACTIVE'});row.role_is_active=true;
});
