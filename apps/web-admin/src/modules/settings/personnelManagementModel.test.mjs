import test from 'node:test';import assert from 'node:assert/strict';
import {canManageCleanRecord,availablePersonnelAccounts,availablePersonnelRoles,personnelLoginFields} from './personnelManagementModel.mjs';
const scope={ready:true,userIds:[50101,50102,50103],employeeIds:[60101],roleIds:[20,23,25,26],existingAccountRequired:true};
test('new personal account selection excludes protected, inactive and already-linked accounts',()=>{
 const o={cleanPersonnel:scope,employees:[{id:60101,userId:50101}],users:[{id:10018,isActive:true},{id:15,isActive:true},{id:50101,isActive:true},{id:50102,isActive:true},{id:50103,isActive:false}]};
 assert.deepEqual(availablePersonnelAccounts(o).map(u=>u.id),[50102]);assert.deepEqual(availablePersonnelAccounts(o,60101).map(u=>u.id),[50101,50102]);
 assert.equal(canManageCleanRecord(scope,'user',10018),false);assert.equal(canManageCleanRecord(scope,'employee',60101),true);assert.equal(canManageCleanRecord({...scope,ready:false},'user',null),false);
});
test('linking an existing account does not resend credentials or create another user',()=>{
 assert.deepEqual(personnelLoginFields({selectedId:null,userId:'50101',loginUsername:'fixture',loginPassword:'not-sent'}),{userId:50101});
 assert.deepEqual(personnelLoginFields({selectedId:60101,userId:'50101',loginUsername:'fixture',loginPassword:'not-sent'}),{userId:50101});
 assert.deepEqual(personnelLoginFields({selectedId:null,userId:'',loginUsername:' fixture ',loginPassword:'fixture-secret'}),{userId:null,loginUsername:'fixture',loginPassword:'fixture-secret'});
});
test('clean role choices remain finite and legacy management retains its roles',()=>{
 const roles=[{id:2,isActive:true},{id:20,isActive:true},{id:23,isActive:false},{id:28,isActive:true}];
 assert.deepEqual(availablePersonnelRoles({roles,cleanPersonnel:scope}).map(r=>r.id),[20]);assert.deepEqual(availablePersonnelRoles({roles}).map(r=>r.id),[2,20,28]);
});
