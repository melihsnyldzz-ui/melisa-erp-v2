import test from 'node:test';
import assert from 'node:assert/strict';
import {terminalActions,terminalRoute,terminalCrmUrl,terminalMessage,terminalStorage,terminalUser,createTerminalScanGate,createTerminalSessionFacade,terminalOfflineText} from './personnelTerminalModel.mjs';
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
