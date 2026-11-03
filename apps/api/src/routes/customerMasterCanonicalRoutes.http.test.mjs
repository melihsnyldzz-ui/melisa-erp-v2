import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

if(!process.execArgv.includes('--experimental-test-module-mocks')){
 test('canonical customer HTTP fixture runs with isolated module mocks and offline guard',()=>{
  const guard=fileURLToPath(new URL('../../../../scripts/ci/offline-guard.cjs',import.meta.url));
  const result=spawnSync(process.execPath,['--require',guard,'--experimental-test-module-mocks','--test',fileURLToPath(import.meta.url)],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 });
}else{

// Only external providers are substituted. The production requireAuth,
// permission middleware, quarantine gate and Express router stack are real.
// No Windows process, native SQL, protected credential or server is used.
const users={editor:{id:17,permissions:['customer.view','customer.edit']},viewer:{id:18,permissions:['customer.view']}};
let held=false;const holds=[];let writes=0;
mock.module('../services/authService.js',{namedExports:{
 verifyAccessToken(token){if(!users[token])throw Object.assign(Error('invalid'),{statusCode:401,code:'AUTH_INVALID'});return {sub:token};},
 async getUserById(id){return users[id];},verifyNormalTestAccessSession(payload,user){if(users[payload.sub]!==user)throw Error('actor mismatch');}
}});
mock.module('../services/operationQuarantineService.js',{namedExports:{
 async assertOperationQuarantineAllowed(rows){holds.push(rows);if(held)throw Object.assign(Error('held'),{statusCode:409,code:'MIGRATION_ENTITY_QUARANTINED'});},
 operationQuarantineService:{},quarantineTransactionContext(){throw Error('not used');}
}});
const legacy=(_req,res)=>res.status(503).json({source:'legacy'});
const oldNames=['getCustomer','getCustomerCard','getCustomerCards','getCustomerContact','getCustomerContactRequest','postCustomerContact','getCustomers','getVegaCustomers','patchCustomerPassive','postCashCustomersEnsure','postCustomer','putCustomer'];
mock.module('../controllers/customerController.js',{namedExports:Object.fromEntries(oldNames.map(name=>[name,legacy]))});
const {createCustomerMasterCanonicalRoutes}=await import('./customerMasterCanonicalRoutes.mjs');
const {customerRoutes}=await import('./customerRoutes.js');
const binding={service:{context:async()=>({source:'canonical'}),recover:async()=>({source:'canonical'}),update:async()=>{writes++;return {source:'canonical'};}},cards:{list:async()=>({data:[{source:'canonical'}]}),detail:async()=>({data:{source:'canonical'}})}};
async function server(order){const app=express();app.use(express.json());for(const name of order)app.use('/api',name==='canonical'?createCustomerMasterCanonicalRoutes(binding):customerRoutes);app.use((e,_q,s,_n)=>s.status(e.statusCode??500).json({code:e.code}));const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));return {fetch:(path,options={})=>fetch(`http://127.0.0.1:${s.address().port}/api${path}`,options),async close(){s.closeAllConnections();await new Promise(r=>s.close(r));}};}
const auth=token=>({authorization:`Bearer ${token}`,'content-type':'application/json'});
test('real HTTP auth and enabled quarantine gate reject before the canonical handler',async()=>{
 const beforeEnv=process.env.MELISA_CANONICAL_TEST;process.env.MELISA_CANONICAL_TEST='true';held=true;holds.length=0;writes=0;const s=await server(['canonical']);
 try{
  assert.equal((await s.fetch('/customers/100/master',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
  assert.equal((await s.fetch('/customers/100/master',{method:'POST',headers:auth('viewer'),body:'{}'})).status,403);
  assert.equal(holds.length,0);assert.equal(writes,0);
  const rejected=await s.fetch('/customers/100/master',{method:'POST',headers:auth('editor'),body:'{}'});assert.equal(rejected.status,409);assert.equal((await rejected.json()).code,'MIGRATION_ENTITY_QUARANTINED');assert.deepEqual(holds,[[{entity:'customer',nativeId:'100'}]]);assert.equal(writes,0);
  held=false;assert.equal((await s.fetch('/customers/100/master',{method:'POST',headers:auth('editor'),body:'{}'})).status,200);assert.equal(writes,1);
 }finally{await s.close();if(beforeEnv===undefined)delete process.env.MELISA_CANONICAL_TEST;else process.env.MELISA_CANONICAL_TEST=beforeEnv;}
});
test('canonical route must be mounted before overlapping legacy routes',async()=>{
 for(const [order,expected] of [[['canonical','legacy'],'canonical'],[['legacy','canonical'],'legacy']]){const s=await server(order);try{const r=await s.fetch('/customers/100/card',{headers:auth('viewer')});const body=await r.json();assert.equal(expected==='canonical'?body.data.source:body.source,expected);assert.equal(r.status,expected==='canonical'?200:503);}finally{await s.close();}}
});
}
