import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {createBusinessBrowserSessionTransport,businessSessionCookie} from '../../business-preview-session.mjs';
import {createWorkingCatalogSession,workingCatalogTokenKey} from './workingCatalogSession.mjs';
import {businessWorkfaceId,businessWorkfaceRequestAllowed,businessCustomerMasterBrowserRequestAllowed,businessCustomerMasterRequestAllowed,businessCustomerMasterInputAllowed} from './businessWorkface.mjs';
const user={id:17,username:'unified-semih-test',role:{id:17,code:'unified_test_semih'},isActive:true,isAdmin:false,testAdminSession:false,nativeTerminalSession:false,permissions:['customer.view','customer.edit']};
const uuid='11111111-1111-4111-8111-111111111111',body={requestId:uuid,expectedRevision:'A'.repeat(64),customerCode:'00155',customerName:'Synthetic',customerType:'wholesale'},path='/api/customers/155/master';
const reply=data=>({ok:true,status:200,text:async()=>JSON.stringify(data)});
async function dispatch(handler,{url=path,method='GET',body:input,headers={authorization:'Bearer fixture-access'}}={}){
 const req=Readable.from(input===undefined?[]:[Buffer.from(typeof input==='string'?input:JSON.stringify(input))]);Object.assign(req,{url,method,headers});let status,result,next=false;
 await handler(req,{writeHead(code){status=code;},end(raw){result=JSON.parse(raw);}},()=>{next=true;});return {status,result,next};
}
test('finite master route requires exact method, canonical bigint, v4 UUID and keeps generic gate closed',()=>{
 for(const [method,url] of [['GET',path],['POST',path],['GET',path+'/requests/'+uuid]]){assert(businessCustomerMasterBrowserRequestAllowed(method,url));assert(businessCustomerMasterRequestAllowed(method,url,user));assert.equal(businessWorkfaceRequestAllowed(method,url),false);}
 for(const [method,url] of [['PUT',path],['DELETE',path],['POST',path+'/requests/'+uuid],['GET',path+'?x=1'],['GET',path+'\n'],['GET','/api/customers/01/master'],['GET','/api/customers/9223372036854775808/master'],['GET',path+'/requests/'+uuid.replace('-4111-','-1111-')],['GET',path+'/requests/'+'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'],['POST','/api/customers'],['POST',path+'/../card']])assert.equal(businessCustomerMasterBrowserRequestAllowed(method,url),false);
 for(const patch of [{id:18},{role:{id:17,code:'admin'}},{isAdmin:true},{testAdminSession:true},{nativeTerminalSession:true},{isActive:false},{permissions:['customer.view']},{permissions:['customer.edit']}])assert.equal(businessCustomerMasterRequestAllowed('POST',path,{...user,...patch}),false);
});
test('body is the finite unchanged local-master contract with exact v4 UUID and revision',()=>{
 assert(businessCustomerMasterInputAllowed(body));for(const bad of [{...body,actorId:17},{...body,balance:0},{...body,requestId:uuid+'\n'},{...body,requestId:uuid.replace('-4111-','-1111-')},{...body,expectedRevision:'a'.repeat(64)},{...body,expectedRevision:'A'.repeat(64)+'\n'},{...body,customerCode:'x'.repeat(51)},{...body,customerName:'x\ny'},{...body,customerType:'supplier'}])assert.equal(businessCustomerMasterInputAllowed(bad),false);
 let invoked=false;const accessor={...body};Object.defineProperty(accessor,'customerName',{enumerable:true,get(){invoked=true;return 'X';}});assert.equal(businessCustomerMasterInputAllowed(accessor),false);assert.equal(invoked,false);
});
test('fresh jwt auth/me guards all three master routes; exact raw body forwarded once and no automatic retry on lost response',async()=>{
 let actor=user,lose=false;const calls=[],handler=createBusinessBrowserSessionTransport({fetchImpl:async(url,o)=>{calls.push({url,...o});if(url.endsWith('/auth/me'))return reply({success:true,data:actor,meta:{source:'jwt-auth'}});if(lose)throw Error('lost acknowledgement');return reply({success:true,data:{ok:true}});}});
 for(const [method,url,input] of [['GET',path,undefined],['POST',path,JSON.stringify(body,null,2)],['GET',path+'/requests/'+uuid,undefined]]){const before=calls.length,r=await dispatch(handler,{method,url,body:input});assert.equal(r.status,200);assert.equal(calls[before].url,'http://127.0.0.1:4144/api/auth/me');assert.equal(calls[before+1].url,'http://127.0.0.1:4144'+url);assert.equal(calls[before+1].body,input);}
 actor={...user,permissions:['customer.view']};let before=calls.length;assert.equal((await dispatch(handler,{method:'POST',body})).status,403);assert.equal(calls.length,before+1);
 actor={...user,nativeTerminalSession:true};before=calls.length;assert.equal((await dispatch(handler)).status,403);assert.equal(calls.length,before+1);
 actor=user;before=calls.length;assert.equal((await dispatch(handler,{method:'POST',body:{...body,balance:1}})).status,400);assert.equal(calls.length,before);
 before=calls.length;assert.equal((await dispatch(handler,{headers:{authorization:'Bearer fixture-access','x-melisa-session-transport':'native'}})).status,401);assert.equal(calls.length,before);
 lose=true;before=calls.length;assert.equal((await dispatch(handler,{method:'POST',body})).status,503);assert.equal(calls.length,before+2);assert.equal(calls.filter(c=>c.method==='POST').length,2);
});
test('normal browser session reaches only finite customer master transport and retains recovery UUID',async()=>{
 const store=new Map([[workingCatalogTokenKey,'fixture-access']]),calls=[];
 const transport=createBusinessBrowserSessionTransport({fetchImpl:async(url,o)=>{const p=new URL(url).pathname;calls.push({path:p,method:o.method,body:o.body});if(p==='/api/auth/session-confirm')return reply({success:true,data:{confirmed:true,user,expiresAt:Date.now()+900000}});if(p==='/api/auth/me')return reply({success:true,data:user,meta:{source:'jwt-auth'}});return reply({success:true,data:{fixture:true}});}});
 const session=createWorkingCatalogSession({location:{protocol:'http:',hostname:'127.0.0.1',port:'5244',origin:'http://127.0.0.1:5244'},apiBase:'http://127.0.0.1:4144',businessProfile:businessWorkfaceId,protectedDevice:null,storage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},fetchImpl:async(url,o)=>{const r=await dispatch(transport,{url:new URL(url).pathname,method:o.method,body:o.body,headers:{authorization:o.headers.Authorization,...(url.includes('/api/auth/')?{cookie:businessSessionCookie+'='+'A'.repeat(43)}:{})}});assert(!r.next);return {ok:r.status===200,status:r.status,json:async()=>r.result};}});
 try{await session.start();await session.customerMaster('155');await session.customerMaster('155',{method:'POST',body});await session.customerMasterRecovery('155',uuid);assert.deepEqual(calls.filter(c=>c.path.startsWith(path)).map(c=>[c.method,c.path]),[['GET',path],['POST',path],['GET',path+'/requests/'+uuid]]);assert.deepEqual(JSON.parse(calls.find(c=>c.method==='POST'&&c.path===path).body),body);await assert.rejects(()=>session.customerMaster('155',{method:'POST',body:{...body,balance:4}}));assert.equal(calls.filter(c=>c.method==='POST'&&c.path===path).length,1);}finally{session.dispose();}
});
test('vite and packaged web gateway route through the finite master predicate before session transport',async()=>{
 for(const file of ['../../vite.config.mjs','../../business-web-gateway.mjs']){const text=await readFile(new URL(file,import.meta.url),'utf8');assert.match(text,/!businessCustomerMasterBrowserRequestAllowed\(req\.method,req\.url\)/);assert.match(text,/businessWorkfaceRequestAllowed/);assert.match(text,/(?:sessionTransport|transport)\(req,res,(?:next|\(\)=>\{next=true;\})\)/);}
});
