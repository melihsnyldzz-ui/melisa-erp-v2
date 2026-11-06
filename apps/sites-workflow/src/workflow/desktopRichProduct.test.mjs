import test from 'node:test';import assert from 'node:assert/strict';import {createDesktopProductCreate} from './desktopProductCreate.mjs';import {createDesktopLocalProductTransport} from './desktopLocalProductTransport.mjs';
import {productRejectionRecord,productRejectionOutcome} from '../../../api/src/services/desktopProductRejection.mjs';
const requestId='da171000-6f42-4f19-8cab-9f4539618647',base={stockCode:'P1',name:'Ürün',barcode:'0001',unit:'ADET',currency:'TRY',salePriceExact4:'10.0000',purchasePriceExact4:'5.0000',purchaseDiscountRateExact4:'0.0000',saleTier:null};
const rich={...base,brand:'Marka',category:'Bebek',supplierId:'9'},entity={kind:'local',id:'1',name:'Ürün',units:[{id:'2',label:'ADET',factorExact8:'1.00000000',isMain:true}],prices:[{id:'3',type:'sale',unitId:'2',tier:null,currency:'TRY',priceExact8:'10.00000000'}]};
test('additional leading-zero barcodes survive unknown retry and durable rejected draft without changing legacy bodies',async()=>{
 const input={...rich,additionalBarcodes:['000001','000002']},calls=[];const x=setup(async p=>{calls.push(p);if(calls.length===1)throw Error('lost');return productRejectionOutcome(productRejectionRecord(requestId,'PRODUCT_BARCODE_DUPLICATE_INPUT'),true);});
 assert.equal((await x.make(true).create(input)).state,'UNKNOWN');assert.deepEqual(x.make(true).pending().additionalBarcodes,input.additionalBarcodes);assert.equal((await x.make(true).retry()).state,'NOT_COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.deepEqual(x.make(true).draft().additionalBarcodes,input.additionalBarcodes);assert.equal(x.make(true).rejected().reason,'PRODUCT_BARCODE_DUPLICATE_INPUT');
 const invalid=setup(()=>{throw Error('must not send');});await assert.rejects(invalid.make(true).create({...rich,additionalBarcodes:[rich.barcode]}));assert.equal(invalid.make(true).pending(),null);
 let sent;const send=createDesktopLocalProductTransport({location:{origin:'http://127.0.0.1:5294'},tokenProvider:async()=> 'a.b.c',fetch:async(_u,o)=>{sent=JSON.parse(o.body);return {ok:false,status:409,json:async()=>({success:false,data:productRejectionOutcome(productRejectionRecord(requestId,'PRODUCT_BARCODE_DUPLICATE_INPUT'),false),error:{code:'PRODUCT_BARCODE_DUPLICATE_INPUT'}})};}});assert.equal((await send({requestId,...input})).state,'NOT_COMMITTED');assert.deepEqual(sent.additionalBarcodes,input.additionalBarcodes);
});
function setup(submit){let value=null;const storage={getItem:()=>value,setItem:(_k,v)=>{value=v;},removeItem:()=>{value=null;}};return {storage,make:richCards=>createDesktopProductCreate({actorId:'7',storage,locks:{request:async(_k,_o,fn)=>fn({})},newId:()=>requestId,submit,richCards})};}
test('a lost conflict reply keeps the exact body until a durable rejection is recovered',async()=>{
 const rejected=productRejectionOutcome(productRejectionRecord(requestId,'PRODUCT_BARCODE_IN_USE'),true);let calls=[];
 const x=setup(async p=>{calls.push(p);if(calls.length===1)throw Error('lost');return rejected;});
 assert.equal((await x.make(true).create(rich)).state,'UNKNOWN');assert.ok(x.make(true).pending());
 assert.equal((await x.make(true).retry()).state,'NOT_COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.equal(x.make(true).pending(),null);
 assert.deepEqual(x.make(true).draft(),calls[0]);assert.equal(x.make(true).rejected().reason,'PRODUCT_BARCODE_IN_USE');
 for(const change of [{requestId:'da171000-6f42-4f19-8cab-9f4539618648'},{reason:'SQL_ERROR'},{resolution:null},{operation:'customer.create'}]){const y=setup(async()=>({...rejected,...change}));assert.equal((await y.make(true).create(rich)).state,'UNKNOWN');assert.ok(y.make(true).pending());}
});
test('rejection fields survive a closed screen; storage failure retains the original pending request',async()=>{
 const rejected=productRejectionOutcome(productRejectionRecord(requestId,'PRODUCT_BARCODE_IN_USE'),false);let finish;
 const x=setup(()=>new Promise(resolve=>{finish=resolve;})),original=x.make(true),sending=original.create(rich);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(x.make(true).pending().requestId,requestId);
 finish(rejected);assert.equal((await sending).state,'NOT_COMMITTED');
 const reopened=x.make(true);assert.equal(reopened.pending(),null);assert.deepEqual(reopened.draft(),{requestId,...rich});assert.deepEqual(reopened.rejected(),rejected);
 let raw=null;const storage={getItem:()=>raw,setItem:(_k,v)=>{if(JSON.parse(v).version===2)throw Error('disk full');raw=v;},removeItem(){throw Error('must not remove');}};
 const controller=createDesktopProductCreate({actorId:'7',storage,locks:{request:async(_k,_o,fn)=>fn({})},newId:()=>requestId,submit:async()=>rejected,richCards:true});
 await assert.rejects(controller.create(rich),/disk full/);assert.equal(controller.pending().requestId,requestId);assert.equal(controller.draft(),null);
});
test('product transport accepts only the exact 409 durable rejection envelope',async()=>{
 const data=productRejectionOutcome(productRejectionRecord(requestId,'PRODUCT_STOCK_CODE_IN_USE'),false);
 const make=(status=409,success=false,code=data.reason)=>createDesktopLocalProductTransport({location:{origin:'http://127.0.0.1:5294'},tokenProvider:async()=> 'a.b.c',fetch:async()=>({status,ok:status<400,json:async()=>({success,data,error:{code}})})});
 assert.deepEqual(await make()({requestId,...rich}),data);
 for(const [status,success,code] of [[503,false,data.reason],[409,true,data.reason],[409,false,'WRONG'],[201,false,data.reason]])await assert.rejects(make(status,success,code)({requestId,...rich}));
 await assert.rejects(make()({requestId,...base}));
});
test('rich product preserves all selected fields on lost response and retry',async()=>{let calls=[];const x=setup(async p=>{calls.push(p);if(calls.length===1)throw Error();return {state:'COMMITTED',requestId,operation:'product.create',entity,replayed:true};});assert.equal((await x.make(true).create(rich)).state,'UNKNOWN');assert.equal((await x.make(true).retry()).state,'COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].supplierId,'9');});
test('legacy pending product body replays unchanged after rich upgrade',async()=>{let calls=[];const x=setup(async p=>{calls.push(p);if(calls.length===1)throw Error();return {state:'COMMITTED',requestId,operation:'product.create',entity,replayed:true};});await x.make(false).create(base);assert.equal((await x.make(true).retry()).state,'COMMITTED');assert.deepEqual(calls[0],calls[1]);assert.equal('supplierId' in calls[1],false);});
test('new rich creation requires complete supplier and category fields',async()=>{const x=setup(async()=>{throw Error();});await assert.rejects(x.make(true).create(base));await assert.rejects(x.make(true).create({...rich,supplierId:''}));});
test('unsupported FX cost setup fails before a new durable request is created',async()=>{let sent=false;const x=setup(async()=>{sent=true;});await assert.rejects(x.make(true).create({...rich,currency:'USD'}));assert.equal(x.make(true).pending(),null);assert.equal(sent,false);});
test('product transport preserves rich fields',async()=>{let sent;const send=createDesktopLocalProductTransport({location:{origin:'http://127.0.0.1:5294'},tokenProvider:async()=> 'a.b.c',fetch:async(_u,o)=>{sent=JSON.parse(o.body);return {ok:true,status:201,json:async()=>({success:true,data:{state:'COMMITTED',requestId,operation:'product.create',entity,replayed:false}})};}});await send({requestId,...rich});assert.equal(sent.brand,'Marka');assert.equal(sent.category,'Bebek');assert.equal(sent.supplierId,'9');});
