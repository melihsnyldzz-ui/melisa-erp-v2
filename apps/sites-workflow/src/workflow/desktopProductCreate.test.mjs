import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopProductCreate,desktopProductDecimal4,desktopProductDecimal3,isDesktopProductCostSupported} from './desktopProductCreate.mjs';
const id='d6be01f9-fac4-4e9c-b421-e2f070b6beb0';
const fields={stockCode:'P1',name:'Ürün',barcode:'0001',unit:'ADET',currency:'TRY',salePriceExact4:'10.2500',purchasePriceExact4:'5.0000',purchaseDiscountRateExact4:'0.0000',saleTier:null};
function memory(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
function lockManager(){const held=new Set();return {async request(key,options,fn){assert.equal(options.ifAvailable,true);if(held.has(key))return fn(null);held.add(key);try{return await fn({});}finally{held.delete(key);}}};}
function make(storage,submit,locks=lockManager()){return createDesktopProductCreate({actorId:'7',storage,submit,locks,newId:()=>id});}
function committed(p){return {state:'COMMITTED',requestId:p.requestId,operation:'product.create',replayed:true,entity:{kind:'local',id:'1',name:p.name,units:[{id:'2',label:p.unit,factorExact8:'1.00000000',isMain:true}],prices:[{id:'3',type:'sale',unitId:'2',tier:p.saleTier,currency:p.currency,priceExact8:p.salePriceExact4+'0000'}]}};}
test('lost product reply retains UUID and exact prices across reload and successful replay',async()=>{
 const s=memory(),calls=[];let fail=true;const send=async p=>{calls.push(p);if(fail)throw Error('lost');return committed(p);};
 assert.equal((await make(s,send).create(fields)).state,'UNKNOWN');fail=false;const fresh=make(s,send);assert.equal(fresh.pending().requestId,id);
 assert.equal((await fresh.retry()).state,'COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.equal(fresh.pending(),null);
});
test('opening quantity and date survive uncertain product creation without a second stock request',async()=>{
 const storage=memory(),calls=[];let lost=true;const send=async value=>{calls.push(value);if(lost)throw Error('lost');return committed(value);};
 const input={...fields,openingQuantityExact3:'4.000',openingDate:'2026-11-05'};
 assert.equal((await make(storage,send).create(input)).state,'UNKNOWN');lost=false;assert.equal((await make(storage,send).retry()).state,'COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].openingQuantityExact3,'4.000');
 for(const change of [{openingDate:'2026-02-30'},{openingQuantityExact3:'-1.000'},{currency:'USD'},{unit:'METRE'},{purchasePriceExact4:'0.0000'}])await assert.rejects(make(memory(),send).create({...input,...change}));
 assert.equal(desktopProductDecimal3('4,25'),'4.250');assert.throws(()=>desktopProductDecimal3('4.2501'));
});
test('concurrent tabs and changed body cannot replace pending request',async()=>{
 const s=memory(),locks=lockManager();let finish,calls=0;const send=()=>{calls++;return new Promise(r=>{finish=r;});};
 const a=make(s,send,locks),b=make(s,send,locks),p=a.create(fields);await assert.rejects(b.create({...fields,name:'Başka'}),/PRODUCT_CREATE_BUSY/);
 finish({state:'UNKNOWN'});await p;await assert.rejects(b.create({...fields,name:'Başka'}),/PRODUCT_CREATE_PENDING/);assert.equal(calls,1);
});
test('full native product identity is required before pending record can be cleared',async()=>{
 const mutations=[e=>delete e.name,e=>{e.kind='vega';},e=>{e.units[0].label='KOLİ';},e=>{e.prices[0].unitId='99';},e=>{e.prices[0].currency='USD';},e=>{e.prices[0].priceExact8='10.25000001';},e=>{e.prices[0].tier=2;},e=>{e.units[0].id='9223372036854775808';}];
 for(const mutate of mutations){const s=memory(),c=make(s,async p=>{const r=committed(p);mutate(r.entity);return r;});assert.equal((await c.create(fields)).state,'UNKNOWN');assert.equal(c.pending().requestId,id);}
});
test('storage failure, extra unsupported fields and wrong exact amounts never dispatch',async()=>{
 let calls=0;const send=async()=>{calls++;};const blocked={getItem:()=>null,setItem:()=>{throw Error();},removeItem:()=>{}};
 await assert.rejects(make(blocked,send).create(fields));
 for(const bad of [{brand:'MELISA'},{category:'Kıyafet'},{supplierId:'1'},{salePriceExact4:'10.25'}])await assert.rejects(make(memory(),send).create({...fields,...bad}));
 assert.equal(calls,0);
});
test('exact decimal parsing never rounds and cost restriction mirrors the current server',()=>{
 assert.equal(desktopProductDecimal4('10,25'),'10.2500');assert.equal(desktopProductDecimal4('0'),'0.0000');assert.equal(desktopProductDecimal4('100',{percentage:true}),'100.0000');
 for(const v of ['1.23456','1e3','-1','01','1.000,00'])assert.throws(()=>desktopProductDecimal4(v));
 assert.throws(()=>desktopProductDecimal4('100.0001',{percentage:true}));
 assert.equal(isDesktopProductCostSupported(fields),true);assert.equal(isDesktopProductCostSupported({...fields,purchasePriceExact4:'5.3000'}),true);
 assert.equal(isDesktopProductCostSupported({...fields,purchaseDiscountRateExact4:'10.0000'}),true);
 assert.equal(isDesktopProductCostSupported({...fields,purchasePriceExact4:'0.0003',purchaseDiscountRateExact4:'50.0000'}),false);
 assert.equal(isDesktopProductCostSupported({...fields,purchaseDiscountRateExact4:'100.0000'}),true);
 assert.equal(isDesktopProductCostSupported({...fields,currency:'USD',purchasePriceExact4:'5.3000',purchaseDiscountRateExact4:'10.0000'}),true);
});
