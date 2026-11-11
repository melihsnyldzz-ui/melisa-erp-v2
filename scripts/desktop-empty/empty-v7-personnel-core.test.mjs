import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EMPTY_V7_PERSONNEL_ROSTER as people,EMPTY_V7_PERSONNEL_ROLES as roles,EMPTY_V7_PERSONNEL_ROSTER_SHA256 as rosterHash,EMPTY_V7_PERSONNEL_HASH_KEYS as keys,EMPTY_V7_PERSONNEL_BUSINESS_NAMES as names,personnelPolicy,parsePersonnelObservation,personnelReceipt,validatePersonnelReceipt,assertPersonnelPreservation} from './empty-v7-personnel-core.mjs';
import {desktopSalesPolicyForUser,desktopCreditAccessForUser} from '../../apps/api/src/services/desktopSalesPolicy.mjs';
import {applyRolePermissionDefaults,expandPermissions} from '../../apps/api/src/services/permissionCatalog.js';
const version=n=>'0x'+n.toString(16).padStart(16,'0'),family='11111111-1111-4111-8111-111111111111',operation='22222222-2222-4222-8222-222222222222';
const users=active=>people.map((p,i)=>{const r=roles.find(x=>x.key===p.role),j=roles.indexOf(r);return {key:p.key,username:p.username,userId:String(i+2),userVersion:version(i+101),roleId:String(j+2),roleVersion:version(j+201),roleCode:r.code,active};});
function row(mode='create-inactive'){
 const us=users(mode==='activate'),policy=personnelPolicy(us);
 return {state:mode==='preflight'?'EMPTY_V7_PERSONNEL_OBSERVED':mode==='activate'?'EMPTY_V7_PERSONNEL_ACTIVATED':mode==='deactivate'?'EMPTY_V7_PERSONNEL_DEACTIVATED':'EMPTY_V7_PERSONNEL_CREATED_INACTIVE',mode,rosterOperationId:family,operationId:operation,rosterSha256:rosterHash,userCount:7,roleCount:6,permissionCount:51,identitiesJson:JSON.stringify(us),policyId:'3',policyVersion:version(400),policySha256:createHash('sha256').update(policy,'utf16le').digest('hex'),...Object.fromEntries(keys.map(k=>[k,'a'.repeat(64)])),businessFingerprintsJson:JSON.stringify(names.map(name=>({name,count:0,sha256:'b'.repeat(64)})))};
}
test('fixed matrix is six people, five custom roles, sixteen explicit capabilities and roster-only digest',()=>{
 assert.equal(people.length,6);assert.equal(roles.length,5);assert.equal(roles.flatMap(r=>r.rights).length,16);
 assert.equal(rosterHash,createHash('sha256').update(JSON.stringify(people)).digest('hex'));
 assert.deepEqual(people.map(p=>p.key),['sales','warehouse','manager','boss','accounting','creditSetup']);
 for(const r of roles){assert.ok(!['admin','owner_manager','owner_partner'].includes(r.code));const explicit=r.rights.map(p=>p.key);assert.deepEqual(applyRolePermissionDefaults(expandPermissions(r.rights.map(p=>({permission_key:p.key,can_view:p.flags[0],can_create:p.flags[1],can_update:p.flags[2],can_delete:p.flags[3],can_approve:p.flags[4]}))),r.code).sort(),[...explicit].sort());}
});
test('real source policy keeps sales3, distinct approval5/boss, definer-manager management only and finance separate',()=>{
 const us=users(false),policy={id:'3',value:personnelPolicy(us),valueType:'json',active:true,version:version(400)};
 assert.deepEqual(JSON.parse(policy.value).people.map(x=>x.kind),['sales','manager','boss','manager']);assert.ok(!JSON.parse(policy.value).people.some(x=>x.actorId==='1'));
 for(const p of people){const u=us.find(x=>x.key===p.key),role=roles.find(r=>r.key===p.role),user={id:u.userId,role:{id:u.roleId,code:u.roleCode},userVersion:u.userVersion,roleVersion:u.roleVersion,permissions:role.rights.map(x=>x.key)},s=desktopSalesPolicyForUser(user,policy),c=desktopCreditAccessForUser(user,policy);
  assert.equal(s.canChangeSalePrice,false);assert.equal(s.maxDiscountRateExact4,p.key==='sales'?'3.0000':'0.0000');assert.equal(s.canApproveUpToFive,['manager','boss'].includes(p.key));assert.equal(s.canApproveAboveFive,p.key==='boss');assert.equal(c.canManage,p.key==='creditSetup');assert.equal(c.canApprove,['manager','boss'].includes(p.key));assert.equal(c.canApproveOwnDueException,p.key==='boss');
 }
});
test('finite receipt round-trip binds target, family, exact identities and UTF16LE policy hash',()=>{
 for(const mode of ['create-inactive','activate','deactivate']){const o=parsePersonnelObservation(row(mode)),r=personnelReceipt(o);assert.equal(validatePersonnelReceipt(r),true);assert.equal(r.users.length,6);assert.equal(r.users[2].roleId,r.users[3].roleId);assert.equal(JSON.stringify(r).includes('Credential'),false);assert.ok(Object.isFrozen(r));}
 const b=row('preflight');Object.assign(b,{userCount:1,roleCount:1,permissionCount:35,identitiesJson:'[]',policyId:null,policyVersion:null,policySha256:null});assert.equal(parsePersonnelObservation(b).policy,null);
 assert.throws(()=>personnelReceipt(parsePersonnelObservation(row('rollback'))),/INPUT_REJECTED/);
});
test('receipt faults reject old DB, admin identity, mismatched shared role, renamed or duplicate people and authority changes',()=>{
 const base=personnelReceipt(parsePersonnelObservation(row()));
 const changes=[r=>r.target.databaseId=5,r=>r.users[0].userId='1',r=>r.users[3].roleId='9',r=>r.users[4].userId=r.users[0].userId,r=>r.users[0].roleCode='admin',r=>r.users[5].username='kurulum',r=>r.users[1].active=true,r=>r.policy.sha256='f'.repeat(64),r=>r.users.push(r.users[0]),r=>r.rosterOperationId=r.operationId,r=>r.users[0].password_hash='not-public',r=>r.target.extra=true];
 for(const change of changes){const r=structuredClone(base);change(r);assert.throws(()=>validatePersonnelReceipt(r),/INPUT_REJECTED/);}
});
test('observation rejects leaked fields, partial inventory, duplicate/foreign tables, count overflow and malformed native hashes',()=>{
 for(const change of [x=>x.password='private',x=>x.permissionCount=52,x=>x.identitiesJson='[]',x=>x.securitySha256='bad',x=>x.businessFingerprintsJson=JSON.stringify(names.map((name,i)=>({name:i===0?'auth_refresh_tokens':name,count:0,sha256:'b'.repeat(64)}))),x=>x.businessFingerprintsJson=JSON.stringify(names.map(name=>({name,count:1001,sha256:'b'.repeat(64)})))]){const r=row();change(r);assert.throws(()=>parsePersonnelObservation(r),/INPUT_REJECTED/);}
});
test('preservation rejects each independently changed native fingerprint; identity-counter values are not a preservation assertion',()=>{
 const a=parsePersonnelObservation(row()),b=parsePersonnelObservation(row('activate'));assert.equal(assertPersonnelPreservation(a,b),true);
 for(const key of keys){const c=structuredClone(b);c.hashes[key]='c'.repeat(64);assert.throws(()=>assertPersonnelPreservation(a,c),/INPUT_REJECTED/);}
 const c=structuredClone(b);c.business[0].count=1;assert.throws(()=>assertPersonnelPreservation(a,c),/INPUT_REJECTED/);
});
