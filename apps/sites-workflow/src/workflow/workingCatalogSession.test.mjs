import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkingCatalogSession,workingCatalogTokenKey,workingCatalogUserLabel} from './workingCatalogSession.mjs';
import {testSessionModeKey} from './testAdminSession.mjs';
import {createTradeJournal} from './workTradeModel.mjs';
const location={hostname:'127.0.0.1',protocol:'http:',port:'5194'},apiBase='http://127.0.0.1:4144';
const user={id:16,displayName:'TEST ADMIN',role:{code:'admin'},permissions:['product.view','sales.view']};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const reply=(data,status=200)=>({ok:status===200,status,json:async()=>status===200?{success:true,data}:{success:false,error:{message:'RAW SQL INTERNAL'}}});

test('daily cash transport is normal authenticated clean-only and rejects unknown routes, targets and actor overrides',async()=>{
 const place={hostname:'127.0.0.1',protocol:'http:',port:'5244'},account={...user,id:20,role:{code:'clean_test_finance'},permissions:['finance.view','finance.collection','finance.payment']},store=storage(),calls=[];
 store.setItem(workingCatalogTokenKey,'cash-session-fixture');store.setItem(testSessionModeKey,'manual');
 const session=createWorkingCatalogSession({location:place,apiBase:'http://127.0.0.1:4194',storage:store,fetchImpl:async(url,options)=>{if(url.endsWith('/auth/me'))return reply(account);calls.push({url,options});return reply({record:true});}});
 await session.start();await session.cash('/api/finance/cash-register?businessDate=2026-10-22');await session.cash('/api/finance/cash-register/transfers',{method:'POST',body:{requestId:'command'}});
 assert.equal(calls.length,2);assert(calls.every(c=>c.url.startsWith('http://127.0.0.1:4194/')&&c.options.headers.Authorization==='Bearer cash-session-fixture'));
 for(const path of ['/api/finance/cash-register?businessDate=2026-10-23','/api/finance/cash-register?businessDate=2026-10-22&actorId=23','/api/finance/cash-register/open/extra','/api/finance/accounts'])await assert.rejects(()=>session.cash(path));
 await assert.rejects(()=>session.cash('/api/finance/cash-register/transfers',{method:'DELETE',body:{}}));await assert.rejects(()=>session.cash('/api/finance/cash-register/transfers',{method:'POST',body:{},actorId:10018}));assert.equal(calls.length,2);session.dispose();
 const old=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async()=>reply(account)});await old.start();await assert.rejects(()=>old.cash('/api/finance/cash-register?businessDate=2026-10-22'));old.dispose();
});

for(const path of ['/api/work-sales/invoices','/api/work-sales/invoices?limit=25','/api/work-sales/invoices/42'])test('verified DB02 historical GET can complete after the normal 15s: '+path,async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'history-deadline-fixture');store.setItem(testSessionModeKey,'manual');let finish;
 const session=createWorkingCatalogSession({location:worktestLocation('5234'),apiBase:'http://127.0.0.1:4184',copyProfile:homeCopyProfile(),protectedDevice:null,storage:store,fetchImpl:async(url,options)=>{if(url.endsWith('/auth/me'))return reply(user);calls.push(options);return new Promise(resolve=>{finish=resolve;});}});
 await session.start();const read=session.work(path);t.mock.timers.tick(20000);assert.equal(calls[0].signal.aborted,false);assert.equal(calls.length,1);finish(reply({data:[],meta:{total:0}}));await read;assert.equal(calls.length,1);session.dispose();
});
test('DB02 historical GET is bounded at45s, never retried, and preserves its actor session',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'history-deadline-fixture');store.setItem(testSessionModeKey,'manual');
 const session=createWorkingCatalogSession({location:worktestLocation('5234'),apiBase:'http://127.0.0.1:4184',copyProfile:homeCopyProfile(),protectedDevice:null,storage:store,fetchImpl:async(url,options)=>{if(url.endsWith('/auth/me'))return reply(user);calls.push(options);return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});
 await session.start();const read=session.work('/api/work-sales/invoices'),rejected=assert.rejects(read,e=>e.status===503);t.mock.timers.tick(44999);assert.equal(calls[0].signal.aborted,false);t.mock.timers.tick(1);await rejected;assert.equal(calls.length,1);assert.equal(store.getItem(workingCatalogTokenKey),'history-deadline-fixture');session.dispose();
});

test('invoice history admits only paired customer/currency GET filters and bounded pagination',async()=>{
 const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'history-fixture');store.setItem(testSessionModeKey,'manual');
 const session=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async(url,options)=>{if(url.endsWith('/auth/me'))return reply(user);calls.push({url,options});return reply({data:[],meta:{page:1,limit:25,total:0}});}});
 await session.start();
 for(const path of ['/api/work-sales/invoices?page=2&limit=25&customerId=501&currency=USD','/api/work-sales/invoices?currency=TRY&customerId=501','/api/work-sales/invoices?page=1&limit=50'])await session.work(path);
 assert.equal(calls.length,3);assert(calls.every(c=>c.options.method==='GET'&&c.options.headers.Authorization==='Bearer history-fixture'));
 const base='/api/work-sales/invoices?';
 for(const query of ['customerId=501','currency=USD','customerId=501&currency=LL','customerId=0501&currency=TRY','customerId=501&currency=TRY&currency=USD','customerId=501&currency=TRY&actorId=16','customerId=501&currency=TRY&token=x','page=0','limit=51','page=10001','page=1&page=2',''])await assert.rejects(()=>session.work(base+query));
 await assert.rejects(()=>session.work(base+'customerId=501&currency=TRY',{method:'POST',body:{}}));
 assert.equal(calls.length,3);session.dispose();
});

test('an authenticated work POST can finish after15s while its exact UUID/body and journal stay unchanged',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const store=storage(),calls=[];let finish,signal;
 store.setItem(workingCatalogTokenKey,'deadline-fixture');store.setItem(testSessionModeKey,'manual');
 const session=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async(url,options)=>{
  if(url.endsWith('/auth/me'))return reply(user);
  calls.push({url,options});signal=options.signal;return new Promise(resolve=>{finish=resolve;});
 }});
 await session.start();const journal=createTradeJournal({storage:store,key:'deadline-journal'}),body={requestId:'00000000-0000-4000-8000-000000000001',expectedRevision:'fixed-revision'};
 const pending=journal.begin('/api/work-sales/drafts/99/finalize',body),request=session.work(pending.path,{method:'POST',body:pending.body});
 t.mock.timers.tick(15001);assert.equal(signal.aborted,false);assert.equal(journal.read().status,'pending');
 assert.deepEqual(JSON.parse(calls[0].options.body),body);assert.equal(calls.length,1);
 finish(reply({requestId:body.requestId,replayed:false}));const result=await request;journal.done(pending,result);
 assert.equal(journal.read().status,'done');assert.equal(calls.length,1);session.dispose();
});

test('work POST is bounded at60s and preserves the pending request for deliberate identical replay',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'deadline-fixture');store.setItem(testSessionModeKey,'manual');
 const session=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async(url,options)=>{
  if(url.endsWith('/auth/me'))return reply(user);calls.push(options);
  return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
 }});
 await session.start();const journal=createTradeJournal({storage:store,key:'deadline-journal'}),pending=journal.begin('/api/work-sales/drafts/99/finalize',{requestId:'00000000-0000-4000-8000-000000000001',expectedRevision:'fixed-revision'});
 const request=session.work(pending.path,{method:'POST',body:pending.body}),rejection=assert.rejects(request,e=>e.status===503);
 t.mock.timers.tick(59999);assert.equal(calls[0].signal.aborted,false);t.mock.timers.tick(1);await rejection;
 assert.equal(journal.read().status,'pending');assert.deepEqual(journal.read().body,pending.body);assert.equal(calls.length,1);
 assert.equal(store.getItem(workingCatalogTokenKey),'deadline-fixture');session.dispose();
});

test('GET and login retain15s and callers cannot inject a longer work deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'deadline-fixture');store.setItem(testSessionModeKey,'manual');
 const session=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async(url,options)=>{
  if(url.endsWith('/auth/me'))return reply(user);calls.push({url,options});
  return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
 }});
 await session.start();await assert.rejects(()=>session.work('/api/work-sales/context',{workMutation:true}));assert.equal(calls.length,0);
 const read=session.work('/api/work-sales/context'),readRejected=assert.rejects(read,e=>e.status===503);t.mock.timers.tick(15000);await readRejected;assert.equal(calls[0].options.signal.aborted,true);
 const login=session.login({username:'fixture',password:'fixture-only'}),loginRejected=assert.rejects(login,e=>e.status===503);t.mock.timers.tick(15000);await loginRejected;assert.equal(calls[1].options.signal.aborted,true);
 session.dispose();
});

test('only the two pinned clean operational context reads wait up to30s without retry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const place={hostname:'127.0.0.1',protocol:'http:',port:'5244'},store=storage(),calls=[];
 store.setItem(workingCatalogTokenKey,'clean-context-fixture');store.setItem(testSessionModeKey,'manual');
 const session=createWorkingCatalogSession({location:place,apiBase:'http://127.0.0.1:4194',storage:store,fetchImpl:async(url,options)=>{
  if(url.endsWith('/auth/me'))return reply(user);calls.push({url,options});
  return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
 }});
 await session.start();
 for(const [operation,path]of [['work','/api/work-sales/context'],['inbound','/api/work-receiving/context']]){
  const pending=session[operation](path),rejected=assert.rejects(pending,e=>e.status===503),count=calls.length;
  t.mock.timers.tick(15000);assert.equal(calls.at(-1).options.signal.aborted,false);
  t.mock.timers.tick(14999);assert.equal(calls.at(-1).options.signal.aborted,false);
  t.mock.timers.tick(1);await rejected;assert.equal(calls.at(-1).options.signal.aborted,true);assert.equal(calls.length,count);
 }
 for(const [operation,path]of [['api','/api/catalog/products?limit=50'],['work','/api/work-sales/selection-options']]){
  const pending=session[operation](path),rejected=assert.rejects(pending,e=>e.status===503);t.mock.timers.tick(15000);await rejected;assert.equal(calls.at(-1).options.signal.aborted,true);
 }
 const count=calls.length;await assert.rejects(session.work('/api/work-sales/context',{timeoutMs:600000}));assert.equal(calls.length,count);session.dispose();
});
test('carton metadata stays on the exact authenticated device origin and rejects cross-target routes before network',async()=>{
 const target={hostname:'127.0.0.1',protocol:'http:',port:'5234',origin:'http://127.0.0.1:5234'},store=storage(),calls=[],person={id:15,permissions:['sales.view'],role:{code:'isolated_test_sales'}};
 store.setItem(testSessionModeKey,'manual');store.setItem(workingCatalogTokenKey,'carton-fixture');
 const s=createWorkingCatalogSession({location:target,apiBase:'http://127.0.0.1:4184',storage:store,copyProfile:homeCopyProfile(),fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/me')?reply(person):url.endsWith('/receipts/99')?reply(null,403):reply([]);}});
 await s.start();await s.cartons('/api/terminal-cartons/receipts');await assert.rejects(()=>s.cartons('/api/terminal-cartons/receipts/99'),e=>e.status===403);assert.equal(store.getItem(workingCatalogTokenKey),'carton-fixture');
 assert.equal(calls[1].url,target.origin+'/api/terminal-cartons/receipts');assert.equal(calls[1].options.headers.Authorization,'Bearer carton-fixture');
 const n=calls.length;for(const path of ['/api/work-sales/invoices','/api/terminal-cartons/receipts/01','/api/terminal-cartons/receipts/1?actorId=16','/api/terminal-cartons/receipts/../1','http://192.168.1.46:5234/api/terminal-cartons/receipts'])await assert.rejects(()=>s.cartons(path));
 await assert.rejects(()=>s.cartons('/api/terminal-cartons/receipts',{method:'POST',body:{}}));await assert.rejects(()=>s.cartons('/api/terminal-cartons/receipts/1',{method:'DELETE'}));assert.equal(calls.length,n);s.dispose();
 const lanCalls=[],lan=createWorkingCatalogSession({location:{...target,hostname:'192.168.1.46',origin:'http://192.168.1.46:5234'},apiBase:'http://192.168.1.46:4184',storage:store,copyProfile:homeCopyProfile(),fetchImpl:async(url,options)=>{lanCalls.push({url,options});return url.endsWith('/auth/me')?reply(person):reply([]);}});
 await lan.start();await lan.cartons('/api/terminal-cartons/receipts');const body={requestId:'00000000-0000-4000-8000-000000000001',cartons:[]};await lan.cartons('/api/terminal-cartons/receipts/1',{method:'POST',body});
 assert.deepEqual(lanCalls.map(c=>c.url),['http://192.168.1.46:4184/api/auth/me','http://192.168.1.46:5234/api/terminal-cartons/receipts','http://192.168.1.46:5234/api/terminal-cartons/receipts/1']);
 assert.equal(lanCalls[2].options.headers.Authorization,'Bearer carton-fixture');assert.equal(lanCalls[2].options.credentials,'omit');assert.equal(lanCalls[2].options.redirect,'error');assert.deepEqual(JSON.parse(lanCalls[2].options.body),body);lan.dispose();
});
test('carton GET list and detail have a bounded30s cold-read budget with no retry; metadata POST stays15s',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const target={hostname:'127.0.0.1',protocol:'http:',port:'5234',origin:'http://127.0.0.1:5234'},store=storage(),calls=[],person={id:15,permissions:['sales.view'],role:{code:'isolated_test_sales'}};
 store.setItem(testSessionModeKey,'manual');store.setItem(workingCatalogTokenKey,'carton-fixture');
 const s=createWorkingCatalogSession({location:target,apiBase:'http://127.0.0.1:4184',storage:store,copyProfile:homeCopyProfile(),fetchImpl:async(url,options)=>{if(url.endsWith('/auth/me'))return reply(person);calls.push({url,options});return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});
 await s.start();
 for(const path of ['/api/terminal-cartons/receipts','/api/terminal-cartons/receipts/12']){const n=calls.length,read=s.cartons(path),rejected=assert.rejects(read,e=>e.status===503);t.mock.timers.tick(15000);assert.equal(calls[n].options.signal.aborted,false);t.mock.timers.tick(14999);assert.equal(calls[n].options.signal.aborted,false);t.mock.timers.tick(1);await rejected;assert.equal(calls.length,n+1);assert.equal(calls[n].options.method,'GET');}
 const n=calls.length;await assert.rejects(()=>s.cartons('/api/terminal-cartons/receipts/12',{timeoutMs:60000}));await assert.rejects(()=>s.cartons('/api/terminal-cartons/receipts/12',{coldRead:true}));assert.equal(calls.length,n);
 const body={requestId:'00000000-0000-4000-8000-000000000001',cartons:[],timeoutMs:60000,method:'GET'},write=s.cartons('/api/terminal-cartons/receipts/12',{method:'POST',body}),rejected=assert.rejects(write,e=>e.status===503);t.mock.timers.tick(14999);assert.equal(calls[n].options.signal.aborted,false);t.mock.timers.tick(1);await rejected;assert.equal(calls.length,n+1);assert.equal(calls[n].options.method,'POST');assert.deepEqual(JSON.parse(calls[n].options.body),body);assert.equal(store.getItem(workingCatalogTokenKey),'carton-fixture');s.dispose();
});
test('cartons rejects foreign LAN pairs and missing or wrong DB02 copy brands without network or session loss',async()=>{
 const target={hostname:'192.168.1.46',protocol:'http:',port:'5234',origin:'http://192.168.1.46:5234'},person={id:15,permissions:['sales.view'],role:{code:'isolated_test_sales'}};
 const fixtures=[{location:target,profile:null},{location:target,profile:{...homeCopyProfile(),copyId:'00000000-0000-4000-8000-000000000001'}},{location:target,profile:{...homeCopyProfile(),target:{...homeCopyProfile().target,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'}}},{location:{...target,port:'5224',origin:'http://192.168.1.46:5224'},profile:homeCopyProfile(),base:'http://192.168.1.46:4174'},{location:{...target,hostname:'192.168.1.47',origin:'http://192.168.1.47:5234'},profile:homeCopyProfile()},{location:{...target,origin:'http://127.0.0.1:5234'},profile:homeCopyProfile()},{location:{...target,hostname:'localhost',origin:'http://localhost:5234'},profile:homeCopyProfile()}];
 for(const f of fixtures){const store=storage(),calls=[];store.setItem(testSessionModeKey,'manual');store.setItem(workingCatalogTokenKey,'carton-fixture');const s=createWorkingCatalogSession({location:f.location,apiBase:f.base??'http://192.168.1.46:4184',copyProfile:f.profile,storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return reply(person);}});try{await s.start();}catch{}const n=calls.length;await assert.rejects(()=>s.cartons('/api/terminal-cartons/receipts'));await assert.rejects(()=>s.cartons('/api/terminal-cartons/receipts/1',{method:'POST',body:{}}));assert.equal(calls.length,n);assert.equal(store.getItem(workingCatalogTokenKey),'carton-fixture');s.dispose();}
});
test('shared LAN session cannot send its catalog reads to either prior TEST API',async()=>{
 const sharedLocation={...location,hostname:'192.168.1.46',port:'5224'},sharedBase='http://127.0.0.1:4174',calls=[];
 const session=createWorkingCatalogSession({location:sharedLocation,apiBase:sharedBase,storage:storage(),fetchImpl:async(url)=>{calls.push(url);return url.endsWith('/auth/test-admin')?reply({user,accessToken:'shared-fixture-token'}):reply({products:[]});}});
 await session.start();await session.api('/api/catalog/products?limit=50');session.dispose();
 assert.deepEqual(calls,['http://192.168.1.46:4174/api/auth/test-admin','http://192.168.1.46:4174/api/catalog/products?limit=50']);
 for(const base of [apiBase,'http://127.0.0.1:4154']){
  const blocked=createWorkingCatalogSession({location:sharedLocation,apiBase:base,storage:storage(),fetchImpl:async()=>{throw Error('Unexpected cross-target request');}});
  await assert.rejects(()=>blocked.start());blocked.dispose();
 }
});

test('isolated copy session routes only to4154 and refuses original/copy cross-pairs before network',async()=>{
 const copyLocation={...location,port:'5204'},copyBase='http://127.0.0.1:4154',calls=[];
 const session=createWorkingCatalogSession({location:copyLocation,apiBase:copyBase,storage:storage(),fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/test-admin')?reply({user,accessToken:'copy-token'}):reply({readable:true});}});
 await session.start();await session.supplierPayments('/api/work-supplier-payments/context');
 assert.deepEqual(calls.map(x=>x.url),[copyBase+'/api/auth/test-admin',copyBase+'/api/work-supplier-payments/context']);assert.equal(calls[1].options.method,'GET');session.dispose();
 for(const pair of [{location:copyLocation,apiBase},{location,apiBase:copyBase}]){const blocked=createWorkingCatalogSession({...pair,storage:storage(),fetchImpl:async()=>{throw Error('Network forbidden');}});await assert.rejects(()=>blocked.start());blocked.dispose();}
});
test('private purchase reference reaches only its exact GET with all existing financial privileges',async()=>{
 const current={...user,permissions:['product.view','purchase.view','finance.view']},calls=[],store=storage();
 const s=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/test-admin')?reply({user:current,accessToken:'private-read'}):reply({cardAmountExact:'15.03000000'});}});
 await s.start();const value=await s.api('/api/products/36724/purchase-reference',{envelope:true});assert.equal(value.data.cardAmountExact,'15.03000000');assert.equal(calls[1].options.method,'GET');assert.equal(calls[1].options.body,undefined);assert.equal(calls[1].options.headers.Authorization,'Bearer private-read');
 const n=calls.length;for(const p of['/api/products/01/purchase-reference','/api/products/36724/purchase-reference?currency=TRY','https://other/api/products/36724/purchase-reference','/api/products/36724/purchase-reference#x','/api/products/36724/purchase-reference/../write'])await assert.rejects(()=>s.api(p));for(const options of[{method:'POST'},{body:{}},{method:'DELETE'}])await assert.rejects(()=>s.api('/api/products/36724/purchase-reference',options));assert.equal(calls.length,n);s.dispose();
 const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user:{...user,permissions:['product.view','purchase.view']},accessToken:'seller'}):reply({}));await f.session.start();await assert.rejects(()=>f.session.api('/api/products/36724/purchase-reference'));assert.equal(f.calls.length,1);f.session.dispose();
});
function fixture(fetchImpl){const store=storage(),calls=[];const session=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return fetchImpl(url,options);}});return {session,store,calls};}
test('reports and system use exact authenticated GET; rejected finance reports do not revoke personnel identity',async()=>{
 const {session,calls,store}=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'report-read'}):url.includes('/work-reports?')?reply(null,403):reply({readable:true}));
 await session.start();assert.equal((await session.reports('/api/work-reports/context')).readable,true);assert.equal((await session.reports('/api/work-reports/export?kind=sales&period=today')).readable,true);assert.equal((await session.system('/api/work-system/summary')).readable,true);
 await assert.rejects(()=>session.reports('/api/work-reports?kind=purchases'),e=>e.status===403);assert.equal(store.getItem(workingCatalogTokenKey),'report-read');
 for(const path of ['/api/settings','https://other/api/work-reports','/api/work-reports/../settings','/api/work-reports/context#bad','/api/work-reports/apply'])await assert.rejects(()=>session.reports(path));
 await assert.rejects(()=>session.reports('/api/work-reports/context',{method:'POST'}));await assert.rejects(()=>session.system('/api/work-system/summary?write=1'));
 assert.ok(calls.slice(1).every(c=>c.options.method==='GET'&&c.options.body===undefined&&c.options.headers.Authorization==='Bearer report-read'));session.dispose();
});
test('supplier payment transport rejects path escapes and preserves a denied personnel session',async()=>{
 let expired=0;const store=storage(),calls=[];
 const session=createWorkingCatalogSession({location,apiBase,storage:store,onExpired:()=>expired++,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/test-admin')?reply({user,accessToken:'scoped'}):url.endsWith('/work-supplier-payments/context')?reply(null,403):reply({readable:true});}});
 await session.start();await assert.rejects(()=>session.supplierPayments('/api/work-supplier-payments/context'),e=>e.status===403);
 assert.equal(expired,0);assert.equal(store.getItem(workingCatalogTokenKey),'scoped');
 await session.inbound('/api/work-receiving/home');
 await session.supplierPayments('/api/work-supplier-payments/payments/12/cancel',{method:'POST',body:{reason:'Yanlış işlem'}});
 assert.equal(calls.at(-1).options.method,'POST');
 const before=calls.length;
 for(const [path,options] of [['/api/work-supplier-payments/context',{method:'POST',body:{}}],['/api/work-supplier-payments/payments/01/cancel',{method:'POST',body:{}}],['/api/work-supplier-payments/payments/12/cancel?other=1',{method:'POST',body:{}}],['/api/supplier-payments',{method:'POST',body:{}}],['https://other/api/work-supplier-payments/context',{}],['/api/work-supplier-payments/context',{method:'DELETE'}]])await assert.rejects(()=>session.supplierPayments(path,options));
 assert.equal(calls.length,before);session.dispose();
});
test('payment failures expose only known user states, never raw server details',async()=>{
 for(const code of ['WORK_PAYMENT_DEBT','WORK_PAYMENT_FUNDS','WORK_PAYMENT_RATE','WORK_PAYMENT_STALE','WORK_PAYMENT_REQUEST_CONFLICT','RAW_SQL_INTERNAL']){
  const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'payment-role'}):{ok:false,status:409,json:async()=>({success:false,error:{code,message:'RAW SQL INTERNAL'}})});
  await f.session.start();await assert.rejects(()=>f.session.supplierPayments('/api/work-supplier-payments/preview',{method:'POST',body:{}}),e=>e.status===409&&!e.message.includes('SQL')&&e.code===(code==='RAW_SQL_INTERNAL'?undefined:code));f.session.dispose();
 }
});
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
test('cached startup disposed before late 200 or 401 never erases a newer manual session across instances',async()=>{
 for(const status of [200,401]){
 const store=storage();store.setItem(workingCatalogTokenKey,'previous');store.setItem(testSessionModeKey,'manual');let finish,expired=0;
 const old=createWorkingCatalogSession({location,apiBase,storage:store,onExpired:()=>expired++,fetchImpl:()=>new Promise(resolve=>finish=resolve)});
 const started=old.start();old.dispose();const next=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async url=>url.endsWith('/auth/login')?reply({user:{...user,id:15},accessToken:'replacement'}):reply({safe:true})});
 await next.login({username:'seller',password:'fixture-secret'});finish(reply(user,status));await assert.rejects(started);assert.equal(store.getItem(workingCatalogTokenKey),'replacement');assert.equal(store.getItem(testSessionModeKey),'manual');assert.equal(expired,0);assert.deepEqual(await next.inbound('/api/work-receiving/context'),{safe:true});next.dispose();
 }
});
test('late cached auth failure in still active older instance cannot clear a replacement login',async()=>{
 const store=storage();store.setItem(workingCatalogTokenKey,'previous');store.setItem(testSessionModeKey,'manual');let finish;
 const old=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:()=>new Promise(resolve=>finish=resolve)}),started=old.start();
 const next=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async()=>reply({user:{...user,id:15},accessToken:'replacement'})});await next.login({username:'seller',password:'fixture-secret'});finish(reply(null,401));await assert.rejects(started);assert.equal(store.getItem(workingCatalogTokenKey),'replacement');await assert.rejects(()=>old.home());old.dispose();next.dispose();
});
test('active cached auth transient 503, network failure or timeout preserves token and manual choice without granting reads or bootstrap',async()=>{
 for(const cause of ['503','network','timeout']){
 const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'cached');store.setItem(testSessionModeKey,'manual');let transient=true;
 const session=createWorkingCatalogSession({location,apiBase,storage:store,timeoutMs:2,fetchImpl:async(url)=>{calls.push(url);if(transient){if(cause==='503')return reply(null,503);if(cause==='network')throw Error('private transport');await new Promise(resolve=>setTimeout(resolve,8));}return reply({...user,id:15});}});
 await assert.rejects(()=>session.start(),e=>e.status===503&&/Yenileyerek/.test(e.message)&&!e.message.includes('private'));assert.equal(store.getItem(workingCatalogTokenKey),'cached');assert.equal(store.getItem(testSessionModeKey),'manual');await assert.rejects(()=>session.home());assert.ok(calls.every(url=>url.endsWith('/auth/me')));transient=false;assert.equal((await session.start()).id,15);assert.equal(calls.length,2);session.dispose();
 }
});
test('current cached auth 401 and 403 still expire without allowing reads in manual mode',async()=>{
 for(const status of [401,403]){const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'invalid');store.setItem(testSessionModeKey,'manual');const session=createWorkingCatalogSession({location,apiBase,storage:store,fetchImpl:async url=>{calls.push(url);return reply(null,status);}});assert.equal(await session.start(),null);assert.equal(store.getItem(workingCatalogTokenKey),null);assert.equal(store.getItem(testSessionModeKey),'manual');await assert.rejects(()=>session.inbound('/api/work-receiving/context'));assert.deepEqual(calls,[apiBase+'/api/auth/me']);session.dispose();}
});
test('remote, LIVE, wrong API target cannot bootstrap or login; no source fallback',async()=>{
 for(const settings of [{location:{...location,port:'5188'}},{location:{...location,hostname:'192.168.1.2'}},{apiBase:'http://127.0.0.1:4114'}]){let calls=0;const s=createWorkingCatalogSession({location,apiBase,storage:storage(),fetchImpl:async()=>{calls++;},...settings});await assert.rejects(()=>s.start());await assert.rejects(()=>s.login({username:'admin',password:'secret'}));assert.equal(calls,0);}
});
test('approved LAN explicit manual selection skips bootstrap then uses normal login and authenticated LAN home/catalog/photo',async()=>{
 const calls=[],store=storage(),lan={...location,hostname:'192.168.1.46'},regular={id:15,displayName:'İlker',role:{code:'accountant'},permissions:['product.view','goods.view']};
 const session=createWorkingCatalogSession({location:lan,apiBase,storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/login')?reply({user:regular,accessToken:'lan-user'}):url.includes('/photo?')?imageReply():reply({readOnly:true});}});
 store.setItem(testSessionModeKey,'manual');assert.equal(await session.start(),null);assert.equal(calls.length,0);assert.equal((await session.login({username:'ilker',password:'secret'})).id,15);await session.home();await session.api('/api/catalog/products');await session.media('/api/catalog/products/12/photo?variant=thumbnail');
 assert.equal(store.getItem(testSessionModeKey),'manual');assert.ok(calls.every(c=>c.url.startsWith('http://192.168.1.46:4144/')));assert.ok(calls.every(c=>!c.url.includes('/test-admin')));assert.equal(calls[0].options.method,'POST');assert.ok(calls.slice(1).every(c=>c.options.method==='GET'&&c.options.headers.Authorization==='Bearer lan-user'));session.dispose();
 const persisted=createWorkingCatalogSession({location:lan,apiBase,storage:store,fetchImpl:async(url)=>{assert.equal(url,'http://192.168.1.46:4144/api/auth/me');return reply(regular);}});assert.equal((await persisted.start()).id,15);persisted.dispose();
});
test('LAN login blocks foreign hosts, wrong web/API ports and alternate protocols before network',async()=>{
 for(const settings of [{location:{...location,hostname:'192.168.1.47'}},{location:{...location,hostname:'192.168.1.46',port:'5195'}},{location:{...location,hostname:'192.168.1.46',protocol:'https:'}},{location:{...location,hostname:'192.168.1.46'},apiBase:'http://192.168.1.46:4114'}]){let count=0;const session=createWorkingCatalogSession({location,apiBase,storage:storage(),fetchImpl:async()=>{count++;},...settings});await assert.rejects(()=>session.start());await assert.rejects(()=>session.login({username:'ilker',password:'secret'}));assert.equal(count,0);session.dispose();}
});
test('fresh approved LAN bootstraps once and reload verifies the same stored session',async()=>{
 const calls=[],store=storage(),lan={...location,hostname:'192.168.1.46'};const create=()=>createWorkingCatalogSession({location:lan,apiBase,storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/test-admin')?reply({user,accessToken:'lan-admin'}):url.endsWith('/auth/me')?reply(user):reply({rows:[]});}});
 const first=create();assert.equal((await first.start()).id,user.id);assert.equal(calls[0].url,'http://192.168.1.46:4144/api/auth/test-admin');assert.equal(calls[0].options.method,'POST');assert.deepEqual(JSON.parse(calls[0].options.body),{});assert.equal(store.getItem(workingCatalogTokenKey),'lan-admin');await first.home();assert.equal(calls[1].options.headers.Authorization,'Bearer lan-admin');first.dispose();
 const reload=create();assert.equal((await reload.start()).id,user.id);assert.equal(calls[2].url,'http://192.168.1.46:4144/api/auth/me');assert.equal(calls[2].options.headers.Authorization,'Bearer lan-admin');assert.equal(calls.filter(c=>c.url.endsWith('/auth/test-admin')).length,1);reload.dispose();
});
test('manual normal login stores token/mode only, not password; malformed auth rejects',async()=>{
 const f=fixture(async()=>reply({user,accessToken:'manual'}));await f.session.login({username:'ilker',password:'secret'});assert.equal(f.store.getItem(testSessionModeKey),'manual');assert.equal(f.store.getItem(workingCatalogTokenKey),'manual');assert.equal(f.store.getItem('password'),null);assert.equal(f.calls[0].url,apiBase+'/api/auth/login');
 const bad=fixture(async()=>reply({user:{...user,permissions:'admin'},accessToken:'bad'}));await assert.rejects(()=>bad.session.start());assert.equal(bad.store.getItem(workingCatalogTokenKey),null);
});
test('revoked auth clears token and invokes expiration; raw server errors never reach screen',async()=>{
 let count=0,expired=0;const store=storage(),s=createWorkingCatalogSession({location,apiBase,storage:store,onExpired:()=>expired++,fetchImpl:async()=>count++===0?reply({user,accessToken:'x'}):reply(null,401)});await s.start();await assert.rejects(()=>s.api('/api/catalog/products'),e=>e.status===401&&!e.message.includes('SQL'));assert.equal(store.getItem(workingCatalogTokenKey),null);assert.equal(expired,1);await assert.rejects(()=>s.api('/api/catalog/products'));
});

test('a normal permission refusal cannot log out the user or block the next permitted screen',async()=>{
 let expired=0;const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'normal-session');store.setItem(testSessionModeKey,'manual');
 const s=createWorkingCatalogSession({location,apiBase,storage:store,onExpired:()=>expired++,fetchImpl:async(url)=>{calls.push(url);return url.endsWith('/auth/me')?reply(user):url.endsWith('/work-sales/context')?reply(null,403):reply({items:[]});}});
 await s.start();await assert.rejects(()=>s.work('/api/work-sales/context'),e=>e.status===403);assert.equal(store.getItem(workingCatalogTokenKey),'normal-session');assert.equal(expired,0);
 assert.deepEqual(await s.api('/api/catalog/products'),{items:[]});assert.equal(calls.filter(x=>x.includes('/auth/')).length,1);s.dispose();
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
test('normal work transport preserves mutation replay and limits writes to exact new routes',async()=>{
 const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'work-token'}):reply({invoice:{id:'42'},replayed:true}));await f.session.start();const body={requestId:'00000000-0000-4000-8000-000000000001'};const r=await f.session.work('/api/work-sales/drafts',{method:'POST',body});assert.equal(r.replayed,true);assert.deepEqual(JSON.parse(f.calls[1].options.body),body);assert.equal(f.calls[1].options.headers.Authorization,'Bearer work-token');await f.session.work('/api/work-sales/invoices/42');await f.session.work('/api/work-collections/context?invoiceId=42');await f.session.customers('/api/customer-cards?search=000012&page=1&limit=25',{envelope:true});await f.session.customers('/api/customers/501/card');const count=f.calls.length;
 for(const [path,options] of [['/api/catalog/products/12',{method:'POST',body}],['/api/finance/collections',{method:'POST',body}],['https://other/api/work-sales/drafts',{method:'POST',body}],['/api/work-sales/drafts?other=1',{method:'POST',body}],['/api/work-sales/context',{method:'POST',body}],['/api/work-sales/drafts',{method:'DELETE',body}],['/api/work-collections/context?invoiceId=42&token=x',{}]])await assert.rejects(()=>f.session.work(path,options));await assert.rejects(()=>f.session.customers('/api/customers/501/card',{method:'POST'}));assert.equal(f.calls.length,count);f.session.dispose();
});
test('inbound transport preserves count and supplier-return replay while confining read/write paths',async()=>{
 const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'inbound-token'}):reply({draft:{id:'12'},replayed:true}));
 await f.session.start();const body={requestId:'00000000-0000-4000-8000-000000000001',expectedRevision:'a'.repeat(64),lines:[{productId:null,barcode:'000007',physicalQuantityExact3:'1.000'}]};
 assert.equal((await f.session.inbound('/api/work-receiving/count-drafts/12/update',{method:'POST',body})).replayed,true);
 assert.deepEqual(JSON.parse(f.calls[1].options.body),body);assert.equal(f.calls[1].options.headers.Authorization,'Bearer inbound-token');
 const countBody={requestId:'00000000-0000-4000-8000-000000000002',lines:[{productId:'301985',stockCode:'TEST-V70-GOODS-P',physical:2,system:3,reason:'Raf eksiği',movementFingerprint:'b'.repeat(64)}],unknownScans:[]};
 await f.session.inbound('/api/test-daily/count');assert.equal((await f.session.inbound('/api/test-daily/count/draft',{method:'POST',body:countBody})).replayed,true);assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),countBody);
 const returnBody={requestId:'00000000-0000-4000-8000-000000000004',sourceInvoiceId:139,sourceItemId:701,quantity:1,date:'2026-10-06',reason:'Ürün fiziksel olarak geri gönderildi'};
 await f.session.inbound('/api/test-daily/purchase');assert.equal((await f.session.inbound('/api/test-daily/purchase/draft',{method:'POST',body:returnBody})).replayed,true);assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),returnBody);
 for(const suffix of ['approve','reject','cancel'])await f.session.inbound('/api/test-daily/purchase/'+suffix,{method:'POST',body:{requestId:'00000000-0000-4000-8000-000000000005',id:12,reason:'Kontrol edildi',date:'2026-10-06'}});
 for(const suffix of ['approve','reject','cancel'])await f.session.inbound('/api/test-daily/count/'+suffix,{method:'POST',body:{requestId:'00000000-0000-4000-8000-000000000003',id:12,reason:'Kontrol edildi',date:'2026-10-06'}});
 for(const path of ['/api/work-receiving/context','/api/work-receiving/count-drafts/12','/api/work-receiving/requests/00000000-0000-4000-8000-000000000001','/api/work-purchases/context','/api/work-purchases/drafts/12','/api/work-suppliers/history'])await f.session.inbound(path);
 const count=f.calls.length;
 for(const [path,options] of [['/api/work-receiving/context',{method:'POST',body}],['/api/work-receiving/count-drafts/01/update',{method:'POST',body}],['/api/work-receiving/count-drafts/12/update?token=x',{method:'POST',body}],['/api/work-suppliers/context',{method:'POST',body}],['/api/work-receiving/count-drafts/12',{method:'DELETE',body}],['/api/test-daily/count/prepare',{method:'POST',body}],['/api/test-daily/purchase/prepare',{method:'POST',body}],['/api/test-daily/purchase/prepare-partial-goods',{method:'POST',body}],['/api/test-daily/purchase/approve/12',{method:'POST',body}],['/api/test-daily/purchase/draft?token=x',{method:'POST',body}],['/api/test-daily/sales/prepare',{method:'POST',body}],['/api/test-daily/sales/prepare-partial-goods',{method:'POST',body}],['/api/test-daily/sales/draft?token=x',{method:'POST',body}],['/api/test-daily/sales/approve/12',{method:'POST',body}],['/api/test-daily/count-cancel/sale',{method:'POST',body}],['/api/test-purchase/batches',{method:'POST',body}],['/api/work-purchases/drafts/12/finalize/extra',{method:'POST',body}],['/api/work-receiving/context?token=x',{}]])await assert.rejects(()=>f.session.inbound(path,options));
 assert.equal(f.calls.length,count);f.session.dispose();await assert.rejects(()=>f.session.inbound('/api/work-receiving/context'));
});
test('normal FX transport confines the current-price lifecycle and preserves its full replay body',async()=>{
 const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'fx-token'}):reply({safe:true}));await f.session.start();
 const body={requestId:'00000000-0000-4000-8000-000000000001',currency:'USD',quantityExact:'1',priceRevision:'a'.repeat(64)};
 for(const suffix of ['context','drafts/12'])await f.session.inbound('/api/work-purchases/fx/'+suffix);
 for(const suffix of ['preview','receipts','receipts/12/approve','receipts/12/reject','drafts','drafts/12/finalize','drafts/12/cancel']){await f.session.inbound('/api/work-purchases/fx/'+suffix,{method:'POST',body});assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),body);}
 const count=f.calls.length;
 for(const [suffix,method] of [['context','POST'],['rates','GET'],['prices','POST'],['receipts/01/approve','POST'],['drafts/12/finalize/extra','POST'],['context?token=x','GET'],['drafts/12','DELETE']])await assert.rejects(()=>f.session.inbound('/api/work-purchases/fx/'+suffix,{method,body}));
 assert.equal(f.calls.length,count);f.session.dispose();
});
test('denied inbound finance keeps the personnel session while 401 still expires; supplier cards stay read-only',async()=>{
 let expired=0;const calls=[],store=storage();const s=createWorkingCatalogSession({location,apiBase,storage:store,onExpired:()=>expired++,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/test-admin')?reply({user,accessToken:'personnel'}):url.endsWith('/work-purchases/context')?reply(null,403):reply({safe:true});}});
 await s.start();await assert.rejects(()=>s.inbound('/api/work-purchases/context'),e=>e.status===403);assert.equal(expired,0);assert.equal(store.getItem(workingCatalogTokenKey),'personnel');assert.deepEqual(await s.inbound('/api/work-receiving/home'),{safe:true});await s.suppliers('/api/supplier-cards?search=demo&page=1&limit=25',{envelope:true});await s.suppliers('/api/suppliers/13370/card');const count=calls.length;
 await assert.rejects(()=>s.suppliers('/api/suppliers/13370/card',{method:'POST'}));await assert.rejects(()=>s.suppliers('/api/suppliers/13370/contact'));assert.equal(calls.length,count);s.dispose();
 const lost=createWorkingCatalogSession({location,apiBase,storage:storage(),onExpired:()=>expired++,fetchImpl:async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'x'}):reply(null,401)});await lost.start();await assert.rejects(()=>lost.inbound('/api/work-receiving/home'),e=>e.status===401);assert.equal(expired,1);lost.dispose();
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
test('normal sale cancellation preserves only its known collection dependency code without server messages',async()=>{
 for(const entry of [{path:'/api/work-sales/drafts/42/cancel',status:409,code:'WORK_COLLECTIONS_ACTIVE',expected:'WORK_COLLECTIONS_ACTIVE'},{path:'/api/work-sales/drafts/42/cancel',status:409,code:'SQL_PRIVATE',expected:undefined},{path:'/api/work-sales/drafts/42/cancel',status:400,code:'WORK_COLLECTIONS_ACTIVE',expected:undefined},{path:'/api/work-collections/77/cancel',status:409,code:'WORK_COLLECTIONS_ACTIVE',expected:undefined},{path:'/api/catalog/products',status:409,code:'WORK_COLLECTIONS_ACTIVE',expected:undefined}]){
 const f=fixture(async url=>url.endsWith('/auth/test-admin')?reply({user,accessToken:'token'}):{ok:false,status:entry.status,json:async()=>({success:false,error:{code:entry.code,message:'RAW SQL native internal'}})});await f.session.start();const call=entry.path.startsWith('/api/catalog')?()=>f.session.api(entry.path):()=>f.session.work(entry.path,{method:'POST',body:{requestId:'00000000-0000-4000-8000-000000000001'}});await assert.rejects(call,e=>{assert.equal(e.status,entry.status);assert.equal(e.code,entry.expected);assert.doesNotMatch(e.message,/RAW SQL|SQL_PRIVATE|native internal/);return true;});f.session.dispose();}
});

const homeBootstrap={path:'/api/terminal-worktest/home-summary',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82'};
const worktestLocation=port=>({hostname:'127.0.0.1',protocol:'http:',port,origin:`http://127.0.0.1:${port}`});
function homeCopyProfile(){return {schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:'ISOLATED_TEST_COPY',copyId:homeBootstrap.copyId,sealHash:'A'.repeat(64),backupSHA:'B'.repeat(64),sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},date:'2026-10-09',scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'C'.repeat(64),businessInvoiceMaxExact4:'20000.0000',actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:[{id:'301',supplierId:'601',sourceKey:'VEGA2026/F0102TBLSTOKLAR/301',stockCode:'FIXTURE-301',unit:'ADET',unitFactorExact8:'1.00000000',priceIds:['801'],barcodes:['000301']}],customers:[{id:'501',partyId:'901',accountId:'1001',currency:'TRY',sourceKey:'VEGA2026/F0102TBLCARI/501'}],suppliers:[{id:'601',partyId:'902',accountId:'1002',currency:'TRY',sourceKey:'VEGA2026/F0103TBLCARI/601'}],financeAccounts:[{id:'701',currency:'TRY'}]};}

test('selected-source collection transport is constructor gated to the DB02 business copy and actor 16',async()=>{
 const target=worktestLocation('5234'),base='http://127.0.0.1:4184',path='/api/work-collections/selected-source/context?invoiceId=42';
 const person={...user,role:{code:'isolated_test_ilker'},permissions:['finance.view','customer.view','finance.collection','finance.collection.cancel']};
 const make=({enabled=false,location=target,apiBase=base,profile=homeCopyProfile(),actor=person,respond=()=>reply({safe:true})}={})=>{
  const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'selected-fixture');store.setItem(testSessionModeKey,'manual');
  const session=createWorkingCatalogSession({location,apiBase,copyProfile:profile,selectedSourceCollections:enabled,storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/me')?reply(actor):respond(url,options);}});
  return {session,calls,store};
 };
 for(const variant of [{},{enabled:true,location:worktestLocation('5224'),apiBase:'http://127.0.0.1:4174'},{enabled:true,apiBase:'http://192.168.1.46:4184'},{enabled:true,profile:{...homeCopyProfile(),target:{...homeCopyProfile().target,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'}}},{enabled:true,actor:{...person,id:15}},{enabled:true,actor:{...person,role:{code:'admin'}}},{enabled:true,actor:{...person,permissions:['finance.view','customer.view']}}]){
  const f=make(variant);try{await f.session.start();}catch{}const count=f.calls.length;await assert.rejects(()=>f.session.work(path),e=>e.status===403);assert.equal(f.calls.length,count);f.session.dispose();
 }
 const f=make({enabled:true});await f.session.start();const body={requestId:'00000000-0000-4000-8000-000000000001'};
 for(const [route,options] of [[path,{}],['/api/work-collections/selected-source/preview',{method:'POST',body}],['/api/work-collections/selected-source',{method:'POST',body}],['/api/work-collections/selected-source/77/cancel',{method:'POST',body}]]){
  assert.deepEqual(await f.session.work(route,options),{safe:true});assert.equal(f.calls.at(-1).url,base+route);assert.equal(f.calls.at(-1).options.headers.Authorization,'Bearer selected-fixture');
 }
 const count=f.calls.length;
 for(const [route,options] of [['/api/work-collections/selected-source/context?invoiceId=042',{}],['/api/work-collections/selected-source/context?invoiceId=42&x=1',{}],['/api/work-collections/selected-source/preview?x=1',{method:'POST',body}],['/api/work-collections/selected-source/77/cancel/extra',{method:'POST',body}],['/api/work-collections/selected-source/0/cancel',{method:'POST',body}],['/api/work-collections/selected-source/preview',{method:'GET'}],['/api/work-collections/selected-source/preview',{method:'POST'}],['/api/work-collections/selected-source/preview',{method:'POST',body:[]}],['/api/work-collections/selected-source/preview',{method:'POST',body,headers:{x:'override'}}],[path,{body}],['https://other/api/work-collections/selected-source/preview',{method:'POST',body}]])await assert.rejects(()=>f.session.work(route,options));
 assert.equal(f.calls.length,count);f.session.dispose();
 const withoutCancel=make({enabled:true,actor:{...person,permissions:person.permissions.filter(p=>p!=='finance.collection.cancel')}});await withoutCancel.session.start();const before=withoutCancel.calls.length;await assert.rejects(()=>withoutCancel.session.work('/api/work-collections/selected-source/77/cancel',{method:'POST',body}),e=>e.status===403);assert.equal(withoutCancel.calls.length,before);withoutCancel.session.dispose();
 const forbidden=make({enabled:true,respond:()=>reply(null,403)});await forbidden.session.start();await assert.rejects(()=>forbidden.session.work(path),e=>e.status===403);assert.equal(forbidden.store.getItem(workingCatalogTokenKey),'selected-fixture');forbidden.session.dispose();
});

test('normal price editor uses only exact DB02 routes, preserves denial and sends unchanged UUID/body',async()=>{
 for(const host of ['127.0.0.1','192.168.1.46']){
  const target={hostname:host,protocol:'http:',port:'5234',origin:`http://${host}:5234`},store=storage(),calls=[];
  store.setItem(workingCatalogTokenKey,'price-fixture');store.setItem(testSessionModeKey,'manual');
  const person={...user,role:{code:'isolated_test_ilker'},permissions:['product.view','purchase.view','product.price.edit']};
  const s=createWorkingCatalogSession({location:target,apiBase:`http://${host}:4184`,copyProfile:homeCopyProfile(),storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/me')?reply(person):url.includes('/302/')?reply(null,403):reply({verified:true});}});
  await s.start();assert.deepEqual(await s.api('/api/products/301/current-prices'),{verified:true});
  const body={requestId:'00000000-0000-4000-8000-000000000001',priceExact:'1.25000000',reason:'Fixture price'};
  await s.api('/api/products/301/current-prices',{method:'POST',body});assert.deepEqual(JSON.parse(calls.at(-1).options.body),body);assert.equal(calls.at(-1).url,`http://${host}:4184/api/products/301/current-prices`);assert.equal(calls.at(-1).options.headers.Authorization,'Bearer price-fixture');
  await assert.rejects(()=>s.api('/api/products/302/current-prices'),e=>e.status===403);assert.equal(store.getItem(workingCatalogTokenKey),'price-fixture');
  const count=calls.length;
  for(const path of ['/api/products/0301/current-prices','/api/products/301/current-prices?actor=16','/api/products/301/current-prices#x','/api/products/301/current-prices/../write','https://other/api/products/301/current-prices'])await assert.rejects(()=>s.api(path));
  for(const options of [{method:'DELETE'},{body:{}},{method:'POST'},{method:'POST',body:[]},{method:'POST',body,workMutation:true},{method:'POST',body,timeoutMs:90000}])await assert.rejects(()=>s.api('/api/products/301/current-prices',options));
  await assert.rejects(()=>s.api('/api/catalog/products',{method:'POST',body}));assert.equal(calls.length,count);s.dispose();
 }
});

test('price transport rejects original TEST, missing copy and missing permissions before network',async()=>{
 const target={hostname:'127.0.0.1',protocol:'http:',port:'5234',origin:'http://127.0.0.1:5234'};
 for(const f of [{location,apiBase,profile:homeCopyProfile(),permissions:['product.view','purchase.view','product.price.edit']},{location:target,apiBase:'http://127.0.0.1:4184',profile:null,permissions:['product.view','purchase.view','product.price.edit']},{location:target,apiBase:'http://127.0.0.1:4184',profile:homeCopyProfile(),permissions:['product.view']}]){
  const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'price-fixture');store.setItem(testSessionModeKey,'manual');
  const s=createWorkingCatalogSession({location:f.location,apiBase:f.apiBase,copyProfile:f.profile,storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return reply({...user,permissions:f.permissions});}});await s.start();const n=calls.length;
  await assert.rejects(()=>s.api('/api/products/301/current-prices'));await assert.rejects(()=>s.api('/api/products/301/current-prices',{method:'POST',body:{}}));assert.equal(calls.length,n);s.dispose();
 }
 const store=storage(),calls=[];store.setItem(workingCatalogTokenKey,'readonly-price');store.setItem(testSessionModeKey,'manual');
 const s=createWorkingCatalogSession({location:target,apiBase:'http://127.0.0.1:4184',copyProfile:homeCopyProfile(),storage:store,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/me')?reply({...user,permissions:['product.view','purchase.view']}):reply({canEdit:false});}});
 await s.start();assert.equal((await s.api('/api/products/301/current-prices')).canEdit,false);const n=calls.length;await assert.rejects(()=>s.api('/api/products/301/current-prices',{method:'POST',body:{}}));assert.equal(calls.length,n);s.dispose();
});
function worktestHomeSession({target=worktestLocation('5234'),bootstrap=homeBootstrap,profile=homeCopyProfile(),base='http://127.0.0.1:4184',respond=async()=>reply({meta:{readOnly:true}}),onExpired=()=>{}}={}){
 const store=storage(),calls=[];store.setItem(testSessionModeKey,'manual');store.setItem(workingCatalogTokenKey,'worktest-home-fixture');
 const session=createWorkingCatalogSession({location:target,apiBase:base,storage:store,copyProfile:profile,homeBootstrap:bootstrap,onExpired,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/me')?reply(user):respond(url,options);}});
 return {session,store,calls};
}
test('exact DB02 HOME bootstrap selects only same-origin authenticated GET on USB or approved persistent LAN device',async()=>{
 for(const host of ['127.0.0.1','192.168.1.46']){
  const target={...worktestLocation('5234'),hostname:host,origin:`http://${host}:5234`},f=worktestHomeSession({target});await f.session.start();assert.deepEqual(await f.session.home(),{meta:{readOnly:true}});
  assert.equal(f.calls[0].url,`http://${host}:4184/api/auth/me`);assert.equal(f.calls[1].url,`http://${host}:5234/api/terminal-worktest/home-summary`);
  const opts=f.calls[1].options;assert.equal(opts.method,'GET');assert.equal(opts.body,undefined);assert.equal(opts.headers.Authorization,'Bearer worktest-home-fixture');assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
  await f.session.api('/api/catalog/products?limit=50');await f.session.work('/api/work-sales/context');const body={requestId:'00000000-0000-4000-8000-000000000001'};await f.session.work('/api/work-sales/drafts',{method:'POST',body});
  assert(f.calls.slice(2).every(c=>c.url.startsWith(`http://${host}:4184/`)));assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),body);
  const count=f.calls.length;await assert.rejects(()=>f.session.home({method:'POST'}));await assert.rejects(()=>f.session.api(homeBootstrap.path));await assert.rejects(()=>f.session.work(homeBootstrap.path,{method:'POST',body}));assert.equal(f.calls.length,count);f.session.dispose();
 }
});
test('malformed HOME bootstrap and every foreign origin retain legacy route or closed target',async()=>{
 for(const bootstrap of [null,{},[],{...homeBootstrap,copyId:'00000000-0000-4000-8000-000000000001'},{...homeBootstrap,path:'https://other/home'},{...homeBootstrap,path:homeBootstrap.path+'?actorId=16'},{...homeBootstrap,apiBase:'http://other'}]){
  const legacy=worktestHomeSession({bootstrap});await legacy.session.start();await legacy.session.home();assert.equal(legacy.calls[1].url,'http://127.0.0.1:4184/api/home/summary');legacy.session.dispose();
  const desktop=worktestHomeSession({target:worktestLocation('5264'),bootstrap});await assert.rejects(()=>desktop.session.start());assert.equal(desktop.calls.length,0);desktop.session.dispose();
 }
 for(const target of [{...worktestLocation('5234'),hostname:'192.168.1.46',origin:'http://192.168.1.46:5234'},{...location,origin:'http://127.0.0.1:5194'}]){
  const base=target.port==='5194'?apiBase:'http://127.0.0.1:4184',expected=target.port==='5194'?apiBase+'/api/home/summary':'http://192.168.1.46:5234'+homeBootstrap.path;const f=worktestHomeSession({target,base});await f.session.start();await f.session.home();assert.equal(f.calls[1].url,expected);assert.equal(f.calls[1].options.method,'GET');assert.equal(f.calls[1].options.body,undefined);f.session.dispose();
 }
 for(const target of [{...worktestLocation('5264'),protocol:'https:',origin:'https://127.0.0.1:5264'},{...worktestLocation('5264'),hostname:'other',origin:'http://other:5264'},{...worktestLocation('5264'),origin:'http://other:5264'},{...worktestLocation('5264'),port:'5265',origin:'http://127.0.0.1:5265'},{...worktestLocation('5264'),hostname:'localhost',origin:'http://localhost:5264'}]){
  const f=worktestHomeSession({target});await assert.rejects(()=>f.session.start());assert.equal(f.calls.length,0);f.session.dispose();
 }
 const wrongApi=worktestHomeSession({target:worktestLocation('5264'),base:apiBase});await assert.rejects(()=>wrongApi.session.start());assert.equal(wrongApi.calls.length,0);wrongApi.session.dispose();
});
test('temporary desktop bootstrap cannot normalize an invalid target or make any auth or HOME request',async()=>{
 const cached=worktestHomeSession({target:worktestLocation('5264')});await assert.rejects(()=>cached.session.start());await assert.rejects(()=>cached.session.home());assert.equal(cached.calls.length,0);assert.equal(cached.store.getItem(workingCatalogTokenKey),'worktest-home-fixture');cached.session.dispose();
 const store=storage(),calls=[],session=createWorkingCatalogSession({location:worktestLocation('5264'),apiBase:'http://127.0.0.1:4184',storage:store,copyProfile:homeCopyProfile(),homeBootstrap,fetchImpl:async(url,options)=>{calls.push({url,options});return reply({user,accessToken:'normal-home-fixture'});}});
 await assert.rejects(()=>session.start());await assert.rejects(()=>session.login({username:'fixture',password:'fixture-only'}));await assert.rejects(()=>session.home());assert.equal(calls.length,0);session.dispose();
});
test('scoped HOME keeps15s deadline, auth-expiry and disposal without retry or new session',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=worktestHomeSession({respond:async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))});await f.session.start();const request=f.session.home(),rejection=assert.rejects(request,e=>e.status===503);t.mock.timers.tick(15000);await rejection;assert.equal(f.calls.length,2);assert.equal(f.store.getItem(workingCatalogTokenKey),'worktest-home-fixture');f.session.dispose();
 for(const status of [401,403]){let expired=0;const lost=worktestHomeSession({respond:async()=>reply(null,status),onExpired:()=>expired++});await lost.session.start();await assert.rejects(()=>lost.session.home(),e=>e.status===status&&!e.message.includes('SQL'));assert.equal(lost.store.getItem(workingCatalogTokenKey),status===401?null:'worktest-home-fixture');assert.equal(expired,status===401?1:0);lost.session.dispose();}
 let finish;const late=worktestHomeSession({respond:async()=>new Promise(resolve=>finish=resolve)});await late.session.start();const pending=late.session.home();late.session.dispose();assert.equal(late.calls.at(-1).options.signal.aborted,true);finish(reply({meta:{readOnly:true}}));await assert.rejects(()=>pending);assert.equal(late.calls.length,2);
});

test('HOME flag cannot override a missing, different-copy or malformed DB02 operation profile',async()=>{
 for(const mutate of [()=>null,p=>({...p,copyId:'00000000-0000-4000-8000-000000000001'}),p=>({...p,target:{...p.target,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'}}),p=>({...p,actors:[{id:'15',role:'admin'}]}),p=>({...p,products:p.products.map(x=>({...x,unit:'KOLI'}))}),p=>({...p,businessDaily:{scopeHash:'D'.repeat(64),selection:{}}})]){
  const profile=mutate(homeCopyProfile()),legacy=worktestHomeSession({profile});await legacy.session.start();await legacy.session.home();assert.equal(legacy.calls[1].url,'http://127.0.0.1:4184/api/home/summary');legacy.session.dispose();
  const desktop=worktestHomeSession({target:worktestLocation('5264'),profile});await assert.rejects(()=>desktop.session.start());assert.equal(desktop.calls.length,0);desktop.session.dispose();
 }
});

test('normal clean administrator label remains Yönetici',()=>{assert.equal(workingCatalogUserLabel({id:10018,displayName:'Semih',role:{code:'clean_test_administrator'}}),'Yönetici');});
