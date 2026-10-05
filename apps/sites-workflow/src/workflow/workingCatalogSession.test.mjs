import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkingCatalogSession,workingCatalogTokenKey,workingCatalogUserLabel} from './workingCatalogSession.mjs';
import {testSessionModeKey} from './testAdminSession.mjs';
const location={hostname:'127.0.0.1',protocol:'http:',port:'5194'},apiBase='http://127.0.0.1:4144';
const user={id:16,displayName:'TEST ADMIN',role:{code:'admin'},permissions:['product.view','sales.view']};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const reply=(data,status=200)=>({ok:status===200,status,json:async()=>status===200?{success:true,data}:{success:false,error:{message:'RAW SQL INTERNAL'}}});
function fixture(fetchImpl){const store=storage(),calls=[];const session=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return fetchImpl(url,options);}});return {session,store,calls};}
test('fresh exact target bootstrap shares LAB session token, validates user and allows catalog reads only',async()=>{
 const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'token'}):reply({rows:[]}));await f.session.start();assert.equal(f.store.getItem(workingCatalogTokenKey),'token');assert.equal(f.calls[0].options.method,'POST');assert.deepEqual(JSON.parse(f.calls[0].options.body),{});assert.equal(workingCatalogUserLabel(user),'Yönetici');
 const p=await f.session.api('/api/catalog/products?barcode=000012',{envelope:true});assert.equal(p.success,true);assert.equal(f.calls[1].options.method,'GET');assert.equal(f.calls[1].options.credentials,'omit');assert.equal(f.calls[1].options.redirect,'error');assert.equal(f.calls[1].options.headers.Authorization,'Bearer token');
 for(const path of ['/api/vega/products','https://other/api/catalog/products','/api/catalog/products/12#fragment','/api/catalog/products/../other'])await assert.rejects(()=>f.session.api(path));await assert.rejects(()=>f.session.api('/api/catalog/products',{method:'POST'}));assert.equal(f.calls.length,2);f.session.dispose();
});
test('existing token verifies auth/me and manual mode never auto-elevates',async()=>{
 const f=fixture(async()=>reply(user));f.store.setItem(workingCatalogTokenKey,'old');f.store.setItem(testSessionModeKey,'manual');assert.equal((await f.session.start()).id,16);assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,apiBase+'/api/auth/me');
 const missing=fixture(async()=>{throw Error('must not call');});missing.store.setItem(testSessionModeKey,'manual');assert.equal(await missing.session.start(),null);assert.equal(missing.calls.length,0);
 const expired=fixture(async()=>reply(null,401));expired.store.setItem(workingCatalogTokenKey,'bad');expired.store.setItem(testSessionModeKey,'manual');assert.equal(await expired.session.start(),null);assert.equal(expired.calls.length,1);assert.equal(expired.store.getItem(workingCatalogTokenKey),null);
});
test('remote, LIVE, wrong API target cannot bootstrap or login; no source fallback',async()=>{
 for(const settings of [{location:{...location,port:'5188'}},{location:{...location,hostname:'192.168.1.2'}},{apiBase:'http://127.0.0.1:4114'}]){let calls=0;const s=createWorkingCatalogSession({location,apiBase,storage:storage(),fetchImpl:async()=>{calls++;},...settings});await assert.rejects(()=>s.start());await assert.rejects(()=>s.login({username:'admin',password:'secret'}));assert.equal(calls,0);}
});
test('manual normal login stores token/mode only, not password; malformed auth rejects',async()=>{
 const f=fixture(async()=>reply({user,accessToken:'manual'}));await f.session.login({username:'ilker',password:'secret'});assert.equal(f.store.getItem(testSessionModeKey),'manual');assert.equal(f.store.getItem(workingCatalogTokenKey),'manual');assert.equal(f.store.getItem('password'),null);assert.equal(f.calls[0].url,apiBase+'/api/auth/login');
 const bad=fixture(async()=>reply({user:{...user,permissions:'admin'},accessToken:'bad'}));await assert.rejects(()=>bad.session.start());assert.equal(bad.store.getItem(workingCatalogTokenKey),null);
});
test('revoked auth clears token and invokes expiration; raw server errors never reach screen',async()=>{
 let count=0,expired=0;const store=storage(),s=createWorkingCatalogSession({location,apiBase,storage:store,onExpired:()=>expired++,fetchImpl:async()=>count++===0?reply({user,accessToken:'x'}):reply(null,403)});await s.start();await assert.rejects(()=>s.api('/api/catalog/products'),e=>e.status===403&&!e.message.includes('SQL'));assert.equal(store.getItem(workingCatalogTokenKey),null);assert.equal(expired,1);await assert.rejects(()=>s.api('/api/catalog/products'));
});
test('navigation disposal aborts pending auth and prevents late token persistence',async()=>{
 let resolve;const f=fixture(async()=>new Promise(r=>resolve=r));const pending=f.session.start();f.session.dispose();assert.equal(f.calls[0].options.signal.aborted,true);resolve(reply({user,accessToken:'late'}));await assert.rejects(()=>pending);assert.equal(f.store.getItem(workingCatalogTokenKey),null);
});
test('deadline abort is fail closed even if fetch adapter returns after timeout',async()=>{
 const s=createWorkingCatalogSession({location,apiBase,storage:storage(),timeoutMs:1,fetchImpl:async()=>{await new Promise(r=>setTimeout(r,8));return reply({user,accessToken:'late'});}});await assert.rejects(()=>s.start());s.dispose();
});
test('late old 401 cannot clear a newer manual login or invoke expired callback',async()=>{
 let resolveOld,expired=0;const store=storage();
 const s=createWorkingCatalogSession({location,apiBase,storage:store,onExpired:()=>expired++,fetchImpl:async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'old'}):url.endsWith('/auth/login')?reply({user,accessToken:'new'}):new Promise(r=>resolveOld=r)});
 await s.start();const old=s.api('/api/catalog/products');await s.login({username:'ilker',password:'secret'});resolveOld(reply(null,401));await assert.rejects(()=>old);assert.equal(store.getItem(workingCatalogTokenKey),'new');assert.equal(expired,0);s.dispose();
});
