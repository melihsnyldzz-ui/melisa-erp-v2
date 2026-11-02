import test,{mock} from 'node:test';import assert from 'node:assert/strict';import {request} from 'node:http';import express from 'express';
import {createCustomerMasterMetadataRoutes} from './customerMasterMetadataRoutes.mjs';
import {customerMasterMetadataFixture} from '../services/customerMasterMetadata.test-fixture.mjs';
// Keep the real permission middleware, but never import the SQL-backed session
// provider/native ODBC addon into this portable offline router test.
const unusedSession=()=>{throw Error('Session provider is outside this fixture');};
mock.module('../services/authService.js',{namedExports:{getUserById:unusedSession,verifyAccessToken:unusedSession,verifyNormalTestAccessSession:unusedSession}});
const url='/api/customers/master-metadata';
async function fixture(reader){
 const app=express(),calls=[];app.use(express.json());
 const authenticate=(req,res,next)=>{calls.push(req.originalUrl);if(req.headers.authorization!=='Bearer fixture')return next(Object.assign(Error(),{code:'AUTH_TOKEN_REQUIRED',statusCode:401}));req.user={id:17,permissions:(req.headers['x-test-permissions']??'customer.view,customer.edit').split(',')};next();};
 app.use('/api',createCustomerMasterMetadataRoutes({reader,authenticate}));
 app.get('/api/unrelated',(_req,res)=>res.json({ok:true}));
 app.use((error,_req,res,_next)=>res.status(error.statusCode??500).json({code:error.code??'FAILED'}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 return {calls,fetch:(path=url,options={})=>fetch(base+path,{...options,headers:{authorization:'Bearer fixture',...options.headers}}),getWithBody:body=>new Promise((resolve,reject)=>{const text=JSON.stringify(body),req=request(base+url,{method:'GET',headers:{authorization:'Bearer fixture','content-type':'application/json','content-length':Buffer.byteLength(text)}},res=>{res.resume();res.once('end',()=>resolve(res.statusCode));});req.once('error',reject);req.end(text);}),async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
test('fixed metadata route requires normal authentication and both existing customer permissions before any query',{timeout:5000},async()=>{
 const f=await customerMasterMetadataFixture(),s=await fixture(f.reader);
 try{
  assert.equal((await s.fetch(url,{headers:{authorization:''}})).status,401);
  for(const permissions of ['', 'customer.view','customer.edit','supplier.view'])assert.equal((await s.fetch(url,{headers:{'x-test-permissions':permissions}})).status,403);
  assert.equal(f.calls.length,0);assert.equal((await s.fetch('/api/unrelated')).status,200);assert.equal(s.calls.length,5);
  const r=await s.fetch();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('pragma'),'no-cache');const body=await r.json();assert.equal(body.success,true);assert.equal(body.data.status,'OBSERVED');assert.equal(body.data.queryCount,3);assert.equal(f.calls.length,3);
 }finally{await s.close();}
});
test('metadata route rejects caller SQL, database, objects and limits; no query is forwarded',{timeout:5000},async()=>{
 const f=await customerMasterMetadataFixture(),s=await fixture(f.reader);
 try{for(const query of ['query=SELECT%201','database=OTHER','objects=x','limit=1']){const r=await s.fetch(url+'?'+query);assert.equal(r.status,400);assert.equal((await r.json()).code,'CUSTOMER_VALIDATION_FAILED');}for(const body of [{query:'SELECT 1'},[],null])assert.equal(await s.getWithBody(body),400);assert.equal(f.calls.length,0);for(const method of ['POST','PUT','DELETE','PATCH','HEAD'])assert.equal((await s.fetch(url,{method})).status,405);assert.equal(f.calls.length,0);}finally{await s.close();}
});
test('wrong actual target and metadata failures return 503 without exposing a successful observation',{timeout:5000},async()=>{
 const f=await customerMasterMetadataFixture();f.modes.identity={databaseName:'OTHER'};const s=await fixture(f.reader);
 try{let r=await s.fetch();assert.equal(r.status,503);let b=await r.json();assert.equal(b.success,false);assert.equal(b.data.reason,'IDENTITY_REJECTED');assert.deepEqual(b.data.objects,[]);assert.equal(f.calls.length,1);f.modes.identity={};f.modes.error=Object.assign(Error('PRIVATE_CANARY'),{number:229});r=await s.fetch();b=await r.json();assert.equal(r.status,503);assert.equal(b.data.reason,'QUERY_PERMISSION_DENIED');assert(!JSON.stringify(b).includes('PRIVATE_CANARY'));}finally{await s.close();}
});
test('missing reader remains unavailable and one in-flight observation excludes a second request',{timeout:5000},async()=>{
 const unavailable=await fixture();try{assert.equal((await unavailable.fetch()).status,503);}finally{await unavailable.close();}
 let unblock,entered;const enteredPromise=new Promise(r=>entered=r),f=await customerMasterMetadataFixture(),s=await fixture({async read(){entered();await new Promise(r=>unblock=r);return f.reader.read();}});
 try{const first=s.fetch();await enteredPromise;assert.equal((await s.fetch()).status,503);assert.equal(f.calls.length,0);unblock();assert.equal((await first).status,200);assert.equal(f.calls.length,3);}finally{unblock?.();await s.close();}
});
