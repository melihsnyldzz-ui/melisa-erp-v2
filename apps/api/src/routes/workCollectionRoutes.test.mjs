import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {selectedSourceCollectionFixture,selectedSourceCollector,selectedSourceRequestId} from '../services/businessSelectedSaleCollectionPreparation.test-fixture.mjs';

// The production router imports these defaults when it is constructed. Keep
// its real permission middleware while preventing unused SQL/auth backends
// from loading a native driver in this isolated HTTP route test.
const noNativeBackend=()=>{assert.fail('Route fixture must not access SQL or the auth database');};
const workCollectionService=Object.fromEntries(['context','preview','collect','cancel'].map(name=>[name,noNativeBackend]));
mock.module('../services/workCollectionService.mjs',{exports:{workCollectionService}});
mock.module('../services/authService.js',{exports:{getUserById:noNativeBackend,verifyAccessToken:noNativeBackend,verifyNormalTestAccessSession:noNativeBackend}});
const {createWorkCollectionRoutes,workCollectionRoutes}=await import('./workCollectionRoutes.mjs');

async function withServer(run,{selectedSourceService,legacyService}={}){
 const app=express(),calls=[],fixture=selectedSourceCollectionFixture();app.use(express.json());
 const users={collector:selectedSourceCollector(),creator:{...selectedSourceCollector(),id:'15',role:{code:'isolated_test_sales'}},missing:{...selectedSourceCollector(),permissions:['finance.view','customer.view']},noCancel:{...selectedSourceCollector(),permissions:['finance.view','customer.view','finance.collection']}};
 const authenticate=(req,res,next)=>{const user=req.get('authorization')?.replace(/^Bearer /,'');if(!users[user])return res.status(401).json({code:'AUTH_TOKEN_REQUIRED'});req.user=users[user];next();};
 const legacy=legacyService??Object.fromEntries(['context','preview','collect','cancel'].map(name=>[name,async(...args)=>{calls.push({name,args});return {legacy:name};}]));
 app.use('/api',createWorkCollectionRoutes({authenticate,service:legacy,selectedSourceService:selectedSourceService===true?fixture.service:selectedSourceService}));
 app.get('/api/unrelated',(_req,res)=>res.json({success:true}));
 app.use((error,_req,res,_next)=>res.status(error.statusCode??500).json({success:false,code:error.code??'UNKNOWN'}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const request=async(path,{method='POST',user='collector',body}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{...(user?{authorization:'Bearer '+user}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:response.status,value:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};};
 try{await run({request,calls,fixture,users});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}

test('production collection router leaves every selected SOURCE method closed and keeps legacy routes intact',async()=>{
 assert.equal(workCollectionRoutes.stack.filter(layer=>layer.route?.path?.includes('selected-source')).length,0);
 await withServer(async({request,calls})=>{
  for(const [method,path] of [['GET','/work-collections/selected-source/context?invoiceId=1000'],['POST','/work-collections/selected-source/preview'],['POST','/work-collections/selected-source'],['POST','/work-collections/selected-source/2000/cancel']])assert.equal((await request(path,{method,body:method==='POST'?{}:undefined})).status,404);
  assert.equal((await request('/unrelated',{method:'GET',user:null})).status,200);
  for(const [method,path,name] of [['GET','/work-collections/context?invoiceId=1000','context'],['POST','/work-collections/preview','preview'],['POST','/work-collections','collect'],['POST','/work-collections/2000/cancel','cancel']]){const response=await request(path,{method,body:method==='POST'?{}:undefined});assert.equal(response.status,200);assert.equal(response.value.data.legacy,name);}
  assert.deepEqual(calls.map(c=>c.name),['context','preview','collect','cancel']);
 });
});

test('selected SOURCE registration rejects legacy, lookalike and null services before mounting',()=>{
 for(const selectedSourceService of [workCollectionService,{...workCollectionService},null,true]){
  assert.throws(()=>createWorkCollectionRoutes({selectedSourceService}),{code:'SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',statusCode:503});
 }
});

test('injected SOURCE route connects GET, partial/full collection, exact replay and reversal through isolated journal',async()=>{
 await withServer(async({request,fixture:f,calls})=>{
  const context=await request('/work-collections/selected-source/context?invoiceId=1000',{method:'GET'});assert.equal(context.status,200);assert.equal(context.value.data.invoice.id,'1000');
  const firstSelection=f.selection('5.0000'),firstPreview=await request('/work-collections/selected-source/preview',{body:firstSelection});assert.equal(firstPreview.status,200);
  const firstBody={...firstSelection,requestId:selectedSourceRequestId(20),expectedRevision:firstPreview.value.data.revision,previewHash:firstPreview.value.data.previewHash};
  const first=await request('/work-collections/selected-source',{body:firstBody});assert.equal(first.status,200);assert.equal(first.value.data.invoice.collections.outstandingExact4,'19.0000');
  const repeat=await request('/work-collections/selected-source',{body:firstBody});assert.equal(repeat.status,200);assert.equal(repeat.value.data.replayed,true);
  const rest=f.selection('19.0000'),secondPreview=await request('/work-collections/selected-source/preview',{body:rest});assert.equal(secondPreview.status,200);
  const second=await request('/work-collections/selected-source',{body:{...rest,requestId:selectedSourceRequestId(21),expectedRevision:secondPreview.value.data.revision,previewHash:secondPreview.value.data.previewHash}});assert.equal(second.status,200);assert.equal(second.value.data.invoice.collections.outstandingExact4,'0.0000');
  const collection=second.value.data.collection,cancelBody={requestId:selectedSourceRequestId(22),expectedRevision:collection.revision,documentDate:f.copy.date,reason:'Offline SOURCE reversal'};
  const cancelled=await request(`/work-collections/selected-source/${collection.id}/cancel`,{body:cancelBody});assert.equal(cancelled.status,200);assert.equal(cancelled.value.data.invoice.collections.outstandingExact4,'19.0000');
  const cancelRepeat=await request(`/work-collections/selected-source/${collection.id}/cancel`,{body:cancelBody});assert.equal(cancelRepeat.status,200);assert.equal(cancelRepeat.value.data.replayed,true);
  assert.equal(f.state().cash,50000n);assert.equal(f.state().stockEffects,0);assert.equal(f.events.filter(e=>e==='collect').length,2);assert.equal(f.events.filter(e=>e==='reverse').length,1);assert.deepEqual(calls,[]);
 },{selectedSourceService:true});
});

test('SOURCE auth, role, permission, account, body and revision failures leave financial effects unchanged',async()=>{
 await withServer(async({request,fixture:f,calls})=>{
  const selection=f.selection('5.0000'),path='/work-collections/selected-source/preview';
  for(const user of [null,'missing','creator']){const result=await request(path,{user,body:selection});assert.equal(result.status,user===null?401:403);}
  const preview=await request(path,{body:selection});assert.equal(preview.status,200);
  const body={...selection,requestId:selectedSourceRequestId(30),expectedRevision:preview.value.data.revision,previewHash:preview.value.data.previewHash};
  assert.equal((await request('/work-collections/selected-source',{body:{...body,unexpected:true}})).status,400);
  assert.equal((await request('/work-collections/selected-source',{body:{...body,accountId:'999'}})).status,409);
  assert.equal((await request('/work-collections/selected-source',{body:{...body,expectedRevision:'a'.repeat(64)}})).status,409);
  assert.equal((await request('/work-collections/selected-source',{body:{...body,amountExact4:'25.0000'}})).status,409);
  f.actual.accounts[0].currency='USD';assert.equal((await request(path,{body:selection})).status,409);
  assert.equal(f.state().cash,0n);assert.equal(f.state().customerDebt,240000n);assert.equal(f.state().requests.size,0);assert.deepEqual(calls,[]);
 },{selectedSourceService:true});
});

test('SOURCE cancel requires native-facing cancel permission before collection read',async()=>{
 await withServer(async({request,fixture:f})=>{
  const response=await request('/work-collections/selected-source/2000/cancel',{user:'noCancel',body:{requestId:selectedSourceRequestId(40),expectedRevision:'a'.repeat(64),documentDate:f.copy.date,reason:'Denied'}});
  assert.equal(response.status,403);assert.equal(response.value.code,'AUTH_PERMISSION_DENIED');assert.deepEqual(f.events,[]);
 },{selectedSourceService:true});
});
