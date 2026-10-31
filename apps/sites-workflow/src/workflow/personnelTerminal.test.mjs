import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {terminalActions,terminalRoute,terminalCrmUrl,terminalMessage,terminalStorage,terminalUser,createTerminalScanGate,createTerminalSessionFacade,terminalOfflineText} from './personnelTerminalModel.mjs';

test('clean terminal selects only its exact CRM pair and carries no credentials or legacy address',()=>{
 for(const hostname of ['127.0.0.1','localhost','192.168.1.46']){
  const location={protocol:'http:',hostname,port:'5244',origin:`http://${hostname}:5244`},paired=terminalCrmUrl(location),u=new URL(paired.url);
  assert.equal(paired.origin,`http://${hostname}:62800`);assert.equal(u.searchParams.get('erpOrigin'),location.origin);assert.equal(u.searchParams.get('terminal'),'1');assert.equal([...u.searchParams].length,2);
  for(const patch of [{origin:'http://other:5244'},{origin:`http://${hostname}:5234`},{protocol:'https:'},{hostname:'192.168.1.47'}])assert.throws(()=>terminalCrmUrl({...location,...patch}));
 }
});
test('shared terminal uses its paired CRM origin without changing the normal terminal or trusting other hosts',()=>{
 const local={protocol:'http:',hostname:'127.0.0.1',port:'5224',origin:'http://127.0.0.1:5224'};
 assert.equal(terminalCrmUrl(local).origin,'http://127.0.0.1:62600');
 assert.equal(terminalCrmUrl({...local,hostname:'192.168.1.46',origin:'http://192.168.1.46:5224'}).origin,'http://192.168.1.46:62600');
 assert.equal(terminalCrmUrl({...local,port:'5194',origin:'http://127.0.0.1:5194'}).origin,'http://127.0.0.1:62400');
 assert.equal(terminalCrmUrl({...local,port:'5234',origin:'http://127.0.0.1:5234'}).origin,'http://127.0.0.1:62700');
 assert.equal(terminalCrmUrl({...local,port:'5234',hostname:'192.168.1.46',origin:'http://192.168.1.46:5234'}).origin,'http://192.168.1.46:62700');
 for(const changed of [{...local,port:'5214'},{...local,hostname:'192.168.1.47'},{...local,protocol:'https:'}])assert.throws(()=>terminalCrmUrl(changed));
});
test('CRM iframe keeps the exact TEST terminal path Referer required by its navigation guard',()=>{
 const html=readFileSync(new URL('../../terminal.html',import.meta.url),'utf8');
 const iframe=html.match(/<iframe\b[^>]*id="terminal-crm-frame"[^>]*>/)?.[0];
 assert.ok(iframe);assert.match(iframe,/referrerpolicy="no-referrer-when-downgrade"/);
 assert.doesNotMatch(iframe,/referrerpolicy="(?:no-referrer|origin|same-origin)"/);
 assert.doesNotMatch(iframe,/\bsrc="/); // src is produced only by the strict approved-host model.
});
test('terminal exposes only six daily routes; finance and injected hashes are excluded',()=>{
 assert.deepEqual(terminalActions.map(a=>a.id),['goods','sales','crm','products','count','returns']);
 for(const route of ['finance','supplier-payments','settings','admin','<script>'])assert.equal(terminalRoute(route),'home');
 assert.equal(terminalRoute('count'),'count');
});
test('CRM origin is pinned to the current approved TEST host, without credentials in URL',()=>{
 const l={protocol:'http:',port:'5194',hostname:'192.168.1.46',origin:'http://192.168.1.46:5194'};
 const r=terminalCrmUrl(l),u=new URL(r.url);assert.equal(r.origin,'http://192.168.1.46:62400');assert.equal(u.searchParams.get('terminal'),'1');assert.equal(u.searchParams.get('erpOrigin'),l.origin);assert.equal([...u.searchParams].length,2);
 for(const patch of [{port:'5188'},{hostname:'evil.test'},{protocol:'https:'}])assert.throws(()=>terminalCrmUrl({...l,...patch}));
});
test('iframe navigation accepts only the exact child window and origin with no identity payload',()=>{
 const win={},frame={contentWindow:win},origin='http://127.0.0.1:62400';
 const e={source:win,origin,data:{type:'melisa-terminal-child',version:1,action:'ready'}};
 assert.equal(terminalMessage(e,frame,origin),'ready');
 assert.equal(terminalMessage({...e,data:{...e.data,action:'logged-out'}},frame,origin),'logged-out');
 for(const patch of [{source:{}},{origin:'http://localhost:62400'},{data:{...e.data,token:'fixture'}}])assert.equal(terminalMessage({...e,...patch},frame,origin),null);
 assert.equal(terminalMessage({...e,data:{...e.data,action:'finalize'}},frame,origin),null);
});
test('terminal auth storage preserves the desktop session and always selects manual personel login',()=>{
 const map=new Map([['melisaTestSalesAccessToken','desktop-fixture']]),s={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},t=terminalStorage(s);
 assert.equal(t.getItem('melisaTestSalesAccessToken'),null);assert.equal(t.getItem('melisaTestSessionMode'),'manual');t.setItem('melisaTestSalesAccessToken','personel-fixture');t.removeItem('melisaTestSalesAccessToken');assert.equal(map.get('melisaTestSalesAccessToken'),'desktop-fixture');
});
test('admin cannot become the terminal personel identity',()=>{
 assert.throws(()=>terminalUser({id:1,permissions:[],role:{code:'admin'}}));assert.throws(()=>terminalUser({id:'15',permissions:[]}));
 assert.equal(terminalUser({id:15,permissions:['product.view'],role:{code:'seller'}}).id,15);
});
test('scanner preserves leading zero and prevents fast repeated Enter plus in-flight scans',()=>{
 let n=0;const gate=createTerminalScanGate({now:()=>n});
 assert.equal(gate.accept('0007130801618'),true);assert.equal(gate.accept('0007130801618'),false);gate.setBusy(true);n=1000;assert.equal(gate.accept('0161 MOLLY'),false);gate.setBusy(false);assert.equal(gate.accept('0161 MOLLY'),true);gate.reset();assert.equal(gate.accept('0161 MOLLY'),true);assert.equal(gate.accept(161),false);assert.equal(gate.accept(''),false);
});
test('offline actions do not call an ERP method or schedule an eventual write',()=>{
 let calls=0;const session={api:()=>calls++,media:()=>calls++,inbound:()=>calls++,work:()=>calls++},facade=createTerminalSessionFacade(session,{online:()=>false});
 for(const run of [()=>facade.api('/api/catalog/products'),()=>facade.media('/photo'),()=>facade.work('/api/work-sales/drafts',{method:'POST',body:{}}),()=>facade.inbound('/api/work-receiving/count-drafts',{method:'POST',body:{}})])assert.throws(run,{message:terminalOfflineText});
 assert.equal(calls,0);assert.equal(facade.supplierPayments,undefined);assert.equal(facade.suppliers,undefined);
});
test('personel facade prevents approval, payment, cancellation and purchase mutations before transport',()=>{
 let paths=[];const session={inbound:(path)=>paths.push(path),work:(path)=>paths.push(path)},facade=createTerminalSessionFacade(session,{online:()=>true});
 for(const path of ['/api/test-daily/count/approve','/api/test-daily/purchase/approve','/api/work-receiving/receipts/1/approve','/api/work-supplier-payments/payments','/api/work-collections','/api/work-purchases/drafts','/api/test-daily/count/cancel'])assert.throws(()=>facade.inbound(path,{method:'POST',body:{}}),e=>e.status===403);
 assert.deepEqual(paths,[]);facade.inbound('/api/work-receiving/count-drafts',{method:'POST',body:{}});facade.work('/api/work-sales/preview',{method:'POST',body:{}});assert.equal(paths.length,2);
});

test('Windows menu invokes the original terminal close guard, including pending writes/modal/count',async()=>{
 const {runInNewContext}=await import('node:vm'),source=readFileSync(new URL('./personnelTerminal.js',import.meta.url),'utf8'),start=source.indexOf('function closeAllowed(){'),end=source.indexOf('function go(',start),context={window:{},pendingWrites:0,controller:null,route:'home',user:{id:15},announce:()=>{},document:{getElementById:()=>({style:{display:'none'}})},localStorage:{getItem:()=>null}};
 runInNewContext(source.slice(start,end),context);assert.equal(context.window.MelisaWorkingBeforeNavigate,context.closeAllowed);assert.equal(context.window.MelisaWorkingBeforeNavigate(),true);
 context.pendingWrites=1;assert.equal(context.window.MelisaWorkingBeforeNavigate(),false);context.pendingWrites=0;context.controller={requestClose:()=>false};assert.equal(context.window.MelisaWorkingBeforeNavigate(),false);context.controller=null;context.document.getElementById=()=>({style:{display:'flex'}});assert.equal(context.window.MelisaWorkingBeforeNavigate(),false);context.document.getElementById=()=>({style:{display:'none'}});context.route='count';context.localStorage.getItem=()=>'{"requestId":"same","result":null}';assert.equal(context.window.MelisaWorkingBeforeNavigate(),false);context.localStorage.getItem=()=>'{"result":{"verified":true}}';assert.equal(context.window.MelisaWorkingBeforeNavigate(),true);
});

async function startupFixture({status=503,offline=false}={}){
 const {runInNewContext}=await import('node:vm'),{createWorkingCatalogSession}=await import('./workingCatalogSession.mjs');
 const source=readFileSync(new URL('./personnelTerminal.js',import.meta.url),'utf8'),code=source.slice(source.indexOf('function showConnectionRetry(){'),source.indexOf('function clearCrm(){')).replace('import.meta.env.VITE_API_BASE_URL',JSON.stringify('http://127.0.0.1:4184'));
 const actor={id:15,username:'normal-personnel',role:{code:'isolated_test_sales'},permissions:['sales.view']},initial={userId:'15',username:actor.username,accessToken:'saved-access',refreshToken:'saved-refresh',expiresAt:Date.now()+900000};let record={...initial},responseStatus=status;
 const calls={clear:0,get:0,put:0,login:[],setUser:[],urls:[],removed:[],crmLogout:0},button={},elements={'terminal-user':{},'terminal-logout':{}},root={innerHTML:'',querySelector:()=>button},storage={getItem:()=>null,setItem(){},removeItem:k=>calls.removed.push(k)},protectedDevice={get:async()=>{calls.get++;return record;},put:async r=>{calls.put++;record={...r};},clear:async()=>{calls.clear++;record=null;}};
 const location={origin:'http://127.0.0.1:5234',protocol:'http:',hostname:'127.0.0.1',port:'5234'};
 const context={session:null,controller:null,user:null,root,crm:{},document:{getElementById:k=>elements[k]},storage,location,online:()=>!offline,announce(){},terminalOfflineText:'offline',requestCrmLogout:()=>calls.crmLogout++,showLogin:m=>calls.login.push(m),setUser:u=>calls.setUser.push(u),createWorkingCatalogSession:options=>createWorkingCatalogSession({...options,protectedDevice,fetchImpl:async url=>{calls.urls.push(url);if(responseStatus==='network')throw new TypeError('private-network-error');const ok=responseStatus===200;return{ok,status:responseStatus,json:async()=>ok?{success:true,data:url.endsWith('/auth/me')?actor:{user:actor,accessToken:'fresh-access',refreshToken:'rotated-refresh',expiresAt:Date.now()+900000}}:{success:false,error:{code:'UNAVAILABLE',message:'unavailable'}}};}})};
 runInNewContext(code,context);return{context,calls,root,button,initial,get record(){return record;},setStatus:v=>responseStatus=v,setRecord:v=>record=v};
}
test('cold protected startup 503/network keeps vault and shows retry without requesting credentials',async()=>{
 for(const status of[503,'network']){const f=await startupFixture({status});await f.context.start();assert.equal(f.calls.clear,0);assert.deepEqual(f.record,f.initial);assert.deepEqual(f.calls.login,[]);assert.deepEqual(f.calls.setUser,[]);assert(f.root.innerHTML.includes('Bağlantı bekleniyor'));assert(!/password|username|<form/.test(f.root.innerHTML));assert(!f.calls.urls.some(u=>u.endsWith('/auth/login')));
  f.setStatus(200);await f.button.onclick();assert.equal(f.calls.setUser.at(-1).id,15);assert.equal(f.record.refreshToken,'rotated-refresh');assert(f.calls.urls.some(u=>u.endsWith('/auth/me')));assert.equal(f.calls.clear,0);}
});
test('authoritative protected refresh 401/403 still clears the vault and requests normal login',async()=>{
 for(const status of[401,403]){const f=await startupFixture({status});await f.context.start();assert.equal(f.record,null);assert(f.calls.clear>0);assert(f.calls.login.length>0);assert.equal(f.calls.setUser.length,0);assert(!f.root.innerHTML.includes('data-session-retry'));}
});
test('missing protected session still uses normal login rather than inventing an identity',async()=>{
 const f=await startupFixture({status:200});f.setRecord(null);await f.context.start();assert.equal(f.calls.login.length,1);assert.equal(f.calls.setUser.length,0);assert.equal(f.calls.urls.length,0);
});
test('offline retry makes no new auth call and stale startup cannot overwrite a fresh session',async()=>{
 const f=await startupFixture({offline:true});await f.context.start();const before=f.calls.urls.length;f.button.onclick();assert.equal(f.calls.urls.length,before);
 const pending=[];f.context.createWorkingCatalogSession=()=>({dispose(){},start:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))});const first=f.context.start(),second=f.context.start();pending[1].resolve({id:15});await second;const html=f.root.innerHTML;pending[0].reject(Object.assign(new Error('old'),{status:503}));await first;assert.equal(f.calls.setUser.at(-1).id,15);assert.equal(f.root.innerHTML,html);
});
