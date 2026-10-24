import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
let state;
class Transaction {async begin(){state.begin++;}async commit(){state.commit++;}async rollback(){state.rollback++;if(state.rollbackError)throw state.rollbackError;}}
class Request {constructor(tx){this.tx=tx;this.args={};}input(k,t,v){this.args[k]=v;return this;}async query(q){
 state.queries.push(q);
 if(q.includes('INSERT INTO dbo.users')){if(state.coreError)throw state.coreError;if(state.duplicate)throw Object.assign(Error('Duplicate'),{number:2627});return {recordset:[{id:17}]};}
 if(q==='SELECT TOP (1) id, code, name FROM dbo.roles WHERE id = @roleId AND is_active = 1;')return {recordset:state.role?[{id:2,code:'admin',name:'Admin'}]:[]};
 return {recordset:[]};
}}
mock.module('bcrypt',{defaultExport:{hash:async(pw,rounds)=>{state.hashCalls++;assert.equal(rounds,12);return 'fixture-hash';}}});
mock.module('mssql',{defaultExport:{BigInt:0,NVarChar:()=>0,Bit:0}});
mock.module('../config/database.js',{namedExports:{getSqlDriver:()=>({Transaction,Request}),getSqlPool:async()=>{state.poolCalls++;return {request:()=>new Request(null)};}}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async(req,event)=>{state.audit.push(event);if(state.auditError)throw Error('Audit failure');}}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{state.guard++;if(!state.authorized)throw Object.assign(Error('Denied'),{code:'SQL_WRITE_TARGET_INVALID'});}}});
const {createAuthAdminUser}=await import('./authAdminService.js');
const payload={username:'fixture.user',displayName:'Fixture',password:'fixture-password',roleId:2};
beforeEach(()=>{state={authorized:true,guard:0,poolCalls:0,hashCalls:0,begin:0,commit:0,rollback:0,queries:[],audit:[],role:true,duplicate:false,auditError:false};});
test('normal API keeps existing guard transaction and overview with shared audited core',async()=>{
 const result=await createAuthAdminUser(payload,{id:2});assert.equal(state.guard,1);assert.equal(state.begin,1);assert.equal(state.commit,1);assert.equal(state.rollback,0);assert.deepEqual(result,{users:[],roles:[],permissions:[],auditLogs:[]});assert.equal(state.audit[0].action,'user_created');assert.doesNotMatch(JSON.stringify(result),/fixture-password|fixture-hash/);
});
test('normal API guard rejects before pool or password hashing',async()=>{
 state.authorized=false;await assert.rejects(createAuthAdminUser(payload),{code:'SQL_WRITE_TARGET_INVALID'});assert.equal(state.poolCalls,0);assert.equal(state.hashCalls,0);assert.equal(state.begin,0);
});
test('normal API role, duplicate and audit failure roll back and preserve 409 duplicate contract',async()=>{
 state.role=false;await assert.rejects(createAuthAdminUser(payload),{code:'AUTH_ADMIN_ROLE_NOT_FOUND'});assert.equal(state.rollback,1);assert.equal(state.commit,0);
 state.role=true;state.duplicate=true;await assert.rejects(createAuthAdminUser(payload),{code:'AUTH_ADMIN_USERNAME_DUPLICATE',statusCode:409});assert.equal(state.rollback,2);
 state.duplicate=false;state.auditError=true;await assert.rejects(createAuthAdminUser(payload),/Audit failure/);assert.equal(state.rollback,3);assert.equal(state.commit,0);
});

test('auto-aborted and already-closed transaction cleanup cannot replace the primary native failure',async()=>{
 for(const code of ['EABORT','ENOTBEGUN','ECONNCLOSED']){
  const primary=Object.assign(Error('PRIVATE_NATIVE_MESSAGE'),{code:'EREQUEST',number:51972,query:'PRIVATE_QUERY'});
  const cleanup=Object.assign(Error('PRIVATE_CLEANUP_MESSAGE'),{code});
  state.coreError=primary;state.rollbackError=cleanup;
  await assert.rejects(createAuthAdminUser(payload),e=>{
   assert.equal(e.cause,primary);assert.deepEqual(e.errors,[primary,cleanup]);
   assert.equal(e.code,'EREQUEST');assert.equal(e.statusCode,503);
   assert.equal(e.message,'Auth admin request failed');return true;
  });
  assert.equal(state.commit,0);assert.equal(state.audit.length,0);
 }
 assert.equal(state.rollback,3);
});

test('a successful rollback rethrows the original error object and does not create a success or commit',async()=>{
 const primary=Object.assign(Error('PRIVATE_NATIVE_MESSAGE'),{code:'EREQUEST',number:51972});state.coreError=primary;
 await assert.rejects(createAuthAdminUser(payload),e=>e===primary);
 assert.equal(state.rollback,1);assert.equal(state.commit,0);assert.equal(state.audit.length,0);
});

test('duplicate and validation public contracts remain safe when cleanup also fails',async()=>{
 state.rollbackError=Object.assign(Error('PRIVATE_CLEANUP_MESSAGE'),{code:'EABORT'});
 for(const number of [2601,2627]){
  state.coreError=Object.assign(Error('PRIVATE_DUPLICATE_MESSAGE'),{code:'EREQUEST',number});
  await assert.rejects(createAuthAdminUser(payload),e=>{
   assert.equal(e.cause,state.coreError);assert.equal(e.errors[1],state.rollbackError);
   assert.equal(e.code,'AUTH_ADMIN_USERNAME_DUPLICATE');assert.equal(e.statusCode,409);assert.equal(e.message,'Username already exists');return true;
  });
 }
 state.role=false;
 await assert.rejects(createAuthAdminUser(payload),e=>e.code==='AUTH_ADMIN_ROLE_NOT_FOUND'&&e.cause.code==='AUTH_ADMIN_ROLE_NOT_FOUND'&&e.errors[1]===state.rollbackError);
 assert.equal(state.commit,0);assert.equal(state.rollback,3);
});

test('normal controller never returns raw primary or cleanup SQL details',async()=>{
 const {postAuthAdminUser}=await import('../controllers/authAdminController.js');
 state.coreError=Object.assign(Error('PRIVATE_NATIVE_MESSAGE'),{code:'EREQUEST',number:51972,procName:'PRIVATE_PROCEDURE',parameters:{password:'PRIVATE_PASSWORD'}});
 state.rollbackError=Object.assign(Error('PRIVATE_CLEANUP_MESSAGE'),{code:'EABORT'});
 let status,body;const res={status(v){status=v;return this;},json(v){body=v;return v;}};
 await postAuthAdminUser({body:payload,user:{id:2}},res);
 assert.equal(status,503);assert.equal(body.error.code,'EREQUEST');assert.equal(body.error.message,'Auth admin request failed');
 assert.doesNotMatch(JSON.stringify(body),/PRIVATE|51972|EABORT|cause|errors|parameters|rollback/);
 assert.equal(state.rollback,1);assert.equal(state.commit,0);
});
