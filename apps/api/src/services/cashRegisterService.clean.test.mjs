import test,{mock} from 'node:test';
import assert from 'node:assert/strict';

// Lifecycle contract only: this does not claim real SQL or normal GUI proof.
let calls=[],external,rejectContext=false;
const failure=Object.assign(new Error('Controlled native request failure'),{code:'CASH_TEST_REQUEST_FAILURE'});
const schema=()=>({recordset:[Object.fromEntries(['cash_drawers','cash_sessions','cash_session_counts','expense_categories','cash_expenses','cash_transfers','cash_adjustments'].map(k=>[k,1]))]});
class Transaction{
 constructor(){calls.push('new-transaction');}
 async begin(){calls.push('begin');}
 async commit(){calls.push('commit');}
 async rollback(){calls.push('rollback');}
}
class Request{
 constructor(tx){calls.push('request');assert.equal(tx,external??owned);}
 input(){return this;}
 async query(){throw failure;}
}
const owned=new Transaction();
const driver={Request,Transaction:class extends Transaction{constructor(){super();return owned;}},BigInt:1,Date:2,NVarChar:()=>3,Decimal:()=>4};
const pool={request(){calls.push('pool-request');return {async query(){return schema();}};}};
// Construction above predates the per-case counter.
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>{calls.push('default-pool');return pool;},getSqlDriver:()=>driver}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>calls.push('write-guard')}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async()=>assert.fail('No successful posting expected')}});
mock.module('./cleanStoreDayScope.mjs',{namedExports:{assertCleanCashRegisterTransaction(context,operation,actor){calls.push(operation);if(rejectContext)throw Error('Unbound cash context');assert.equal(context.transaction,external);assert.equal(context.sqlDriver,driver);assert.equal(context.pool,pool);assert.equal(actor.id,20);}}});
const service=await import('./cashRegisterService.js');
const cases=[['cash_open','openCashSession',{drawerId:1,businessDate:'2026-10-22',counts:{}}],['cash_transfer','createCashTransfer',{sessionId:1,currency:'USD',amount:1,direction:'main_to_drawer',description:'Örnek transfer'}],['cash_expense','createCashExpense',{sessionId:1,categoryId:1,currency:'EUR',amount:1,description:'Örnek gider'}],['cash_close','closeCashSession',{sessionId:1,counts:{}}]];

for(const [operation,name,payload] of cases){
 test(`${name}: a failed native request leaves rollback to its admitted outer transaction`,async()=>{
  calls=[];external={};rejectContext=false;
  await assert.rejects(service[name](payload,{id:20},{pool,transaction:external,sqlDriver:driver}),e=>e===failure);
  assert.equal(calls[0],operation);assert(calls.includes('write-guard'));assert(calls.includes('request'));
  assert(!calls.some(c=>['default-pool','new-transaction','begin','commit','rollback'].includes(c)));
 });
 test(`${name}: unbound context is refused before any pool or native engine request`,async()=>{
  calls=[];external={};rejectContext=true;
  await assert.rejects(service[name](payload,{id:20},{pool,transaction:external,sqlDriver:driver}),/Unbound cash context/);
  assert.deepEqual(calls,[operation]);
 });
 test(`${name}: the original standalone engine still owns and rolls back its own transaction`,async()=>{
  calls=[];external=null;rejectContext=false;
  await assert.rejects(service[name](payload,{id:20}),e=>e===failure);
  assert.deepEqual(calls.slice(0,5),['write-guard','default-pool','pool-request','new-transaction','begin']);
  assert.equal(calls.filter(c=>c==='rollback').length,1);assert(!calls.includes('commit'));
 });
}
