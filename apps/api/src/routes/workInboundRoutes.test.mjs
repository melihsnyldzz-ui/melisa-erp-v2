import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createWorkInboundRoutes} from './workInboundRoutes.mjs';
import {createWorkInboundFxRoutes} from './workInboundFxRoutes.mjs';

test('mounted inbound routers never intercept auth or unrelated endpoints; work endpoints require auth and retain service gates',async()=>{
 const app=express(),authCalls=[],serviceCalls=[];
 app.use(express.json());
 const authenticate=(req,res,next)=>{authCalls.push(req.originalUrl);if(req.headers.authorization!=='Bearer fixture'){res.status(401).json({code:'AUTH_TOKEN_REQUIRED'});return;}req.user={id:'16'};next();};
 const service={context:async actor=>{serviceCalls.push(actor.id);return {kind:'receiving'};},purchaseContext:async()=>{throw Object.assign(Error('Yetki gerekli.'),{statusCode:403});}};
 app.use('/api',createWorkInboundRoutes({authenticate,service}));
 app.use('/api',createWorkInboundFxRoutes({authenticate,service:{context:async actor=>{serviceCalls.push(actor.id);return {kind:'fx'};}}}));
 app.post('/api/auth/login',(req,res)=>res.json({success:true,username:req.body.username}));
 app.get('/api/unrelated',(req,res)=>res.json({success:true}));
 app.use((error,req,res,next)=>res.status(error.statusCode??500).json({message:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'personnel'})});assert.equal(login.status,200);assert.equal((await login.json()).username,'personnel');
  assert.equal((await fetch(base+'/api/unrelated')).status,200);assert.equal(authCalls.length,0);
  for(const path of ['/work-receiving/context','/work-purchases/context','/work-suppliers/context','/work-purchases/fx/context'])assert.equal((await fetch(base+'/api'+path)).status,401);
  assert.equal(serviceCalls.length,0);
  assert.equal((await fetch(base+'/api/work-receiving/context',{headers:{authorization:'Bearer fixture'}})).status,200);
  assert.equal((await fetch(base+'/api/work-purchases/context',{headers:{authorization:'Bearer fixture'}})).status,403);
  const fx=await fetch(base+'/api/work-purchases/fx/context',{headers:{authorization:'Bearer fixture'}});assert.equal(fx.status,200);assert.equal((await fx.json()).data.kind,'fx');assert.deepEqual(serviceCalls,['16','16']);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
