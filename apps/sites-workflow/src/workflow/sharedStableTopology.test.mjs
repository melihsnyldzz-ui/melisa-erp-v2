import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SHARED_STABLE_ORIGIN,SHARED_STABLE_DATABASE,isSharedStableLocation,sharedStableApiBase} from './sharedStableTopology.mjs';
import {resolveTestApiBase,shouldAutoOpenTestAdmin} from './testAdminSession.mjs';
import {validateOperationCopyBootstrap,operationCopyFromMeta} from './isolatedOperationCopyModel.mjs';
import {createWorkingCatalogSession,workingCatalogTokenKey} from './workingCatalogSession.mjs';
import {createBusinessSupplierSelection} from './businessSupplierSelection.mjs';
import {createPaymentJournal} from './workSupplierPaymentsModel.mjs';
import {mountCopyActorSelector} from './workCopyActorSelector.mjs';
import {terminalCrmUrl,terminalMessage} from './personnelTerminalModel.mjs';
const location=Object.freeze({origin:SHARED_STABLE_ORIGIN,protocol:'https:',hostname:'semih.tail295701.ts.net',port:'8443',host:'semih.tail295701.ts.net:8443'});
const apiBase=SHARED_STABLE_ORIGIN;
const uuid='00000000-0000-4000-8000-000000000001';
function profile(){return {schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:'ISOLATED_TEST_COPY',scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'a'.repeat(64),businessInvoiceMaxExact4:'20000.0000',copyId:uuid,sealHash:'b'.repeat(64),backupSHA:'c'.repeat(64),sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:SHARED_STABLE_DATABASE},date:'2026-10-09',actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:[{id:'101',supplierId:'601',sourceKey:'VEGA2026/F0102TBLSTOKLAR/101',stockCode:'SYN-101',unit:'ADET',unitFactorExact8:'1.00000000',priceIds:[],barcodes:['000101']}],customers:[{id:'501',partyId:'501',accountId:'801',currency:'TRY',sourceKey:'VEGA2026/F0102TBLCARI/501'}],suppliers:[{id:'601',partyId:'601',accountId:'901',currency:'TRY',sourceKey:'VEGA2026/F0103TBLCARI/601'}],financeAccounts:[{id:'701',currency:'TRY'}],businessDaily:{scopeHash:'d'.repeat(64),selection:{currency:'TRY',customerAccountId:'801',supplierAccountId:'901',financeAccountId:'701',productIds:['101']}}};}
function store(){const map=new Map([['saved-draft','keep'],['melisa-work-supplier-payment:http://127.0.0.1:4184:16','legacy-kept']]);return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
const user={id:16,displayName:'Personnel',role:{code:'isolated_test_ilker'},permissions:['product.view','goods.view']};
const reply=data=>({ok:true,status:200,json:async()=>({success:true,data})});

test('actual API configuration selects stable origin while the same package keeps its legacy build target',async()=>{
 const config=await readFile(new URL('../config/apiConfig.js',import.meta.url),'utf8'),helper=new URL('./sharedStableTopology.mjs',import.meta.url).href;
 const source=config.replace("'../workflow/sharedStableTopology.mjs'",JSON.stringify(helper)).replaceAll('import.meta.env',JSON.stringify({VITE_API_BASE_URL:'http://127.0.0.1:4184'}));
 const previous=globalThis.window;
 try{for(const [name,current,expected] of [['stable',location,apiBase],['legacy',{protocol:'http:',hostname:'127.0.0.1',port:'5234',origin:'http://127.0.0.1:5234'},'http://127.0.0.1:4184']]){globalThis.window={location:current};const module=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+name).toString('base64'));assert.equal(module.API_BASE_URL,expected);assert.equal(module.API_BASE_URL.endsWith('/api'),false);}}
 finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('stable transport rejects origin spoofing, alternate host/port/protocol and cross-target APIs',()=>{
 assert.equal(isSharedStableLocation(location),true);
 assert.equal(sharedStableApiBase({location,apiBase}),apiBase);
 assert.equal(resolveTestApiBase({location,apiBase}),apiBase);
 for(const patch of [{origin:'https://other.ts.net:8443'},{hostname:'other.ts.net'},{protocol:'http:'},{port:'443'},{origin:undefined}]){
  const changed={...location,...patch};assert.equal(isSharedStableLocation(changed),false);assert.equal(resolveTestApiBase({location:changed,apiBase}),null);assert.throws(()=>terminalCrmUrl(changed));
 }
 for(const base of ['http://127.0.0.1:4184','http://192.168.1.46:4184',apiBase+'/api',apiBase+'/',apiBase.replace(':8443',''),'/api','https://other.ts.net:8443'])assert.equal(resolveTestApiBase({location,apiBase:base}),null);
 for(const mode of [undefined,'admin','manual'])assert.equal(shouldAutoOpenTestAdmin({location,apiBase,mode}),false);
});

test('stable copy preserves DB02 seal/source/business bounds and rejects old copies or fabricated scope',()=>{
 const p=profile();assert.equal(validateOperationCopyBootstrap(p,location),p);
 const meta={operationOrigin:p.operationOrigin,copyId:p.copyId,sealHash:p.sealHash,date:p.date};assert.equal(operationCopyFromMeta(meta,{profile:p,location}),p);
 for(const mutate of [x=>x.target.database='MELISA_ERP_SIRKET_TEST_20260929_01',x=>x.target.database='MELISA_ERP_CRM_SHARED_TEST_20261009_01',x=>x.sourceDatabase='VEGA2026',x=>x.scopeKind='SYNTHETIC',x=>x.businessScopeHash='bad',x=>x.businessInvoiceMaxExact4='999999.0000',x=>x.products[0].unitFactorExact8='2.00000000',x=>x.actors[0].role='admin']){const x=structuredClone(p);mutate(x);assert.throws(()=>validateOperationCopyBootstrap(x,location));}
 assert.throws(()=>operationCopyFromMeta({...meta,sealHash:'e'.repeat(64)},{profile:p,location}));
 assert.throws(()=>operationCopyFromMeta({}, {profile:p,location}));
});

test('stable normal login/read keeps drafts, carries existing token and cannot mint either TEST convenience identity',async()=>{
 const calls=[],storage=store(),p=profile();
 const session=createWorkingCatalogSession({location,apiBase,copyProfile:p,storage,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/auth/login')?reply({user,accessToken:'normal-login-fixture'}):reply({readable:true});}});
 assert.equal(await session.start(),null);assert.equal(calls.length,0);
 await assert.rejects(()=>session.selectCopyActor('15'),e=>e.status===403&&/yeniden giriş/.test(e.message));assert.equal(calls.length,0);
 assert.equal((await session.login({username:'personnel',password:'offline-fixture'})).id,16);
 await session.api('/api/catalog/products?barcode=000101');await session.inbound('/api/work-receiving/context');
 assert.deepEqual(calls.map(c=>c.url),[apiBase+'/api/auth/login',apiBase+'/api/catalog/products?barcode=000101',apiBase+'/api/work-receiving/context']);
 assert.equal(calls[1].options.headers.Authorization,'Bearer normal-login-fixture');assert.equal(calls[1].options.credentials,'omit');assert.equal(calls[1].options.redirect,'error');
 assert.deepEqual(calls[2].options.headers['x-melisa-supplier-id'],'601');assert.equal(storage.getItem('saved-draft'),'keep');assert.equal(storage.getItem(workingCatalogTokenKey),'normal-login-fixture');
 await assert.rejects(()=>session.selectCopyActor('16'));assert.equal(calls.length,3);session.dispose();
});

test('stable cached session only validates auth/me; expired session never falls back to test-admin',async()=>{
 for(const status of [200,401]){const storage=store(),calls=[];storage.setItem(workingCatalogTokenKey,'cached-fixture');const session=createWorkingCatalogSession({location,apiBase,storage,fetchImpl:async(url,o)=>{calls.push({url,o});return {status,ok:status===200,json:async()=>({success:status===200,data:user})};}});assert.equal((await session.start())?.id??null,status===200?16:null);assert.deepEqual(calls.map(c=>c.url),[apiBase+'/api/auth/me']);assert.equal(storage.getItem('saved-draft'),'keep');session.dispose();}
});

test('stable supplier/payment journals retain actor, sealed source and scope; legacy stored pending entries are not copied or replayed',()=>{
 const previous=globalThis.window,p=profile();globalThis.window={location,__MELISA_OPERATION_COPY__:p};
 try{const storage=store(),selection=createBusinessSupplierSelection({storage,userId:16});assert.deepEqual(selection.headers(),{'x-melisa-supplier-id':'601','x-melisa-currency':'TRY'});assert.throws(()=>selection.set('601','USD'));
  const journal=createPaymentJournal({storage,actorId:'16',apiBase,makeUuid:()=>uuid});assert.equal(journal.read().request,null);journal.backup({amount:'1'});const intent=journal.begin('/api/work-supplier-payments/payments',{amountExact4:'1.0000'});assert.equal(intent.body.requestId,uuid);assert.throws(()=>journal.begin('/api/work-supplier-payments/payments',{}));assert.equal(createPaymentJournal({storage,actorId:'15',apiBase}).read().request,null);
  assert.equal(storage.getItem('melisa-work-supplier-payment:http://127.0.0.1:4184:16'),'legacy-kept');assert.equal(storage.getItem('saved-draft'),'keep');assert.throws(()=>createPaymentJournal({storage,actorId:'16',apiBase:'http://127.0.0.1:4184'}));
  globalThis.window.__MELISA_OPERATION_COPY__={...p,businessDaily:undefined};assert.throws(()=>createPaymentJournal({storage,actorId:'16',apiBase}));
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('stable selector offers manual sign-in guidance with no actor buttons, callbacks or identity requests',()=>{
 const doc={createElement:()=>({children:[],style:{},setAttribute(){},append(n){this.children.push(n);},remove(){this.removed=true;}})},container={ownerDocument:doc,children:[],append(n){this.children.push(n);}};
 let called=0;const dispose=mountCopyActorSelector({container,profile:profile(),location,user,session:{selectCopyActor(){called++;}},beforeSwitch(){called++;},onChanged(){called++;}});
 const box=container.children[0];assert.equal(box.children.length,1);assert.match(box.children[0].textContent,/kendi hesabınızla yeniden giriş/);assert.equal(called,0);dispose();assert.equal(box.removed,true);
});

test('stable terminal uses one exact CRM origin and preserves strict window/action checks without token payloads',()=>{
 const target=terminalCrmUrl(location),url=new URL(target.url);assert.equal(target.origin,apiBase);assert.equal(url.pathname,'/crm/');assert.equal(url.searchParams.get('terminal'),'1');assert.equal(url.searchParams.get('erpOrigin'),apiBase);assert.equal([...url.searchParams].length,2);
 const child={},frame={contentWindow:child},event={source:child,origin:apiBase,data:{type:'melisa-terminal-child',version:1,action:'ready'}};assert.equal(terminalMessage(event,frame,target.origin),'ready');
 for(const patch of [{source:{}},{origin:'http://127.0.0.1:62700'},{data:{...event.data,token:'not-allowed'}},{data:{...event.data,action:'approve'}}])assert.equal(terminalMessage({...event,...patch},frame,target.origin),null);
});
