import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import http from 'node:http';
import {createDesktopSaleWorkflowRoutes} from './desktopSaleWorkflowRoutes.mjs';
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
