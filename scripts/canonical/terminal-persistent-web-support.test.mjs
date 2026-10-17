import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {businessInboundFixture} from '../../apps/api/src/services/businessInbound.test-fixture.mjs';
import {persistentTerminalRequestGuard,isPersistentTerminalApiPath,readPersistentTerminalUpstream,createPersistentTerminalHandler,initializePersistentTerminalSupport} from './terminal-persistent-web-support.mjs';
import {requestGuard,enrichInvoice,CARTON_IDENTITY_SQL,WORKTEST} from './start-terminal-worktest.mjs';
const request=(extra={})=>({method:'GET',url:'/api/terminal-worktest/home-summary',socket:{remoteAddress:'192.168.1.70'},headers:{host:'192.168.1.46:5234',authorization:'Bearer fixture'},...extra});
const response=()=>({status:null,headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}});
test('persistent5234 permits only existing LAN range and exact same origin; temporary5264 stays loopback',()=>{
 assert.doesNotThrow(()=>persistentTerminalRequestGuard(request()));
 assert.doesNotThrow(()=>persistentTerminalRequestGuard(request({socket:{remoteAddress:'::ffff:192.168.1.254'}})));
 assert.doesNotThrow(()=>persistentTerminalRequestGuard(request({socket:{remoteAddress:'::1'},headers:{host:'localhost:5234'}})));
 assert.throws(()=>requestGuard(request()),{code:'WORKTEST_PEER'});
 for(const peer of ['192.168.2.10','192.168.1.0','192.168.1.255','192.168.1.999','10.0.0.1','::ffff:192.168.2.2'])assert.throws(()=>persistentTerminalRequestGuard(request({socket:{remoteAddress:peer}})),{code:'WORKTEST_PEER'});
 for(const host of ['192.168.1.46:5264','192.168.1.46:5194','evil:5234','127.0.0.1:4184'])assert.throws(()=>persistentTerminalRequestGuard(request({headers:{host}})));
 for(const key of ['forwarded','x-forwarded-host','x-forwarded-for','tailscale-user-login'])assert.throws(()=>persistentTerminalRequestGuard(request({headers:{...request().headers,[key]:'anything'}})),{code:'WORKTEST_PROXY'});
 for(const origin of ['http://127.0.0.1:5234','http://192.168.1.47:5234','https://192.168.1.46:5234','null'])assert.throws(()=>persistentTerminalRequestGuard(request({headers:{...request().headers,origin}})),{code:'WORKTEST_ORIGIN'});
 assert.throws(()=>persistentTerminalRequestGuard(request({method:'POST'})),{code:'WORKTEST_ORIGIN'});
 assert.doesNotThrow(()=>persistentTerminalRequestGuard(request({method:'POST',headers:{...request().headers,origin:'http://192.168.1.46:5234'}})));
 for(const url of ['https://evil/api','/api/%2e%2e/x','/api/../x','/api\\x','/api/x#y'])assert.throws(()=>persistentTerminalRequestGuard(request({url})),{code:'WORKTEST_PATH'});
});
test('HOME uses a finite authenticated GET only; no body/cookie/login/alternate destination proxy',async()=>{
 const calls=[],data={cash:[{currency:'USD',amount:'1.0000'}]};
 const transport=async(url,options)=>{calls.push({url,options});return Response.json({success:true,data});};
 assert.deepEqual(await readPersistentTerminalUpstream('/api/home/summary','Bearer fixture',{transport}),data);
 assert.equal(calls[0].url,WORKTEST.api+'/api/home/summary');assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'error');assert.deepEqual(calls[0].options.headers,{authorization:'Bearer fixture'});assert.equal(calls[0].options.body,undefined);
 for(const pathname of ['/api/home-summary','/api/home/summary?actor=16','/api/home/summary/other','/api/auth/login','/api/work-sales/drafts','http://evil/api/home/summary'])await assert.rejects(()=>readPersistentTerminalUpstream(pathname,'Bearer fixture',{transport}));
 assert.equal(calls.length,1);await assert.rejects(()=>readPersistentTerminalUpstream('/api/home/summary','Cookie fixture',{transport}),{code:'WORKTEST_AUTH'});
 await assert.rejects(()=>readPersistentTerminalUpstream('/api/home/summary','Bearer fixture',{transport:async()=>Response.json({}, {status:403})}),{code:'WORKTEST_SCOPE'});
 await assert.rejects(()=>readPersistentTerminalUpstream('/api/home/summary','Bearer fixture',{transport:async()=>Response.json({success:false,data})}),{code:'WORKTEST_API_DATA'});
});
test('HOME proxy follows registered ERP route; legacy missing route is never contacted or aliased',async()=>{
 const routeSource=await readFile(new URL('../../apps/api/src/routes/homeSummaryRoutes.mjs',import.meta.url),'utf8');
 const registered=routeSource.match(/router\.get\('([^']+)',authenticate,/);
 assert.equal(registered?.[1],'/home/summary');
 const canonical='/api'+registered[1],{copy}=businessInboundFixture(),calls=[];
 const transport=async url=>{calls.push(url);if(url===WORKTEST.api+'/api/auth/me')return Response.json({success:true,data:{id:15,role:{code:copy.actors.find(a=>a.id==='15').role},permissions:['goods.view','sales.view']}});if(url===WORKTEST.api+canonical)return Response.json({success:true,data:{sections:{goods:{status:'available'}}}});return Response.json({success:false,error:{code:'NOT_FOUND'}},{status:404});};
 const handler=createPersistentTerminalHandler({context:copy,csp:"default-src 'self'",transport}),res=response();await handler(request(),res);
 assert.equal(res.status,200);assert.equal(res.body.data.sections.goods.status,'available');assert.deepEqual(calls,[WORKTEST.api+'/api/auth/me',WORKTEST.api+canonical]);
 const count=calls.length;await assert.rejects(()=>readPersistentTerminalUpstream('/api/home-summary','Bearer fixture',{transport}));assert.equal(calls.length,count);
 await assert.rejects(()=>readPersistentTerminalUpstream(canonical,'Bearer fixture',{transport:async()=>Response.json({success:false,error:{code:'NOT_FOUND'}},{status:404})}),{code:'WORKTEST_SCOPE',statusCode:404});
 await assert.rejects(()=>readPersistentTerminalUpstream(canonical,'Bearer fixture',{transport:async()=>new Response('x'.repeat(2097153))}),{code:'WORKTEST_UPSTREAM_SIZE'});
});
test('HOME normal native-scoped actor and methods are checked before exact API read; no arbitrary handler paths',async()=>{
 const {copy}=businessInboundFixture(),calls=[],actor={id:15,role:{code:copy.actors.find(a=>a.id==='15').role},permissions:['goods.view','sales.view']},home={summary:'native unchanged'};
 let active=actor;
 const transport=async(url,options)=>{calls.push(url);assert.deepEqual(options.headers,{authorization:'Bearer fixture'});return Response.json({success:true,data:url.endsWith('/api/auth/me')?active:home});};
 const handler=createPersistentTerminalHandler({context:copy,csp:"default-src 'self'",transport});
 const res=response();await handler(request(),res);assert.equal(res.status,200);assert.deepEqual(res.body,{success:true,data:home});assert.deepEqual(calls,[WORKTEST.api+'/api/auth/me',WORKTEST.api+'/api/home/summary']);
 for(const actorBad of [{...actor,role:{code:'admin'},isAdmin:true},{...actor,id:999},{...actor,role:{code:'wrong'}},{...actor,permissions:[]}]){active=actorBad;const res=response();await handler(request(),res);assert.equal(res.status,403);}
 const count=calls.length;for(const extra of [{method:'POST',headers:{...request().headers,origin:'http://192.168.1.46:5234'}},{url:'/api/work-sales/drafts'},{url:'/api/terminal-worktest/home-summary?actor=16'},{url:'/terminal.html'}]){const res=response();await handler(request(extra),res);assert.notEqual(res.status,200);}assert.equal(calls.length,count);
 assert(isPersistentTerminalApiPath('/api/terminal-cartons/receipts/7'));assert(isPersistentTerminalApiPath('/api/terminal-worktest/home-summary'));assert(!isPersistentTerminalApiPath('/api/work-sales/drafts'));
});
test('carton save authenticates before native source comparison and file metadata; trade POST remains closed',async()=>{
 const {copy}=businessInboundFixture(),calls=[],invoice={id:'7',status:'finalized'};let role=copy.actors.find(a=>a.id==='15').role;
 const transport=async url=>{calls.push(url);return Response.json({success:true,data:url.endsWith('/api/auth/me')?{id:15,role:{code:role},permissions:['sales.view']}:invoice});};
 const handler=createPersistentTerminalHandler({context:copy,csp:"default-src 'self'",transport,withSource:async(receipt,fn)=>{assert.deepEqual(receipt,invoice);calls.push('native readonly source');return fn({invoiceId:'7'});},store:{save:async(actor,source,input)=>{assert.equal(actor,'15');assert.deepEqual(input,{schemaVersion:'fixture'});calls.push('file metadata');return {state:'DRAFT'};}}});
 const req=request({method:'POST',url:'/api/terminal-cartons/receipts/7',headers:{...request().headers,origin:'http://192.168.1.46:5234','content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from('{"schemaVersion":"fixture"}');}}),res=response();await handler(req,res);assert.equal(res.status,200);assert.deepEqual(calls,[WORKTEST.api+'/api/auth/me',WORKTEST.api+'/api/work-sales/invoices/7','native readonly source','file metadata']);
 role='wrong';const denied=response();await handler(req,denied);assert.equal(denied.status,403);assert.equal(calls.at(-1),WORKTEST.api+'/api/auth/me');const count=calls.length,resBad=response();await handler({...req,url:'/api/work-sales/drafts'},resBad);assert.equal(resBad.status,404);assert.equal(calls.length,count);
});
test('SOURCE USD selected creation remains independently tied to native account, ordered lines, zero barcode and units',()=>{
 const items=['7','8'].map((id,i)=>({productId:id,stockCode:i?'0161 MOLLY':'0007 CONCEPT',name:'Kaynak ürün '+id,quantityExact3:'2.000',unitPriceExact4:'3.0000',lineTotalExact4:'6.0000',currency:'USD',quoteId:String(17+i),unit:{label:'ADET',factorExact8:'1.00000000'}}));
 const context={copyId:'copy',sealHash:'seal',operationOrigin:'SOURCE',customers:[{id:'4',accountId:'44',currency:'USD',name:'Kaynak müşteri',sourceKnown:true,sourceWitnessHash:'a'.repeat(64)}],products:items.map(i=>({id:i.productId,unit:'ADET',unitFactorExact8:'1.00000000',barcodes:['000'+i.productId]}))};
 const invoice={id:'12',documentNo:'F12',customerId:'4',currency:'USD',status:'finalized',items},preview={copyId:context.copyId,sealHash:context.sealHash,operationOrigin:context.operationOrigin,policyHash:'b'.repeat(64),currency:'USD',selection:{customerId:'4',customerAccountId:'44',currency:'USD',items:items.map(({productId,quoteId,quantityExact3})=>({productId,quoteId,quantityExact3}))},items};
 const header={...invoice,preview:JSON.stringify(preview)},rows=items.map((i,n)=>({...i,itemId:String(n+100),barcode:'000'+i.productId,unitName:'ADET',unitFactorExact8:'1.00000000'}));
 const source=enrichInvoice(invoice,header,rows,context);assert.equal(source.items.length,2);assert.equal(source.customerName,'Kaynak müşteri');assert.deepEqual(source.items[0].barcodes,['0007']);
 for(const change of [p=>p.selection.customerAccountId='45',p=>p.selection.currency='TRY',p=>p.selection.items.reverse(),p=>p.selection.items[0].quoteId='999',p=>p.items[0].unit.factorExact8='2.00000000']){const p=structuredClone(preview);change(p);assert.throws(()=>enrichInvoice(invoice,{...header,preview:JSON.stringify(p)},rows,context));}
 assert.throws(()=>enrichInvoice(invoice,header,[{...rows[0],barcode:'7'},rows[1]],context));
});
test('persistent startup uses only sealed readonly reader pool; failure closes pool; no writer or historical dependency pin',async()=>{
 const {copy}=businessInboundFixture(),identity={db:WORKTEST.database,server:'Semih\\MELISADEV',login:WORKTEST.reader,sysadmin:0,control:0,live:0,original:0,copyId:copy.copyId,seal:copy.sealHash,actualT1:'false',sealed:true},events=[];
 let identityRows=[identity];class ConnectionPool{constructor(config){assert.equal(config.user,WORKTEST.reader);assert.equal(config.password,'fixture');assert.equal(config.pool.max,2);}async connect(){events.push('connect');return this;}request(){return {input(){return this;},async query(text){assert.equal(text,CARTON_IDENTITY_SQL);return {recordset:identityRows};}};}async close(){events.push('close');}}
 const config={server:copy.target.server,database:copy.target.database,sqlUser:WORKTEST.reader,sqlPassword:'fixture'},support=await initializePersistentTerminalSupport({config,context:copy,csp:"default-src 'self'",native:{ConnectionPool,UniqueIdentifier:'uuid'},assertDirectory:async()=>events.push('ACL')});
 assert.equal(support.homeRuntime.path,'/api/terminal-worktest/home-summary');assert.equal(support.homeRuntime.copyId,copy.copyId);await support.close();assert.deepEqual(events,['ACL','connect','close']);
 identityRows=[{...identity,login:'writer'}];await assert.rejects(()=>initializePersistentTerminalSupport({config,context:copy,csp:'',native:{ConnectionPool,UniqueIdentifier:'uuid'},assertDirectory:async()=>{}}),{code:'WORKTEST_DB_IDENTITY'});assert.equal(events.at(-1),'close');
 await assert.rejects(()=>initializePersistentTerminalSupport({config:{...config,sqlUser:copy.target.login},context:copy,csp:'',native:{ConnectionPool},assertDirectory:async()=>{}}),{code:'WORKTEST_DB_IDENTITY'});
});
