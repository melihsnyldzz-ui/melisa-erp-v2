import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import http from 'node:http';
import {createDesktopSaleWorkflowRoutes} from './desktopSaleWorkflowRoutes.mjs';

test('read-only quote query preserves exact inputs, rejects extra/partial authority fields and requires both sale permissions',async t=>{
 let input,rateError=null,permissions=['sales.create','sales.finalize'];
 const app=express();app.use(createDesktopSaleWorkflowRoutes({service:{transition:async()=>{}},draftService:{preview:async(actor,value)=>{assert.equal(actor,'8');input=value;if(rateError)throw Object.assign(Error(),{code:rateError});if(value.discountRateExact4==='3.0001')throw Object.assign(Error(),{code:'DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED'});return {quote:{totalExact4:'32.9800'}};}},authenticateNormal:async()=>({kind:'normal',userId:'8',permissions})}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const send=q=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/desktop-sale/draft-preview?'+q,headers:{host:'127.0.0.1:4294',origin:'http://127.0.0.1:5294'}},res=>{let body='';res.on('data',v=>body+=v);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));});req.on('error',reject);req.end();});
 const query='customerId=2&documentDate=2026-11-06&productIds=8,1&quantities=2.000,1.000&quantityUnits=ADET,ADET&discountRateExact4=3.0000';
 assert.equal((await send(query)).status,200);assert.deepEqual(input,{customerId:'2',documentDate:'2026-11-06',productIds:['8','1'],quantities:['2.000','1.000'],quantityUnits:['ADET','ADET'],discountRateExact4:'3.0000'});
 const pricing={version:1,policyRevision:'a'.repeat(64),unitPricesExact4:[null,'10.0000'],approvalId:null};assert.equal((await send(query+'&pricing='+encodeURIComponent(JSON.stringify(pricing)))).status,200);assert.deepEqual(input.pricing,pricing);assert.equal((await send(query+'&pricing='+encodeURIComponent(JSON.stringify({...pricing,extra:true})))).status,503);assert.equal((await send('customerId=2&documentDate=2026-11-06&productIds=8,1&pricing='+encodeURIComponent(JSON.stringify(pricing)))).status,503);
 assert.equal((await send(query.replace('3.0000','3.0001'))).body.code,'DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED');
 for(const suffix of ['&role=owner','&maxDiscountRateExact4=100.0000','&discountRateExact4=0.0000'])assert.equal((await send(query+suffix)).status,503);
 assert.equal((await send(query.replace('&quantityUnits=ADET,ADET',''))).status,503);
 const fx={documentCurrency:'USD',accountId:'7',documentRateExact8:'40.00000000',accountRateExact8:'40.00000000',documentRateMode:'company',accountRateMode:'company'},fxQuery=query+'&currencySelection='+encodeURIComponent(JSON.stringify(fx));assert.equal((await send(fxQuery)).status,200);assert.deepEqual(input.currencySelection,fx);
 for(const code of ['DESKTOP_COMPANY_RATE_REQUIRED','DESKTOP_COMPANY_RATE_CHANGED','DESKTOP_SALE_PRICE_REQUIRED']){rateError=code;const result=await send(fxQuery);assert.equal(result.status,409);assert.equal(result.body.code,code);}rateError=null;
 for(const suffix of ['&currencySelection='+encodeURIComponent(JSON.stringify(fx)),'&provider=external'])assert.equal((await send(fxQuery+suffix)).status,503);assert.equal((await send(query+'&currencySelection='+encodeURIComponent(JSON.stringify({...fx,documentRateExact8:40})))).status,503);
 permissions=['sales.create'];assert.equal((await send(query)).status,503);
});
test('normal workflow route binds actor, path and permission; unsupported dispatch stays closed',async t=>{
 let permissions=['sales.create'],calls=0;const app=express();app.use(express.json());
 app.use(createDesktopSaleWorkflowRoutes({authenticateNormal:async()=>({kind:'normal',userId:'8',permissions}),service:{async transition(actor,body){assert.equal(actor,'8');calls++;return {state:'COMMITTED',requestId:body.requestId,invoiceId:body.invoiceId,operation:body.operation,replayed:false};}}}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const body={requestId:'da171000-6f42-4f19-8cab-9f4539618647',invoiceId:'12',operation:'PREPARE',expectedVersion:'0x0000000000000001',cartons:[]};
 const send=payload=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/desktop-sale/workflows/12/transitions',method:'POST',headers:{host:'127.0.0.1:4294',origin:'http://127.0.0.1:5294','content-type':'application/json'}},res=>{let text='';res.on('data',v=>text+=v);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));});req.on('error',reject);req.end(JSON.stringify(payload));});
 assert.equal((await send(body)).status,201);assert.equal(calls,1);
 for(const payload of [{...body,operation:'DISPATCH'},{...body,invoiceId:'13'},{...body,operation:'CHECK'}]){const result=await send(payload);assert.equal(result.status,503);assert.equal(result.body.data.requestId,body.requestId);}
 permissions=[];assert.equal((await send(body)).body.data.state,'UNKNOWN');assert.equal(calls,1);
 const cancel={...body,operation:'CANCEL'};permissions=['sales.create'];assert.equal((await send(cancel)).status,503);assert.equal(calls,1);permissions=['sales.edit'];assert.equal((await send(cancel)).status,201);assert.equal(calls,2);
});
test('draft, checked dispatch, preview, reopen and resolution have separate normal-session routes',async t=>{
 let permissions=['sales.view','sales.create','sales.finalize'];const requestId='da171000-6f42-4f19-8cab-9f4539618647';
 const result=state=>({state:'COMMITTED',requestId,invoiceId:'12',workflowState:state,version:'0x0000000000000001',replayed:false});
 const app=express();app.use(express.json());app.use(createDesktopSaleWorkflowRoutes({service:{transition:async()=>result('READY')},draftService:{createDraft:async()=>result('DRAFT'),preview:async()=>({customerId:'2'})},dispatchService:{dispatch:async()=>result('COMPLETED')},readService:{read:async()=>({invoiceId:'12'})},resolutionService:{resolve:async()=>({state:'NOT_COMMITTED',requestId,actorId:'8',kind:'transition',resolution:'DURABLE_NO_COMMIT'})},authenticateNormal:async()=>({kind:'normal',userId:'8',permissions})}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const send=(path,body)=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method:body?'POST':'GET',headers:{host:'127.0.0.1:4294',origin:'http://127.0.0.1:5294','content-type':'application/json'}},res=>{let data='';res.on('data',v=>data+=v);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
 assert.equal((await send('/api/desktop-sale/drafts',{requestId})).body.data.workflowState,'DRAFT');
 assert.equal((await send('/api/desktop-sale/workflows/12/dispatch',{requestId,invoiceId:'12'})).body.data.workflowState,'COMPLETED');
 assert.equal((await send('/api/desktop-sale/draft-preview?customerId=2&productIds=5,9&documentDate=2026-11-05')).status,200);
 assert.equal((await send('/api/desktop-sale/workflows/12')).body.data.invoiceId,'12');
 permissions=['sales.view'];assert.equal((await send('/api/desktop-sale/drafts',{requestId})).status,503);assert.equal((await send('/api/desktop-sale/workflows/12/dispatch',{requestId,invoiceId:'12'})).status,503);
 assert.equal((await send('/api/desktop-sale/resolve',{kind:'transition',body:{requestId}})).body.data.state,'NOT_COMMITTED');
});
