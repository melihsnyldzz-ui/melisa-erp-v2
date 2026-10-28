import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {createBusinessBrowserSessionTransport,businessSessionCookie as name} from '../../business-preview-session.mjs';
async function call(handler,{path='/api/auth/refresh',body,cookie,headers={},method='POST'}={}){
 const input=body===undefined&&method==='POST'?{}:body;const req=Readable.from(input===undefined?[]:[Buffer.from(JSON.stringify(input))]);Object.assign(req,{method,url:path,headers:{...headers,...(cookie?{cookie}:{})}});
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

test('late rejected refresh cannot erase the newer HttpOnly cookie from a concurrent tab',async()=>{
 let releaseOld;const oldResult=new Promise(resolve=>{releaseOld=resolve;});
 const handler=createBusinessBrowserSessionTransport({fetchImpl:async(url,o)=>JSON.parse(o.body).refreshToken==='A'.repeat(43)?oldResult:{ok:true,status:200,text:async()=>JSON.stringify({success:true,data:{user:actor,accessToken:'fixture',refreshToken:'C'.repeat(43),expiresAt:Date.now()+900000,refreshExpiresAt:Date.now()+86400000}})}});
 const old=call(handler,{cookie:name+'='+'A'.repeat(43)});
 const fresh=await call(handler,{cookie:name+'='+'B'.repeat(43)});assert.equal(fresh.status,200);assert.match(fresh.headers['Set-Cookie'],/^melisa_erp_business_5244=C/);
 releaseOld({ok:false,status:401,text:async()=>JSON.stringify({success:false,error:{code:'AUTH_REFRESH_INVALID'}})});
 const rejected=await old;assert.equal(rejected.status,401);assert.equal(rejected.headers['Set-Cookie'],undefined);
 const missing=await call(handler);assert.equal(missing.status,401);assert.equal(missing.headers['Set-Cookie'],undefined);
 const logout=await call(handler,{path:'/api/auth/logout'});assert.match(logout.headers['Set-Cookie'],/Max-Age=0/);
});


test('approved semih label uses only existing native actor; password and role checks stay native',async()=>{
 const calls=[];const handler=createBusinessBrowserSessionTransport({fetchImpl:async(url,o)=>{calls.push(JSON.parse(o.body));return {ok:false,status:401,text:async()=>JSON.stringify({success:false,error:{code:'AUTH_INVALID_CREDENTIALS'}})};}});
 const result=await call(handler,{path:'/api/auth/login',body:{username:'semih',password:'fixture-only'}});
 assert.equal(result.status,401);assert.deepEqual(calls,[{username:'unified-semih-test',password:'fixture-only'}]);assert.equal(result.headers['Set-Cookie'],undefined);
 for(const username of ['Semih','semih ','admin','unified-other'])assert.equal((await call(handler,{path:'/api/auth/login',body:{username,password:'fixture-only'}})).status,401);
 assert.equal(calls.length,1);
});

const previewActor={...actor,isActive:true,isAdmin:false,testAdminSession:false,permissions:['sales.view','sales.create','customer.view','product.view','finance.view']};
const selection={customerId:'155',customerAccountId:'7',currency:'USD',documentDate:'2026-10-28',items:[{productId:'12',quoteId:'81',quantityExact3:'1.000'}]};
const response=(data,status=200)=>({ok:status===200,status,text:async()=>JSON.stringify(data)});
test('BFF fresh Bearer auth/me authorizes exact three previews without a work-sales cookie or refresh token',async()=>{
 const calls=[],handler=createBusinessBrowserSessionTransport({fetchImpl:async(url,o)=>{calls.push({url,o});return response(url.endsWith('/auth/me')?{success:true,data:previewActor,meta:{source:'jwt-auth'}}:{success:true,data:{fixture:true}});}});
 for(const [method,path] of [['GET','/api/work-sales/context'],['POST','/api/work-sales/selected-context'],['POST','/api/work-sales/preview']]){
  const r=await call(handler,{method,path,body:method==='GET'?undefined:selection,headers:{authorization:'Bearer fixture-access'}});assert.equal(r.status,200);assert.equal(r.headers['Set-Cookie'],undefined);
 }
 assert.equal(calls.length,6);for(let n=0;n<6;n+=2){assert.equal(calls[n].url,'http://127.0.0.1:4144/api/auth/me');assert.equal(calls[n].o.method,'GET');assert.equal(calls[n].o.body,undefined);assert.equal(calls[n].o.cache,'no-store');assert.equal(calls[n].o.redirect,'error');for(const c of [calls[n],calls[n+1]]){assert.equal(c.o.headers.Authorization,'Bearer fixture-access');assert.equal(c.o.headers.cookie,undefined);assert.equal(c.o.headers.refreshToken,undefined);}}
 assert.deepEqual(JSON.parse(calls[3].o.body),selection);assert.deepEqual(JSON.parse(calls[5].o.body),selection);
});
test('BFF rejects claimed actor, non-normal upstream identity, missing permissions, failed auth and malformed scope before forwarding',async()=>{
 for(const patch of [{id:16},{role:{id:17,code:'admin'}},{isAdmin:true},{testAdminSession:true},{nativeTerminalSession:true},{isActive:false},{permissions:['sales.create']}]){
  const calls=[],handler=createBusinessBrowserSessionTransport({fetchImpl:async(url)=>{calls.push(url);return response({success:true,data:{...previewActor,...patch},meta:{source:'jwt-auth'}});}});
  assert.equal((await call(handler,{path:'/api/work-sales/preview',body:selection,headers:{authorization:'Bearer fixture-access','x-actor-id':'17'}})).status,403);assert.equal(calls.length,1);
 }
 for(const auth of [{success:false},{success:true,data:previewActor,meta:{source:'sql-auth'}}]){const h=createBusinessBrowserSessionTransport({fetchImpl:async()=>response(auth)});assert.equal((await call(h,{path:'/api/work-sales/preview',body:selection,headers:{authorization:'Bearer fixture-access'}})).status,401);}
 const h=createBusinessBrowserSessionTransport({fetchImpl:()=>assert.fail('no upstream')});
 assert.equal((await call(h,{path:'/api/work-sales/preview',body:selection})).status,401);
 assert.equal((await call(h,{path:'/api/work-sales/preview',body:{...selection,actorId:'17'},headers:{authorization:'Bearer fixture-access'}})).status,400);
 assert.equal((await call(h,{path:'/api/work-sales/preview',body:selection,headers:{authorization:'Bearer fixture-access','x-melisa-session-transport':'native'}})).status,401);
});
test('BFF only admits exact invoice detail GET with finance permission; list and every commercial operation stay outside dispatch',async()=>{
 const calls=[],h=createBusinessBrowserSessionTransport({fetchImpl:async(url,o)=>{calls.push({url,o});return response(url.endsWith('/auth/me')?{success:true,data:previewActor,meta:{source:'jwt-auth'}}:{success:true,data:{id:'51'}});}});
 const r=await call(h,{method:'GET',path:'/api/work-sales/invoices/51',body:undefined,headers:{authorization:'Bearer fixture-access'}});assert.equal(r.status,200);assert.equal(calls.length,2);
 for(const [method,path] of [['GET','/api/work-sales/invoices'],['GET','/api/work-sales/invoices/51?accountId=7'],['POST','/api/work-sales/drafts'],['POST','/api/work-sales/drafts/51/finalize'],['POST','/api/work-sales/drafts/51/cancel'],['POST','/api/work-collections']])assert.equal((await call(h,{method,path})).next,true);
 assert.equal(calls.length,2);
 const denied=createBusinessBrowserSessionTransport({fetchImpl:async()=>response({success:true,data:{...previewActor,permissions:previewActor.permissions.filter(p=>p!=='finance.view')},meta:{source:'jwt-auth'}})});assert.equal((await call(denied,{method:'GET',path:'/api/work-sales/invoices/51',body:undefined,headers:{authorization:'Bearer fixture-access'}})).status,403);
});
