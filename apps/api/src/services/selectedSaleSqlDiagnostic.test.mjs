import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {SELECTED_SALE_DIAGNOSTIC_CALLS,selectedSaleDiagnosticProbe,selectedSaleSqlDiagnostics,selectedSaleSqlStateCode} from './selectedSaleSqlDiagnostic.mjs';
const failure=()=>Object.assign(new Error('PRIVATE_MESSAGE_CANARY'),{code:'EREQUEST',number:10053,state:'08S01',originalError:{sqlstate:'08S01',message:'PRIVATE_DRIVER_CANARY'},sqlCall:'FORGED_PRIVATE_CANARY',query:'PRIVATE_SQL_CANARY',params:{password:'PRIVATE_PASSWORD_CANARY'}});
test('innermost finite call survives nesting; original error, execution count and success value are unchanged',async()=>{
 const error=failure(),before=Object.getOwnPropertyDescriptors(error);let attempts=0;
 await assert.rejects(selectedSaleDiagnosticProbe('selectedSale.transaction',()=>selectedSaleDiagnosticProbe('invoice.finalize',async()=>{attempts++;throw error;})),e=>e===error);
 assert.equal(attempts,1);assert.deepEqual(Object.getOwnPropertyDescriptors(error),before);
 const result=selectedSaleSqlDiagnostics(error);assert.equal(result.sqlCall,'invoice.finalize');assert.equal(result.sqlStateCode,'08S01');assert(Number.isSafeInteger(result.sqlCallDurationMs));assert(result.sqlCallDurationMs>=0&&result.sqlCallDurationMs<=86400000);assert.deepEqual(Object.keys(result).sort(),['sqlCall','sqlCallDurationMs','sqlStateCode']);assert(!JSON.stringify(result).includes('PRIVATE'));
 result.sqlCall='forged';assert.equal(selectedSaleSqlDiagnostics(error).sqlCall,'invoice.finalize');
 const value={};assert.equal(await selectedSaleDiagnosticProbe('invoice.read',()=>value),value);
 for(const value of [null,undefined,'PRIVATE',17])await assert.rejects(selectedSaleDiagnosticProbe('invoice.read',()=>{throw value;}),e=>e===value);
});
test('ODBC SQLSTATE stays distinct from numeric SQL Server state without coercion or accessors',()=>{
 for(const error of [{state:1,originalError:{sqlstate:'08S01'}},{originalError:{info:{state:'42000'}}},{sqlstate:'HYT00'},{originalError:{state:'IM002'}}])assert.match(selectedSaleSqlStateCode(error),/^[0-9A-Z]{5}$/);
 for(const value of [0,1,255,'08s01','08S01 ','08S01PRIVATE','abcde',{},[],null,Symbol('PRIVATE')])assert.equal(selectedSaleSqlStateCode({state:value}),null);
 let getters=0;const e={};for(const key of ['originalError','sqlstate','sqlState','state','message','stack'])Object.defineProperty(e,key,{get(){getters++;throw Error('PRIVATE');}});assert.deepEqual(selectedSaleSqlDiagnostics(e),{});assert.equal(getters,0);
 const cyclic={state:1};cyclic.originalError=cyclic;cyclic.toJSON=()=>assert.fail();assert.deepEqual(selectedSaleSqlDiagnostics(cyclic),{});
 const proxy=new Proxy({},{getOwnPropertyDescriptor(){throw Error('PRIVATE');}});assert.deepEqual(selectedSaleSqlDiagnostics(proxy),{});
});
test('only six static calls are allowed and forged or inherited error fields cannot supply call identity',async()=>{
 assert.equal(SELECTED_SALE_DIAGNOSTIC_CALLS.length,6);
 for(const call of ['',null,'invoice.finalize.PRIVATE','INVOICE.FINALIZE',{},'invoice.finalize '])await assert.rejects(selectedSaleDiagnosticProbe(call,()=>assert.fail()),TypeError);
 assert.deepEqual(selectedSaleSqlDiagnostics({sqlCall:'invoice.finalize',sqlCallDurationMs:1}),{});
 assert.deepEqual(selectedSaleSqlDiagnostics(Object.create({state:'08S01',sqlCall:'invoice.finalize'})),{});
});
test('concurrent failures retain their own innermost identity without ambient state',async()=>{
 const a=failure(),b=failure();let releaseA,releaseB;
 const pa=selectedSaleDiagnosticProbe('invoice.post',()=>new Promise((_,reject)=>{releaseA=()=>reject(a);}));
 const pb=selectedSaleDiagnosticProbe('invoice.refresh',()=>new Promise((_,reject)=>{releaseB=()=>reject(b);}));
 const checkedA=assert.rejects(pa,e=>e===a),checkedB=assert.rejects(pb,e=>e===b);releaseB();releaseA();await Promise.all([checkedA,checkedB]);
 assert.equal(selectedSaleSqlDiagnostics(a).sqlCall,'invoice.post');assert.equal(selectedSaleSqlDiagnostics(b).sqlCall,'invoice.refresh');
});
const trade=fs.readFileSync(new URL('./workTradeStore.mjs',import.meta.url),'utf8'),factory=fs.readFileSync(new URL('./isolatedOperationCopyStoreFactory.mjs',import.meta.url),'utf8');
test('actual isolated finalize callback identifies each failing callee and stops before later effects',async()=>{
 const start=trade.indexOf('    c.finalize=',trade.indexOf('export async function buildIsolatedCopyTradeDomain')),end=trade.indexOf('    c.cancel=',start),source=trade.slice(start,end);
 const stages=['invoice.finalize','invoice.post','invoice.refresh','invoice.read'];
 for(const broken of [...stages,null]){
  const error=failure(),events=[],value={},actor={},ctx={},c={},step=async call=>{events.push(call);if(call===broken)throw error;return value;};
  vm.runInNewContext(source,{c,r:{invoice:{finalizeSalesInvoice:async(id,a,t)=>{assert.equal(id,901);assert.equal(a,actor);assert.equal(t,ctx);return step(stages[0]);}}},nativeId:()=>901,actor,ctx,postInvoice:async(id,type)=>{assert.equal(id,'901');assert.equal(type,'sales_invoice');return step(stages[1]);},refresh:()=>step(stages[2]),invoice:id=>{assert.equal(id,'901');return step(stages[3]);},selectedSaleDiagnosticProbe});
  if(broken){await assert.rejects(selectedSaleDiagnosticProbe('selectedSale.transaction',()=>c.finalize('901')),e=>e===error);assert.equal(selectedSaleSqlDiagnostics(error).sqlCall,broken);assert.equal(selectedSaleSqlDiagnostics(error).sqlStateCode,'08S01');assert.deepEqual(events,stages.slice(0,stages.indexOf(broken)+1));}
  else{assert.equal(await c.finalize('901'),value);assert.deepEqual(events,stages);}
 }
});
test('actual selected transaction callback preserves arguments and original rejection with no retry',async()=>{
 const line=factory.split(/\r?\n/).find(l=>/^  mutateSelectedSale:/.test(l));assert(line);const error=failure(),actor={},payload={},fn=()=>{};let count=0;
 const store=vm.runInNewContext('({'+line+'})',{selectedSaleDiagnosticProbe,readPermission:'sales.view',transaction:async(a,w,f,p,automatic)=>{count++;assert.equal(a,actor);assert.equal(w,true);assert.equal(f,fn);assert.equal(p,'sales.view');assert.equal(automatic.operation,'sale_finalize');assert.equal(automatic.payload,payload);assert.equal(automatic.selected,true);throw error;}});
 await assert.rejects(store.mutateSelectedSale(actor,'sale_finalize',payload,fn),e=>e===error);assert.equal(count,1);assert.equal(selectedSaleSqlDiagnostics(error).sqlCall,'selectedSale.transaction');
});
