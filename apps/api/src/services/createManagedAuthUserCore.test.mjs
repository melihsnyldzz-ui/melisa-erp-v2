import test from 'node:test';
import assert from 'node:assert/strict';
import {createManagedAuthUserCore,normalizeManagedAuthUser} from './createManagedAuthUserCore.mjs';
const payload={username:'erp-semih-test-20261012',displayName:'Semih TEST',password:'fixture-password-only',roleId:2};
function harness({role=true,auditError=false,duplicate=false}={}) {
 const calls=[],tx={},events=[];
 const create=createManagedAuthUserCore({sql:{BigInt:'big',NVarChar:n=>'nv'+n},request:transaction=>{
  assert.equal(transaction,tx);const args={};return {input(k,t,v){args[k]=v;return this;},async query(q){calls.push({q,args});if(q.includes('FROM dbo.roles'))return {recordset:role?[{id:2,code:'admin',name:'Admin'}]:[]};if(duplicate)throw Object.assign(Error('Duplicate'),{number:2627});assert.match(q,/INSERT INTO dbo.users/);assert.doesNotMatch(q,/UPDATE|DELETE/);return {recordset:[{id:17}]};}};
 },hashPassword:async(password,rounds)=>{assert.equal(password,payload.password);assert.equal(rounds,12);return 'fixture-bcrypt-hash';},writeAudit:async(request,event)=>{events.push(event);if(auditError)throw Error('Audit rejected');}});
 return {create,calls,events,tx};
}
test('shared create core uses existing active role, parameterized insert and secret-free audit',async()=>{
 const h=harness(),user=await h.create(h.tx,payload,{id:2});assert.equal(user.id,17);assert.equal(user.roleCode,'admin');assert.equal(h.calls.length,2);assert.equal(h.calls[1].args.passwordHash,'fixture-bcrypt-hash');assert.equal(h.events[0].action,'user_created');assert.equal(h.events[0].actor.id,2);assert.doesNotMatch(JSON.stringify([user,h.events]),/fixture-password|fixture-bcrypt/);
});
test('missing role never inserts and duplicate never adopts an existing user',async()=>{
 const absent=harness({role:false});await assert.rejects(absent.create(absent.tx,payload),{code:'AUTH_ADMIN_ROLE_NOT_FOUND'});assert.equal(absent.calls.length,1);assert.equal(absent.events.length,0);
 const duplicate=harness({duplicate:true});await assert.rejects(duplicate.create(duplicate.tx,payload),{number:2627});assert.equal(duplicate.events.length,0);
});
test('audit failure propagates to caller transaction owner',async()=>{
 const h=harness({auditError:true});await assert.rejects(h.create(h.tx,payload),/Audit rejected/);
});
test('same normal input bounds and transaction/dependencies fail closed',async()=>{
 for(const p of [{...payload,username:'bad user'},{...payload,password:'short'},{...payload,roleId:0},{...payload,displayName:''}])assert.throws(()=>normalizeManagedAuthUser(p));
 assert.throws(()=>createManagedAuthUserCore({}));const h=harness();await assert.rejects(h.create(null,payload),/TRANSACTION/);assert.equal(h.calls.length,0);
});
