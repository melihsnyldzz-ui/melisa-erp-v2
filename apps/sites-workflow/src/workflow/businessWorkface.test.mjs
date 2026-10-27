import test from 'node:test';import assert from 'node:assert/strict';
import {businessWorkfaceId as profile,businessWorkfaceRequestAllowed as allowed} from './businessWorkface.mjs';
import {resolveTestApiBase} from './testAdminSession.mjs';
import {createWorkingCatalogSession} from './workingCatalogSession.mjs';
const location={protocol:'http:',hostname:'127.0.0.1',port:'5244',origin:'http://127.0.0.1:5244'};
const user={id:17,username:'unified-semih-test',role:{id:17,code:'unified_test_semih'},permissions:['product.view','sales.view']};
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
test('business face requires explicit matching profile; wrong port/profile never falls back to CLEAN',()=>{
 assert.equal(resolveTestApiBase({location,apiBase:'http://127.0.0.1:4144'}),null);
 for(const host of ['127.0.0.1','localhost','192.168.1.46','100.87.188.3']){const l={...location,hostname:host,origin:`http://${host}:5244`};assert.equal(resolveTestApiBase({location:l,apiBase:'http://127.0.0.1:4144',businessProfile:profile}),l.origin);}
 for(const edit of [{businessProfile:'wrong'},{apiBase:'http://127.0.0.1:4194'},{location:{...location,hostname:'foreign',origin:'http://foreign:5244'}}])assert.equal(resolveTestApiBase({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,...edit}),null);
});
test('read-only workface admits catalog, photos and separate party cards but never commercial/admin/external mutations',()=>{
 for(const path of ['/api/catalog/products?limit=50','/api/catalog/products/12/photo?variant=thumbnail','/api/customer-cards?limit=25','/api/customers/12/card','/api/supplier-cards?status=all','/api/suppliers/22/card'])assert.equal(allowed('GET',path),true);
 for(const method of ['POST','PUT','DELETE','PATCH'])for(const path of ['/api/work-collections','/api/products','/api/suppliers/22/card','/api/auth/local-passwordless-admin','/api/work-sales/drafts/1/finalize'])assert.equal(allowed(method,path),false);
 for(const path of ['//foreign/api/auth/login','/api/auth/login?next=x','/api/../auth/login','/api/%2e%2e/auth/login'])assert.equal(allowed('POST',path),false);
});
test('normal browser reopens through HttpOnly transport without storing refresh secrets; logout prevents reopening',async()=>{
 const saved=storage(),calls=[];let authenticated=false;
 const fetchImpl=async(url,o)=>{calls.push({url,...o});assert.equal(o.credentials,'same-origin');assert.equal(new URL(url).origin,location.origin);const path=new URL(url).pathname,body=JSON.parse(o.body??'{}');
  if(path==='/api/auth/login'){assert.deepEqual(body,{username:user.username,password:'fixture-password'});authenticated=true;}
  else if(path==='/api/auth/refresh'){assert.deepEqual(body,{});if(!authenticated)return{ok:false,status:401,json:async()=>({success:false,error:{code:'AUTH_REFRESH_INVALID'}})};}
  else if(path==='/api/auth/logout'){assert.deepEqual(body,{});authenticated=false;return{ok:true,status:200,json:async()=>({success:true,data:{loggedOut:true}})};}
  else throw Error('Unexpected request');
  return{ok:true,status:200,json:async()=>({success:true,data:{user,accessToken:'fixture-access-token',expiresAt:Date.now()+900000,browserSession:true}})};
 };
 const make=()=>createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,storage:saved,fetchImpl,protectedDevice:null});
 const first=make();assert.equal(await first.start(),null);assert.equal((await first.login({username:user.username,password:'fixture-password'})).id,17);
 const reopened=make();assert.equal((await reopened.start()).id,17);assert(!JSON.stringify([...saved.data]).includes('refreshToken'));await reopened.logout();assert.equal(await make().start(),null);
 assert(!calls.some(c=>c.url.includes('local-passwordless-admin')||c.url.includes(':4194')));
});
