import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopLocalCustomerTransport} from './desktopLocalCustomerTransport.mjs';
import {createDesktopCustomerCreate} from './desktopCustomerCreate.mjs';

const location={origin:'http://127.0.0.1:5294'},requestId='d6be01f9-fac4-4e9c-b421-e2f070b6beb0';
const body=()=>({requestId,customerCode:'M1',name:'Örnek',phone:'555',customerType:'customer',currency:'TRY',city:'Yalova',country:'Türkiye'});
const result=()=>({state:'COMMITTED',requestId,operation:'customer.create',replayed:false,entity:{kind:'local',id:'1',entityId:'2',selectedCurrency:'TRY',accounts:[{id:'3',customerId:'1',currency:'TRY',currentBalanceExact8:'0.00000000'}]}});
const ok=payload=>({status:201,ok:true,json:async()=>payload});
const setup=fetch=>createDesktopLocalCustomerTransport({location,fetch,tokenProvider:async()=> 'abc.def.ghi'});

test('posts same request once to exact loopback, unwraps success data, and disables redirect/credentials',async()=>{
 const calls=[],expected=result();const send=setup(async(url,options)=>{calls.push({url,options});return ok({success:true,data:expected});});
 assert.deepEqual(await send(body()),expected);assert.equal(calls.length,1);const {url,options}=calls[0];
 assert.equal(url,'http://127.0.0.1:4294/api/desktop-local/customers');assert.equal(options.method,'POST');
 assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.ok(options.signal instanceof AbortSignal);
 assert.equal(options.headers.Authorization,'Bearer abc.def.ghi');assert.deepEqual(JSON.parse(options.body),body());
});
test('503, bad JSON, network loss, invalid envelopes and mismatched UUID all throw generic unknown',async()=>{
 const cases=[async()=>({status:503,ok:false,json:async()=>({})}),async()=>ok(null),async()=>{throw Error('secret');},
  async()=>({status:201,ok:true,json:async()=>{throw Error('bad json');}}),async()=>ok({success:true,data:{...result(),requestId:'b9e7013e-d9d6-425b-92a4-d263e983d990'}}),
  async()=>ok({success:false,data:result()}),async()=>ok({success:true,data:{...result(),replayed:'false'}}),
  async()=>ok({success:true,data:{...result(),entity:{id:'1'}}}),async()=>ok({success:true,data:{...result(),replayed:true}})];
 for(const fetch of cases)await assert.rejects(setup(fetch)(body()),{code:'CUSTOMER_TRANSPORT_UNAVAILABLE',message:'CUSTOMER_TRANSPORT_UNAVAILABLE'});
});
test('only expected origin, signed-token-shaped value and exact body are accepted',async()=>{
 let calls=0;const fetch=async()=>{calls++;return ok({success:true,data:result()});};
 assert.throws(()=>createDesktopLocalCustomerTransport({location:{origin:'http://192.168.1.46:5294'},fetch,tokenProvider:async()=>''}),{code:'CUSTOMER_TRANSPORT_UNAVAILABLE'});
 const noToken=createDesktopLocalCustomerTransport({location,fetch,tokenProvider:async()=> 'not-a-token'});
 await assert.rejects(noToken(body()),{code:'CUSTOMER_TRANSPORT_UNAVAILABLE'});
 await assert.rejects(setup(fetch)({...body(),actorId:'1'}),{code:'CUSTOMER_TRANSPORT_UNAVAILABLE'});assert.equal(calls,0);
});
test('replayed committed result is accepted only with HTTP 200',async()=>{
 const replay={...result(),replayed:true};
 const send=setup(async()=>({status:200,ok:true,json:async()=>({success:true,data:replay})}));
 assert.equal((await send(body())).replayed,true);
});
test('request body is frozen as serialized data before async token acquisition',async()=>{
 let release,observed;const send=createDesktopLocalCustomerTransport({location,fetch:async(_url,options)=>{observed=JSON.parse(options.body);return ok({success:true,data:result()});},
  tokenProvider:()=>new Promise(resolve=>{release=resolve;})});
 const input=body(),pending=send(input);input.city='Başka';release('abc.def.ghi');await pending;
 assert.equal(observed.city,'Yalova');assert.equal(observed.requestId,requestId);
});
test('origin change while awaiting token fails before network dispatch',async()=>{
 let release,calls=0;const mutable={origin:location.origin},send=createDesktopLocalCustomerTransport({location:mutable,fetch:async()=>{calls++;},tokenProvider:()=>new Promise(r=>{release=r;})});
 const pending=send(body());mutable.origin='http://example.invalid';release('abc.def.ghi');await assert.rejects(pending,{code:'CUSTOMER_TRANSPORT_UNAVAILABLE'});assert.equal(calls,0);
});
test('controller keeps the identical pending body after 503 and accepts matching 200 replay',async()=>{
 const map=new Map(),storage={getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 const locks={request:async(_key,_options,fn)=>fn({})};const calls=[];
 const transport=setup(async(_url,options)=>{calls.push(options.body);return calls.length===1?{status:503,ok:false}: {status:200,ok:true,json:async()=>({success:true,data:{...result(),replayed:true}})};});
 const controller=createDesktopCustomerCreate({actorId:'7',storage,locks,submit:transport,newId:()=>requestId});
 const {requestId:ignored,...fields}=body();assert.ok(ignored);
 assert.equal((await controller.create(fields)).state,'UNKNOWN');assert.equal(controller.pending().requestId,requestId);
 assert.equal((await controller.retry()).state,'COMMITTED');assert.equal(controller.pending(),null);assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);
});
