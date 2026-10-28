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

test('actual business middleware applies host/origin guard before exact authenticated dispatch and never generic-proxies a write',async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
 const {businessSaleBrowserRequestAllowed,businessWorkfaceRequestAllowed}=await import('./businessWorkface.mjs');
 const source=await readFile(new URL('../../vite.config.mjs',import.meta.url),'utf8'),start=source.indexOf('server.middlewares.use((req,res,next)=>',source.indexOf('const businessPreview=')),end=source.indexOf(');\n  const extra=',start);
 assert(start>0&&end>start);const handler=runInNewContext(source.slice(start+'server.middlewares.use('.length,end),{cleanPreviewRequestAllowed,businessWorkfaceRequestAllowed,businessSaleBrowserRequestAllowed,peers:[],sessionTransport:(req,res,next)=>{req.dispatched=true;res.end('authenticated-dispatch');}});
 const base={method:'POST',url:'/api/work-sales/preview',socket:{localAddress:'127.0.0.1',remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:5244',origin:'http://127.0.0.1:5244','sec-fetch-site':'same-origin'}};
 function call(patch={}){const req={...base,...patch},out={status:null,next:false};handler(req,{writeHead(s){out.status=s;},end(value){out.body=value;}},()=>{out.next=true;});return {...out,dispatched:req.dispatched===true};}
 assert.equal(call().dispatched,true);assert.equal(call({method:'GET',url:'/api/work-sales/invoices/51'}).dispatched,true);assert.equal(call({method:'GET',url:'/api/work-sales/requests/00000000-0000-4000-8000-000000000001'}).dispatched,true);
 for(const headers of [{...base.headers,origin:'http://elsewhere:5244'},{...base.headers,'x-forwarded-for':'127.0.0.1'},{...base.headers,'sec-fetch-site':'cross-site'}]){const r=call({headers});assert.equal(r.status,403);assert.equal(r.dispatched,false);assert.equal(r.next,false);}
 for(const [method,url] of [['GET','/api/work-sales/invoices'],['GET','/api/work-sales/invoices/51?accountId=7'],['POST','/api/work-sales/drafts'],['POST','/api/work-sales/drafts/51/finalize'],['POST','/api/work-sales/drafts/51/cancel'],['POST','/api/work-collections']]){const r=call({method,url});assert.equal(r.status,403);assert.equal(r.dispatched,false);assert.equal(r.next,false);}
});
