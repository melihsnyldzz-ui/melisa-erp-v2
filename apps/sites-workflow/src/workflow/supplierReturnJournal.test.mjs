import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupplierReturnJournal,supplierReturnRequest} from './supplierReturnJournal.mjs';
const path='/api/test-daily/purchase/draft',body={requestId:'00000000-0000-4000-8000-000000000001',date:'2026-10-06',reason:'Mal geri gönderildi',sourceInvoiceId:139,sourceItemId:701,quantity:1};
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('lost response survives refresh and replays the complete immutable request without a new effect',async()=>{
 const storage=store(),calls=[];let effects=0,lost=true;const send=async(p,o)=>{calls.push({p,o});if(!effects)effects++;if(lost){lost=false;throw Error('network');}return {replayed:true};};
 const journal=createSupplierReturnJournal({storage,key:'return',send,refresh:async()=>{}});const selection={...body};await assert.rejects(()=>journal.begin(path,selection));selection.quantity=4;assert.equal(journal.read().body.quantity,1);await assert.rejects(()=>journal.begin(path,{...body,quantity:2}));
 const restored=createSupplierReturnJournal({storage,key:'return',send,refresh:async()=>{}});assert.deepEqual(await restored.retry(),{replayed:true});assert.equal(effects,1);assert.deepEqual(calls[0],calls[1]);assert.equal(restored.read(),null);
});
test('double click is blocked while request is pending; refresh failure keeps the original request',async()=>{
 const storage=store();let release,calls=0;const wait=new Promise(r=>release=r),j=createSupplierReturnJournal({storage,key:'return',send:async()=>{calls++;await wait;},refresh:async()=>{throw Error('read lost');}});
 const first=j.begin(path,body);assert.equal(j.busy,true);await assert.rejects(()=>j.begin(path,body));release();await assert.rejects(()=>first);assert.equal(calls,1);assert.deepEqual(j.read().body,body);
});
test('storage failure and corrupted or out-of-scope pending data fail before any request',async()=>{
 let calls=0;for(const storage of [null,{getItem:()=>null,setItem(){throw Error('full');}}]){const j=createSupplierReturnJournal({storage,key:'return',send:async()=>{calls++;},refresh:async()=>{}});await assert.rejects(()=>j.begin(path,body));}
 const storage=store();storage.setItem('return',JSON.stringify({version:1,path:'/api/test-daily/purchase/prepare',body}));const j=createSupplierReturnJournal({storage,key:'return',send:async()=>{calls++;},refresh:async()=>{}});await assert.rejects(()=>j.retry());assert.equal(calls,0);
 for(const [p,b] of [['/api/test-daily/sales/draft',body],[path,{...body,quantity:0}],[path,{...body,actorId:1}],[path,{...body,sourceItemId:0}]])assert.throws(()=>supplierReturnRequest(p,b));
});
test('definitive rollback response permits correction; decisions each use their own complete UUID body',async()=>{
 const storage=store(),j=createSupplierReturnJournal({storage,key:'return',send:async()=>{throw Object.assign(Error('forbidden'),{status:403});},refresh:async()=>{}});await assert.rejects(()=>j.begin(path,body));assert.equal(j.read(),null);
 for(const action of ['approve','reject','cancel'])assert.doesNotThrow(()=>supplierReturnRequest('/api/test-daily/purchase/'+action,{requestId:body.requestId,date:body.date,id:9,...(action==='approve'?{}:{reason:'Kaydı düzeltiyorum'})}));
});
test('late retry completion or rejection cannot erase a newer pending request in another tab',async()=>{
 for(const status of [null,409]){
  const storage=store();let release,call=0;const wait=new Promise(r=>release=r),send=async()=>{if(++call===2){await wait;if(status)throw Object.assign(Error('stale'),{status});}else if(call===3)throw Error('lost');return {};};
  const a=createSupplierReturnJournal({storage,key:'return',send,refresh:async()=>{}}),b=createSupplierReturnJournal({storage,key:'return',send,refresh:async()=>{}});
  const first=a.begin(path,body),late=b.retry();await first;const next={...body,requestId:'00000000-0000-4000-8000-000000000002'};await assert.rejects(()=>a.begin(path,next));release();if(status)await assert.rejects(()=>late);else await late;assert.deepEqual(a.read().body,next);
 }
});
test('a successful write followed by forbidden refresh still keeps its replay request',async()=>{
 const storage=store(),j=createSupplierReturnJournal({storage,key:'return',send:async()=>({id:9}),refresh:async()=>{throw Object.assign(Error('read denied'),{status:403});}});await assert.rejects(()=>j.begin(path,body));assert.deepEqual(j.read().body,body);
 assert.throws(()=>supplierReturnRequest(path,{...body,date:'2026-02-31'}));
});
