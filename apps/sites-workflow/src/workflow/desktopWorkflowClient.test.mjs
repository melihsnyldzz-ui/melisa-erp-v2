import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopWorkflowClient} from './desktopWorkflowClient.mjs';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const locks={request:async(_k,_options,fn)=>fn({})},uuid='da171000-6f42-4f19-8cab-9f4539618647';

test('uncertain cancellation keeps the original command and accepts its exact committed replay',async()=>{
 const storage=memory();let lost=true;const calls=[];const args={actorId:'8',storage,locks,newId:()=>uuid,submit:async(kind,body)=>{calls.push({kind,body});if(lost)throw Error('lost');return {state:'COMMITTED',requestId:body.requestId,invoiceId:body.invoiceId,workflowState:'CANCELLED',version:'0x0000000000000002',replayed:true};}};
 const first=createDesktopWorkflowClient(args);assert.equal((await first.create('transition',{invoiceId:'12',operation:'CANCEL',expectedVersion:'0x0000000000000001',cartons:[]})).state,'UNKNOWN');lost=false;const restored=createDesktopWorkflowClient(args);assert.equal((await restored.retry()).workflowState,'CANCELLED');assert.deepEqual(calls[0],calls[1]);assert.equal(restored.pending(),null);
});
test('lost lifecycle reply preserves UUID/body across remount and blocks a different command',async()=>{
 const storage=memory(),calls=[];let lost=true;
 const submit=async(kind,body)=>{calls.push({kind,body:structuredClone(body)});if(lost)throw Error('lost');return {state:'COMMITTED',requestId:body.requestId,invoiceId:body.invoiceId,workflowState:'PREPARING',version:'0x0000000000000002',replayed:true};};
 const make=()=>createDesktopWorkflowClient({actorId:'8',storage,locks,newId:()=>uuid,submit});
 const fields={invoiceId:'12',operation:'PREPARE',expectedVersion:'0x0000000000000001',cartons:[]};
 const first=make();assert.equal((await first.create('transition',fields)).state,'UNKNOWN');
 await assert.rejects(first.create('transition',{...fields,operation:'READY'}));
 lost=false;const next=make();assert.equal((await next.retry()).state,'COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.equal(next.pending(),null);
});
test('invalid success, storage failure and unavailable lock cannot erase or send an uncertain command',async()=>{
 const storage=memory();let calls=0;const args={actorId:'8',storage,locks,newId:()=>uuid,submit:async()=>{calls++;return {state:'COMMITTED',requestId:uuid,invoiceId:'99',workflowState:'COMPLETED',version:'0x0000000000000002',replayed:false};}};
 const f=createDesktopWorkflowClient(args),body={invoiceId:'12',customerId:'2',productIds:['5','9'],expectedVersion:'0x0000000000000001'};
 assert.equal((await f.create('dispatch',body)).state,'UNKNOWN');assert.ok(f.pending());
 const noLock=createDesktopWorkflowClient({...args,locks:{request:async(_a,_b,fn)=>fn(null)}});await assert.rejects(noLock.retry());assert.equal(calls,1);
 const noStore=createDesktopWorkflowClient({...args,storage:{...memory(),setItem(){throw Error('storage failed');}}});await assert.rejects(noStore.create('dispatch',body));assert.equal(calls,1);
});
test('only a matching durable no-commit resolution releases an unknown lifecycle command',async()=>{
 const storage=memory();let allowed=false;
 const client=createDesktopWorkflowClient({actorId:'8',storage,locks,newId:()=>uuid,submit:async(kind,body)=>{
  if(kind!=='resolve')throw Error('lost');return {state:'NOT_COMMITTED',requestId:body.body.requestId,actorId:allowed?'8':'9',kind:body.kind,resolution:'DURABLE_NO_COMMIT'};
 }});
 await client.create('transition',{invoiceId:'12',operation:'READY',expectedVersion:'0x0000000000000001',cartons:[]});
 assert.equal((await client.resolve()).state,'UNKNOWN');assert.ok(client.pending());allowed=true;
 assert.equal((await client.resolve()).state,'NOT_COMMITTED');assert.equal(client.pending(),null);
});
