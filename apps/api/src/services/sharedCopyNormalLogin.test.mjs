import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {applyRolePermissionDefaults,expandPermissions} from './permissionCatalog.js';

// Execute the existing credential/session service against inert SQL/crypto
// fixtures. No database, credential, account, role or token is created.
const source=fs.readFileSync(new URL('./authService.js',import.meta.url),'utf8');
const middleware=fs.readFileSync(new URL('../middleware/authMiddleware.js',import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
function fixture({active=true,hasHash=true,passwordOK=true,role='terminal_user'}={}){
 const queries=[],claims=[];
 const row={id:15,username:'fixture-personnel',display_name:'Fixture',password_hash:hasHash?'inert-supported-hash':null,role_id:3,role_code:role,role_name:'Fixture',is_active:active};
 const pool={request(){return {input(){return this;},async query(q){queries.push(q);assert.match(q,/^\s*SELECT/);return {recordset:q.includes('dbo.permissions')?[{permission_key:'product.view',can_view:1,can_create:0,can_update:0,can_approve:0}]:[row]};}};}};
 const bcrypt={async compare(p,h){assert.equal(p,'fixture-password');assert.equal(h,'inert-supported-hash');return passwordOK;}};
 const jwt={sign(c){claims.push(c);return 'inert-fixture-token';}};
 const sql={BigInt:'bigint',NVarChar:()=> 'nvarchar'};
 const env={auth:{jwtSecret:'fixture-only',refreshSecret:'fixture-only',accessExpiresIn:'8h'},sql:{readOnly:false}};
 const deps=[bcrypt,crypto,jwt,sql,env,async()=>pool,applyRolePermissionDefaults,expandPermissions,()=>assert.fail('write guard must never run'),()=>true,()=>({copyId:'fixture-copy'}),()=>({database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',isolatedOperationCopy:'fixture-copy'})];
 const api=new Function('bcrypt','crypto','jwt','sql','env','getSqlPool','applyRolePermissionDefaults','expandPermissions','assertMelisaWriteEnabled','isIsolatedOperationCopyRuntime','getIsolatedOperationCopyConfig','sharedCopyAuthClaims',strip(source)+'\nreturn {login,authenticateUserCredentials};')(...deps);
 return {api,queries,claims};
}
async function stateless(fn){const old=process.env.MELISA_TEST_STATELESS_AUTH;process.env.MELISA_TEST_STATELESS_AUTH='true';try{return await fn();}finally{if(old===undefined)delete process.env.MELISA_TEST_STATELESS_AUTH;else process.env.MELISA_TEST_STATELESS_AUTH=old;}}
test('existing normal personnel credentials keep role and DB02 claims; stateless login performs only SELECT',()=>stateless(async()=>{
 const f=fixture(),session=await f.api.login({username:' fixture-personnel ',password:'fixture-password'});
 assert.equal(session.user.role.code,'terminal_user');assert.equal(session.refreshToken,null);assert.equal(session.accessToken,'inert-fixture-token');
 assert.equal(f.claims[0].sub,'15');assert.equal(f.claims[0].database,'MELISA_ERP_CRM_SHARED_TEST_20261009_02');assert.equal(f.claims[0].isolatedOperationCopy,'fixture-copy');
 assert.equal(f.queries.length,2);assert.ok(f.queries.every(q=>q.trimStart().startsWith('SELECT')));assert.ok(!session.user.permissions.includes('finance.payment'));
}));
test('wrong password, inactive account, absent hash and missing credentials never issue a session',()=>stateless(async()=>{
 for(const options of [{passwordOK:false},{active:false},{hasHash:false}]){const f=fixture(options);await assert.rejects(f.api.login({username:'fixture-personnel',password:'fixture-password'}),e=>e.code==='AUTH_INVALID_CREDENTIALS');assert.equal(f.claims.length,0);}
 const f=fixture();await assert.rejects(f.api.login({username:'',password:''}),e=>e.code==='AUTH_CREDENTIALS_REQUIRED');assert.equal(f.queries.length,0);
}));
test('normal personnel login does not grant payment or approval; existing middleware returns 403',()=>stateless(async()=>{
 const f=fixture(),session=await f.api.login({username:'fixture-personnel',password:'fixture-password'});
 const {requirePermission}=new Function('getUserById','verifyAccessToken','resolveTestAdminUser',strip(middleware)+'\nreturn {requirePermission};')(()=>{},()=>{},()=>{});
 for(const permission of ['finance.payment','purchase.finalize','settings.manage']){let error;requirePermission(permission)({user:session.user},{},e=>{error=e;});assert.equal(error?.statusCode,403);assert.equal(error?.code,'AUTH_PERMISSION_DENIED');}
 let passed=false;requirePermission('product.view')({user:session.user},{},e=>{assert.equal(e,undefined);passed=true;});assert.equal(passed,true);
}));
