import test from 'node:test';import assert from 'node:assert/strict';
import {businessPreviewNetwork,validateBusinessPreviewHealth,cleanPreviewRequestAllowed} from '../../vite.config.mjs';
import {businessWorkfaceId} from './businessWorkface.mjs';
const env=()=>({MELISA_BUSINESS_UI_NETWORK:'lan-tailscale-20261027',MELISA_BUSINESS_WORKFACE:businessWorkfaceId,VITE_API_BASE_URL:'http://127.0.0.1:4144',VITE_ERP_WORKFACE:businessWorkfaceId,BUSINESS_SOURCE_COMMIT:'1'.repeat(40),BUSINESS_PACKAGE_ID:'fixture-business-package',MELISA_BUSINESS_UI_TAILSCALE_PEERS:'100.90.1.1'});
const interfaces={fixture:[{family:'IPv4',internal:false,address:'192.168.1.46',netmask:'255.255.255.0'},{family:'IPv4',internal:false,address:'100.87.188.3',netmask:'255.255.255.255'}]};
test('business preview is opt-in and never repoints a CLEAN installation or opens an arbitrary interface',()=>{
 assert.equal(businessPreviewNetwork({}),false);assert.equal(businessPreviewNetwork(env(),interfaces),true);
 for(const patch of [{MELISA_CLEAN_TEST:'20261022'},{MELISA_CLEAN_UI_NETWORK:'lan-tailscale-20261022'},{VITE_API_BASE_URL:'http://127.0.0.1:4194'},{VITE_ERP_WORKFACE:'other'},{BUSINESS_SOURCE_COMMIT:'bad'},{MELISA_BUSINESS_UI_TAILSCALE_PEERS:'0.0.0.0'}])assert.throws(()=>businessPreviewNetwork({...env(),...patch},interfaces));
 assert.throws(()=>businessPreviewNetwork(env(),{}));
});
test('preview requires the pinned actual canonical backend and admitted normal identity before binding',()=>{
 const h={ok:true,environment:'CANONICAL_TEST',mode:'erp',port:4144,databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01',serverName:'Semih\\MELISADEV',loginName:'melisa_sirket_sales_test_20260929_01',databaseUser:'melisa_sirket_sales_test_20260929_01',sysadmin:0,databaseControl:0,liveDatabaseAccess:0,writes:true,sqlReadOnly:false,actualT1:false,externalOperations:false,automaticJobs:false,businessWorkfaceId,normalSessionUserId:17,persistentNormalSession:true,businessSessionSignerDomain:'dedicated-business-key-v1',sourceCommit:env().BUSINESS_SOURCE_COMMIT,packageId:env().BUSINESS_PACKAGE_ID};
 assert.equal(validateBusinessPreviewHealth(h,env()),h);
 for(const patch of [{environment:'CLEAN_SYNTHETIC_TEST'},{databaseName:'LIVE'},{databaseName:'MELISA_ERP_CLEAN_TEST_20261022'},{port:4194},{sysadmin:1},{normalSessionUserId:10018},{persistentNormalSession:false},{actualT1:true},{sourceCommit:'2'.repeat(40)},{packageId:'old-package'}])assert.throws(()=>validateBusinessPreviewHealth({...h,...patch},env()));
});
test('same-origin adapter keeps exact host, physical interface and forwarded-header rejection',()=>{
 const req={method:'POST',url:'/api/auth/refresh',socket:{localAddress:'192.168.1.46',remoteAddress:'192.168.1.50'},headers:{host:'192.168.1.46:5244',origin:'http://192.168.1.46:5244','sec-fetch-site':'same-origin'}};
 assert.equal(cleanPreviewRequestAllowed(req),true);
 for(const patch of [{host:'other:5244'},{origin:'http://127.0.0.1:5244'},{'x-forwarded-for':'127.0.0.1'},{'sec-fetch-site':'cross-site'}])assert.equal(cleanPreviewRequestAllowed({...req,headers:{...req.headers,...patch}}),false);
});

test('actual business middleware keeps host/origin and generic write guards while finite sale routes await genuine authenticated BFF dispatch',{timeout:5000},async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
 const {Readable}=await import('node:stream'),{createBusinessBrowserSessionTransport}=await import('../../business-preview-session.mjs');
 const {businessSaleBrowserRequestAllowed,businessWorkfaceRequestAllowed}=await import('./businessWorkface.mjs');
 const source=await readFile(new URL('../../vite.config.mjs',import.meta.url),'utf8'),start=source.indexOf('server.middlewares.use((req,res,next)=>',source.indexOf('const businessPreview=')),end=source.indexOf(');\n  const extra=',start);
 const actor={id:17,username:'unified-semih-test',role:{id:17,code:'unified_test_semih'},isActive:true,isAdmin:false,testAdminSession:false,nativeTerminalSession:false,permissions:['sales.view','sales.create','sales.finalize','sales.cancel','customer.view','product.view','finance.view']},upstream=[];
 let identity=actor;
 const transport=createBusinessBrowserSessionTransport({fetchImpl:async(url,options)=>{
  upstream.push({url,options});const auth=url==='http://127.0.0.1:4144/api/auth/me';
  return {ok:auth,status:auth?200:409,text:async()=>JSON.stringify(auth?{success:true,data:identity,meta:{source:'jwt-auth'}}:{success:false,error:{code:'WORK_STALE'}})};
 }});
 assert(start>0&&end>start);const handler=runInNewContext(source.slice(start+'server.middlewares.use('.length,end),{cleanPreviewRequestAllowed,businessWorkfaceRequestAllowed,businessSaleBrowserRequestAllowed,peers:[],sessionTransport:(req,res,next)=>{req.dispatched=true;return transport(req,res,next);}});
 const base={method:'POST',url:'/api/work-sales/preview',socket:{localAddress:'127.0.0.1',remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:5244',origin:'http://127.0.0.1:5244','sec-fetch-site':'same-origin'}};
 async function call({body,...patch}={}){
  const req=Object.assign(Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]),base,patch),out={status:null,next:false};
  // The middleware deliberately returns void. Completion is the real BFF
  // response end, not the synchronous outer handler's return value.
  await new Promise((resolve,reject)=>{try{handler(req,{writeHead(s){out.status=s;},end(value){try{out.body=JSON.parse(value);}catch{out.body=value;}resolve();}},()=>{out.next=true;resolve();});}catch(error){reject(error);}});
  return {...out,dispatched:req.dispatched===true};
 }
 for(const patch of [{},{method:'GET',url:'/api/work-sales/invoices/51'},{method:'GET',url:'/api/work-sales/requests/00000000-0000-4000-8000-000000000001'},{url:'/api/work-sales/drafts'},{url:'/api/work-sales/drafts/51/finalize'},{url:'/api/work-sales/drafts/51/cancel'}]){const r=await call(patch);assert.equal(r.status,401);assert.equal(r.body.error.code,'AUTH_TOKEN_REQUIRED');assert.equal(r.dispatched,true);assert.equal(r.next,false);}
 assert.equal(upstream.length,0);
 for(const headers of [{...base.headers,host:'other:5244'},{...base.headers,origin:'http://elsewhere:5244'},{...base.headers,'x-forwarded-for':'127.0.0.1'},{...base.headers,'sec-fetch-site':'cross-site'}]){const r=await call({url:'/api/work-sales/drafts',headers});assert.equal(r.status,403);assert.equal(r.dispatched,false);assert.equal(r.next,false);}
 for(const [method,url] of [['GET','/api/work-sales/invoices'],['GET','/api/work-sales/invoices/51?accountId=7'],['POST','/api/work-sales/drafts/51/collect'],['POST','/api/work-sales/drafts/51/finalize?actorId=17'],['POST','/api/work-collections'],['POST','/api/work-receiving/count-drafts']]){const r=await call({method,url});assert.equal(r.status,403);assert.equal(r.dispatched,false);assert.equal(r.next,false);}
 assert.equal(upstream.length,0);
 const headers={...base.headers,authorization:'Bearer fixture-access'},requestId='00000000-0000-4000-8000-000000000001',expectedRevision='a'.repeat(64),draft={requestId,expectedRevision,previewHash:'b'.repeat(64),customerId:'155',customerAccountId:'7',documentDate:'2026-10-28',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'1.000'}]};
 for(const body of [{},{...draft,actorId:'17'},{...draft,requestId:requestId+'\n'},{...draft,items:[{...draft.items[0],quantityExact3:'6.000'}]}]){const r=await call({url:'/api/work-sales/drafts',headers,body});assert.equal(r.status,400);assert.equal(r.next,false);}
 assert.equal(upstream.length,0);
 for(const [url,body] of [['/api/work-sales/drafts',draft],['/api/work-sales/drafts/51/finalize',{requestId,expectedRevision}],['/api/work-sales/drafts/51/cancel',{requestId,expectedRevision,reason:'Sentetik iptal'}]]){
  const before=upstream.length,r=await call({url,headers,body});assert.equal(r.status,409);assert.equal(r.body.error.code,'WORK_STALE');assert.equal(r.next,false);assert.equal(upstream.length,before+2);
  const [auth,mutation]=upstream.slice(before);assert.equal(auth.url,'http://127.0.0.1:4144/api/auth/me');assert.equal(auth.options.method,'GET');assert.equal(mutation.url,'http://127.0.0.1:4144'+url);assert.equal(mutation.options.method,'POST');assert.deepEqual(JSON.parse(mutation.options.body),body);assert([auth,mutation].every(c=>c.options.headers.Authorization==='Bearer fixture-access'&&c.options.headers.cookie===undefined&&c.options.redirect==='error'&&c.options.cache==='no-store'));
 }
 const before=upstream.length;identity={...actor,permissions:actor.permissions.filter(p=>p!=='sales.finalize')};const denied=await call({url:'/api/work-sales/drafts/51/finalize',headers,body:{requestId,expectedRevision}});assert.equal(denied.status,403);assert.equal(upstream.length,before+1);assert.equal(upstream.at(-1).url,'http://127.0.0.1:4144/api/auth/me');
});
