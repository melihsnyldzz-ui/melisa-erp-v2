import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {AsyncLocalStorage} from 'node:async_hooks';
import express from 'express';

const scope=new AsyncLocalStorage();let poolState={exists:true,opened:0,authReads:0};const existingPool={connected:true};
const fixtureGetPool=async()=>{poolState.authReads++;if(poolState.dropDuringAuth)poolState.exists=false;
 if(scope.getStore()!==true || !poolState.exists)throw Object.assign(Error('existing only'),{statusCode:503});return existingPool;};
mock.module('../services/authService.js',{namedExports:{getUserById:async()=>{await fixtureGetPool();return {id:17,permissions:['audit.view']};},
 verifyAccessToken:token=>{if(token!=='fixture')throw Object.assign(Error(),{statusCode:401});return {sub:'17'};},verifyNormalTestAccessSession:()=>{}}});
mock.module('../config/database.js',{namedExports:{isCanonicalTest:()=>false,
 getExistingCanonicalReadonlyPool:async()=>poolState.exists?existingPool:null,
 runWithCanonicalExistingPoolOnly:callback=>scope.run(true,callback)}});
mock.module('../config/env.js',{namedExports:{env:{}}});
const {createC06SaleReadonlyMetadataRoutes,isC06MetadataLoopback}=await import('./c06SaleReadonlyMetadataRoutes.mjs');
const path='/api/maintenance/sale-metadata';
async function fixture(read=async()=>({modules:[{name:'fixture',status:'UNKNOWN'}]})){
  poolState={exists:true,opened:0,authReads:0};
  const app=express();app.use(express.json());let reads=0,authCalls=0;
  const authenticate=(req,_res,next)=>{
    authCalls++;
    if(req.headers.authorization!=='Bearer fixture')return next(Object.assign(Error(),{statusCode:401}));
    req.user={permissions:(req.headers['x-fixture-permissions']??'audit.view').split(',')};
    req.authContext={nativeTerminalCode:req.headers['x-fixture-terminal']??null};next();
  };
  app.use('/api',createC06SaleReadonlyMetadataRoutes({authenticate,reader:async()=>{reads++;return read();}}));
  app.use((err,_req,res,_next)=>res.status(err.statusCode??500).end());
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  function call({method='GET',url=path,headers={},body}={}){return new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:server.address().port,path:url,method,headers:{host:'127.0.0.1:4146',authorization:'Bearer fixture',...headers}},res=>{
      let text='';res.setEncoding('utf8');res.on('data',x=>text+=x);res.once('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));
    });req.once('error',reject);if(body!==undefined)req.write(body);req.end();
  });}
  return {call,reads:()=>reads,authCalls:()=>authCalls,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
test('loopback GET with existing audit.view reads once and never caches',async()=>{
 const f=await fixture();try{const r=await f.call();assert.equal(r.status,200);assert.equal(f.reads(),1);assert.equal(r.headers['cache-control'],'no-store');assert.equal(JSON.parse(r.text).data.modules[0].status,'UNKNOWN');}finally{await f.close();}
});
test('auth, audit permission, host and normal session are required before metadata',async()=>{
 const f=await fixture();try{
  for(const [headers,status] of [[{authorization:''},401],[{'x-fixture-permissions':'sales.view'},403],[{host:'attacker.invalid:4146'},403],[{'x-fixture-terminal':'fixture-device'},403],[{'x-forwarded-for':'127.0.0.1'},403]]){
   assert.equal((await f.call({headers})).status,status);assert.equal(f.reads(),0);
  }
 }finally{await f.close();}
});
test('socket peer and 4146 host are both exact; LAN cannot use the reader',()=>{
 assert.equal(isC06MetadataLoopback('127.0.0.1','127.0.0.1:4146'),true);
 assert.equal(isC06MetadataLoopback('::ffff:127.0.0.1','localhost:4146'),true);
 for(const [peer,host] of [['192.168.1.46','127.0.0.1:4146'],['127.0.0.1','192.168.1.46:4146'],['127.0.0.1','localhost:4144'],['127.0.0.2','localhost:4146']])assert.equal(isC06MetadataLoopback(peer,host),false);
});
test('query, body and other methods never reach the reader',async()=>{
 const f=await fixture();try{
  for(const args of [{url:path+'?object=other'},{url:path+'?'},{url:path+'/'},{method:'POST'},{method:'HEAD'},
    {body:'x',headers:{'content-length':'1','content-type':'text/plain'}}]) {
   assert.notEqual((await f.call(args)).status,200);assert.equal(f.reads(),0);assert.equal(f.authCalls(),0);
  }
 }finally{await f.close();}
});
test('default middleware uses bearer authentication and existing audit permission',async()=>{
 poolState={exists:true,opened:0,authReads:0};
 const app=express();let reads=0;
 app.use('/api',createC06SaleReadonlyMetadataRoutes({reader:async()=>{reads++;return {modules:[]};}}));
 app.use((err,_req,res,_next)=>res.status(err.statusCode??500).end());
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 async function call(authorization){return new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'127.0.0.1:4146',authorization}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});}
 try{
  assert.equal(await call('Bearer invalid'),401);assert.equal(reads,0);
  assert.equal(await call('Bearer fixture'),200);assert.equal(reads,1);assert.equal(poolState.authReads,1);
  poolState.exists=false;assert.equal(await call('Bearer fixture'),503);assert.equal(poolState.authReads,1);
  poolState.exists=true;poolState.dropDuringAuth=true;assert.equal(await call('Bearer fixture'),503);assert.equal(reads,1);assert.equal(poolState.opened,0);
 }
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('reader error is redacted',async()=>{
 const app=express();const auth=(req,_res,next)=>{req.user={permissions:['audit.view']};req.authContext={};next();};
 app.use('/api',createC06SaleReadonlyMetadataRoutes({authenticate:auth,reader:async()=>{throw Error('private-fixture');}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{const result=await new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host:'localhost:4146'}},res=>{let s='';res.on('data',x=>s+=x);res.on('end',()=>resolve({status:res.statusCode,body:s}));});req.on('error',reject);req.end();});assert.equal(result.status,503);assert.doesNotMatch(result.body,/private-fixture/);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('one outstanding read rejects a duplicate without a second reader call',async()=>{
 let release,entered;const started=new Promise(resolve=>{entered=resolve;});
 const f=await fixture(async()=>{entered();await new Promise(resolve=>{release=resolve;});return {modules:[]};});
 try{const first=f.call();await started;assert.equal((await f.call()).status,503);assert.equal(f.reads(),1);release();assert.equal((await first).status,200);}
 finally{release?.();await f.close();}
});
