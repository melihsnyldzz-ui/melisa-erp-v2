import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';

const blocked=()=>{throw Error('Unexpected real or write boundary');};
let sqlCalls,sqlRows,routeActor,defaultContext,defaultOwned,defaultDetail;
const sql={BigInt:'synthetic-bigint'};
class Request{
 values={};
 input(name,_type,value){this.values[name]=value;return this;}
 async query(text){
  assert.ok(!/\b(INSERT|UPDATE|DELETE|MERGE|EXEC)\b/i.test(text),'only SELECT is permitted');
  sqlCalls.push({text,values:{...this.values}});
  return {recordset:sqlRows};
 }
}
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request:()=>new Request()}),getSqlDriver:()=>sql}});
mock.module('./invoiceDraftService.js',{namedExports:{getSalesDraft:(...args)=>defaultDetail(...args)}});
mock.module('./nativeTerminalCatalog.mjs',{namedExports:{nativeRequestContext:(...args)=>defaultContext(...args),nativeBootstrap:blocked,nativeSearch:blocked}});
mock.module('./nativeTerminalSale.mjs',{namedExports:{nativeOwnedInvoice:(...args)=>defaultOwned(...args),nativeSubmitSale:blocked,nativeSaleStatus:blocked,nativeDiscountApproval:blocked,nativeCancelSale:blocked}});
mock.module('./nativeCatalogSync.mjs',{namedExports:{nativeCatalogVersion:blocked,nativeCatalogPage:blocked}});
mock.module('./nativeTerminalWorkflows.mjs',{namedExports:{nativeWorkflows:{settings:blocked,saveRates:blocked,orders:blocked,order:blocked}}});
mock.module('./nativeTerminalPacking.mjs',{namedExports:{nativePacking:{receipts:blocked,receipt:blocked}}});
mock.module('./terminalReceiptPrintService.js',{namedExports:{printTerminalSaleReceipt:blocked}});
mock.module('./authService.js',{namedExports:{getUserById:async()=>routeActor,verifyAccessToken:token=>{
 if(token!=='synthetic-test-token')throw Object.assign(Error('Invalid token'),{code:'AUTH_TOKEN_INVALID',statusCode:401});
 return {sub:8};
}}});

const {createNativeCategoryReports}=await import('./nativeCategoryReports.mjs');
const {nativeTerminalRoutes}=await import('../routes/nativeTerminalRoutes.mjs');
const actor={id:8,permissions:['terminal.sales.create']},query={terminalCode:'TEST-DEVICE'};
beforeEach(()=>{
 sqlCalls=[];sqlRows=[];routeActor=actor;
 defaultContext=blocked;defaultOwned=blocked;defaultDetail=blocked;
});
function fixture(){
 const calls=[],invoice={id:11,documentCurrency:'USD',discountRate:5,grandTotal:76,
  customerName:'Private customer',estimatedProfitTry:123,
  items:[{productId:21,stockCode:'ST-21',productName:'Product 21',category:' Takım ',quantity:2,unitPrice:10.25,
   averageCostTry:8,note:'Private note'},
   {productId:22,stockCode:'ST-22',productName:'Product 22',category:null,quantity:3,unitPrice:19.5}]};
 const deps={
  owned:async(id,code,user)=>{assert.equal(id,11);assert.equal(code,query.terminalCode);assert.equal(user,actor);calls.push('owned');},
  detail:async id=>{assert.equal(id,11);calls.push('detail');return invoice;},
  context:async(code,user)=>{assert.equal(code,query.terminalCode);assert.equal(user,actor);calls.push('context');},
  categories:async ids=>{calls.push({ids});return [{productId:21,category:'Takım',privateCost:99},{productId:22,category:null}];}
 };
 return {api:createNativeCategoryReports(deps),deps,calls,invoice};
}

test('receipt ownership precedes authoritative detail and only report fields are returned',async()=>{
 const f=fixture(),result=await f.api.receipt('11',query,actor);
 assert.deepEqual(f.calls,['owned','detail']);
 assert.deepEqual(result,{invoiceId:11,currency:'USD',discountRate:'5',items:[
  {productId:21,stockCode:'ST-21',productName:'Product 21',category:' Takım ',quantity:'2',unitPrice:'10.25'},
  {productId:22,stockCode:'ST-22',productName:'Product 22',category:'',quantity:'3',unitPrice:'19.5'}]});
});

test('denied ownership never loads or returns commercial detail',async()=>{
 const f=fixture();f.deps.owned=async()=>{throw Object.assign(Error('Not this operator'),{code:'NATIVE_RECEIPT_OWNER',statusCode:403});};
 await assert.rejects(createNativeCategoryReports(f.deps).receipt(11,query,actor),{code:'NATIVE_RECEIPT_OWNER',statusCode:403});
 assert.deepEqual(f.calls,[]);assert.equal(sqlCalls.length,0);
});

test('reports read current category and recorded receipt prices without applying invoice discount',async()=>{
 const f=fixture();const first=await f.api.receipt(11,query,actor);
 f.invoice.items[0].category='Yeni kategori';
 const second=await f.api.receipt(11,query,actor);
 assert.equal(second.items[0].category,'Yeni kategori');
 assert.equal(second.items[0].unitPrice,first.items[0].unitPrice);
 assert.equal(second.discountRate,'5');assert.ok(!('grandTotal' in second));
});

test('missing display labels and categories use empty strings without inventing product data',async()=>{
 const f=fixture();f.invoice.discountRate=null;
 f.invoice.items=[{productId:21,stockCode:null,productName:null,quantity:2,unitPrice:10}];
 const result=await f.api.receipt(11,query,actor);
 assert.equal(result.discountRate,'0');assert.equal(result.items[0].category,'');
 assert.equal(result.items[0].stockCode,'');assert.equal(result.items[0].productName,'');
});

test('invalid invoice ids are rejected before ownership and detail',async()=>{
 for(const id of [0,-1,'abc','1.5','9007199254740992']){
  const f=fixture();await assert.rejects(f.api.receipt(id,query,actor),{code:'NATIVE_ID_INVALID'});
  assert.deepEqual(f.calls,[]);
 }
});

test('missing personnel or malformed terminal scope cannot read either category source',async()=>{
 for(const user of [null,{}, {id:0},{id:-1},{id:1.5}]){
  const f=fixture();await assert.rejects(f.api.receipt(11,query,user),{code:'TERMINAL_OPERATOR_REQUIRED'});
  await assert.rejects(f.api.products({...query,ids:'21'},user),{code:'TERMINAL_OPERATOR_REQUIRED'});
  assert.deepEqual(f.calls,[]);
 }
 for(const terminalCode of ['',null,[],{},' ', 'X'.repeat(81),'X/Y']){
  const f=fixture();const scope={terminalCode,ids:'21'};
  await assert.rejects(f.api.receipt(11,scope,actor),{code:'TERMINAL_CODE_REQUIRED'});
  await assert.rejects(f.api.products(scope,actor),{code:'TERMINAL_CODE_REQUIRED'});
  assert.deepEqual(f.calls,[]);
 }
});

test('product metadata checks operator context and returns only category fields',async()=>{
 const f=fixture(),result=await f.api.products({...query,ids:'21,22'},actor);
 assert.deepEqual(f.calls,['context',{ids:[21,22]}]);
 assert.deepEqual(result,{items:[{productId:21,category:'Takım'},{productId:22,category:''}]});
});

test('denied terminal context cannot reach product metadata reads',async()=>{
 const f=fixture();f.deps.context=async()=>{throw Object.assign(Error('Inactive'),{code:'TERMINAL_DEVICE_NOT_ACTIVE',statusCode:403});};
 await assert.rejects(createNativeCategoryReports(f.deps).products({...query,ids:'21'},actor),{code:'TERMINAL_DEVICE_NOT_ACTIVE'});
 assert.deepEqual(f.calls,[]);assert.equal(sqlCalls.length,0);
});

test('product ids reject empty, repeated, malformed, unsafe and oversized requests before any read',async()=>{
 const invalid=[undefined,null,[],{},'',',','21,','0','-1','1.5','1e2','0x10','01',' 21','21,22,21',
  '21); SELECT 1','9007199254740992',Array.from({length:201},(_,i)=>i+1).join(','),'1'.repeat(3400)];
 for(const ids of invalid){
  const f=fixture();await assert.rejects(f.api.products({...query,ids},actor),{code:'NATIVE_CATEGORY_IDS_INVALID',statusCode:400});
  assert.deepEqual(f.calls,[]);
 }
 assert.equal(sqlCalls.length,0);
});

test('exactly 200 unique ids including the safe integer limit are accepted',async()=>{
 const f=fixture(),ids=[...Array.from({length:199},(_,i)=>i+1),Number.MAX_SAFE_INTEGER];
 await f.api.products({...query,ids:ids.join(',')},actor);
 assert.deepEqual(f.calls,['context',{ids}]);
});

test('real metadata query parameterizes every id and retains reviewed scope for inactive cards',async()=>{
 let authorized=false;
 const api=createNativeCategoryReports({context:async()=>{assert.equal(sqlCalls.length,0);authorized=true;}});
 sqlRows=[{productId:21,category:'Pasif kart kategorisi',is_active:0},{productId:22,category:null}];
 const result=await api.products({...query,ids:'21,22,23'},actor);
 assert.equal(authorized,true);assert.equal(sqlCalls.length,1);
 assert.deepEqual(sqlCalls[0].values,{categoryProduct0:21,categoryProduct1:22,categoryProduct2:23});
 assert.match(sqlCalls[0].text,/p\.id IN \(@categoryProduct0,@categoryProduct1,@categoryProduct2\)/);
 assert.match(sqlCalls[0].text,/entity_id=p\.id/);
 assert.match(sqlCalls[0].text,/vega_card_imported/);assert.match(sqlCalls[0].text,/saleEligible/);
 assert.ok(!/p\.is_active\s*=\s*1/i.test(sqlCalls[0].text));
 assert.deepEqual(result,{items:[{productId:21,category:'Pasif kart kategorisi'},{productId:22,category:''}]});
});

async function runRoute(path,{authorization='Bearer synthetic-test-token',params={},requestQuery={...query,ids:'21'}}={}){
 const req={method:'GET',params,query:requestQuery,get:name=>name==='authorization'?authorization:undefined};
 const res={statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 const target=nativeTerminalRoutes.stack.find(layer=>layer.route?.path===path&&layer.route.methods.get);
 assert.ok(target,`GET ${path} exists`);
 const middleware=[];
 for(const layer of nativeTerminalRoutes.stack){if(layer===target)break;if(!layer.route)middleware.push(layer.handle);}
 middleware.push(...target.route.stack.slice(0,-1).map(layer=>layer.handle));
 for(const handle of middleware){
  const error=await new Promise((resolve,reject)=>{try{Promise.resolve(handle(req,res,resolve)).catch(reject);}catch(error){reject(error);}});
  if(error)return {error,res};
 }
 await target.route.stack.at(-1).handle(req,res);
 return {error:null,res};
}

test('both report routes require authentication and existing sales permission before reading',async()=>{
 for(const path of ['/products/categories','/sales/:invoiceId/category-report']){
  assert.equal((await runRoute(path,{authorization:''})).error.code,'AUTH_TOKEN_REQUIRED');
  routeActor={...actor,permissions:[]};
  assert.equal((await runRoute(path)).error.code,'AUTH_PERMISSION_DENIED');
  routeActor=actor;
 }
 assert.equal(sqlCalls.length,0);
});

test('authorized category route keeps denied invoice ownership private',async()=>{
 let ownershipReads=0;
 defaultOwned=async()=>{ownershipReads++;throw Object.assign(Error('Not your receipt'),{code:'NATIVE_RECEIPT_OWNER',statusCode:403});};
 const result=await runRoute('/sales/:invoiceId/category-report',{params:{invoiceId:'11'}});
 assert.equal(result.error,null);assert.equal(result.res.statusCode,403);
 assert.equal(result.res.body.error.code,'NATIVE_RECEIPT_OWNER');assert.ok(!('data' in result.res.body));
 assert.equal(ownershipReads,1);assert.equal(sqlCalls.length,0);
});

test('authorized product route returns the bounded category contract',async()=>{
 defaultContext=async()=>{};sqlRows=[{productId:21,category:'Kategori'}];
 const result=await runRoute('/products/categories');
 assert.equal(result.error,null);assert.equal(result.res.statusCode,200);
 assert.deepEqual(result.res.body.data,{items:[{productId:21,category:'Kategori'}]});
});
