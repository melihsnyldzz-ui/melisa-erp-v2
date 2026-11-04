import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

if(!process.execArgv.includes('--experimental-test-module-mocks')){
 test('canonical reader hash closure in an isolated metadata-only ESM fixture',()=>{
  const result=spawnSync(process.execPath,['--experimental-test-module-mocks','--test',fileURLToPath(import.meta.url)],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 });
}else{
 // Only this disposable child replaces the startup selector. These fixtures
 // supply SQL-shaped metadata; they never register a grant or open a database.
 const url=new URL('./canonicalBusinessSessionContext.mjs',import.meta.url),owner=await import(url.href);
 const hashes=Object.fromEntries(owner.CANONICAL_BUSINESS_SALE_READER_MODULES.map(name=>[name,createHash('sha256').update('fixture-only:'+name).digest('hex').toUpperCase()]));let enabled=false;
 const expected=(name,fallback)=>enabled&&Object.hasOwn(hashes,name)?hashes[name]:fallback;
 mock.module(url.href,{namedExports:{...owner,getCanonicalBusinessSaleDefinitionHash:expected}});
 const {createCatalogProductReadStore,configureCatalogSourceVersion,catalogSourceVersion}=await import('./catalogProductReadStore.mjs'),{CATALOG_SQL_PROOF}=await import('./catalogSqlProof.mjs'),{parseCatalogQuery}=await import('./catalogModel.mjs');
 const {createStockProductReadStore}=await import('./stockProductReadStore.mjs'),{STOCK_PRODUCT_SQL_PROOF}=await import('./stockProductSqlProof.mjs'),{parseStockProductQuery}=await import('./stockProductModel.mjs');
 const {createSupplierCardReadStore,SUPPLIER_CARD_PROC_HASH}=await import('./supplierCardReadStore.mjs');
 const {createWorkInboundStore}=await import('./workInboundStore.mjs');
 const {createWorkSupplierPaymentStore}=await import('./workSupplierPaymentStore.mjs'),{WORK_SUPPLIER_PAYMENT_SQL_PROOF}=await import('./workSupplierPaymentSqlProof.mjs'),{rawPaymentFixture,paymentActor}=await import('./workSupplierPaymentFixture.mjs');
 const {legacyPaymentScope}=await import('./workSupplierPaymentLegacyScope.mjs');
 const {createTestProductPriceStore}=await import('./testProductPriceStore.mjs'),{PRODUCT_PRICE_SQL_PROOF,CURRENT_PRICE_PURCHASE_SQL_PROOF}=await import('./testProductPriceSqlProof.mjs');
 const {createTestCurrentPricePurchaseService}=await import('./testCurrentPricePurchaseService.mjs');
 const contact=await import('./testSupplierContactStore.mjs');
 const identity={db:owner.BUSINESS_SESSION.database,server:owner.BUSINESS_SESSION.server,login:owner.BUSINESS_SESSION.login,databaseUser:owner.BUSINESS_SESSION.login,sysadmin:0,admin:0,control:0,live:0};
 const rs=rows=>({recordset:rows});
 function runtime({query=()=>rs([identity]),execute}={}){
  const state={commits:0,rollbacks:0,queries:[],executed:[]},pool={};
  class Transaction{constructor(parent){assert.equal(parent,pool);}async begin(){}async commit(){state.commits++;}async rollback(){state.rollbacks++;}}
  class Request{constructor(parent){this.parent=parent;this.params={};}input(k,type,v){this.params[k]=v;return this;}async query(text){state.queries.push(text);return query(text,this.params);}async execute(name){state.executed.push(name);return execute(name,this.params);}}
  const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},BigInt:1,Int:2,UniqueIdentifier:3,MAX:-1,NVarChar:n=>n,Char:n=>n};return {state,pool,sql};
 }
 const companions=base=>({...base,supplierReaderHash:expected('dbo.usp_read_supplier_cards',base.supplierReaderHash),c09PriceGetterHash:expected('dbo.usp_get_test_product_prices',base.c09PriceGetterHash),c09PriceSetterHash:expected('dbo.usp_set_test_product_price',base.c09PriceSetterHash)});
 const priceContext={product:{id:'301986',stockCode:'TEST-DAILY-PURCHASE',name:'Fixture',unit:'ADET',synthetic:true},capabilities:{currencies:['TRY'],units:[{id:'7',label:'ADET',factorExact8:'1.00000000',isMainUnit:true}],purchaseTier:0,saleTiers:[1],supportedTuples:[{type:'purchase',unitId:null,tier:0,currency:'TRY'}],canEdit:true},revision:'A'.repeat(64),prices:[],recentChanges:[]};
 const paymentProof=base=>({...base,readyHash:expected('dbo.usp_work_supplier_payment_ready',base.readyHash)});
 test('unconfigured real selector preserves all legacy defaults and cannot create a registered profile',()=>{
  for(const name of owner.CANONICAL_BUSINESS_SALE_READER_MODULES)assert.equal(owner.getCanonicalBusinessSaleDefinitionHash(name,'fallback'),'fallback');
  assert.equal(owner.getCanonicalBusinessSaleDefinitionHash('dbo.not_admitted','fallback'),'fallback');assert.equal(owner.getCanonicalBusinessSaleLegacyProof(),null);
 });
 for(const kind of ['catalog','stock'])test(`${kind} compares actual companion metadata with admitted hashes, preserving self/version and all other pins`,async()=>{
  for(const active of [false,true]){
   enabled=active;const base=kind==='catalog'?CATALOG_SQL_PROOF:STOCK_PRODUCT_SQL_PROOF,proof=companions(base),row={...proof,actorId:'14',canView:true,canViewFinance:false,canViewSalesPrices:false,total:0,page:1,limit:kind==='catalog'?50:25,readAt:'2026-10-05T08:00:00.000Z',rowsJson:'[]',filtersJson:'{"brands":[],"productTypes":[]}',acceptedCount:16622,syntheticCount:kind==='catalog'?0:3,quarantinedCount:54};
   const run=async patch=>{const r=runtime({execute:()=>rs([{...row,...patch}])}),store=kind==='catalog'?createCatalogProductReadStore({getRuntime:async()=>r,classificationStore:{selection:()=>({candidatesJson:'[]',filters:{brands:[],productTypes:[]}}),assertRow:()=>{}},getCopyContext:()=>null}):createStockProductReadStore({getRuntime:async()=>r,getSourceVersion:()=>null});const result=await (kind==='catalog'?store.readCatalogProducts({actorId:'14',options:parseCatalogQuery({})}):store.readStockProducts({actorId:'14',options:parseStockProductQuery({})}));assert.equal(r.state.commits,1);return result;};
   await run({});for(const key of ['supplierReaderHash','c09PriceGetterHash','c09PriceSetterHash','readerDefinitionHash','holdRowsGuardHash'])await assert.rejects(run({[key]:'0'.repeat(64)}),{statusCode:503});
   if(active)await assert.rejects(run({supplierReaderHash:base.supplierReaderHash}),{statusCode:503});
  }
 });
 test('supplier reader resolves only its own hash and preserves bounded DTO validation',async()=>{
  for(const active of [false,true]){
   enabled=active;const run=async hash=>{const r=runtime({execute:()=>rs([{total:0,readerDefinitionHash:hash,rowsJson:'[]'}])});return createSupplierCardReadStore({getRuntime:async()=>r,getCopyContext:()=>null,getFinalContext:()=>null,getCurrentFinanceContext:()=>null}).listSupplierCardRows({});};
   assert.deepEqual(await run(expected('dbo.usp_read_supplier_cards',SUPPLIER_CARD_PROC_HASH)),{rows:[],total:0});await assert.rejects(run('0'.repeat(64)),{statusCode:503});
  }
 });
 test('inbound ready admits only exact selected metadata while actor and target guards remain',async()=>{
  for(const active of [false,true]){
   enabled=active;const base={readyHash:'A'.repeat(64)},actor={id:'15',permissions:['goods.view']};
   const run=async(readyHash,wrongRole=false)=>{
    const r=runtime({execute:()=>rs([{readyHash}]),query:text=>text.includes('DB_NAME()')?rs([identity]):text.includes('SELECT u.id,r.code')?{recordsets:[[{id:15,code:wrongRole?'admin':'isolated_test_sales'}],[{permission_key:'goods.view'}]]}:text.includes('purchasePriceExact8')?rs([{id:'301985',stockQuantityExact3:'1.000'},{id:'325503',stockQuantityExact3:'2.000'}]):rs([])});
    return createWorkInboundStore({getRuntime:async()=>({withTestPurchaseBatchContext:async(a,fn)=>fn({sql:r.sql,tx:{}},{s:{supplier_code:'TEST',supplier_name:'Fixture',balance:0,warehouse_name:'TEST'}})}),proof:base}).read(actor,c=>c.products);
   };
   assert.equal((await run(expected('dbo.usp_work_inbound_ready',base.readyHash))).length,2);await assert.rejects(run('0'.repeat(64)),{statusCode:503});await assert.rejects(run(expected('dbo.usp_work_inbound_ready',base.readyHash),true),{statusCode:403});
  }
 });
 test('payment definitions, returned context and effect metadata use the same ready pin without changing companion pins',async()=>{
  for(const active of [false,true]){
   enabled=active;const proof=paymentProof(WORK_SUPPLIER_PAYMENT_SQL_PROOF),raw=rawPaymentFixture();
   const run=async drift=>{
    const r=runtime({query:text=>text.includes('DB_NAME()')?rs([identity]):text.includes('OBJECT_DEFINITION')?rs([{...proof,...(drift==='definitions'?{readyHash:'BAD'}:{})}]):text.includes('SELECT * FROM dbo.work_supplier_payment_requests')?rs([]):rs([]),execute:name=>name.endsWith('_context')?rs([{...proof,...(drift==='context'?{contextHash:'BAD'}:{}),context_json:JSON.stringify(raw)}]):name.endsWith('_effects')?rs([{...proof,...(drift==='effect'?{readyHash:'BAD'}:{}),valid:1}]):rs([])});
    return createWorkSupplierPaymentStore({getRuntime:async()=>({...r,proof:WORK_SUPPLIER_PAYMENT_SQL_PROOF,withMutation:fn=>fn()})}).mutate(paymentActor,c=>c.journal('payment_cancel',{requestId:'11111111-1111-4111-8111-111111111111'},async()=>({payment:{id:'101',originalId:null}})));
   };
   assert.equal((await run()).payment.id,'101');for(const drift of ['definitions','context','effect'])await assert.rejects(run(drift),{statusCode:503});
  }
 });
 test('legacy payment scope uses the same ready selector and retains actor denial',async()=>{
  for(const active of [false,true]){
   enabled=active;const proof=paymentProof(WORK_SUPPLIER_PAYMENT_SQL_PROOF);
   const r=runtime({query:text=>text.includes('SELECT p.permission_key')?rs(paymentActor.permissions.map(permission_key=>({permission_key}))):rs([{installed:1,...proof}]),execute:()=>rs([{...proof,context_json:JSON.stringify(rawPaymentFixture())}])});
   assert.equal((await legacyPaymentScope({sqlDriver:r.sql,transaction:{}},paymentActor)).supplierId,'9001');await assert.rejects(legacyPaymentScope({sqlDriver:r.sql,transaction:{}},{...paymentActor,id:'15'}),{statusCode:403});
  }
 });
 test('product price compares admitted getter/setter metadata while every immutable companion remains pinned',async()=>{
  for(const active of [false,true]){
   enabled=active;const proof={...PRODUCT_PRICE_SQL_PROOF,getterHash:expected('dbo.usp_get_test_product_prices',PRODUCT_PRICE_SQL_PROOF.getterHash),setterHash:expected('dbo.usp_set_test_product_price',PRODUCT_PRICE_SQL_PROOF.setterHash)};
   const run=async patch=>{const r=runtime({execute:()=>rs([{...proof,...patch,replayed:false,context_json:JSON.stringify(priceContext)}])});return createTestProductPriceStore({getRuntime:async()=>r}).readTestProductPrices('301986','14');};
   assert.equal((await run()).product.id,'301986');for(const key of Object.keys(proof))await assert.rejects(run({[key]:'0'.repeat(64)}),{statusCode:503});
  }
 });
 test('current purchase price context resolves both consumers but not its immutable manifest',async()=>{
  for(const active of [false,true]){
   enabled=active;const proof={...CURRENT_PRICE_PURCHASE_SQL_PROOF,consumerGetterHash:expected('dbo.usp_get_test_current_price_purchase_context',CURRENT_PRICE_PURCHASE_SQL_PROOF.consumerGetterHash),consumerAssertHash:expected('dbo.usp_assert_test_current_price_purchase_received',CURRENT_PRICE_PURCHASE_SQL_PROOF.consumerAssertHash)};
   const scope={product_id:301986,supplier_id:13373,product_supplier:13373,supplier_currency:'TRY',unit:'ADET',product_unit:'ADET',unit_factor:1,document_date:'2026-10-04',max_quantity:5,max_amount_try:200,warehouse:'TEST-DAILY-WH',supplier_balance_text:'0.0000',average_cost_try_text:'1.0000',current_stock_qty:1};
   const rates=['TRY','USD','EUR'].map(currency=>({currency,rate_exact:'1.00000000',source:'synthetic-test',source_id:'fixture',as_of:'2026-10-04',version:1,hash:'A'.repeat(64)}));
   const run=async patch=>{const r=runtime({query:text=>text.includes('DB_NAME()')?rs([identity]):text.startsWith('SELECT s.*')?rs([scope]):rs([]),execute:()=>({recordsets:[[{...proof,...patch,unit_hash:'A'.repeat(64)}],rates,[]]})});return createTestCurrentPricePurchaseService({runtime:async()=>({...r,assertQuarantine:async()=>{},quarantineContext:()=>({})})}).context({id:16,permissions:['purchase.view','product.view']});};
   assert.deepEqual((await run()).quotes,[]);for(const key of Object.keys(proof))await assert.rejects(run({[key]:'0'.repeat(64)}),{statusCode:503});
  }
 });
 test('supplier contact resolves getter/setter only and retains immutable journal/row guards',async()=>{
  for(const active of [false,true]){
   enabled=active;const proof={getterHash:expected(contact.CONTACT_GET_PROC,contact.CONTACT_GET_HASH),setterHash:expected(contact.CONTACT_SET_PROC,contact.CONTACT_SET_HASH),rowGuardHash:contact.CONTACT_ROW_GUARD_HASH,journalGuardHash:contact.CONTACT_JOURNAL_GUARD_HASH},context={fixture:{id:'13373',supplierCode:'TEST-DAILY-PUR-S',supplierName:'TEST GÜNLÜK ALIŞ İADE TEDARİKÇİ',currency:'TRY',synthetic:true},contact:{phone:null,city:null,country:null},revision:'A'.repeat(64)};
   const run=async patch=>{const r=runtime({execute:()=>rs([{...proof,...patch,replayed:false,contextJson:JSON.stringify(context)}])});return contact.createTestSupplierContactStore({getRuntime:async()=>r}).readTestSupplierContactContext();};
   assert.deepEqual(await run(),context);for(const key of Object.keys(proof))await assert.rejects(run({[key]:'0'.repeat(64)}),{statusCode:503});
  }
 });
 function boundVersion(){
  const runId='PRODUCT-b40b0745-1fa0-4970-b19f-1479cf75d67a',suffix=runId.replaceAll('-','_').toLowerCase();
  return {schemaVersion:'melisa-product-completion-catalog-context.v1',runId,sourceAsOf:'2026-10-08',actualT1:false,evidenceKind:'DATED_TEST_PRODUCT_SCOPE',productCount:16992,priceCount:64018,sourceHash:'a'.repeat(64),planHash:'b'.repeat(64),bindingsHash:'c'.repeat(64),readerDefinitionHash:'d'.repeat(64),stockReaderDefinitionHash:'e'.repeat(64),openingDetailDefinitionHash:'f'.repeat(64),openingListDefinitionHash:'1'.repeat(64),snapshotHash:'2'.repeat(64),ancestry:[{runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30'},{runId:'GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d',sourceAsOf:'2026-10-07'},{runId,sourceAsOf:'2026-10-08'}],procedures:{catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`}};
 }
 for(const kind of ['catalog','stock'])test(`${kind} dated bound version resolves both verified self pins without changing private source provenance`,async()=>{
  for(const active of [false,true]){
   enabled=active;const version=boundVersion(),original=JSON.stringify(version);configureCatalogSourceVersion(version);
   const effective=catalogSourceVersion(),catalogHash=expected(version.procedures.catalog,version.readerDefinitionHash),stockHash=expected(version.procedures.stock,version.stockReaderDefinitionHash);
   assert.equal(effective.readerDefinitionHash,catalogHash);assert.equal(effective.stockReaderDefinitionHash,stockHash);assert.equal(Object.isFrozen(effective),true);assert.equal(JSON.stringify(version),original);
   const {readerDefinitionHash,stockReaderDefinitionHash,...effectiveSource}=effective,{readerDefinitionHash:oldCatalog,stockReaderDefinitionHash:oldStock,...originalSource}=version;assert.deepEqual(effectiveSource,originalSource);
   const base=kind==='catalog'?CATALOG_SQL_PROOF:STOCK_PRODUCT_SQL_PROOF,row={...companions(base),readerDefinitionHash:(kind==='catalog'?catalogHash:stockHash).toUpperCase(),actorId:'14',canView:true,canViewFinance:false,canViewSalesPrices:false,total:0,page:1,limit:kind==='catalog'?50:25,readAt:'2026-10-08T08:00:00.000Z',rowsJson:'[]',filtersJson:'{"brands":[],"productTypes":[]}',acceptedCount:version.productCount,syntheticCount:kind==='catalog'?0:3,quarantinedCount:54,sourceVersionRunId:version.runId,sourceVersionSourceHash:version.sourceHash,sourceVersionPlanHash:version.planHash,sourceVersionBindingsHash:version.bindingsHash};
   const run=async patch=>{const r=runtime({execute:()=>rs([{...row,...patch}])});if(kind==='stock')return createStockProductReadStore({getRuntime:async()=>r}).readStockProducts({actorId:'14',options:parseStockProductQuery({})});const store=createCatalogProductReadStore({getRuntime:async()=>r,classificationStore:{selection:()=>({candidatesJson:'[]',filters:{brands:[],productTypes:[]}}),assertRow:()=>{}},getCopyContext:()=>null});store.configureSourceVersion(version);return store.readCatalogProducts({actorId:'14',options:parseCatalogQuery({})});};
   const result=await run({});assert.equal(result.sourceVersion.readerDefinitionHash,catalogHash);assert.equal(result.sourceVersion.stockReaderDefinitionHash,stockHash);
   await assert.rejects(run({readerDefinitionHash:'0'.repeat(64)}),{statusCode:503});if(active)await assert.rejects(run({readerDefinitionHash:(kind==='catalog'?version.readerDefinitionHash:version.stockReaderDefinitionHash).toUpperCase()}),{statusCode:503});
  }
 });
}
