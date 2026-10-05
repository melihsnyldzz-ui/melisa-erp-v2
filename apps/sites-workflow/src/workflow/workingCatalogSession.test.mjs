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
test('approved LAN starts without bootstrap then uses normal login and authenticated LAN home/catalog/photo',async()=>{
 const calls=[],store=storage(),lan={...location,hostname:'192.168.1.46'},regular={id:15,displayName:'İlker',role:{code:'accountant'},permissions:['product.view','goods.view']};
 const session=createWorkingCatalogSession({location:lan,apiBase,storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/login')?reply({user:regular,accessToken:'lan-user'}):url.includes('/photo?')?imageReply():reply({readOnly:true});}});
 assert.equal(await session.start(),null);assert.equal(calls.length,0);assert.equal((await session.login({username:'ilker',password:'secret'})).id,15);await session.home();await session.api('/api/catalog/products');await session.media('/api/catalog/products/12/photo?variant=thumbnail');
 assert.equal(store.getItem(testSessionModeKey),'manual');assert.ok(calls.every(c=>c.url.startsWith('http://192.168.1.46:4144/')));assert.ok(calls.every(c=>!c.url.includes('/test-admin')));assert.equal(calls[0].options.method,'POST');assert.ok(calls.slice(1).every(c=>c.options.method==='GET'&&c.options.headers.Authorization==='Bearer lan-user'));session.dispose();
 const persisted=createWorkingCatalogSession({location:lan,apiBase,storage:store,fetchImpl:async(url)=>{assert.equal(url,'http://192.168.1.46:4144/api/auth/me');return reply(regular);}});assert.equal((await persisted.start()).id,15);persisted.dispose();
});
test('LAN login blocks foreign hosts, wrong web/API ports and alternate protocols before network',async()=>{
 for(const settings of [{location:{...location,hostname:'192.168.1.47'}},{location:{...location,hostname:'192.168.1.46',port:'5195'}},{location:{...location,hostname:'192.168.1.46',protocol:'https:'}},{location:{...location,hostname:'192.168.1.46'},apiBase:'http://192.168.1.46:4114'}]){let count=0;const session=createWorkingCatalogSession({location,apiBase,storage:storage(),fetchImpl:async()=>{count++;},...settings});await assert.rejects(()=>session.start());await assert.rejects(()=>session.login({username:'ilker',password:'secret'}));assert.equal(count,0);session.dispose();}
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
const imageReply=(type='image/jpeg',size=5)=>({ok:true,status:200,headers:new Headers({'Content-Type':type}),blob:async()=>new Blob([new Uint8Array(size)],{type})});
test('daily home transport is exact authenticated GET and never expands catalogue paths',async()=>{
 const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'home-token'}):reply({meta:{readOnly:true}}));
 await assert.rejects(()=>f.session.home());await f.session.start();assert.deepEqual(await f.session.home(),{meta:{readOnly:true}});
 assert.equal(f.calls[1].url,apiBase+'/api/home/summary');assert.equal(f.calls[1].options.method,'GET');assert.equal(f.calls[1].options.headers.Authorization,'Bearer home-token');assert.equal(f.calls[1].options.credentials,'omit');
 for(const arg of ['/api/dashboard/summary',{method:'POST'},{signal:new AbortController().signal}])await assert.rejects(()=>f.session.home(arg));
 await assert.rejects(()=>f.session.api('/api/home/summary'));assert.equal(f.calls.length,2);f.session.dispose();
});
test('home disposal rejects late data and auth expiry shares the existing login boundary',async()=>{
 let resolve,expired=0;const s=createWorkingCatalogSession({location,apiBase,storage:storage(),onExpired:()=>expired++,fetchImpl:async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'x'}):new Promise(done=>resolve=done)});
 await s.start();const pending=s.home();s.dispose();resolve(reply({meta:{readOnly:true}}));await assert.rejects(()=>pending);assert.equal(expired,0);
 const live=createWorkingCatalogSession({location,apiBase,storage:storage(),onExpired:()=>expired++,fetchImpl:async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'x'}):reply(null,401)});await live.start();await assert.rejects(()=>live.home(),e=>e.status===401);assert.equal(expired,1);live.dispose();
});
test('photo transport uses closure bearer and exact GET raster variants; no foreign paths or token queries',async()=>{
 const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'photo-token'}):imageReply());await f.session.start();
 const blob=await f.session.media('/api/catalog/products/12/photo?variant=preview');assert.equal(blob.type,'image/jpeg');const request=f.calls[1];assert.equal(request.options.method,'GET');assert.equal(request.options.credentials,'omit');assert.equal(request.options.redirect,'error');assert.equal(request.options.headers.Authorization,'Bearer photo-token');assert(!request.url.includes('photo-token'));
 await f.session.media('/api/catalog/products/12/photo?variant=thumbnail');
 for(const path of ['https://other/image','/api/catalog/products/12/photo?variant=original','/api/catalog/products/12/photo?variant=preview&token=x','/api/catalog/products/12/photo?variant=preview#fragment','/api/catalog/products/12/photo?variant=%70review','/api/catalog/products/../photo?variant=preview','/uploads/photo.jpg'])await assert.rejects(()=>f.session.media(path));
 await assert.rejects(()=>f.session.media('/api/catalog/products/12/photo?variant=preview',{method:'POST'}));assert.equal(f.calls.length,3);f.session.dispose();
});
test('photo transport rejects executable, empty and oversized responses without exposing server internals',async()=>{
 for(const response of [imageReply('image/svg+xml'),imageReply('text/html'),imageReply('image/jpeg',0),imageReply('image/jpeg',8*1024*1024+1)]){const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'x'}):response);await f.session.start();await assert.rejects(()=>f.session.media('/api/catalog/products/12/photo?variant=preview'),e=>!e.message.includes('SQL'));f.session.dispose();}
});
test('current media auth expiry clears session and invokes same login flow',async()=>{
 let expired=0;const store=storage(),s=createWorkingCatalogSession({location,apiBase,storage:store,onExpired:()=>expired++,fetchImpl:async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'x'}):reply(null,403)});await s.start();await assert.rejects(()=>s.media('/api/catalog/products/12/photo?variant=preview'),e=>e.status===403&&!e.message.includes('SQL'));assert.equal(store.getItem(workingCatalogTokenKey),null);assert.equal(expired,1);s.dispose();
});
test('external media abort and disposal reject late blobs without session expiry',async()=>{
 for(const disposal of [false,true]){let resolve,expired=0;const s=createWorkingCatalogSession({location,apiBase,storage:storage(),onExpired:()=>expired++,fetchImpl:async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'x'}):new Promise(done=>resolve=done)});await s.start();const signal=new AbortController(),p=s.media('/api/catalog/products/12/photo?variant=preview',{signal:signal.signal});disposal?s.dispose():signal.abort();resolve(imageReply());await assert.rejects(()=>p);assert.equal(expired,0);s.dispose();}
});
test('late old media 401 cannot clear replacement login or invoke expiration',async()=>{
 let finish,expired=0;const store=storage(),s=createWorkingCatalogSession({location,apiBase,storage:store,onExpired:()=>expired++,fetchImpl:async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'old'}):url.endsWith('/auth/login')?reply({user,accessToken:'new'}):new Promise(resolve=>finish=resolve)});await s.start();const old=s.media('/api/catalog/products/12/photo?variant=preview');await s.login({username:'ilker',password:'secret'});finish(reply(null,401));await assert.rejects(()=>old);assert.equal(store.getItem(workingCatalogTokenKey),'new');assert.equal(expired,0);s.dispose();
});
