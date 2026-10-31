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
  else if(path==='/api/auth/session-confirm'){assert.deepEqual(body,{});assert.equal(o.headers.Authorization,'Bearer fixture-access-token');return{ok:authenticated,status:authenticated?200:401,json:async()=>({success:authenticated,data:{confirmed:true,user,expiresAt:Date.now()+900000}})};}
  else throw Error('Unexpected request');
  return{ok:true,status:200,json:async()=>({success:true,data:{user,accessToken:'fixture-access-token',expiresAt:Date.now()+900000,browserSession:true}})};
 };
 const make=()=>createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,storage:saved,fetchImpl,protectedDevice:null});
 const first=make();assert.equal(await first.start(),null);assert.equal((await first.login({username:user.username,password:'fixture-password'})).id,17);
 const reopened=make();assert.equal((await reopened.start()).id,17);assert(!JSON.stringify([...saved.data]).includes('refreshToken'));await reopened.logout();assert.equal(await make().start(),null);
 assert(!calls.some(c=>c.url.includes('local-passwordless-admin')||c.url.includes(':4194')));
 assert.equal(calls.filter(c=>c.url.endsWith('/auth/session-confirm')).length,1);
 assert.equal(calls.filter(c=>c.url.endsWith('/auth/refresh')).length,2);
});

test('failed first login is not described as an expired session and never clears a saved work draft',async()=>{
 const saved=storage();saved.setItem('saved-draft','keep');let expired=0;
 const session=createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,storage:saved,protectedDevice:null,onExpired:()=>expired++,fetchImpl:async()=>({ok:false,status:401,json:async()=>({success:false})})});
 await assert.rejects(session.login({username:user.username,password:'fixture-invalid'}),e=>e.status===401&&e.message==='Kullanıcı adı veya şifre doğrulanamadı.');
 assert.equal(expired,0);assert.equal(saved.getItem('saved-draft'),'keep');
});

test('confirmation outage preserves cached access and work draft instead of rotating or pretending logout',async()=>{
 const saved=storage();saved.setItem('melisaTestSalesAccessToken','fixture');saved.setItem('saved-draft','keep');const paths=[];
 const session=createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,storage:saved,protectedDevice:null,fetchImpl:async url=>{paths.push(new URL(url).pathname);return{ok:false,status:503,json:async()=>({success:false})};}});
 await assert.rejects(session.start(),e=>e.status===503);assert.deepEqual(paths,['/api/auth/session-confirm']);assert.equal(saved.getItem('melisaTestSalesAccessToken'),'fixture');assert.equal(saved.getItem('saved-draft'),'keep');
});

test('rejected old access pair uses only the current HttpOnly refresh cookie and rejects changed identity',async()=>{
 for(const accepted of [true,false]){
  const saved=storage();saved.setItem('melisaTestSalesAccessToken','old');const paths=[];
  const session=createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,storage:saved,protectedDevice:null,fetchImpl:async(url,o)=>{const p=new URL(url).pathname;paths.push(p);assert.deepEqual(JSON.parse(o.body),{});if(p.endsWith('/session-confirm'))return{ok:false,status:401,json:async()=>({success:false})};return{ok:true,status:200,json:async()=>({success:true,data:{browserSession:true,user:accepted?user:{...user,id:18},accessToken:'new',expiresAt:Date.now()+900000}})};}});
  const current=await session.start();assert.equal(current?.id??null,accepted?17:null);assert.deepEqual(paths,['/api/auth/session-confirm','/api/auth/refresh']);
 }
});

test('a forbidden photo does not destroy an otherwise valid session',async()=>{
 const saved=storage();let expired=0;
 const session=createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,storage:saved,protectedDevice:null,onExpired:()=>expired++,fetchImpl:async url=>url.includes('/photo?')?{ok:false,status:403}:{ok:true,status:200,json:async()=>({success:true,data:{browserSession:true,user,accessToken:'fixture',expiresAt:Date.now()+900000}})}});
 await session.login({username:user.username,password:'fixture'});await assert.rejects(session.media('/api/catalog/products/12/photo?variant=thumbnail'),e=>e.status===403);
 assert.equal(expired,0);assert.equal(saved.getItem('melisaTestSalesAccessToken'),'fixture');
});

test('parallel screen reopening confirms the cached pair without rotating the shared cookie',async()=>{
 const saved=storage();saved.setItem('melisaTestSalesAccessToken','fixture');let confirms=0;
 const make=()=>createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,storage:saved,protectedDevice:null,fetchImpl:async(url,o)=>{assert(url.endsWith('/auth/session-confirm'));assert.equal(o.headers.Authorization,'Bearer fixture');confirms++;return{ok:true,status:200,json:async()=>({success:true,data:{confirmed:true,user,expiresAt:Date.now()+900000}})};}});
 const sessions=Array.from({length:4},make);assert.deepEqual((await Promise.all(sessions.map(s=>s.start()))).map(u=>u.id),[17,17,17,17]);assert.equal(confirms,4);sessions.forEach(s=>s.dispose());
});

test('confirmed access near expiry rotates once and keeps the same verified identity',async()=>{
 const saved=storage();saved.setItem('melisaTestSalesAccessToken','fixture');const paths=[];
 const session=createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,storage:saved,protectedDevice:null,fetchImpl:async url=>{paths.push(new URL(url).pathname);return{ok:true,status:200,json:async()=>({success:true,data:url.endsWith('/session-confirm')?{confirmed:true,user,expiresAt:Date.now()+10000}:{browserSession:true,user,accessToken:'renewed',expiresAt:Date.now()+900000}})};}});
 assert.equal((await session.start()).id,17);assert.deepEqual(paths,['/api/auth/session-confirm','/api/auth/refresh']);assert.equal(saved.getItem('melisaTestSalesAccessToken'),'renewed');
});


test('unsupported business receiving scope is distinct from role denial and preserves the existing login',async()=>{
 const saved=storage();saved.setItem('melisaTestSalesAccessToken','fixture');let calls=0,expired=0;
 const session=createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:profile,storage:saved,protectedDevice:null,onExpired:()=>expired++,fetchImpl:async url=>{calls++;assert(url.endsWith('/auth/session-confirm'));return{ok:true,status:200,json:async()=>({success:true,data:{confirmed:true,user:{...user,permissions:[...user.permissions,'goods.view','goods.create','goods.approve']},expiresAt:Date.now()+900000}})};}});
 await session.start();
 for(const [path,options] of [['/api/work-receiving/context',undefined],['/api/work-receiving/count-drafts',{method:'POST',body:{requestId:'00000000-0000-4000-8000-000000000001'}}]])await assert.rejects(()=>session.inbound(path,options),error=>error.status===403&&error.code==='BUSINESS_WORKFACE_SCOPE_UNAVAILABLE');
 assert.equal(calls,1);assert.equal(expired,0);assert.equal(saved.getItem('melisaTestSalesAccessToken'),'fixture');assert.equal(allowed('GET','/api/work-receiving/context'),false);assert.equal(allowed('POST','/api/work-receiving/count-drafts'),false);session.dispose();
});
