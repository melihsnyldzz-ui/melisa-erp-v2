import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {createBusinessBrowserSessionTransport,businessSessionCookie as name} from '../../business-preview-session.mjs';
async function call(handler,{path='/api/auth/refresh',body={},cookie,headers={}}={}){
 const req=Readable.from([Buffer.from(JSON.stringify(body))]);Object.assign(req,{method:'POST',url:path,headers:{...headers,...(cookie?{cookie}:{})}});
 let status,result,sentHeaders,next=false;const res={writeHead(s,h){status=s;sentHeaders=h;},end(b){result=JSON.parse(b);}};
 await handler(req,res,()=>{next=true;});return{status,result,headers:sentHeaders,next};
}
const actor={id:17,username:'unified-semih-test',role:{id:17,code:'unified_test_semih'}};
test('cookie adapter forwards only the normal native family, hides refresh from JSON and uses HttpOnly Strict host cookie',async()=>{
 const calls=[],token='A'.repeat(43),handler=createBusinessBrowserSessionTransport({fetchImpl:async(url,o)=>{calls.push({url,body:JSON.parse(o.body)});return{ok:true,status:200,text:async()=>JSON.stringify({success:true,data:{user:actor,accessToken:'fixture-access',refreshToken:token,expiresAt:Date.now()+900000,refreshExpiresAt:Date.now()+86400000}})};}});
 const result=await call(handler,{path:'/api/auth/login',body:{username:actor.username,password:'fixture-password'}});
 assert.equal(result.status,200);assert.equal(result.result.data.browserSession,true);assert(!JSON.stringify(result.result).includes(token));assert.match(result.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);assert(!result.headers['Set-Cookie'].includes('Domain='));
 await call(handler,{cookie:name+'='+token});assert.equal(calls[1].url,'http://127.0.0.1:4144/api/auth/refresh');assert.deepEqual(calls[1].body,{refreshToken:token});
});
test('missing, duplicate, malformed or injected family is rejected without any upstream call',async()=>{
 const handler=createBusinessBrowserSessionTransport({fetchImpl:()=>{assert.fail('no upstream request');}});
 for(const cookie of [undefined,name+'=invalid',name+'='+'A'.repeat(43)+'; '+name+'='+'B'.repeat(43)])assert.equal((await call(handler,{cookie})).status,401);
 assert.equal((await call(handler,{cookie:name+'='+'A'.repeat(43),body:{refreshToken:'injected'}})).status,400);
 assert.equal((await call(handler,{path:'/api/auth/login',body:{username:'other-user',password:'fixture-password'}})).status,401);
});
test('wrong native actor never creates a browser cookie; logout expires only its own cookie',async()=>{
 const bad=createBusinessBrowserSessionTransport({fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify({data:{user:{...actor,id:10018}}})})});assert.equal((await call(bad,{path:'/api/auth/login',body:{username:actor.username,password:'fixture-password'}})).status,503);
 const good=createBusinessBrowserSessionTransport({fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:{loggedOut:true}})})});const out=await call(good,{path:'/api/auth/logout',cookie:name+'='+'A'.repeat(43)});assert.match(out.headers['Set-Cookie'],/Max-Age=0/);
});
