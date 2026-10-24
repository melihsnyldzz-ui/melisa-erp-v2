import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createTerminalHandoffRoutes} from './terminalHandoffRoutes.mjs';
test('real HTTP router requires own normal Bearer and exact peer transport, never echoes credentials/errors',async()=>{
 const calls=[],provider=Object.fromEntries(['prepare','redeem','verify','revoke'].map(name=>[name,async(body,key)=>{calls.push({name,body,key});if(key==='wrong')throw Error('private-secret-must-not-escape');return {version:1};}]));
 const requireAuth=(req,res,next)=>req.get('authorization')==='Bearer own-fixture-access'?next():res.status(401).json({success:false});
 const router=createTerminalHandoffRoutes({provider,requireAuth}),app=express();app.use(express.json());app.use('/api',router);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const url='http://127.0.0.1:'+server.address().port+'/api/auth/terminal-handoff/';
 const post=(route,body={},headers={})=>fetch(url+route,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  assert.equal((await post('prepare')).status,401);assert.equal(calls.length,0);
  const result=await post('prepare',{refreshToken:'own-fixture-refresh'},{authorization:'Bearer own-fixture-access'});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.deepEqual(await result.json(),{success:true,data:{version:1}});
  assert.equal(calls[0].body.accessToken,'own-fixture-access');
  assert.equal((await post('prepare',{accessToken:'client-selected'},{authorization:'Bearer own-fixture-access'})).status,403);
  for(const headers of [{origin:'http://127.0.0.1:62800'},{forwarded:'for=127.0.0.1'},{'x-forwarded-for':'127.0.0.1'},{'x-forwarded-host':'localhost'}])assert.equal((await post('redeem',{},headers)).status,403);
  const failed=await post('verify',{}, {'x-melisa-terminal-peer':'wrong'});assert.equal(failed.status,403);assert.doesNotMatch(await failed.text(),/private-secret|own-fixture/);
  for(const operation of ['redeem','verify','revoke'])assert.equal((await post(operation,{}, {'x-melisa-terminal-peer':'fixture-peer'})).status,200);
  const count=calls.length;assert.equal((await post('verify?userId=15')).status,403);assert.equal((await post('verify',[])).status,403);assert.equal((await post('verify',{extra:'x'.repeat(4096)})).status,403);assert.equal(calls.length,count);
  const peer=router.stack.find(l=>l.route?.path==='/auth/terminal-handoff/redeem').route.stack[0].handle;let denied=0;
  peer({socket:{remoteAddress:'192.168.1.46'},get:()=>undefined},{status(code){assert.equal(code,403);return this;},json(){denied++;}},()=>assert.fail('LAN peer must not reach provider'));assert.equal(denied,1);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
