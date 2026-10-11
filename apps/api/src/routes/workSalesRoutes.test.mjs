import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {isDailyWebRequest} from '../services/dailyWebPolicy.mjs';

// The actual permission middleware remains loaded. Its unused auth backend
// cannot import a native driver or open SQL in this isolated route test.
const noAuthBackend=()=>{assert.fail('Route fixture must not access the auth database');};
mock.module('../services/authService.js',{namedExports:{getUserById:noAuthBackend,verifyAccessToken:noAuthBackend}});
const {createWorkSalesRoutes}=await import('./workSalesRoutes.mjs');

const selection={customerId:'100',currency:'USD',productIds:['444']};
const sale={customerId:'100',currency:'USD',documentDate:'2026-10-09',items:[{productId:'444',quoteId:'101',quantityExact3:'1.000'}]};
const context={meta:{schemaVersion:'melisa-selected-sale-context.v1',readOnly:true,date:'2026-10-09'},writable:false,scope:{customer:{id:'100',accountId:'5100',currency:'USD'},accounts:[],products:[{id:'444',stockQuantityExact3:'10.000',prices:[{quoteId:'101',unitPriceExact8:'2.12345678',currency:'USD'}]}]}};
const preview={schemaVersion:'melisa-selected-sale-preview.v1',writable:false,writeAuthorized:false,currency:'USD',grandTotalExact4:'2.1235',amountTryExact4:'101.5033',settlement:{accountId:'5100'}};
async function withServer(run,{selectedError=null}={}){
 const calls=[],authCalls=[],errors=[],app=express();app.use(express.json());
 const users={both:{id:'16',permissions:['sales.view','sales.create','sales.finalize','sales.cancel']},view:{id:'15',permissions:['sales.view']},create:{id:'16',permissions:['sales.create']}};
 const authenticate=(req,res,next)=>{authCalls.push(req.originalUrl);const name=req.get('authorization')?.replace(/^Bearer /,'');if(!users[name])return res.status(401).json({code:'AUTH_TOKEN_REQUIRED'});req.user=users[name];next();};
 const selectedService=Object.fromEntries([['context',context],['preview',preview]].map(([name,value])=>[name,async(input,actor)=>{calls.push({family:'selected',name,input,actor,scope:isDailyWebRequest()});if(selectedError)throw selectedError;return value;}]));
 const service=Object.fromEntries(['context','preview','createDraft','finalize','cancel','list','invoice','request'].map(name=>[name,async(...args)=>{calls.push({family:'old',name,args,scope:isDailyWebRequest()});return {old:name};}]));
 service.selectedContext=selectedService.context;
 service.selectionOptions=async actor=>{calls.push({family:'selected',name:'selectionOptions',actor,scope:isDailyWebRequest()});return {enabled:false};};
 // Keep the actual permission middleware; only authentication is synthetic.
 app.use('/api',createWorkSalesRoutes({authenticate,service,selectedService}));
 app.post('/api/auth/login',(_req,res)=>res.json({success:true}));app.get('/api/unrelated',(_req,res)=>res.json({success:true}));
 app.use((error,_req,res,_next)=>{errors.push(error);res.status(error.statusCode??500).json({success:false,code:error.code??'UNKNOWN'});});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const request=async(path,{method='POST',user='both',body}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{...(user?{authorization:'Bearer '+user}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:response.status,value:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};};
 try{await run({request,calls,authCalls,errors,users});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}

test('authenticated selected POST routes forward exact body, actor and cost-free readonly DTO',async()=>{
 await withServer(async({request,calls,users})=>{
  assert.deepEqual(await request('/work-sales/selected-context',{body:selection}),{status:200,value:{success:true,data:context}});
  assert.deepEqual(await request('/work-sales/selected-preview',{body:sale}),{status:200,value:{success:true,data:preview}});
  assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.name),['context','preview']);assert.deepEqual(calls[0].input,selection);assert.deepEqual(calls[1].input,sale);assert(calls.every(c=>c.family==='selected'&&c.actor===users.both&&c.scope===false));
  assert.equal('costExact4' in context.scope.products[0],false);assert.equal('balanceExact4' in context.scope.customer,false);assert.equal(preview.writable,false);assert.equal(preview.writeAuthorized,false);
 });
});
test('selected routes require authentication and both native-facing sales permissions',async()=>{
 await withServer(async({request,calls})=>{
  for(const path of ['/work-sales/selected-context','/work-sales/selected-preview']){
   assert.equal((await request(path,{user:null,body:selection})).status,401);
   for(const user of ['view','create'])assert.deepEqual(await request(path,{user,body:selection}),{status:403,value:{success:false,code:'AUTH_PERMISSION_DENIED'}});
  }
  assert.deepEqual(calls,[]);
 });
});
test('new methods and paths do not intercept unrelated endpoints or open writer routes',async()=>{
 await withServer(async({request,calls,authCalls})=>{
  for(const method of ['GET','PUT','PATCH','DELETE'])for(const path of ['/work-sales/selected-context','/work-sales/selected-preview'])assert.equal((await request(path,{method,user:null})).status,404);
  for(const path of ['/work-sales/selected-context/444','/work-sales/selected-preview/drafts','/work-sales/selected-preview/finalize','/work-sales/selected-context-extra'])assert.equal((await request(path,{user:null})).status,404);
  assert.equal((await request('/auth/login',{user:null})).status,200);assert.equal((await request('/unrelated',{method:'GET',user:null})).status,200);assert.deepEqual(calls,[]);assert.deepEqual(authCalls,[]);
 });
});
test('selected service rejection reaches error middleware unchanged with no old service fallback',async()=>{
 for(const code of ['WORK_INPUT_INVALID','SELECTED_SALE_NATIVE_READ_PIN','SELECTED_SALE_READ_ROLLBACK_FAILED']){
  const primary=Object.assign(Error('offline rejection'),{code,statusCode:code==='WORK_INPUT_INVALID'?400:503});
  await withServer(async({request,calls,errors})=>{for(const path of ['/work-sales/selected-context','/work-sales/selected-preview'])assert.deepEqual(await request(path,{body:sale}),{status:primary.statusCode,value:{success:false,code}});assert.equal(calls.length,2);assert(calls.every(c=>c.family==='selected'));assert.deepEqual(errors,[primary,primary]);},{selectedError:primary});
 }
});
test('all existing route/service signatures, permissions and daily boundaries remain unchanged',async()=>{
 await withServer(async({request,calls})=>{
  const cases=[['GET','/work-sales/context','context',[],false],['POST','/work-sales/preview','preview',[sale],true],['POST','/work-sales/drafts','createDraft',[sale],true],['POST','/work-sales/drafts/444/finalize','finalize',['444',sale],true],['POST','/work-sales/drafts/444/cancel','cancel',['444',sale],true],['GET','/work-sales/invoices?page=2','list',[{page:'2'}],false],['GET','/work-sales/invoices/444','invoice',['444'],false],['GET','/work-sales/requests/444','request',['444'],false]];
  for(const [method,path,name,args,scope] of cases){assert.deepEqual(await request(path,{method,...(method==='POST'?{body:sale}:{})}),{status:200,value:{success:true,data:{old:name}}});const call=calls.at(-1);assert.equal(call.family,'old');assert.equal(call.name,name);assert.deepEqual(call.args.slice(0,-1),args);assert.equal(call.args.at(-1).id,'16');assert.equal(call.scope,scope);}
  assert.equal((await request('/work-sales/context',{method:'GET',user:'view'})).status,200);assert.equal((await request('/work-sales/preview',{user:'create',body:sale})).status,200);
  const before=calls.length;assert.equal((await request('/work-sales/drafts/444/finalize',{user:'create',body:sale})).status,403);assert.equal(calls.length,before);assert(calls.every(c=>c.family==='old'));
 });
});
