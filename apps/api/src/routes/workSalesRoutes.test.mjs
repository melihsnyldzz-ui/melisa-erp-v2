import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {isDailyWebRequest} from '../services/dailyWebPolicy.mjs';
import vm from 'node:vm';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {businessSaleNativeOperationPreviewAllowed} from '../../../sites-workflow/src/workflow/businessWorkface.mjs';

// The actual permission middleware remains loaded. Its unused auth backend
// cannot import a native driver or open SQL in this isolated route test.
const noAuthBackend=()=>{assert.fail('Route fixture must not access the auth database');};
mock.module('../services/authService.js',{namedExports:{getUserById:noAuthBackend,verifyAccessToken:noAuthBackend,verifyNormalTestAccessSession:noAuthBackend}});
const {createWorkSalesRoutes}=await import('./workSalesRoutes.mjs');

const selection={customerId:'100',currency:'USD',productIds:['444']};
const sale={customerId:'100',currency:'USD',documentDate:'2026-10-09',items:[{productId:'444',quoteId:'101',quantityExact3:'1.000'}]};
const context={meta:{schemaVersion:'melisa-selected-sale-context.v1',readOnly:true,date:'2026-10-09'},writable:false,scope:{customer:{id:'100',accountId:'5100',currency:'USD'},accounts:[],products:[{id:'444',stockQuantityExact3:'10.000',prices:[{quoteId:'101',unitPriceExact8:'2.12345678',currency:'USD'}]}]}};
const preview={schemaVersion:'melisa-selected-sale-preview.v1',writable:false,writeAuthorized:false,currency:'USD',grandTotalExact4:'2.1235',amountTryExact4:'101.5033',settlement:{accountId:'5100'}};
async function withServer(run,{selectedError=null}={}){
 const calls=[],authCalls=[],errors=[],app=express();app.use(express.json());
 const users={both:{id:'16',permissions:['sales.view','sales.create','sales.finalize','sales.cancel']},view:{id:'15',permissions:['sales.view']},create:{id:'16',permissions:['sales.create']}};
 const authenticate=(req,res,next)=>{authCalls.push(req.originalUrl);const name=req.get('authorization')?.replace(/^Bearer /,'');if(!users[name])return res.status(401).json({code:'AUTH_TOKEN_REQUIRED'});req.user=users[name];next();};
 const selectedService=Object.fromEntries([['context',context],['preview',preview]].map(([name,value])=>[name,async(input,actor)=>{calls.push({family:'selected',name,input,actor,scope:isDailyWebRequest()});if(selectedError)throw selectedError;return value;}]));
 const service=Object.fromEntries(['context','preview','createDraft','finalize','cancel','list','invoice','request'].map(name=>[name,async(...args)=>{calls.push({family:'old',name,args,scope:isDailyWebRequest()});return {old:name};}]));
 service.selectedContext=selectedService.context;
 service.selectionOptions=async actor=>{calls.push({family:'selected',name:'selectionOptions',actor,scope:isDailyWebRequest()});return {enabled:false};};
 // Keep the actual permission middleware; only authentication is synthetic.
 app.use('/api',createWorkSalesRoutes({authenticate,service,selectedService}));
 app.post('/api/auth/login',(_req,res)=>res.json({success:true}));app.get('/api/unrelated',(_req,res)=>res.json({success:true}));
 app.use((error,_req,res,_next)=>{errors.push(error);res.status(error.statusCode??500).json({success:false,code:error.code??'UNKNOWN'});});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const request=async(path,{method='POST',user='both',body}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{...(user?{authorization:'Bearer '+user}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:response.status,value:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};};
 try{await run({request,calls,authCalls,errors,users});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}

test('authenticated selected POST routes forward exact body, actor and cost-free readonly DTO',async()=>{
 await withServer(async({request,calls,users})=>{
  assert.deepEqual(await request('/work-sales/selected-context',{body:selection}),{status:200,value:{success:true,data:context}});
  assert.deepEqual(await request('/work-sales/selected-preview',{body:sale}),{status:200,value:{success:true,data:preview}});
  assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.name),['context','preview']);assert.deepEqual(calls[0].input,selection);assert.deepEqual(calls[1].input,sale);assert(calls.every(c=>c.family==='selected'&&c.actor===users.both&&c.scope===false));
  assert.equal('costExact4' in context.scope.products[0],false);assert.equal('balanceExact4' in context.scope.customer,false);assert.equal(preview.writable,false);assert.equal(preview.writeAuthorized,false);
 });
});
test('selected routes require authentication and both native-facing sales permissions',async()=>{
 await withServer(async({request,calls})=>{
  for(const path of ['/work-sales/selected-context','/work-sales/selected-preview']){
   assert.equal((await request(path,{user:null,body:selection})).status,401);
   for(const user of ['view','create'])assert.deepEqual(await request(path,{user,body:selection}),{status:403,value:{success:false,code:'AUTH_PERMISSION_DENIED'}});
  }
  assert.deepEqual(calls,[]);
 });
});
test('new methods and paths do not intercept unrelated endpoints or open writer routes',async()=>{
 await withServer(async({request,calls,authCalls})=>{
  for(const method of ['GET','PUT','PATCH','DELETE'])for(const path of ['/work-sales/selected-context','/work-sales/selected-preview'])assert.equal((await request(path,{method,user:null})).status,404);
  for(const path of ['/work-sales/selected-context/444','/work-sales/selected-preview/drafts','/work-sales/selected-preview/finalize','/work-sales/selected-context-extra'])assert.equal((await request(path,{user:null})).status,404);
  assert.equal((await request('/auth/login',{user:null})).status,200);assert.equal((await request('/unrelated',{method:'GET',user:null})).status,200);assert.deepEqual(calls,[]);assert.deepEqual(authCalls,[]);
 });
});
test('selected service rejection reaches error middleware unchanged with no old service fallback',async()=>{
 for(const code of ['WORK_INPUT_INVALID','SELECTED_SALE_NATIVE_READ_PIN','SELECTED_SALE_READ_ROLLBACK_FAILED']){
  const primary=Object.assign(Error('offline rejection'),{code,statusCode:code==='WORK_INPUT_INVALID'?400:503});
  await withServer(async({request,calls,errors})=>{for(const path of ['/work-sales/selected-context','/work-sales/selected-preview'])assert.deepEqual(await request(path,{body:sale}),{status:primary.statusCode,value:{success:false,code}});assert.equal(calls.length,2);assert(calls.every(c=>c.family==='selected'));assert.deepEqual(errors,[primary,primary]);},{selectedError:primary});
 }
});
test('all existing route/service signatures, permissions and daily boundaries remain unchanged',async()=>{
 await withServer(async({request,calls})=>{
  const cases=[['GET','/work-sales/context','context',[],false],['POST','/work-sales/preview','preview',[sale],true],['POST','/work-sales/drafts','createDraft',[sale],true],['POST','/work-sales/drafts/444/finalize','finalize',['444',sale],true],['POST','/work-sales/drafts/444/cancel','cancel',['444',sale],true],['GET','/work-sales/invoices?page=2','list',[{page:'2'}],false],['GET','/work-sales/invoices/444','invoice',['444'],false],['GET','/work-sales/requests/444','request',['444'],false]];
  for(const [method,path,name,args,scope] of cases){assert.deepEqual(await request(path,{method,...(method==='POST'?{body:sale}:{})}),{status:200,value:{success:true,data:{old:name}}});const call=calls.at(-1);assert.equal(call.family,'old');assert.equal(call.name,name);assert.deepEqual(call.args.slice(0,-1),args);assert.equal(call.args.at(-1).id,'16');assert.equal(call.scope,scope);}
  assert.equal((await request('/work-sales/context',{method:'GET',user:'view'})).status,200);assert.equal((await request('/work-sales/preview',{user:'create',body:sale})).status,200);
  const before=calls.length;assert.equal((await request('/work-sales/drafts/444/finalize',{user:'create',body:sale})).status,403);assert.equal(calls.length,before);assert(calls.every(c=>c.family==='old'));
 });
});

// This separate VM loads the production router/service/model, with only native
// authority, auth backing storage and the Router transport replaced. No socket,
// credential, native driver or SQL is available. On the package host, unchanged
// modules come from frozen API560c; only the three reviewed files use source.
const previewOverlayFiles=new Set(['apps/api/src/routes/workSalesRoutes.mjs','apps/api/src/services/businessSelectedSalePreviewStore.mjs','apps/api/src/services/businessSelectedSalePreview.mjs']);
const previewSourceRoot=path.resolve(fileURLToPath(new URL('../../../../',import.meta.url)));
const previewBaseRoot='C:/Sirket/ERP/releases/CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029';
const previewLinkedRoot='C:/Sirket/ERP/releases/CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-LINK-20261030';
const json=value=>JSON.parse(JSON.stringify(value));
async function previewPackageFixture(useFrozenBase=true){
 const present=async value=>access(value).then(()=>true,()=>false),basePresent=useFrozenBase&&await present(path.join(previewBaseRoot,'apps/api/src/routes/workSalesRoutes.mjs'));
 const sandbox=vm.createContext({console:{log(){},error(){}},process:Object.freeze({argv:Object.freeze(['node','offline-route-fixture']),env:Object.freeze({})}),URL,TextEncoder,TextDecoder,structuredClone}),modules=new Map(),brands=new WeakSet(),boundaries=[],loaded=new Set();
 const synthetic=(key,exports)=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [name,value]of Object.entries(exports))this.setExport(name,value);},{identifier:key,context:sandbox});
 const routers=[];
 const Router=()=>{const rows=[],uses=[],r={rows,uses,use(fn){uses.push(fn);}};for(const method of ['get','post'])r[method]=(route,...handlers)=>rows.push({method:method.toUpperCase(),route,handlers});routers.push(r);return r;};
 const failBoundary=()=>{boundaries.push('forbidden');throw Error('PACKAGE_FIXTURE_NATIVE_AUTH_OR_SQL_FORBIDDEN');};
 const replacements=new Map([
  ['express',{Router}],
  ['apps/api/src/services/authService.js',{getUserById:failBoundary,verifyAccessToken:failBoundary,verifyNormalTestAccessSession:failBoundary}],
  ['apps/api/src/services/canonicalTestAdminSession.mjs',{resolveTestAdminUser:failBoundary}],
  ['apps/api/src/services/canonicalBusinessSessionContext.mjs',{getCanonicalBusinessSaleContextProof:value=>brands.has(value)?value:null}],
  ['apps/api/src/config/database.js',{isIsolatedOperationCopyRuntime:()=>false,getIsolatedOperationCopyConfig:failBoundary,getSqlPool:failBoundary,getSqlDriver:failBoundary}]
 ]);
 async function getModule(key){
  if(modules.has(key))return modules.get(key);
  let module;if(replacements.has(key))module=synthetic(key,replacements.get(key));
  else if(key.startsWith('node:'))module=synthetic(key,await import(key));
  else{
   assert(!path.isAbsolute(key)&&!key.startsWith('../'),'Relative package closure escaped its root');
   const root=basePresent&&!previewOverlayFiles.has(key)?previewBaseRoot:previewSourceRoot,source=await readFile(path.join(root,key),'utf8');loaded.add(key);
   module=new vm.SourceTextModule(source,{identifier:key,context:sandbox,initializeImportMeta(meta){meta.url=pathToFileURL(path.join(root,key)).href;},importModuleDynamically:async(specifier,parent)=>{const dependency=await resolve(specifier,parent);if(dependency.status==='unlinked')await dependency.link(resolve);if(dependency.status==='linked')await dependency.evaluate();return dependency;}});
  }modules.set(key,module);return module;
 }
 async function resolve(specifier,parent){return getModule(specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier),specifier)):specifier);}
 const route=await getModule('apps/api/src/routes/workSalesRoutes.mjs');await route.link(resolve);await route.evaluate();
 const service=modules.get('apps/api/src/services/workSalesService.mjs').namespace,model=modules.get('apps/api/src/services/workSalesModel.mjs').namespace;
 const selection={customerId:'155',customerAccountId:'7',documentDate:'2026-10-28',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'2.000'}]};
 const context={meta:{schemaVersion:'melisa-work-trade.v1',date:selection.documentDate,source:'canonical-business-test',operationOrigin:'CANONICAL_TEST_BUSINESS_SALE'},revision:'a'.repeat(64),nativePreviewHash:'b'.repeat(64),profileHash:'c'.repeat(64),capabilities:{canCreate:true,canFinalize:true,canCancel:true,canCollect:false,canCancelCollection:false},supportedCurrencies:['TRY','USD','EUR'],limits:{maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000',maxAmountTryExact4:'500.0000'},scope:{synthetic:false,operationOrigin:'CANONICAL_TEST_BUSINESS_SALE',customer:{id:'155',accountId:'7',partyId:'6',currency:'USD',sourceKey:'FIXTURE/CUSTOMER/155',writeEligible:true,balanceExact8:'0.00000000'},products:[{id:'12',stockCode:'0012 SYN',name:'Fixture product',barcode:'000012',sourceKey:'FIXTURE/PRODUCT/12',sourceWitnessHash:'d'.repeat(64),synthetic:false,operationOrigin:'CANONICAL_TEST_BUSINESS_SALE',writeEligible:true,stockQuantityExact3:'9.000',unit:{label:'ADET',factorExact8:'1.00000000',sourceId:'9'},costExact4:'0.5000',prices:[{quoteId:'81',currency:'USD',unitPriceExact8:'1.23456789'}]}]},rate:{currency:'USD',rateExact8:'2.00000000',rateDate:'2026-10-27',sourceKey:'FIXTURE/RATE'},nativeExpected:{items:[{productId:'12',quoteId:'81',quantityExact3:'2.000',unitPriceExact4:'1.2346',lineTotalExact4:'2.4692'}],grandTotalExact4:'2.4692',amountTryExact4:'4.9384'}};
 Object.assign(context.scope.customer,{synthetic:false,operationOrigin:'CANONICAL_TEST_BUSINESS_SALE'});
 context.supportedCurrencies=[selection.currency];
 brands.add(context);let canonical=true;const calls=[];
 const adapter={context,selectedSaleEnabled:true,selectedSaleContext:async input=>{calls.push(['selected-context',json(input)]);return context;},selectedSalePreview:async input=>{calls.push(['preview',json(input)]);return model.workSalePreview(input,context);}};
 const store={isCanonicalBusinessSale:async()=>canonical,context:async()=>{calls.push(['context']);return {revision:'0'.repeat(64),capabilities:context.capabilities};},read:async(_actor,callback)=>callback(adapter),mutate:failBoundary,mutateSelectedSale:failBoundary};
 const actualService=service.createWorkSalesService({getStore:async()=>store}),authenticated={id:'17',permissions:['sales.view','sales.create']};
 const authenticate=(req,_res,next)=>req.user?next():next(Object.assign(Error('fixture missing normal session'),{code:'AUTH_TOKEN_REQUIRED',statusCode:401}));
 const router=route.namespace.createWorkSalesRoutes({authenticate,service:actualService});
 async function request(method,url,body,user=authenticated){const found=router.rows.find(row=>row.method===method&&row.route===url);assert(found,'Expected exact route');const req={method,path:url,body,user},res={json(value){res.value=json(value);}};const handlers=[...router.uses,...found.handlers];let index=0;async function next(error){if(error)throw error;const fn=handlers[index++];if(!fn)return;let continuation;await fn(req,res,error=>{continuation=next(error);return continuation;});await continuation;}await next();return res.value;}
 return {basePresent,loaded,boundaries,brands,context,selection,calls,adapter,authenticated,request,setCanonical:value=>{canonical=value;},model,present};
}

test('preview-link package: hybrid imports and normal context/selected-context/preview stay isolated and public',async()=>{
 for(const f of [await previewPackageFixture(),await previewPackageFixture(false)]){
 const base=await f.request('GET','/work-sales/context');assert.equal(base.data.revision,'0'.repeat(64));
 const selected=await f.request('POST','/work-sales/selected-context',f.selection),preview=await f.request('POST','/work-sales/preview',f.selection);
 assert.deepEqual(f.calls.map(row=>row[0]),['context','selected-context','preview']);assert.equal(selected.data.scope.customer.accountId,'7');assert.equal(preview.data.scopeRevision,selected.data.revision);assert.equal(preview.data.previewHash,'b'.repeat(64));assert.equal(preview.data.settlement.accountId,'7');assert.equal(preview.data.grandTotalExact4,'2.4692');
 for(const name of ['profileHash','nativePreviewHash','nativeExpected','costExact4','sourceWitnessHash','sourceKey','sourceId'])assert.equal(JSON.stringify(selected).includes('"'+name+'"'),false,name);
 assert.equal(businessSaleNativeOperationPreviewAllowed({context:selected.data,preview:preview.data},f.selection),true);
 assert.throws(()=>f.model.workSalePreview(f.selection,selected.data),{code:'WORK_CANONICAL_SALE_SCOPE'});assert.deepEqual(f.boundaries,[]);
 for(const leaf of previewOverlayFiles)assert(f.loaded.has(leaf),leaf);
 }
});
test('preview-link package: permissions, profile/brand, account and fresh quote failures never fall back or mutate',async()=>{
 const f=await previewPackageFixture();
 for(const endpoint of ['/work-sales/selected-context','/work-sales/preview']){
  await assert.rejects(f.request('POST',endpoint,f.selection,null),{code:'AUTH_TOKEN_REQUIRED'});
  await assert.rejects(f.request('POST',endpoint,f.selection,{id:'17',permissions:['sales.view']}),{code:'AUTH_PERMISSION_DENIED'});
 }
 await assert.rejects(f.request('POST','/work-sales/selected-context',f.selection,{id:'17',permissions:['sales.create']}),{code:'AUTH_PERMISSION_DENIED'});assert.deepEqual(f.calls,[]);
 f.setCanonical(false);await assert.rejects(f.request('POST','/work-sales/selected-context',f.selection),{code:'WORK_SELECTED_SALE_UNAVAILABLE'});f.setCanonical(true);
 f.adapter.selectedSaleContext=async()=>structuredClone(f.context);await assert.rejects(f.request('POST','/work-sales/selected-context',f.selection),{code:'WORK_CANONICAL_SALE_SCOPE'});
 for(const selection of [{...f.selection,customerAccountId:'8'},{...f.selection,items:[{...f.selection.items[0],quoteId:'82'}]}])await assert.rejects(f.request('POST','/work-sales/preview',selection));
 f.adapter.selectedSaleContext=async()=>f.context;const selected=await f.request('POST','/work-sales/selected-context',f.selection),oldRevision=f.context.revision;
 f.context.revision='e'.repeat(64);const fresh=await f.request('POST','/work-sales/preview',f.selection);assert.notEqual(fresh.data.scopeRevision,oldRevision);assert.equal(fresh.data.scopeRevision,f.context.revision);
 assert.equal(businessSaleNativeOperationPreviewAllowed({context:selected.data,preview:fresh.data},f.selection),false,'stale selected-context cannot bind a fresh preview');
 const wrongQuote=json(fresh.data);wrongQuote.items[0].quoteId='82';assert.equal(businessSaleNativeOperationPreviewAllowed({context:{...selected.data,revision:f.context.revision},preview:wrongQuote},f.selection),false);
 assert.deepEqual(f.boundaries,[]);
});
test('preview-link package: selected-preview retains the DB02 reader boundary and is never a B6 alias',async()=>{
 const f=await previewPackageFixture();await assert.rejects(f.request('POST','/work-sales/selected-preview',f.selection),{code:'WORK_INPUT_INVALID'});
 const {customerAccountId,...legacy}=f.selection;await assert.rejects(f.request('POST','/work-sales/selected-preview',legacy),{code:'SELECTED_SALE_READ_RUNTIME'});assert.deepEqual(f.calls,[]);assert.deepEqual(f.boundaries,[]);
});
test('preview-link package: static and literal dynamic relative imports close over frozen base plus exactly three overlays',async t=>{
 const f=await previewPackageFixture(),seen=new Set(),pending=['apps/api/src/routes/workSalesRoutes.mjs'];
 while(pending.length){const key=pending.pop();if(seen.has(key))continue;seen.add(key);assert(!key.startsWith('../')&&!path.isAbsolute(key));
  const root=f.basePresent&&!previewOverlayFiles.has(key)?previewBaseRoot:previewSourceRoot,source=await readFile(path.join(root,key),'utf8');
  for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(\.[^'"]+)\1/g))pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(key),match[2])));
 }
 for(const key of previewOverlayFiles)assert(seen.has(key));if(f.basePresent)assert.equal(seen.size,115,'Frozen API560c closure changed; review the overlay rather than silently expanding it');
 t.diagnostic(`${f.basePresent?'frozen API560c plus three overlays':'source-only CI fixture'}: ${seen.size} relative modules; native dynamic imports read, never executed`);
});
test('preview-link package: passive overlay when present has exact three source blobs and unchanged native core',async t=>{
 const f=await previewPackageFixture();if(!await f.present(path.join(previewLinkedRoot,'release-manifest.json'))){t.skip('Passive package not present: this check proves no installed/package result');return;}
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),manifest=JSON.parse(await readFile(path.join(previewLinkedRoot,'release-manifest.json'),'utf8'));
 assert.equal(manifest.apiOverlaySourceCommit,'d4a7ec26edc22cb7cd707dc2fe4fdb209adf9d5c');assert.deepEqual(manifest.apiOverlayFiles.map(row=>row.path).sort(),[...previewOverlayFiles].sort());
 for(const row of manifest.apiOverlayFiles){const bytes=await readFile(path.join(previewLinkedRoot,row.path));assert.equal(bytes.length,row.bytes);assert.equal(digest(bytes),row.sha256.toLowerCase());assert.deepEqual(bytes,await readFile(path.join(previewSourceRoot,row.path)));}
 for(const leaf of ['workSalesService.mjs','workSalesModel.mjs','workTradeStore.mjs','canonicalBusinessSessionContext.mjs','canonicalBusinessSaleRuntime.mjs']){const key='apps/api/src/services/'+leaf;assert.deepEqual(await readFile(path.join(previewLinkedRoot,key)),await readFile(path.join(previewBaseRoot,key)));}
});
