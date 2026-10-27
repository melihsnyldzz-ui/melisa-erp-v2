import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assertPersonalPasswordTarget} from './unified-semih-password-policy.mjs';
import {UNIFIED_SEMIH as p} from './unified-semih-account-policy.mjs';
const owner='S-1-5-21-1-2-3-1001',proof='C:/Sirket/ERP/evidence/ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private/account-target-admission.json';
const fixture=()=>({identity:{server:p.server,database:p.database,admin:1},intent:{server:p.server,database:p.database,approvalTurn:p.approvalTurn,userId:17,roleId:17,username:p.username,roleCode:p.roleCode,permissionHash:p.permissionHash},user:{id:17,username:p.username,display_name:p.displayName,role_id:17,is_active:true,row_version:Buffer.from('0000000000000001','hex')},role:{code:p.roleCode,is_active:true,is_system_role:false},ownerSid:owner,expectedOwnerSid:owner,rows:[]});
test('personal password setup cannot target a real/shared/different account, role or stale version',()=>{
 for(const edit of [v=>v.intent.userId=1,v=>v.intent.roleId=1,v=>v.intent.approvalTurn='other',v=>v.intent.database=p.sourceDatabase,v=>v.user.id=18,v=>v.user.username='other',v=>v.user.is_active=false,v=>v.role.is_system_role=true,v=>v.role.is_active=false,v=>v.role.code='admin',v=>v.expectedVersion='0000000000000002']){const v=fixture();edit(v);assert.throws(()=>assertPersonalPasswordTarget(v));}
});
test('LOCAL exact existing permissions and owned identity admit only the approved account',{skip:!fs.existsSync(proof)},()=>{
 const v=fixture();v.rows=JSON.parse(fs.readFileSync(proof)).sourcePermissions;assert.equal(assertPersonalPasswordTarget(v).userId,17);
 for(const edit of [x=>x.identity.database=p.sourceDatabase,x=>x.identity.admin=0,x=>x.expectedOwnerSid='other',x=>x.rows[0].can_view=!x.rows[0].can_view]){const x=fixture();x.rows=structuredClone(v.rows);edit(x);assert.throws(()=>assertPersonalPasswordTarget(x));}
});
test('local setup never decrypts the old record or receives a password through argv; old installer refuses superseded setup',()=>{
 const s=fs.readFileSync(new URL('./set-unified-semih-personal-password.mjs',import.meta.url),'utf8'),old=fs.readFileSync(new URL('./install-unified-semih-test-account.mjs',import.meta.url),'utf8');
 assert(!s.includes('unprotect'));assert(!s.includes('first-login.dpapi'));assert(!s.includes('withTestSalesMutation'));assert.match(s,/input\.password=''/);assert.match(s,/passwordStoredOutsideNativeHash:false/);assert.match(s,/expectedVersion/);assert.match(old,/USER_MANAGED_PASSWORD_USE_NORMAL_LOGIN/);
});
