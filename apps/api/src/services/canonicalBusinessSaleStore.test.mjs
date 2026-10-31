import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

if(!process.execArgv.includes('--experimental-test-module-mocks')){
 test('canonical store wiring in an isolated ESM owner/runtime fixture',()=>{
  const result=spawnSync(process.execPath,['--experimental-test-module-mocks','--test',fileURLToPath(import.meta.url)],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 });
}else{
 // This replaces only the owner module inside this test child. No protected
 // context, production transaction grant, database, runtime or account is used.
 const ownerUrl=new URL('./canonicalBusinessSessionContext.mjs',import.meta.url),owner=await import(ownerUrl.href),brands=new WeakSet();
 let current;
 mock.module(ownerUrl.href,{namedExports:{...owner,
  isCanonicalBusinessSaleAvailable:a=>a?.id==='17'&&current?.canonical!==false,
  getCanonicalBusinessSession:()=>current?.sessionRegistered===false?null:{fixtureOnly:true},
  getCanonicalBusinessSaleAdmission:()=>current?.missingAdmission?null:current.profile,
  getCanonicalBusinessSaleContextProof:c=>brands.has(c)?c:null,
  readCanonicalBusinessSaleContext:async({selection})=>{current.readSelections.push(structuredClone(selection));return current.context;},
  getCanonicalBusinessSaleCreationProofJSON:()=>JSON.stringify({profileHash:hash,actorId:'17',requestId,operation:'sale_draft',customerId:'155',accountId:'7',partyEntityId:'6',currency:'USD'}),
  runCanonicalBusinessSaleTransaction:async(input,callback)=>{
   const f=current;f.ownerInputs.push(input);const old=f.journal.get(input.requestId);
   if(old){if(old.body!==input.bodyJson||old.operation!==input.operation)throw Object.assign(Error('Same request has a different body'),{code:'TEST_REQUEST_CONFLICT'});return {...structuredClone(old.response),replayed:true};}
   const tx=new f.sql.Transaction(f.pool),binding={operation:input.operation,context:f.context,requestId:input.requestId,currency:'USD',rateExact8:'2.00000000',products:[{productId:'12',barcode:'000012',averageCostTryExact4:'0.5000'}]};
   f.activeTx=tx;const result=await callback({binding,transaction:tx,sql:f.sql});f.journal.set(input.requestId,{body:input.bodyJson,operation:input.operation,response:structuredClone(result)});return result;
  }
 }});
 const {createWorkTradeStore}=await import('./workTradeStore.mjs');
 const {createWorkSalesService}=await import('./workSalesService.mjs');
 const revision='a'.repeat(64),hash='A'.repeat(64),previewHash='b'.repeat(64),requestId='11111111-1111-4111-8111-111111111111',origin='CANONICAL_TEST_BUSINESS_SALE';
 const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
 function fixture(){
  const f={canonical:true,profile:{profileHash:hash,writesEnabled:true},pool:{fixtureOnly:true},queries:[],ownerInputs:[],readSelections:[],journal:new Map(),mutations:0,creates:0,nativeReads:0,runtimeReads:0,snapshot:null,headerOverride:null,isolated:false};
  f.actor={id:'17',username:'unified-semih-test',role:{id:'17',code:'unified_test_semih'},permissions:['sales.view','sales.create','sales.finalize','sales.cancel']};
  f.selection={customerId:'155',customerAccountId:'7',documentDate:'2026-10-28',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'2.000'}]};
  f.context=freeze({profileHash:hash,meta:{date:f.selection.documentDate,operationOrigin:origin},revision,nativePreviewHash:previewHash,capabilities:{canCreate:true,canFinalize:true,canCancel:true,canCollect:false,canCancelCollection:false},supportedCurrencies:['TRY','USD','EUR'],limits:{maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000'},scope:{synthetic:false,operationOrigin:origin,customer:{id:'155',accountId:'7',partyId:'6',currency:'USD',sourceKey:'fixture/customer',synthetic:false,operationOrigin:origin,writeEligible:true},products:[{id:'12',stockCode:'0012 SYN',name:'Fixture',barcode:'000012',sourceKey:'fixture/product',sourceWitnessHash:hash,synthetic:false,operationOrigin:origin,writeEligible:true,stockQuantityExact3:'9.000',costExact4:'0.5000',unit:{label:'ADET',factorExact8:'1.00000000',sourceId:'9'},prices:[{quoteId:'81',currency:'USD',unitPriceExact8:'1.23456789'}]}]},rate:{currency:'USD',rateExact8:'2.00000000',rateDate:'2026-10-27',sourceKey:'fixture/rate'},nativeExpected:{items:[{...f.selection.items[0],unitPriceExact4:'1.2346',lineTotalExact4:'2.4692'}],grandTotalExact4:'2.4692',amountTryExact4:'4.9384'}});brands.add(f.context);
  class Transaction{constructor(pool){this.parent=pool;}async begin(){}async commit(){}async rollback(){}}
  class Request{
   constructor(parent){this.parent=parent;this.params={};}input(name,type,value){this.params[name]=value;return this;}
   async execute(){throw Error('LEGACY_SQL_FORBIDDEN');}
   async query(text){
    f.queries.push({text,params:{...this.params},transaction:this.parent});
    if(text.startsWith('SELECT DB_NAME() db'))return {recordset:[{db:owner.BUSINESS_SESSION.database,server:owner.BUSINESS_SESSION.server,login:owner.BUSINESS_SESSION.login,databaseUser:owner.BUSINESS_SESSION.login,sysadmin:0,control:0,live:0}]};
    if(text.startsWith('INSERT dbo.work_sales_links')){assert.equal(this.parent,f.activeTx);assert.equal(this.params.actor,'17');f.snapshot=JSON.parse(this.params.preview);f.creationRequest=this.params.request;return {recordset:[]};}
    if(text.startsWith('DECLARE @creation')){
     assert.equal(this.params.profile,hash);assert.match(text,/a\.id\s*=\s*v\.party_currency_account_id/);assert.match(text,/a\.party_entity_id\s*=\s*v\.party_entity_id/);
     const saved=f.journal.get(f.creationRequest);if(!f.snapshot||(!saved&&this.params.draftRequest!==f.creationRequest))return {recordset:[]};
     const h={id:'91',customerId:'155',customerAccountId:'7',partyEntityId:'6',documentDate:f.selection.documentDate,currency:'USD',preview_json:JSON.stringify(f.snapshot),creationRequestId:f.creationRequest,response_json:saved?JSON.stringify(saved.response):null,customerBalanceExact8:'123456789.12345678',customerBalanceExact4:'123456789.1235',revision,unsupportedMovements:0};
     f.headerOverride?.(h);return {recordset:[h]};
    }
    if(text.startsWith('SELECT operation,response_json')){const row=f.journal.get(this.params.id);return {recordset:row?[{operation:row.operation,response_json:JSON.stringify(row.response)}]:[]};}
    throw Error('UNEXPECTED_FIXTURE_SQL');
   }
  }
  f.sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},BigInt:'BigInt',Int:'Int',UniqueIdentifier:'UniqueIdentifier',Bit:'Bit',MAX:'MAX',NVarChar:n=>n,Char:n=>n};
  f.invoice={id:91,documentNo:'FIXTURE',documentDate:f.selection.documentDate,customerId:155,partyEntityId:6,partyCurrencyAccountId:7,customerName:'Fixture customer',documentCurrency:'USD',status:'draft',subtotal:2.4692,grandTotal:2.4692,amountTry:4.9384,items:[{productId:12,stockCode:'0012 SYN',productName:'Fixture',quantity:2,unitPrice:1.2346,lineTotal:2.4692,currency:'USD'}]};
  f.runtime={pool:f.pool,sql:f.sql,withMutation:async fn=>{f.mutations++;return fn();},invoice:{createSalesDraft:async(input,a,ctx)=>{f.creates++;assert.equal(ctx.transaction,f.activeTx);assert.equal(ctx.pool,f.pool);assert.equal(input.items[0].barcode,'000012');assert.equal(input.items[0].averageCostTry,0.5);assert.equal(a.id,'17');return {id:91};},getSalesDraft:async(id,ctx)=>{f.nativeReads++;assert.equal(id,91);assert.equal(ctx.pool,f.pool);return structuredClone(f.invoice);}},get proof(){throw Error('LEGACY_PROOF_FORBIDDEN');}};
  f.store=createWorkTradeStore({getRuntime:async()=>{f.runtimeReads++;return f.isolated?{isolatedCopy:true}:f.runtime;}});f.service=createWorkSalesService({getStore:async()=>f.store});current=f;return f;
 }
 async function create(f){return f.service.createDraft({...f.selection,requestId,expectedRevision:revision,previewHash},f.actor);}
 test('canonical selected preview reads the full account/date/items context instead of the legacy tuple',async()=>{
  const f=fixture(),selected=await f.service.selectedContext(f.selection,f.actor);assert.equal(selected.scope.customer.accountId,'7');assert.equal(selected.scope.products[0].costExact4,undefined);assert.deepEqual(f.readSelections,[f.selection]);
  const preview=await f.service.preview(f.selection,f.actor);assert.equal(preview.previewHash,previewHash);assert.equal(preview.amountTryExact4,'4.9384');assert.equal(f.queries.length,0);
 });
 test('draft uses the owner transaction and journal; a committed replay never reaches the native creator',async()=>{
  const f=fixture(),first=await create(f);assert.equal(first.invoice.id,'91');assert.equal(first.replayed,false);assert.equal(f.creates,1);assert.equal(f.ownerInputs[0].invoiceId,null);
  const payload=JSON.parse(f.ownerInputs[0].bodyJson);assert.equal(payload.customerAccountId,'7');assert.equal(payload.actorId,'17');assert.equal(payload.canonicalBusinessSaleProfileHash,hash);assert.equal(payload.testProfile,'B6-CANONICAL-BUSINESS-SALE-V1');
  const replay=await create(f);assert.equal(replay.replayed,true);assert.equal(f.creates,1);assert.equal(f.journal.size,1);
  await assert.rejects(f.service.createDraft({...f.selection,requestId,expectedRevision:revision,previewHash,items:[{...f.selection.items[0],quantityExact3:'3.000'}]},f.actor),{code:'TEST_REQUEST_CONFLICT'});assert.equal(f.creates,1);
 });
 test('invoice refresh preserves exact headers and the selected account balance; monetary or account drift rejects',async()=>{
  const f=fixture();await create(f);const read=await f.service.invoice('91',f.actor);assert.equal(read.grandTotalExact4,'2.4692');assert.equal(read.amountTryExact4,'4.9384');assert.equal(read.customerBalanceExact8,'123456789.12345678');assert.equal(read.customerBalanceDisplayOnly,true);
  for(const key of ['subtotal','grandTotal','amountTry']){const prior=f.invoice[key];f.invoice[key]=prior+0.0001;await assert.rejects(f.service.invoice('91',f.actor),{code:'WORK_UNAVAILABLE'});f.invoice[key]=prior;}
  f.headerOverride=h=>{h.customerAccountId='8';};await assert.rejects(f.service.invoice('91',f.actor));f.headerOverride=h=>{h.partyEntityId='8';};await assert.rejects(f.service.invoice('91',f.actor));
  f.headerOverride=null;const proof=f.snapshot.nativeCreationProofJSON;f.snapshot.nativeCreationProofJSON=JSON.stringify({...JSON.parse(proof),accountId:'8'});await assert.rejects(f.service.invoice('91',f.actor));f.snapshot.nativeCreationProofJSON=proof;
 });
 test('canonical invoice exposes only account, currency, creation journal and revision presentation witnesses across refresh',async()=>{
  const f=fixture(),created=await create(f),witness={customerId:'155',customerAccountId:'7',partyEntityId:'6',currency:'USD',creationRequestId:requestId,operationOrigin:origin,revision};
  const check=invoice=>{assert.deepEqual(Object.fromEntries(Object.keys(witness).map(key=>[key,invoice[key]])),witness);const json=JSON.stringify(invoice);for(const key of ['nativeCreationProofJSON','profileHash','nativePreviewHash','sourceWitnessHash','costExact4','sqlDriver','transaction'])assert.equal(json.includes('"'+key+'"'),false,key);};
  check(created.invoice);check(await f.service.invoice('91',f.actor));check(await f.service.invoice('91',f.actor));assert.equal(f.creates,1);assert.equal(f.journal.size,1);
  for(const patch of [{customerAccountId:'8'},{partyEntityId:'8'},{currency:'EUR'},{creationRequestId:'22222222-2222-4222-8222-222222222222'},{creationRequestId:null},{revision:'malformed'}]){f.headerOverride=h=>Object.assign(h,patch);await assert.rejects(f.service.invoice('91',f.actor));}f.headerOverride=null;
  const originalOrigin=f.snapshot.operationOrigin;f.snapshot.operationOrigin='OTHER_ORIGIN';await assert.rejects(f.service.invoice('91',f.actor),{code:'WORK_UNAVAILABLE'});f.snapshot.operationOrigin=originalOrigin;
  const proof=f.snapshot.nativeCreationProofJSON;for(const patch of [{profileHash:'C'.repeat(64)},{requestId:'22222222-2222-4222-8222-222222222222'},{operation:'sale_finalize'}]){f.snapshot.nativeCreationProofJSON=JSON.stringify({...JSON.parse(proof),...patch});await assert.rejects(f.service.invoice('91',f.actor),{code:'WORK_UNAVAILABLE'});}f.snapshot.nativeCreationProofJSON=proof;check(await f.service.invoice('91',f.actor));
  const beforeJournal=fixture();beforeJournal.headerOverride=h=>{h.creationRequestId='22222222-2222-4222-8222-222222222222';};await assert.rejects(create(beforeJournal),{code:'WORK_UNAVAILABLE'});assert.equal(beforeJournal.journal.size,0);
 });
 test('canonical profile never falls through to ISO copy or legacy SQL when its adapter cannot admit the read',async()=>{
  const f=fixture();f.isolated=true;await assert.rejects(f.service.preview(f.selection,f.actor),{code:'WORK_UNAVAILABLE'});assert.equal(f.queries.length,0);assert.equal(f.ownerInputs.length,0);
  f.isolated=false;f.missingAdmission=true;await assert.rejects(f.service.preview(f.selection,f.actor),{code:'WORK_FORBIDDEN'});assert.equal(f.queries.length,0);
 });
 test('registered canonical actor with an unavailable sale profile rejects before legacy or ISO runtime admission',async()=>{
  const f=fixture();f.canonical=false;
  for(const isolated of [false,true]){
   f.isolated=isolated;
   for(const invoke of [()=>f.service.context(f.actor),()=>f.service.preview(f.selection,f.actor),()=>f.service.invoice('91',f.actor),()=>f.service.list({},f.actor),()=>f.service.request(requestId,f.actor),()=>f.store.mutate(f.actor,'sale_draft',{requestId},()=>{throw Error('UNADMITTED_CALLBACK');})])await assert.rejects(invoke(),{code:'WORK_UNAVAILABLE',statusCode:503});
  }
  assert.equal(f.runtimeReads,0);assert.equal(f.queries.length,0);assert.equal(f.ownerInputs.length,0);assert.equal(f.creates,0);
 });
}
