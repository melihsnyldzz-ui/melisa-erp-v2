import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopCustomerCreate} from './desktopCustomerCreate.mjs';

const id='2d563464-cd1f-4348-8b18-449b327075e5';
const fields={customerCode:'M001',name:'Örnek Müşteri',phone:'5551234567',customerType:'customer',currency:'TRY',city:' İstanbul ',country:' Türkiye '};
function memory(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),map:m};}
function lockManager(){const held=new Set();return {async request(key,options,callback){assert.equal(options.mode,'exclusive');assert.equal(options.ifAvailable,true);if(held.has(key))return callback(null);held.add(key);try{return await callback({name:key});}finally{held.delete(key);}}};}
function client(storage,submit,actorId='1',locks=lockManager()){return createDesktopCustomerCreate({actorId,storage,submit,newId:()=>id,locks});}
const committed=requestId=>({state:'COMMITTED',requestId,operation:'customer.create',entity:{kind:'local',id:'9',entityId:'11',selectedCurrency:'TRY',accounts:[{id:'13',customerId:'9',currency:'TRY',currentBalanceExact8:'0.00000000'}]},replayed:true});

test('lost reply retains same identifier and exact body through remount and retry',async()=>{
 const s=memory(),calls=[];let fail=true;
 const send=async p=>{calls.push(p);if(fail)throw Error('network');return committed(p.requestId);};
 assert.equal((await client(s,send).create(fields)).state,'UNKNOWN');
 const next=client(s,send);assert.equal(next.pending().requestId,id);fail=false;
 const result=await next.retry();assert.equal(result.state,'COMMITTED');assert.equal(result.replayed,true);
 assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].city,'İstanbul');assert.equal(calls[0].country,'Türkiye');assert.equal(next.pending(),null);
});
test('pending request cannot be replaced by edited form or another actor',async()=>{
 const s=memory(),calls=[];const send=async p=>{calls.push(p);return {state:'UNKNOWN'};};
 const c=client(s,send);await c.create(fields);await assert.rejects(c.create({...fields,name:'Başka'}),/CUSTOMER_CREATE_PENDING/);
 assert.equal(calls.length,1);assert.equal(client(s,send,'2').pending(),null);assert.equal(c.pending().name,fields.name);
});
test('storage failure prevents a network request',async()=>{
 let sent=0;const s={getItem:()=>null,setItem:()=>{throw Error('quota');},removeItem:()=>{}};
 await assert.rejects(client(s,async()=>{sent++;}).create(fields));assert.equal(sent,0);
});
test('concurrent submit is refused and malformed success does not erase pending',async()=>{
 const s=memory();let finish;const c=client(s,()=>new Promise(resolve=>{finish=resolve;}));
 const first=c.create(fields);await assert.rejects(c.retry(),/CUSTOMER_CREATE_BUSY/);
 finish({state:'COMMITTED',requestId:id,operation:'customer.create',entity:{id:'0'}});
 assert.equal((await first).state,'UNKNOWN');assert.equal(c.pending().requestId,id);
});
test('invalid input and corrupted durable record fail without dispatch',async()=>{
 const s=memory();let sent=0;const c=client(s,async()=>{sent++;});
 await assert.rejects(c.create({...fields,unexpected:'x'}));assert.equal(sent,0);
 await c.create(fields);const [key]=s.map.keys();s.map.set(key,'{bad');
 assert.throws(()=>c.pending(),/CUSTOMER_CREATE_INVALID/);await assert.rejects(c.retry(),/CUSTOMER_CREATE_INVALID/);assert.equal(sent,1);
});
test('optional city and country normalize to null; long and control data never dispatch',async()=>{
 const calls=[],s=memory(),c=client(s,async p=>{calls.push(p);return {state:'UNKNOWN'};});
 for(const bad of [{city:'x'.repeat(101)},{country:'Ankara\n'}])await assert.rejects(c.create({...fields,...bad}));
 assert.equal(calls.length,0);await c.create({...fields,city:'   ',country:''});
 assert.equal(calls[0].city,null);assert.equal(calls[0].country,null);
});
test('two tabs cannot submit simultaneously for the same actor',async()=>{
 const s=memory(),locks=lockManager();let finish,calls=0;
 const send=async()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 const a=client(s,send,'1',locks),b=client(s,send,'1',locks);
 const first=a.create(fields);await assert.rejects(b.create({...fields,name:'Başka'}),/CUSTOMER_CREATE_BUSY/);
 assert.equal(calls,1);finish({state:'UNKNOWN'});await first;
 await assert.rejects(b.create({...fields,name:'Başka'}),/CUSTOMER_CREATE_PENDING/);assert.equal(calls,1);
});
test('partial or inconsistent customer identity never clears pending request',async()=>{
 const variants=[
  e=>delete e.entityId,
  e=>{e.kind='vega';},
  e=>{e.selectedCurrency='USD';},
  e=>{e.accounts[0].customerId='8';},
  e=>{e.accounts[0].currency='USD';},
  e=>{e.accounts[0].currentBalanceExact8='1.00000000';},
  e=>{e.accounts[0].id='9223372036854775808';},
  e=>{e.accounts=[];},
 ];
 for(const mutate of variants){const s=memory(),response=committed(id);mutate(response.entity);const c=client(s,async()=>response);
  assert.equal((await c.create(fields)).state,'UNKNOWN');assert.equal(c.pending().requestId,id);}
});
