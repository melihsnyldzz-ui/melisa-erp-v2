import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopLocalProductTransport} from './desktopLocalProductTransport.mjs';
import {createDesktopProductCreate} from './desktopProductCreate.mjs';
const location={origin:'http://127.0.0.1:5294'},requestId='d6be01f9-fac4-4e9c-b421-e2f070b6beb0';
const fields={stockCode:'P1',name:'Ürün',barcode:'0001',unit:'ADET',currency:'TRY',salePriceExact4:'10.2500',purchasePriceExact4:'5.0000',purchaseDiscountRateExact4:'0.0000',saleTier:null};
const body=()=>({requestId,...fields});
const result=()=>({state:'COMMITTED',requestId,operation:'product.create',replayed:false,entity:{kind:'local',id:'1',name:'Ürün',units:[{id:'2',label:'ADET',factorExact8:'1.00000000',isMain:true}],prices:[{id:'3',type:'sale',unitId:'2',tier:null,currency:'TRY',priceExact8:'10.25000000'}]}});
const ok=data=>({status:201,ok:true,json:async()=>({success:true,data})});
const setup=fetch=>createDesktopLocalProductTransport({location,fetch,tokenProvider:async()=> 'a.b.c'});
test('exact product endpoint and decimal strings are sent once without redirects or ambient credentials',async()=>{
 let seen;const r=await setup(async(url,options)=>{seen={url,options};return ok(result());})(body());assert.equal(r.state,'COMMITTED');
 assert.equal(seen.url,'http://127.0.0.1:4294/api/desktop-local/products');assert.equal(seen.options.redirect,'error');assert.equal(seen.options.credentials,'omit');assert.deepEqual(JSON.parse(seen.options.body),body());
});
test('opening stock is carried as exact optional strings in the same product request',async()=>{
 let sent;const input={...body(),openingQuantityExact3:'4.000',openingDate:'2026-11-05'};
 await setup(async(_url,options)=>{sent=JSON.parse(options.body);return ok(result());})(input);assert.deepEqual(sent,input);
 await assert.rejects(setup(async()=>ok(result()))({...input,openingQuantityExact3:4}));
});
test('network/503/malformed or changed identity always throws generic uncertainty',async()=>{
 const bad=[async()=>{throw Error('secret');},async()=>({status:503,ok:false}),async()=>({status:201,ok:true,json:async()=>{throw Error();}}),
  async()=>ok({...result(),requestId:'28a64784-c72e-4f96-a5c3-394f02009589'}),async()=>ok({...result(),entity:{id:'1'}}),
  async()=>{const v=result();v.entity.prices[0].priceExact8='10.25000001';return ok(v);}];
 for(const f of bad)await assert.rejects(setup(f)(body()),{code:'PRODUCT_TRANSPORT_UNAVAILABLE',message:'PRODUCT_TRANSPORT_UNAVAILABLE'});
});
test('extra PR54 fields cannot be silently discarded and invalid origin never dispatches',async()=>{
 let calls=0;const f=async()=>{calls++;return ok(result());};
 for(const extra of [{brand:'MELISA'},{category:'Giysi'},{supplierId:'1'}])await assert.rejects(setup(f)({...body(),...extra}),{code:'PRODUCT_TRANSPORT_UNAVAILABLE'});
 assert.throws(()=>createDesktopLocalProductTransport({location:{origin:'http://localhost:5294'},fetch:f,tokenProvider:async()=>''}),{code:'PRODUCT_TRANSPORT_UNAVAILABLE'});assert.equal(calls,0);
});
test('pending controller replays the same exact request after 503 and resolves matching 200',async()=>{
 const map=new Map(),storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},locks={request:async(_k,_o,cb)=>cb({})},calls=[];
 const send=setup(async(_url,o)=>{calls.push(o.body);return calls.length===1?{status:503,ok:false}:{status:200,ok:true,json:async()=>({success:true,data:{...result(),replayed:true}})};});
 const c=createDesktopProductCreate({actorId:'7',storage,locks,submit:send,newId:()=>requestId});
 assert.equal((await c.create(fields)).state,'UNKNOWN');assert.equal(c.pending().requestId,requestId);
 assert.equal((await c.retry()).state,'COMMITTED');assert.equal(c.pending(),null);assert.equal(calls[0],calls[1]);
});
test('body snapshot is taken before awaiting credentials',async()=>{
 let release,sent;const send=createDesktopLocalProductTransport({location,tokenProvider:()=>new Promise(r=>{release=r;}),fetch:async(_url,o)=>{sent=JSON.parse(o.body);return ok(result());}});
 const value=body(),promise=send(value);value.salePriceExact4='99.0000';release('a.b.c');await promise;assert.equal(sent.salePriceExact4,'10.2500');
});
