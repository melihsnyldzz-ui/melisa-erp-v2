import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import express from 'express';
import {isCanonicalBusinessSaleReadAllowed} from './canonicalBusinessSaleReadPolicy.mjs';

// Exact public EDB policy carried by frozen API BD84; hosted CI has no release
// directory. The fallback is a byte-pinned source fixture, not a rewritten gate.
const frozenLegacyPolicy="// These routes add authentication/permissions and validate the existing named\n// TEST scope before calling the canonical invoice, finance and movement services.\nexport function isCanonicalTestWriteAllowed(method,path,{writes=false,mode='native',protectedNormalAuth=false}={}){\n if(method==='POST'&&/^\\/api\\/auth\\/(?:login|terminal-login)$/.test(path))return true;\n if(!writes||mode!=='erp'||method!=='POST')return false;\n if(protectedNormalAuth===true&&/^\\/api\\/auth\\/(?:refresh|logout|session-confirm)$/.test(path))return true;\n if(/^\\/api\\/work-supplier-payments\\/(?:preview|payments(?:\\/[1-9]\\d*\\/cancel)?)$/.test(path))return true;\n if(/^\\/api\\/work-purchases\\/fx\\/(?:preview|receipts(?:\\/[1-9]\\d*\\/(?:approve|reject))?|drafts(?:\\/[1-9]\\d*\\/(?:finalize|cancel))?)$/.test(path))return true;\n if(/^\\/api\\/work-receiving\\/(?:count-drafts(?:\\/[1-9]\\d*\\/(?:update|submit|cancel))?|receipts\\/[1-9]\\d*\\/(?:approve|reject))$/.test(path)||/^\\/api\\/work-purchases\\/(?:preview|drafts(?:\\/[1-9]\\d*\\/(?:finalize|cancel))?)$/.test(path))return true;\n if(/^\\/api\\/work-sales\\/(?:preview|drafts(?:\\/[1-9]\\d*\\/(?:finalize|cancel))?)$/.test(path)||/^\\/api\\/work-collections(?:\\/preview|\\/[1-9]\\d*\\/cancel)?$/.test(path))return true;\n return /^\\/api\\/sales-invoices\\/(?:test-complete|[1-9]\\d*\\/cancel)$/.test(path)\n  || /^\\/api\\/finance\\/collections(?:\\/[1-9]\\d*\\/(?:cancel|refund))?$/.test(path)\n  || path==='/api/test-finance/preview'\n  || /^\\/api\\/test-purchase\\/(?:goods(?:\\/[1-9]\\d*\\/(?:approve|reject))?|invoices(?:\\/[1-9]\\d*\\/cancel)?)$/.test(path)\n  || /^\\/api\\/test-purchase\\/(?:batches(?:\\/[1-9]\\d*\\/(?:approve|reject))?|invoice-drafts(?:\\/[1-9]\\d*\\/(?:finalize|cancel))?)$/.test(path)\n  || /^\\/api\\/test-purchase-fx\\/(?:preview|receipts(?:\\/[1-9]\\d*\\/(?:approve|reject))?|invoice-drafts(?:\\/[1-9]\\d*\\/(?:finalize|cancel))?)$/.test(path)\n  || path==='/api/test-supplier-cards/13373/contact'\n  || path==='/api/products/301986/current-prices'\n  || /^\\/api\\/test-current-price-purchase\\/(?:preview|receipts(?:\\/[1-9]\\d*\\/(?:approve|reject))?|invoice-drafts(?:\\/[1-9]\\d*\\/(?:finalize|cancel))?)$/.test(path)\n  || /^\\/api\\/test-refund\\/(?:prepare|receive|[1-9]\\d*\\/cancel)$/.test(path)\n  || /^\\/api\\/test-payment\\/payments(?:\\/[1-9]\\d*\\/cancel)?$/.test(path)\n  || /^\\/api\\/test-daily\\/(?:purchase|sales|fx|count|count-cancel|return-cancel)\\/(?:prepare|draft|approve|reject|cancel|collect|preview|reverse|prepare-partial-goods|sale|purchase)$/.test(path);\n}\n";
const legacyHash='fa790698d79d7c4ab27f757a1c3e709f9f9343456a86b4bab6f514bb0a368bf1';
const hash=value=>createHash('sha256').update(value).digest('hex');
const frozenPath='C:/Sirket/ERP/releases/CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-CONTEXT-20261030/apps/api/src/services/canonicalTestRoutePolicy.mjs';
const actualLegacy=fs.existsSync(frozenPath)?fs.readFileSync(frozenPath,'utf8').replaceAll('\r\n','\n'):frozenLegacyPolicy;
assert.equal(hash(actualLegacy),legacyHash);assert.equal(hash(frozenLegacyPolicy),legacyHash);
const {isCanonicalTestWriteAllowed}=await import('data:text/javascript;base64,'+Buffer.from(actualLegacy).toString('base64'));
const actor={id:'17',username:'unified-semih-test',role:{id:'17',code:'unified_test_semih'},permissions:['sales.view','sales.create']};
let user=actor,identityError=null,authCalls=0;
const forbidden=()=>assert.fail('No database, native driver, finance or writer is available');
mock.module('./authService.js',{namedExports:{verifyAccessToken:token=>{authCalls++;if(token!=='fixture-session')throw Object.assign(Error('fixture token rejected'),{code:'AUTH_TOKEN_INVALID',statusCode:401});return {sub:'17'};},getUserById:async id=>{assert.equal(id,'17');return user;},verifyNormalTestAccessSession:()=>{if(identityError)throw identityError;}}});
mock.module('./canonicalTestAdminSession.mjs',{namedExports:{resolveTestAdminUser:(_req,_payload,current)=>current}});
mock.module('./workSalesService.mjs',{namedExports:{workSalesService:{}}});
mock.module('./businessSelectedSalePreviewStore.mjs',{namedExports:{businessSelectedSalePreviewStore:{preview:forbidden}}});
const {createWorkSalesRoutes}=await import('../routes/workSalesRoutes.mjs');
const starter=fs.readFileSync(new URL('../../start-canonical-test.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n');
const gateStart=starter.indexOf('app.use((req,res,next)=>{'),gateEnd=starter.indexOf('\n});',gateStart);
assert(gateStart>=0&&gateEnd>gateStart,'Actual startup global policy middleware must be present');
const gate=starter.slice(gateStart,gateEnd+4);
function createFixture({readPolicy=isCanonicalBusinessSaleReadAllowed,writes=true,mode='erp',businessSession={registered:true},error=null}={}){
 const app=express(),calls=[];app.disable('x-powered-by');
 const source=gate.replace(/^app\.use\(/,'').replace(/\);$/,'');
 const middleware=vm.runInNewContext('('+source+')',{isCanonicalTestWriteAllowed,isCanonicalBusinessSaleReadAllowed:readPolicy,writes,mode,businessSession});
 app.use(middleware);
 const service={selectedContext:async(input,current)=>{calls.push({input,current});if(error)throw error;return {meta:{source:'canonical-business-test',readOnly:true},revision:'a'.repeat(64),scope:{customer:{id:'155',accountId:'7',currency:'USD'}},writable:false};}};
 for(const name of ['context','preview','createDraft','finalize','cancel','list','invoice','request','selectionOptions'])service[name]=forbidden;
 app.use('/api',createWorkSalesRoutes({service}));
 app.use((err,_req,res,_next)=>res.status(err.statusCode??500).json({success:false,error:{code:err.code??'UNEXPECTED'}}));
 // Express router and middleware run in memory: no listener, socket, credentials
 // or native application startup is created by these regression tests.
 const request=(url,{method='POST',authorization='Bearer fixture-session',body={customerId:'155',customerAccountId:'7'}}={})=>new Promise((resolve,reject)=>{
  const headers=new Map(),req={method,url,headers:{...(authorization?{authorization}:{})},body,socket:{remoteAddress:'127.0.0.1'}};
  const res={statusCode:200,setHeader(name,value){headers.set(name.toLowerCase(),value);},getHeader(name){return headers.get(name.toLowerCase());},removeHeader(name){headers.delete(name.toLowerCase());},end(value){resolve({status:this.statusCode,value:value?JSON.parse(String(value)):null});}};
  app.handle(req,res,err=>err?reject(err):resolve({status:404,value:null}));
 });
 return {request,calls};
}

test('startup source differs from the frozen starter only by the pure read policy import and exact global predicate',()=>{
 const importLine="const {isCanonicalBusinessSaleReadAllowed}=await import('./src/services/canonicalBusinessSaleReadPolicy.mjs');\n";
 const predicate='&&!isCanonicalBusinessSaleReadAllowed(req.method,req.path,{writes,mode,protectedNormalAuth:!!businessSession})';
 assert.equal(starter.split(importLine).length,2);assert.equal(starter.split(predicate).length,2);
 const before=starter.replace(importLine,'').replace(predicate,'');
 assert.equal(hash(before),'e02047a0f2375c9242e17f0e2d799fa459637d97412103f99b8a7f148972988a');
});
test('selected native read policy is exact and only admits protected writable ERP POST selected-context',()=>{
 const p='/api/work-sales/selected-context',opts={writes:true,mode:'erp',protectedNormalAuth:true};assert.equal(isCanonicalBusinessSaleReadAllowed('POST',p,opts),true);
 for(const method of ['GET','HEAD','OPTIONS','PUT','PATCH','DELETE','post','POST\n'])assert.equal(isCanonicalBusinessSaleReadAllowed(method,p,opts),false);
 for(const suffix of ['/','/1','-extra','?x=1','\n','\r\n'])assert.equal(isCanonicalBusinessSaleReadAllowed('POST',p+suffix,opts),false);
 for(const path of ['/api/work-sales/selected-preview','/api/work-sales/preview','/api/work-sales/drafts','/api/work-sales/drafts/1/finalize','/api/work-sales/drafts/1/cancel','/api/finance/collections','/api/customers/155/contact','/API/work-sales/selected-context'])assert.equal(isCanonicalBusinessSaleReadAllowed('POST',path,opts),false);
 for(const value of [false,undefined,null,0,1,'true']){assert.equal(isCanonicalBusinessSaleReadAllowed('POST',p,{...opts,writes:value}),false);assert.equal(isCanonicalBusinessSaleReadAllowed('POST',p,{...opts,protectedNormalAuth:value}),false);}
 for(const mode of ['native','clean','ERP',undefined])assert.equal(isCanonicalBusinessSaleReadAllowed('POST',p,{...opts,mode}),false);
});
test('actual Express startup gate plus actual sales route changes frozen legacy 405 into the authenticated read handler only',async()=>{
 user=actor;identityError=null;authCalls=0;const prior=createFixture({readPolicy:()=>false}),next=createFixture();
 assert.deepEqual(await prior.request('/api/work-sales/selected-context'),{status:405,value:{success:false,error:{code:'TEST_WRITE_OUTSIDE_SCOPE',message:'Yalnız ayrı TEST kayıtlarına bağlı iş akışları açıktır.'}}});assert.deepEqual(prior.calls,[]);assert.equal(authCalls,0);
 const result=await next.request('/api/work-sales/selected-context');assert.equal(result.status,200);assert.equal(result.value.data.meta.readOnly,true);assert.equal(result.value.data.writable,false);assert.equal(next.calls.length,1);assert.equal(next.calls[0].current,actor);assert.deepEqual(next.calls[0].input,{customerId:'155',customerAccountId:'7'});assert.equal(authCalls,1);
});
test('actual global policy keeps wrong targets closed and never routes native, unprotected or readonly POSTs',async()=>{
 user=actor;identityError=null;
 for(const options of [{writes:false},{mode:'native'},{businessSession:null}]){const f=createFixture(options);assert.equal((await f.request('/api/work-sales/selected-context')).status,405);assert.deepEqual(f.calls,[]);}
 const f=createFixture();for(const path of ['/api/work-sales/selected-preview','/api/work-sales/selected-context-extra','/api/work-sales/selected-context/1','/api/customers/155/contact'])assert.equal((await f.request(path)).status,405);
 for(const method of ['PUT','PATCH','DELETE'])assert.equal((await f.request('/api/work-sales/selected-context',{method})).status,405);
 assert.equal((await f.request('/api/vega/sales')).status,403);assert.deepEqual(f.calls,[]);
 // Existing legacy write policy is not widened or disabled by this read seam.
 for(const path of ['/api/work-sales/drafts','/api/finance/collections'])assert.equal(isCanonicalTestWriteAllowed('POST',path,{writes:true,mode:'erp'}),true);
});
test('actual auth and both permission checks remain ahead of selected native reads',async()=>{
 const f=createFixture();user=actor;identityError=null;
 assert.equal((await f.request('/api/work-sales/selected-context',{authorization:null})).status,401);
 assert.equal((await f.request('/api/work-sales/selected-context',{authorization:'Bearer invalid'})).status,401);
 for(const permissions of [[],['sales.view'],['sales.create']]){user={...actor,permissions};assert.deepEqual(await f.request('/api/work-sales/selected-context'),{status:403,value:{success:false,error:{code:'AUTH_PERMISSION_DENIED'}}});}
 user=actor;identityError=Object.assign(Error('fixture normal identity invalid'),{code:'AUTH_NORMAL_TEST_SESSION_INVALID',statusCode:401});assert.equal((await f.request('/api/work-sales/selected-context')).status,401);identityError=null;assert.deepEqual(f.calls,[]);
});
test('native profile source account and revision rejections survive the exact read gate with no fallback or writes',async()=>{
 user=actor;identityError=null;
 for(const code of ['CANONICAL_BUSINESS_SALE_ADMISSION_REQUIRED','WORK_CANONICAL_SALE_SCOPE','WORK_SOURCE_ACCOUNT_CHANGED','WORK_REVISION_CONFLICT']){const error=Object.assign(Error('offline native scope rejected'),{code,statusCode:409}),f=createFixture({error});assert.deepEqual(await f.request('/api/work-sales/selected-context'),{status:409,value:{success:false,error:{code}}});assert.equal(f.calls.length,1);}
});
