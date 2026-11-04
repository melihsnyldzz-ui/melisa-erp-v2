import test from 'node:test';import assert from 'node:assert/strict';
import {UNIFIED_SEMIH as p,assertUnifiedSemihAdmission} from './unified-semih-account-policy.mjs';
import fs from 'node:fs';
const owner='S-1-5-21-1-2-3-1001';
const input=()=>({identity:{server:p.server,database:p.database,admin:1},approvalTurn:p.approvalTurn,ownerSid:owner,expectedOwnerSid:owner,rows:[]});
test('wrong DB, owner or approval is rejected before any installer operation',()=>{for(const mutate of [x=>x.identity.database=p.sourceDatabase,x=>x.identity.server='other',x=>x.identity.admin=0,x=>x.approvalTurn='other',x=>x.ownerSid='other']){const x=input();mutate(x);assert.throws(()=>assertUnifiedSemihAdmission(x),/TARGET_OR_APPROVAL/);}});
test('missing, enlarged and changed permission sets fail closed',()=>{for(const rows of [[],null,Array.from({length:36},()=>({permission_key:'sales.view',can_view:true})),Array.from({length:37},()=>({permission_key:'sales.view',can_view:true}))])assert.throws(()=>assertUnifiedSemihAdmission({...input(),rows}),/PERMISSION_DRIFT/);});
test('installer role never uses full-access role defaults or a fixed foreign user ID',()=>{assert.equal(p.username,'unified-semih-test');assert.equal(p.roleCode,'unified_test_semih');assert(!['admin','owner_manager','owner_partner'].includes(p.roleCode));assert(!('targetUserId' in p));assert(!('targetRoleId' in p));});
const localFile='C:/Sirket/ERP/evidence/ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private/account-target-admission.json';
test('LOCAL exact approved 36 rows retain identical effective permissions; any flag edit is rejected',{skip:!fs.existsSync(localFile)},()=>{
 const proof=JSON.parse(fs.readFileSync(localFile,'utf8')),rows=proof.sourcePermissions;
 const admitted=assertUnifiedSemihAdmission({...input(),rows});assert.equal(admitted.permissionRows,36);assert(admitted.effectivePermissions.length>0);
 for(const key of ['can_view','can_create','can_update','can_delete','can_approve']){const changed=structuredClone(rows);changed[0][key]=!changed[0][key];assert.throws(()=>assertUnifiedSemihAdmission({...input(),rows:changed}),/PERMISSION_DRIFT/);}
});
