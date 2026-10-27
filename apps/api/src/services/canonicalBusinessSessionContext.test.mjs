import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {BUSINESS_SESSION as p,validateBusinessSessionProfile,validateBusinessSessionWitness,configureCanonicalBusinessSession,assertCanonicalBusinessSession,businessSessionUserAllowed,businessSessionFingerprintWitness,assertBusinessSessionPermissionRows} from './canonicalBusinessSessionContext.mjs';
const profile=()=>({id:p.id,userId:17,permissionHash:p.permissionHash,sessionPath:p.sessionPath,actualT1:false,externalOperations:false});
const environment=()=>({MELISA_CANONICAL_TEST:'true',SQL_DATABASE:p.database,SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_USER:p.login,SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:'4144',MELISA_TEST_PROTECTED_SESSION_PATH:p.sessionPath});
const identity=()=>({databaseName:p.database,serverName:p.server,loginName:p.login,databaseUser:p.login,sysadmin:0,databaseControl:0,liveDatabaseAccess:0,canInsertSales:1});
const user=()=>({id:17,username:p.username,userActive:true,roleId:17,roleCode:p.roleCode,roleActive:true,systemRole:false});
test('business session profile is explicit, finite and has no default/alternate target',()=>{
 assert.equal(validateBusinessSessionProfile(profile()).userId,17);
 for(const patch of [{userId:10018},{actualT1:true},{externalOperations:true},{sessionPath:'relative.json'},{id:'CLEAN_SYNTHETIC_TEST'},{permissionHash:'0'.repeat(64)},{extra:true}])assert.throws(()=>validateBusinessSessionProfile({...profile(),...patch}));
});
test('missing profile and native boot stay opt-out and perform no SQL',async()=>{const pool={request(){assert.fail('no SQL');}};assert.equal(await configureCanonicalBusinessSession({config:{},mode:'erp',pool}),null);assert.equal(await configureCanonicalBusinessSession({config:{businessWorkface:profile()},mode:'native',pool}),null);});
test('wrong SQL/port/write/OS target fails before any DB observation',async()=>{
 for(const patch of [{identity:{...identity(),sysadmin:1}},{identity:{...identity(),liveDatabaseAccess:1}},{identity:{...identity(),databaseName:'LIVE'}},{identity:{...identity(),loginName:'other'}},{port:4194},{writes:false},{environment:{...environment(),MELISA_CLEAN_TEST:'20261022'}},{environment:{...environment(),SQL_READ_ONLY:'true'}},{environment:{...environment(),MELISA_TEST_PROTECTED_SESSION_PATH:'other'}}]){
  await assert.rejects(()=>configureCanonicalBusinessSession({config:{businessWorkface:profile()},identity:identity(),mode:'erp',port:4144,writes:true,environment:environment(),pool:{request(){assert.fail('wrong target must not query');}},...patch}),{code:'AUTH_BUSINESS_TEST_TARGET_INVALID'});
 }
});
test('a client-shaped or pure validated context cannot authorize a grant store',()=>{assert.throws(()=>assertCanonicalBusinessSession({environment:'CANONICAL_BUSINESS_TEST'}));assert.equal(businessSessionUserAllowed({id:17},{} ,'f'.repeat(64)),false);});
const proofFile='C:/Sirket/ERP/evidence/ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private/account-target-admission.json';
test('LOCAL approved native permission witness registers once and rejects identity, permission and version drift',{skip:!fs.existsSync(proofFile)},async()=>{
 const rows=JSON.parse(fs.readFileSync(proofFile,'utf8')).sourcePermissions,env=environment();const witness={profile:profile(),identity:identity(),mode:'erp',port:4144,writes:true,environment:env,user:user(),rows};
 const validated=validateBusinessSessionWitness(witness);assert.equal(validated.permissions.length,36);assert.throws(()=>assertCanonicalBusinessSession(validated));
 for(const patch of [{user:{...user(),roleId:28}},{user:{...user(),roleActive:false}},{user:{...user(),systemRole:true}},{rows:rows.slice(1)}])assert.throws(()=>validateBusinessSessionWitness({...witness,...patch}));
 const queries=[];const context=await configureCanonicalBusinessSession({...witness,config:{businessWorkface:profile()},pool:{request:()=>({query:async q=>{queries.push(q);assert.doesNotMatch(q,/\b(?:INSERT|UPDATE|DELETE|EXEC)\b/);return{recordset:q.includes('dbo.users')?[user()]:rows};}})}});
 assert.equal(queries.length,2);assert.equal(assertCanonicalBusinessSession(context),context);
 assertBusinessSessionPermissionRows(17,rows);const changed=structuredClone(rows);changed[0].can_delete=!changed[0].can_delete;assert.throws(()=>assertBusinessSessionPermissionRows(17,changed),{code:'AUTH_REFRESH_INVALID'});assertBusinessSessionPermissionRows(16,[]);
 const actor={id:17,username:p.username,role:{id:17,code:p.roleCode},permissions:[...context.permissions]},row={is_active:true,role_is_active:true,user_version:'0x0000000000000001',role_version:'0x0000000000000002'};
 assert.deepEqual(businessSessionFingerprintWitness(actor,row),[row.user_version,row.role_version]);assert.equal(businessSessionUserAllowed(actor,context,'f'.repeat(64)),true);
 for(const patch of [{id:10018},{isAdmin:true},{testAdminSession:true},{permissions:[...actor.permissions,'invented.permission']},{username:'semih'}])assert.equal(businessSessionUserAllowed({...actor,...patch},context,'f'.repeat(64)),false);
 assert.throws(()=>businessSessionFingerprintWitness(actor,{...row,role_is_active:false}));assert.throws(()=>businessSessionFingerprintWitness(actor,{...row,user_version:null}));
 env.SQL_DATABASE='other';assert.throws(()=>assertCanonicalBusinessSession(context));
});
