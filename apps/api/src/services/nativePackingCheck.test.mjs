import test from 'node:test';
import assert from 'node:assert/strict';
import {packingDecision,createPackingCheck} from './nativePackingCheck.mjs';
const order={id:1,status:'FINALIZED',sourceType:'sales_invoice',revision:'r1',items:[{id:11,productId:21,quantity:'2'},{id:12,productId:22,quantity:'1'}]};
const user={id:2,username:'test',permissions:[]},manager={...user,permissions:['terminal.packing.exception']};
const body=(counts,status='PACKED',reason='')=>({terminalCode:'TERM-V2-001',requestId:'11111111-1111-4111-8111-111111111111',revision:'r1',counts,status,reason});
test('exact counts alone permit normal completion',()=>{
 const result=packingDecision(order,body({11:'2',12:'1'}),user);assert.equal(result.status,'PACKED');assert.equal(result.missingQuantity,'0');assert.equal(result.extraQuantity,'0');
});
test('missing, excess, empty and offsetting per-line differences block normal completion',()=>{
 for(const counts of [{},{11:'1',12:'1'},{11:'3',12:'1'},{11:'1',12:'2'}])assert.throws(()=>packingDecision(order,body(counts),manager),{code:'PACKING_COUNT_MISMATCH'});
});
test('unauthorized exception and blank reason fail closed',()=>{
 assert.throws(()=>packingDecision(order,body({11:'1'},'PACKING_EXCEPTION','reason'),user),{code:'PACKING_EXCEPTION_DENIED'});
 for(const reason of ['', '   ', 'x'.repeat(501)])assert.throws(()=>packingDecision(order,body({11:'1'},'PACKING_EXCEPTION',reason),manager),{code:'PACKING_REASON_REQUIRED'});
});
test('authorized exception keeps both differences without netting and keeps reason',()=>{
 const result=packingDecision(order,body({11:'1',12:'2'},'PACKING_EXCEPTION',' reason '),manager);
 assert.equal(result.status,'PACKING_EXCEPTION');assert.equal(result.reason,'reason');assert.equal(result.missingQuantity,'1');assert.equal(result.extraQuantity,'1');
 assert.deepEqual(result.lines[0],{itemId:11,productId:21,expected:'2',counted:'1',missing:'1',extra:'0'});
});
test('invalid, stale, empty and foreign-line payloads cannot be finalized',()=>{
 for(const counts of [{11:'-1'},{11:true},{11:'1e3'},{11:'0.0001'},{999:'1'}])assert.throws(()=>packingDecision(order,body(counts),user));
 assert.throws(()=>packingDecision(order,{...body({11:'2',12:'1'}),revision:'old'},user),{code:'PACKING_RECEIPT_CHANGED'});
 assert.throws(()=>packingDecision({...order,items:[]},body({}),user),{code:'PACKING_RECEIPT_INVALID'});
 assert.throws(()=>packingDecision(order,body({11:'2',12:'1'},'PACKING_EXCEPTION','reason'),manager),{code:'PACKING_EXCEPTION_NOT_REQUIRED'});
});
test('audit includes authenticated actor, result, time; replay is idempotent and conflicts rejected',async()=>{
 let saved,writes=0;
 const check=createPackingCheck({receipt:async()=>order,store:{transaction:async(_id,work)=>work({find:async()=>saved,append:async e=>{writes++;return saved={...e,auditId:'55',recordedAt:'2026-09-17T12:00:00Z'};}})}});
 const input=body({11:'1',12:'2'},'PACKING_EXCEPTION','reviewed');
 const result=await check(1,input,manager);assert.equal(result.actorId,2);assert.equal(result.actorName,'test');assert.equal(result.recordedAt,'2026-09-17T12:00:00Z');
 assert.deepEqual(await check(1,input,manager),result);assert.equal(writes,1);
 await assert.rejects(check(1,{...input,reason:'changed'},manager),{code:'PACKING_REQUEST_CONFLICT'});
 await assert.rejects(check(1,input,user),{code:'PACKING_EXCEPTION_DENIED'});assert.equal(writes,1);
});
test('failed persistence never returns success',async()=>{
 const check=createPackingCheck({receipt:async()=>order,store:{transaction:async(_id,work)=>work({find:async()=>null,append:async()=>{throw Error('disk/db unavailable');}})}});
 await assert.rejects(check(1,body({11:'2',12:'1'}),user),/unavailable/);
});
