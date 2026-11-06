import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import {createDesktopLocalMasterRoutes} from './desktopLocalMasterRoutes.mjs';
import {productRejectionRecord,productRejectionOutcome} from '../services/desktopProductRejection.mjs';
import {createDesktopLocalProductTransport} from '../../../sites-workflow/src/workflow/desktopLocalProductTransport.mjs';

const requestId='d6be01f9-fac4-4e9c-b421-e2f070b6beb0';
const customer={requestId,customerCode:'M1',customerName:'Örnek',phone:'555',customerType:'customer',currency:'TRY',city:' Yalova ',country:' Türkiye '};
const product={requestId,stockCode:'P1',productName:'Ürün',barcode:'0001',unit:'ADET',currency:'TRY',salePriceExact4:'10.0000',purchasePriceExact4:'5.0000',purchaseDiscountRateExact4:'0.0000',saleTier:null};
test('rich product exposes a durable conflict as 409; unverified rejection and unauthorized replay remain uncertain',async t=>{
 const data=productRejectionOutcome(productRejectionRecord(requestId,'PRODUCT_BARCODE_IN_USE'),true),input={...product,brand:'B',category:'C',supplierId:'1'};
 const good=await fixture(t,{richCards:true,outcome:data});const result=await good.post('/api/desktop-local/products',input);
 assert.equal(result.status,409);assert.equal(result.body.success,false);assert.deepEqual(result.body.data,data);assert.equal(result.body.error.code,data.reason);
 const bad=await fixture(t,{richCards:true,outcome:{...data,resolution:'ASSUMED'}});assert.equal((await bad.post('/api/desktop-local/products',input)).status,503);
 const denied=await fixture(t,{richCards:true,outcome:data,auth:false});assert.equal((await denied.post('/api/desktop-local/products',input)).status,503);assert.equal(denied.calls.length,0);
});
async function fixture(t,{auth=true,permissions=['customer.edit','product.edit'],outcome='COMMITTED',corrupt=false,richCards=false,bearer='test'}={}){
 const calls=[];
 const service={
  async createSupplier(){throw Error('not used');},
  async createCustomer(actor,body){calls.push({actor,body,method:'customer'});return outcome==='COMMITTED'?{state:'COMMITTED',requestId:body.requestId,operation:'customer.create',replayed:false,entity:{kind:'local',id:corrupt==='numeric'?1:'1',entityId:'2',selectedCurrency:body.currency,accounts:[{id:'3',customerId:corrupt==='numeric'?1:corrupt?'99':'1',currency:body.currency,currentBalanceExact8:'0.00000000'}]}}:{state:'UNKNOWN',requestId:body.requestId,retry:'SAME_REQUEST_ONLY',requiresRecovery:true};},
  async createProduct(actor,body){calls.push({actor,body,method:'product'});if(outcome&&typeof outcome==='object')return outcome;return {state:'COMMITTED',requestId:body.requestId,operation:'product.create',replayed:false,entity:{kind:'local',id:'2',name:body.name,units:[{id:'3',label:body.unit,factorExact8:'1.00000000',isMain:true}],prices:[{id:'4',type:'sale',unitId:'3',tier:body.saleTier,currency:body.currency,priceExact8:body.salePriceExact4+'0000'},...(body.additionalSalePrices??[]).map((q,i)=>({id:String(5+i),type:'sale',unitId:'3',tier:null,currency:q.currency,priceExact8:corrupt==='fx-price'?'99.00000000':q.priceExact4+'0000'}))]}};},
 };
 const app=express();app.use(express.json());app.use(createDesktopLocalMasterRoutes({service,richCards,authenticateNormal:async req=>{
  if(!auth||req.get('authorization')!=='Bearer '+bearer)throw Error('not authorized');return {kind:'normal',userId:7,permissions};
 }}));
 const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 async function post(path,body,headers={}){
  return new Promise((resolve,reject)=>{
   const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method:'POST',headers:{host:'127.0.0.1:4294',origin:'http://127.0.0.1:5294','content-type':'application/json',authorization:'Bearer test',...headers}},r=>{
    const chunks=[];r.on('data',v=>chunks.push(v));r.on('end',()=>{try{resolve({status:r.statusCode,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch(e){reject(e);}});
   });req.on('error',reject);req.end(JSON.stringify(body));
  });
 }
 return {post,calls};
}

test('normal product transport reaches the real HTTP route with all explicit FX prices; a corrupt committed price stays unknown',async t=>{
 const input={...product,name:product.productName,brand:'B',category:'C',supplierId:'1',additionalSalePrices:[{currency:'USD',priceExact4:'0.7500'},{currency:'EUR',priceExact4:'0.6000'}]};delete input.productName;
 for(const corrupt of [false,'fx-price']){const f=await fixture(t,{richCards:true,bearer:'a.b.c',corrupt});const transport=createDesktopLocalProductTransport({location:{origin:'http://127.0.0.1:5294'},tokenProvider:async()=> 'a.b.c',fetch:async(url,options)=>{const r=await f.post(new URL(url).pathname,JSON.parse(options.body),{authorization:options.headers.Authorization});return {status:r.status,ok:r.status<400,json:async()=>r.body};}});
  if(corrupt)await assert.rejects(transport(input),/PRODUCT_TRANSPORT_UNAVAILABLE/);else{const r=await transport(input);assert.equal(r.state,'COMMITTED');assert.equal(r.entity.prices.length,3);}assert.deepEqual(f.calls[0].body.additionalSalePrices,input.additionalSalePrices);
 }
 const invalid=await fixture(t,{richCards:true});for(const additionalSalePrices of [[],[{currency:'USD',priceExact4:'0.0000'}],[{currency:'TRY',priceExact4:'1.0000'}]])assert.equal((await invalid.post('/api/desktop-local/products',{...input,additionalSalePrices})).status,503);assert.equal(invalid.calls.length,0);
});
test('PR54 customer name and city/country map without dropping data or trusting actor from the body',async t=>{
 const f=await fixture(t),r=await f.post('/api/desktop-local/customers',customer);
 assert.equal(r.status,201);assert.equal(r.body.data.state,'COMMITTED');assert.equal(f.calls[0].actor,'7');
 assert.deepEqual(f.calls[0].body,{requestId,customerCode:'M1',phone:'555',customerType:'customer',currency:'TRY',city:' Yalova ',country:' Türkiye ',name:'Örnek'});
});
test('product uses exact decimal string fields and selected unit without numeric conversion',async t=>{
 const f=await fixture(t),r=await f.post('/api/desktop-local/products',product);
 assert.equal(r.status,201);assert.equal(f.calls[0].body.name,'Ürün');assert.equal(f.calls[0].body.salePriceExact4,'10.0000');assert.equal(f.calls[0].body.unit,'ADET');
});
test('lossy or ambiguous extra fields fail closed and keep the same UUID unknown',async t=>{
 const f=await fixture(t);
 for(const body of [{...customer,name:'Başka'},{...customer,address:'Bilgi'},{...product,salePrice:10},{...customer,actorId:'1'}]){
  const r=await f.post(body.stockCode?'/api/desktop-local/products':'/api/desktop-local/customers',body);
  assert.equal(r.status,503);assert.deepEqual(r.body.data,{state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY',requiresRecovery:true});
 }
 assert.equal(f.calls.length,0);
});
test('authentication, permission and browser origin do not turn an earlier unknown send into a false denial',async t=>{
 const a=await fixture(t,{auth:false}),b=await fixture(t,{permissions:[]}),c=await fixture(t);
 for(const [f,headers] of [[a,{}],[b,{}],[c,{origin:'https://elsewhere.example'}]]){
  const r=await f.post('/api/desktop-local/customers',customer,headers);assert.equal(r.status,503);assert.equal(r.body.data.state,'UNKNOWN');assert.equal(r.body.data.requestId,requestId);assert.equal(f.calls.length,0);
 }
});
test('uncertain coordinator outcomes remain UNKNOWN with same request id and no data invented',async t=>{
 const f=await fixture(t,{outcome:'UNKNOWN'}),r=await f.post('/api/desktop-local/customers',customer);
 assert.equal(r.status,503);assert.equal(r.body.data.requestId,requestId);assert.equal(r.body.data.retry,'SAME_REQUEST_ONLY');assert.equal(f.calls.length,1);
});
test('wrong persisted account identity cannot be reported as successful',async t=>{
 const f=await fixture(t,{corrupt:true}),r=await f.post('/api/desktop-local/customers',customer);
 assert.equal(r.status,503);assert.equal(r.body.data.state,'UNKNOWN');assert.equal(r.body.data.requestId,requestId);
});
test('numeric entity identifiers are not accepted as native committed identity strings',async t=>{
 const f=await fixture(t,{corrupt:'numeric'}),r=await f.post('/api/desktop-local/customers',customer);
 assert.equal(r.status,503);assert.equal(r.body.data.state,'UNKNOWN');assert.equal(r.body.data.requestId,requestId);
});
test('invalid UUID is rejected before authentication and coordinator dispatch',async t=>{
 const f=await fixture(t),r=await f.post('/api/desktop-local/customers',{...customer,requestId:'bad'});
 assert.equal(r.status,400);assert.equal(f.calls.length,0);
});
