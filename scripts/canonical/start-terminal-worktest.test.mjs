import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {worktestStaticPath} from './start-terminal-worktest.mjs';
import {requestGuard,assertActor,assertSqlIdentity,enrichInvoice,createReadonlySourceLock,readUpstream,readScopedReceipts,verifiedCustomerName,createWorktestHandler,CARTON_SOURCE_SQL,WORKTEST} from './start-terminal-worktest.mjs';
import {businessInboundFixture} from '../../apps/api/src/services/businessInbound.test-fixture.mjs';
import {TERMINAL_WORKTEST_HOME_PATH} from './terminal-worktest-home-readonly.mjs';
import {readPersistentTerminalUpstream} from './terminal-persistent-web-support.mjs';
const context={copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',sealHash:'A'.repeat(64),operationOrigin:'COPY',actors:[{id:'15'}],customers:[{id:'4',currency:'TRY',name:'Doğrulanmış müşteri',sourceKnown:true,sourceWitnessHash:'c'.repeat(64)}],products:[{id:'7',unit:'ADET',unitFactorExact8:'1.00000000',barcodes:['0007']}]};
const item={productId:'7',stockCode:'0007 X',name:'Ürün',quantityExact3:'2.000',unitPriceExact4:'3.0000',lineTotalExact4:'6.0000',currency:'TRY',unit:{label:'ADET',factorExact8:'1.00000000'}};
const invoice={id:'12',documentNo:'FIŞ12',customerId:'4',currency:'TRY',status:'finalized',items:[item]};
const header={id:'12',documentNo:'FIŞ12',customerId:'4',currency:'TRY',status:'finalized',preview:JSON.stringify({...context,items:[item]})};
const rows=[{...item,itemId:'18',barcode:'0007'}];
const identity={db:WORKTEST.database,server:'Semih\\MELISADEV',login:WORKTEST.reader,sysadmin:0,control:0,live:0,original:0,copyId:context.copyId,seal:context.sealHash,actualT1:'false',sealed:true};
const request=(extra={})=>({method:'GET',url:'/terminal.html',socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:5234'},...extra});
test('actual built-page query selects only the four-task page and preserves the public bootstrap',async()=>{
 assert.equal(worktestStaticPath('/terminal.html?worktest=1'),'terminal.html');assert.equal(worktestStaticPath('/kullanim-egitimi.html?terminal=1'),'kullanim-egitimi.html');
 for(const raw of ['/terminal.html?worktest=2','/terminal.html?actor=16','/terminal.html?worktest=1&worktest=1','http://other/terminal.html'])assert.throws(()=>worktestStaticPath(raw));
 const dist=await mkdtemp(path.join(os.tmpdir(),'melisa-carton-page-'));try{await writeFile(path.join(dist,'terminal.html'),'<html><head></head><body>Personel</body></html>');let text='',status;const res={setHeader(){},writeHead(s){status=s;},end(s){text=String(s);}};
 const handler=createWorktestHandler({context,bootstrap:{copyId:context.copyId},csp:"default-src 'self'",dist});await handler(request({url:'/terminal.html?worktest=1'}),res);assert.equal(status,undefined);assert.match(text,/<head><script src="\/stage4-runtime.js"><\/script>/);assert.match(text,/Personel/);
 await handler(request({url:'/stage4-runtime.js'}),res);assert.match(text,/window.__MELISA_OPERATION_COPY__/);assert.match(text,new RegExp(context.copyId));
 }finally{const target=path.resolve(dist);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert.match(path.basename(target),/^melisa-carton-page-/);await rm(target,{recursive:true,force:true});}
});
test('strict loopback/logical host/origin/path rejects proxy/remote/CSRF',()=>{assert.doesNotThrow(()=>requestGuard(request()));for(const x of [request({socket:{remoteAddress:'192.168.1.46'}}),request({headers:{host:'evil'}}),request({headers:{host:'127.0.0.1:5234','x-forwarded-host':'evil'}}),request({url:'/assets/%2e%2e/secret'}),request({method:'POST'}),request({headers:{host:'127.0.0.1:5234',origin:'https://evil'}})])assert.throws(()=>requestGuard(x));assert.doesNotThrow(()=>requestGuard(request({method:'POST',headers:{host:'127.0.0.1:5234',origin:'http://127.0.0.1:5234'}})));});
test('pinned web bytes are checked again when served; edits after startup cannot become active code',async()=>{
 const dist=await mkdtemp(path.join(os.tmpdir(),'melisa-carton-page-'));try{
  const original='<html><head></head><body>Personel</body></html>',file=path.join(dist,'terminal.html');await writeFile(file,original);let body='',status;
  const res={setHeader(){},writeHead(s){status=s;},end(s){body=String(s);}};
  const handler=createWorktestHandler({context,bootstrap:{},csp:"default-src 'self'",dist,webPins:new Map([['terminal.html',createHash('sha256').update(original).digest('hex')]])});
  await handler(request(),res);assert.match(body,/Personel/);await writeFile(file,'<html>CHANGED_SOURCE</html>');await handler(request(),res);
  assert.equal(status,503);assert.equal(JSON.parse(body).error.code,'WORKTEST_PACKAGE_PIN');assert.doesNotMatch(body,/CHANGED_SOURCE/);
 }finally{assert.equal(path.dirname(path.resolve(dist)),path.resolve(os.tmpdir()));assert.ok(path.basename(dist).startsWith('melisa-carton-page-'));await rm(dist,{recursive:true,force:true});}
});
test('normal nonadmin salesview actor only; exact DB02 sealed reader checks',()=>{assertActor({id:15,role:{code:'isolated_test_sales'},permissions:['sales.view']},context);for(const a of [{id:15,role:{code:'admin'},permissions:['sales.view']},{id:16,permissions:['sales.view']},{id:15,permissions:[]}])assert.throws(()=>assertActor(a,context));assertSqlIdentity(identity,context);for(const x of [{live:1},{control:1},{sysadmin:1},{actualT1:'true'},{sealed:false},{db:'LIVE'},{login:'writer'}])assert.throws(()=>assertSqlIdentity({...identity,...x},context));});
test('native item identity and barcode zero/unit source proof required',()=>{const s=enrichInvoice(invoice,header,rows,context);assert.equal(s.items[0].itemId,'18');assert.deepEqual(s.items[0].barcodes,['0007']);assert.equal(s.items[0].unit.verified,true);assert.throws(()=>enrichInvoice({...invoice,status:'cancelled'},header,rows,context));assert.throws(()=>enrichInvoice(invoice,header,[{...rows[0],barcode:'7'}],context));assert.throws(()=>enrichInvoice(invoice,header,[{...rows[0],quantityExact3:'3.000'}],context));assert.throws(()=>enrichInvoice(invoice,header,rows,{...context,products:[{...context.products[0],unit:undefined}]}));});
test('read-only SERIALIZABLE shared source locks span entire FS callback; rollback always',async()=>{let sequence=[];class Transaction{async begin(level){assert.equal(level,'SERIALIZABLE');sequence.push('begin');}async rollback(){sequence.push('rollback');}}class Request{input(){return this;}async query(sql){sequence.push(sql===CARTON_SOURCE_SQL?'source':'identity');return sql===CARTON_SOURCE_SQL?{recordsets:[[header],rows]}:{recordset:[identity]};}}const locked=createReadonlySourceLock({sql:{Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},UniqueIdentifier:'uuid',BigInt:'bigint'},pool:{},context});await locked(invoice,async()=>{sequence.push('fs-save');});assert.deepEqual(sequence,['begin','identity','source','fs-save','rollback']);sequence=[];await assert.rejects(()=>locked(invoice,async()=>{sequence.push('fs-fail');throw Error('FAIL');}));assert.equal(sequence.at(-1),'rollback');assert.doesNotMatch(CARTON_SOURCE_SQL,/\b(?:INSERT|UPDATE|DELETE|EXEC|UPDLOCK)\b/i);assert.equal((CARTON_SOURCE_SQL.match(/HOLDLOCK/g)??[]).length,3);});
test('API source only GET pinned routes/auth upstream never mint or forward cookies',async()=>{let settings;const transport=async(url,options)=>{assert.equal(url,WORKTEST.api+'/api/auth/me');settings=options;return Response.json({success:true,data:{id:15}});};assert.deepEqual(await readUpstream('/api/auth/me','Bearer secret',{transport}),{id:15});assert.equal(settings.redirect,'error');assert.deepEqual(Object.keys(settings.headers),['authorization']);await assert.rejects(()=>readUpstream('/api/auth/test-admin','Bearer secret',{transport}));await assert.rejects(()=>readUpstream('/api/auth/me','Bearer secret',{transport:async()=>Response.json({success:false},{status:403})}));});
test('only original gateway GET invoice reads receive20s through the persistent upstream wrapper; auth and metadata POST retain12s',async t=>{
 const budgets=[];t.mock.method(AbortSignal,'timeout',ms=>{budgets.push(ms);return new AbortController().signal;});
 const transport=async url=>Response.json({success:true,data:url.endsWith('/auth/me')?{id:15,permissions:['sales.view']}:url.includes('?page=')?{data:[invoice],meta:{total:1,page:1,limit:50}}:invoice});
 const upstream=(p,a)=>readPersistentTerminalUpstream(p,a,{transport}),saved=[];
 const handler=createWorktestHandler({context,bootstrap:{},csp:'',dist:'.',upstream,withSource:async(i,fn)=>fn(enrichInvoice(i,header,rows,context)),store:{load:async()=>({status:'DRAFT'}),save:async(actor,source,body)=>{saved.push(body);return {status:'DRAFT'};}}});
 const headers={host:'127.0.0.1:5234',origin:'http://127.0.0.1:5234',authorization:'Bearer token','content-type':'application/json'},res={setHeader(){},writeHead(s){this.status=s;},end(s){this.body=JSON.parse(s);}};
 for(const url of ['/api/terminal-cartons/receipts','/api/terminal-cartons/receipts/12']){budgets.length=0;await handler(request({url,headers}),res);assert.equal(res.status,200);assert.deepEqual(budgets,[12000,20000]);}
 budgets.length=0;const body={timeoutMs:60000,method:'GET',cartons:[]};await handler(request({method:'POST',url:'/api/terminal-cartons/receipts/12',headers,async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}}),res);assert.equal(res.status,200);assert.deepEqual(budgets,[12000,12000]);assert.deepEqual(saved,[body]);
 budgets.length=0;await readUpstream('/api/work-sales/invoices/12','Bearer token',{transport,method:'GET',timeoutMs:60000});assert.deepEqual(budgets,[12000]);
});
test('concurrent original GET and POST keep separate invoice budgets and do not retry an upstream failure',async t=>{
 const budgets=[];t.mock.method(AbortSignal,'timeout',ms=>{budgets.push(ms);return new AbortController().signal;});
 const transport=async url=>{await Promise.resolve();return Response.json({success:true,data:url.endsWith('/auth/me')?{id:15,permissions:['sales.view']}:invoice});};
 const handler=createWorktestHandler({context,bootstrap:{},csp:'',dist:'.',upstream:(p,a)=>readUpstream(p,a,{transport}),withSource:async(i,fn)=>fn(enrichInvoice(i,header,rows,context)),store:{load:async()=>({}),save:async()=>({})}});
 const headers={host:'127.0.0.1:5234',origin:'http://127.0.0.1:5234',authorization:'Bearer token','content-type':'application/json'},response=()=>({setHeader(){},writeHead(s){this.status=s;},end(){}}),get=response(),post=response();
 await Promise.all([handler(request({url:'/api/terminal-cartons/receipts/12',headers}),get),handler(request({method:'POST',url:'/api/terminal-cartons/receipts/12',headers,async *[Symbol.asyncIterator](){yield Buffer.from('{}');}}),post)]);assert.equal(get.status,200);assert.equal(post.status,200);assert.deepEqual(budgets.toSorted((a,b)=>a-b),[12000,12000,12000,20000]);
 let calls=0;await assert.rejects(()=>readUpstream('/api/work-sales/invoices/12','Bearer token',{transport:async()=>{calls++;throw Error('private upstream details');}}),{code:'WORKTEST_API_UNAVAILABLE'});assert.equal(calls,1);
});
test('metadata route does not permit any trade/auth POST; source compare precedes FS save',async()=>{const events=[];const upstream=async p=>{events.push(p);return p==='/api/auth/me'?{id:15,permissions:['sales.view']}:invoice;};const handler=createWorktestHandler({context,bootstrap:{},csp:"default-src 'self'",dist:'.',upstream,withSource:async(i,fn)=>{events.push('lock-source');return fn(enrichInvoice(i,header,rows,context));},store:{save:async()=>{events.push('fs-save');return {status:'DRAFT'};}}});const res={status:null,setHeader(){},writeHead(s){this.status=s;},end(s){this.body=JSON.parse(s);}};await handler(request({method:'POST',url:'/api/work-sales/drafts'}),res);assert.equal(res.status,403);assert.equal(events.length,0);const req=request({method:'POST',url:'/api/terminal-cartons/receipts/12',headers:{host:'127.0.0.1:5234',origin:'http://127.0.0.1:5234',authorization:'Bearer token','content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from('{}');}});await handler(req,res);assert.equal(res.status,200);assert.deepEqual(events,['/api/auth/me','/api/work-sales/invoices/12','lock-source','fs-save']);});
test('bounded exact API paging keeps older finalized receipts beyond first25 and first50',async()=>{
 const values=Array.from({length:64},(_,i)=>({id:String(1000-i),documentNo:'F'+i,customerId:'4',currency:'TRY',status:i<50?'draft':'finalized'})),calls=[];
 const upstream=async(p,auth)=>{calls.push(p);assert.equal(auth,'Bearer token');const page=Number(new URL(p,'http://local').searchParams.get('page'));return {data:values.slice((page-1)*50,page*50),meta:{total:64,page,limit:50}};};
 const receipts=await readScopedReceipts(upstream,'Bearer token',context);assert.equal(receipts.length,14);assert.equal(receipts.at(-1).id,'937');assert.equal(receipts[0].customerName,'Doğrulanmış müşteri');assert.deepEqual(calls,['/api/work-sales/invoices?page=1&limit=50','/api/work-sales/invoices?page=2&limit=50']);
 await assert.rejects(()=>readUpstream('/api/work-sales/invoices?page=21&limit=50','Bearer token'));await assert.rejects(()=>readUpstream('/api/work-sales/invoices?page=1&limit=100','Bearer token'));
});
test('customer list and detail use exact sealed identity/currency name, never numeric ID or unverified upstream name',()=>{
 assert.equal(verifiedCustomerName({...invoice,customerName:'UNTRUSTED'},context),'Doğrulanmış müşteri');
 assert.equal(enrichInvoice(invoice,header,rows,context).customerName,'Doğrulanmış müşteri');
 assert.equal(verifiedCustomerName(invoice,{...context,customers:[{...context.customers[0],name:undefined}]}),'Müşteri adı okunamadı');
 const multi={...context,customers:[context.customers[0],{...context.customers[0],currency:'USD',name:'Dolar hesabı müşterisi'}]};assert.equal(verifiedCustomerName(invoice,multi),'Doğrulanmış müşteri');
 assert.throws(()=>verifiedCustomerName({...invoice,customerId:'5'},context),{code:'CARTON_CUSTOMER_SCOPE'});
 assert.throws(()=>verifiedCustomerName(invoice,{...context,customers:[{...context.customers[0],sourceKnown:false}]}),{code:'CARTON_CUSTOMER_PROOF'});
});
test('oversized, shifting or duplicate receipt pages fail without a silently partial list',async()=>{
 let calls=0;await assert.rejects(()=>readScopedReceipts(async()=>{calls++;return {data:[],meta:{total:1001,page:1,limit:50}};},'Bearer token'),{code:'WORKTEST_RECEIPT_SCOPE_LIMIT'});assert.equal(calls,1);
 const first=Array.from({length:50},(_,i)=>({id:String(i+1),status:'draft'}));
 await assert.rejects(()=>readScopedReceipts(async p=>p.includes('page=1&')?{data:first,meta:{total:51,page:1,limit:50}}:{data:[{id:'51',status:'finalized'}],meta:{total:52,page:2,limit:50}},'Bearer token'),{code:'WORKTEST_RECEIPT_LIST_CHANGED'});
 await assert.rejects(()=>readScopedReceipts(async p=>p.includes('page=1&')?{data:first,meta:{total:51,page:1,limit:50}}:{data:[{id:'1',status:'finalized'}],meta:{total:51,page:2,limit:50}},'Bearer token'),{code:'WORKTEST_RECEIPT_LIST_CHANGED'});
});
test('temporary HOME route is exact GET-only with normal upstream auth and no general proxy',async()=>{
 const {copy}=businessInboundFixture(),actor={id:16,role:{code:'isolated_test_ilker'},permissions:['goods.view']},calls=[];
 const handler=createWorktestHandler({context:copy,bootstrap:{copyId:copy.copyId},csp:"default-src 'self'",dist:'.',upstream:async(p,authorization)=>{calls.push(p);assert.equal(authorization,'Bearer normal');return actor;},homeSummary:async actual=>{assert.equal(actual,actor);calls.push('home');return {meta:{copyId:copy.copyId}};}});
 const res={setHeader(){},writeHead(s){this.status=s;},end(s){this.body=String(s);}},headers={host:'127.0.0.1:5234',origin:'http://127.0.0.1:5234',authorization:'Bearer normal'};
 await handler(request({url:TERMINAL_WORKTEST_HOME_PATH,headers}),res);assert.equal(res.status,200);assert.equal(JSON.parse(res.body).data.meta.copyId,copy.copyId);assert.deepEqual(calls,['/api/auth/me','home']);
 for(const extra of [{method:'POST',expected:405},{method:'HEAD',expected:405},{url:TERMINAL_WORKTEST_HOME_PATH+'?actorId=15',expected:404},{url:'/api/home/summary',expected:404},{headers:{host:'127.0.0.1:5234'},expected:401}]){calls.length=0;const {expected,...value}=extra;await handler(request({url:TERMINAL_WORKTEST_HOME_PATH,headers,...value}),res);assert.equal(res.status,expected);assert.equal(calls.length,0);}
 await handler(request({url:'/stage4-runtime.js'}),res);assert.match(res.body,/window.__MELISA_OPERATION_COPY__/);assert.match(res.body,/window.__MELISA_TERMINAL_WORKTEST_HOME__/);assert.match(res.body,new RegExp(TERMINAL_WORKTEST_HOME_PATH));
});
test('HOME route rejects admin/foreign role without entering the reader and publishes no flag when disabled',async()=>{
 const {copy}=businessInboundFixture();let reads=0;
 for(const actor of [{id:1,role:{code:'admin'},permissions:['goods.view']},{id:16,role:{code:'isolated_test_sales'},permissions:['goods.view']}]){const handler=createWorktestHandler({context:copy,bootstrap:{},csp:'',dist:'.',upstream:async()=>actor,homeSummary:async()=>{reads++;}}),res={setHeader(){},writeHead(s){this.status=s;},end(s){this.body=String(s);}};await handler(request({url:TERMINAL_WORKTEST_HOME_PATH,headers:{host:'127.0.0.1:5234',authorization:'Bearer normal'}}),res);assert.equal(res.status,403);}assert.equal(reads,0);
 const handler=createWorktestHandler({context:copy,bootstrap:{},csp:'',dist:'.'}),res={setHeader(){},writeHead(){},end(s){this.body=String(s);}};await handler(request({url:'/stage4-runtime.js'}),res);assert.doesNotMatch(res.body,/__MELISA_TERMINAL_WORKTEST_HOME__/);
});
