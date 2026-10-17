import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
const blocked=()=>{throw Error('Unexpected write or external boundary');};
let terminal,queries,listCalls,listRows,detailDoc,actor,barcodeRows;
const sql={NVarChar:()=>0,BigInt:0};
class Request{
 values={};
 input(name,_type,value){this.values[name]=value;return this;}
 async query(text){
  assert.ok(!/\b(INSERT|UPDATE|DELETE|MERGE|EXEC)\b/i.test(text),'read-only SQL boundary');
  queries.push({text,values:{...this.values}});
  if(text.includes('AS restrictions_ready'))return {recordset:[{is_ready:1,restrictions_ready:1}]};
  if(text.includes('FROM dbo.terminal_devices d'))return {recordset:terminal?[terminal]:[]};
  if(text.includes('FROM dbo.product_barcodes b'))return {recordset:barcodeRows};
  throw Error('Unexpected synthetic SQL');
 }
}
mock.module('mssql',{defaultExport:sql});
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request:()=>new Request()}),getSqlDriver:()=>sql}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:blocked}});
mock.module('./invoiceDraftService.js',{namedExports:{createSalesDraft:blocked,finalizeSalesInvoice:blocked,
 getSalesDraftsList:async query=>{listCalls.push(query);return {data:listRows,meta:{hasNextPage:true,total:31}};},
 getSalesDraft:async id=>{assert.equal(id,3);return detailDoc;}}});
mock.module('./vegaCustomerClientService.js',{namedExports:{getVegaCustomersListFromWorker:blocked}});
mock.module('./vegaProductClientService.js',{namedExports:{getVegaProductsListFromWorker:blocked}});
mock.module('./vegaProductImageService.js',{namedExports:{getVegaProductImageMap:blocked}});
mock.module('./nativeCatalogSync.mjs',{namedExports:{nativeCatalogVersion:blocked,nativeCatalogPage:blocked}});
mock.module('./nativeTerminalCatalog.mjs',{namedExports:{nativeRequestContext:blocked,nativeBootstrap:blocked,nativeSearch:blocked}});
mock.module('./currencyRateService.js',{namedExports:{getCurrencyRates:blocked,upsertCurrencyRates:blocked}});
mock.module('./salesPipelineService.js',{namedExports:{listPipelineDocuments:blocked,getPipelineDocument:blocked}});
mock.module('./nativeTerminalSale.mjs',{namedExports:{nativeSubmitSale:blocked,nativeSaleStatus:blocked,nativeDiscountApproval:blocked,nativeCancelSale:blocked,nativeOwnedInvoice:blocked}});
mock.module('./terminalReceiptPrintService.js',{namedExports:{printTerminalSaleReceipt:blocked}});
mock.module('./authService.js',{namedExports:{getUserById:async()=>actor,verifyNormalTestAccessSession:(payload,user)=>{assert.deepEqual(payload,{sub:8});assert.equal(user,actor);},verifyAccessToken:token=>{
 if(token!=='synthetic-test-token')throw Object.assign(Error('Invalid token'),{code:'AUTH_TOKEN_INVALID',statusCode:401});
 return {sub:8};
}}});
const {createNativePacking,nativePacking}=await import('./nativeTerminalPacking.mjs');
const {getTerminalPersonnelContext,getTerminalOperatorContext}=await import('./terminalService.js');
const {nativeTerminalRoutes}=await import('../routes/nativeTerminalRoutes.mjs');
const query={terminalCode:'TEST-TC21'};
beforeEach(()=>{
 actor={id:8,permissions:[]};queries=[];listCalls=[];
 terminal={terminal_device_id:2,device_code:'TEST-TC21',device_name:'Fixture',device_is_active:true,
  employee_id:9,employee_code:'EMP-9',employee_name:'Fixture personnel',employee_is_active:true,
  can_terminal_sale:false,can_change_sale_price:false,max_sale_discount_percent:0};
 listRows=[{id:3,invoiceNo:'SAT-3',customerName:'Fixture customer',documentDate:new Date('2026-09-15T00:00:00Z'),
  itemCount:1,status:'FINALIZED',updatedAt:new Date('2026-09-15T08:30:15.123Z'),totalAmount:100,currency:'USD',employeeName:'Private employee'}];
 detailDoc={id:3,documentNo:'SAT-3',customerName:'Fixture customer',documentDate:'2026-09-15',status:'FINALIZED',updatedAt:'2026-09-15T11:30:15.123+03:00',grandTotal:100,
  description:'Private sales note',customerCurrency:'USD',amountTry:4700,estimatedProfitTry:999,
  items:[{id:11,productId:21,stockCode:'TEST-21',productName:'Test product',quantity:2,barcode:'1001',
   unitPrice:50,lineTotal:100,averageCostTry:40,grossProfitTry:60,note:'Private line note'}]};
 barcodeRows=[{product_id:21,barcode:'1002'},{product_id:21,barcode:'1001'},{product_id:999,barcode:'OTHER'}];
});

async function runRoute(path,{method='get',authorization='Bearer synthetic-test-token',body={}}={}){
 const req={method:method.toUpperCase(),query,params:{id:'3'},body,get:name=>name==='authorization'?authorization:undefined};
 const res={statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 const target=nativeTerminalRoutes.stack.find(layer=>layer.route?.path===path&&layer.route.methods[method]);
 assert.ok(target,`Route exists: ${method} ${path}`);
 const middleware=[];
 for(const layer of nativeTerminalRoutes.stack){
  if(layer===target)break;
  if(!layer.route)middleware.push(layer.handle);
 }
 middleware.push(...target.route.stack.slice(0,-1).map(layer=>layer.handle));
 for(const handle of middleware){
  const error=await new Promise((resolve,reject)=>{try{Promise.resolve(handle(req,res,resolve)).catch(reject);}catch(error){reject(error);}});
  if(error)return {error,res};
 }
 await target.route.stack.at(-1).handle(req,res);
 return {error:null,res};
}

test('packing requires no sales permission or employee sale flag, using actual personnel context',async()=>{
 const page=await nativePacking.receipts({...query,page:'2',search:' SAT '},actor);
 assert.deepEqual(listCalls,[{page:2,limit:30,search:'SAT',status:'FINALIZED'}]);
 assert.equal(page.total,31);assert.equal(page.hasMore,true);assert.equal(page.page,2);
 assert.deepEqual(page.orders,[{id:3,documentNo:'SAT-3',customerName:'Fixture customer',documentDate:'2026-09-15',itemCount:1,status:'FINALIZED',documentVersion:'2026-09-15T08:30:15.123Z'}]);
 assert.equal(queries.length,2);assert.equal(queries[1].values.operatorUserId,8);assert.equal(queries[1].values.terminalCode,'TEST-TC21');
});

test('packing list filters leaked draft, cancelled and archived rows without exposing them',async()=>{
 listRows.push(...['DRAFT','CANCELLED','ARCHIVED_TEST','CONFIRMED'].map((status,index)=>({...listRows[0],id:20+index,status})));
 const page=await nativePacking.receipts(query,actor);
 assert.deepEqual(page.orders.map(row=>row.id),[3]);
});

test('unauthenticated service calls are rejected before personnel or invoice reads',async()=>{
 for(const user of [null,{}, {id:0},{id:-1},{id:1.5},{id:'bad'}]){
  await assert.rejects(nativePacking.receipts(query,user),{code:'TERMINAL_OPERATOR_REQUIRED',statusCode:401});
  await assert.rejects(nativePacking.receipt(3,query,user),{code:'TERMINAL_OPERATOR_REQUIRED',statusCode:401});
 }
 assert.equal(queries.length,0);assert.equal(listCalls.length,0);
});

test('inactive or absent device and inactive or unassigned personnel cannot read packing data',async()=>{
 for(const [change,code] of [
  [{device_is_active:false},'TERMINAL_DEVICE_NOT_ACTIVE'],
  [{employee_is_active:false},'TERMINAL_EMPLOYEE_NOT_ASSIGNED'],
  [{employee_id:null},'TERMINAL_EMPLOYEE_NOT_ASSIGNED']]){
  const original={...terminal};Object.assign(terminal,change);
  await assert.rejects(nativePacking.receipts(query,actor),{code});
  await assert.rejects(nativePacking.receipt(3,query,actor),{code});terminal=original;
 }
 terminal=null;await assert.rejects(nativePacking.receipts(query,actor),{code:'TERMINAL_DEVICE_NOT_ACTIVE'});
 assert.equal(listCalls.length,0);
});

test('existing sales context keeps employee sale restriction and original return shape',async()=>{
 assert.equal((await getTerminalPersonnelContext(query.terminalCode,8)).canTerminalSale,false);
 await assert.rejects(getTerminalOperatorContext(query.terminalCode,8),{code:'TERMINAL_EMPLOYEE_SALE_RESTRICTED',statusCode:403});
 terminal.can_terminal_sale=true;const result=await getTerminalOperatorContext(query.terminalCode,8);
 assert.equal(result.employeeId,9);assert.equal(result.canChangeSalePrice,false);assert.equal('canTerminalSale' in result,false);
});

test('invalid paging, search, terminal code and invoice IDs never reach invoice readers',async()=>{
 for(const page of ['NaN','0','1.5','100001'])await assert.rejects(nativePacking.receipts({...query,page},actor),{code:'NATIVE_PAGE_INVALID'});
 await assert.rejects(nativePacking.receipts({...query,search:'a'.repeat(121)},actor),{code:'NATIVE_PAGE_INVALID'});
 for(const terminalCode of ['',null,' '.repeat(2),'a'.repeat(81)])await assert.rejects(nativePacking.receipts({terminalCode},actor),{code:'TERMINAL_CODE_REQUIRED'});
 for(const id of [0,-1,1.5,'bad'])await assert.rejects(nativePacking.receipt(id,query,actor),{code:'NATIVE_ID_INVALID'});
 assert.equal(listCalls.length,0);
});

test('packing detail uses sales invoice lines and active alternate barcodes, excluding all financial and private fields',async()=>{
 const doc=await nativePacking.receipt(3,query,actor);
 assert.equal(doc.sourceType,'sales_invoice');assert.equal(doc.itemCount,1);assert.equal(doc.items[0].quantity,'2');
 assert.deepEqual(doc.items[0],{id:11,productId:21,stockCode:'TEST-21',productName:'Test product',quantity:'2',barcodes:['1001','1002']});
 assert.deepEqual(Object.keys(doc).sort(),['id','documentNo','customerName','documentDate','itemCount','status','sourceType','items','revision','documentVersion'].sort());
 assert.match(doc.revision,/^[a-f0-9]{64}$/);
 const page=await nativePacking.receipts(query,actor);
 assert.equal(doc.documentVersion,'2026-09-15T08:30:15.123Z');assert.equal(page.orders[0].documentVersion,doc.documentVersion);
 const sqlCall=queries.find(call=>call.text.includes('FROM dbo.product_barcodes b'));assert.match(sqlCall.text,/sales_invoice_items/);assert.match(sqlCall.text,/i.sales_invoice_id=@invoiceId AND b.is_active=1/);
 assert.equal(sqlCall.values.invoiceId,3);assert.doesNotMatch(sqlCall.text,/sales_order/);
});

test('draft, cancelled, archived and order documents cannot open packing detail',async()=>{
 for(const status of ['DRAFT','CANCELLED','ARCHIVED_TEST','CONFIRMED','finalized']){
  detailDoc.status=status;await assert.rejects(nativePacking.receipt(3,query,actor),{code:'NATIVE_PACKING_RECEIPT_UNAVAILABLE',statusCode:409});
 }
 assert.ok(queries.every(call=>!call.text.includes('product_barcodes')));
});

test('packing revision changes with quantity or identity, not a price-only correction or barcode row order',async()=>{
 const first=await nativePacking.receipt(3,query,actor);
 detailDoc.grandTotal=200;detailDoc.items[0].unitPrice=100;barcodeRows.reverse();
 detailDoc.updatedAt=new Date('2026-09-16T12:00:00Z');
 const financialChange=await nativePacking.receipt(3,query,actor);
 assert.equal(financialChange.documentVersion,'2026-09-16T12:00:00.000Z');
 assert.notEqual(financialChange.documentVersion,first.documentVersion);
 assert.equal(financialChange.revision,first.revision);
 detailDoc.items[0].quantity=3;const quantityChange=await nativePacking.receipt(3,query,actor);assert.notEqual(quantityChange.revision,first.revision);
 detailDoc.customerName='Changed customer';assert.notEqual((await nativePacking.receipt(3,query,actor)).revision,quantityChange.revision);
});

test('missing invoice errors propagate without trying barcode reads',async()=>{
 const api=createNativePacking({detail:async()=>{throw Object.assign(Error('Not found'),{code:'SALES_DRAFT_NOT_FOUND',statusCode:404});}});
 await assert.rejects(api.receipt(3,query,actor),{code:'SALES_DRAFT_NOT_FOUND',statusCode:404});
 assert.ok(queries.every(call=>!call.text.includes('product_barcodes')));
});

test('actual packing GET middleware accepts authenticated personnel with an empty permission set',async()=>{
 for(const path of ['/packing-receipts','/packing-receipts/:id']){
  const {error,res}=await runRoute(path);assert.equal(error,null);assert.equal(res.statusCode,200);assert.equal(res.body.success,true);
 }
});

test('actual packing GET middleware still rejects missing or invalid bearer tokens',async()=>{
 for(const path of ['/packing-receipts','/packing-receipts/:id'])for(const authorization of ['', 'Bearer wrong']){
  const {error}=await runRoute(path,{authorization});assert.equal(error.statusCode,401);
 }
 assert.equal(queries.length,0);assert.equal(listCalls.length,0);
});

test('new packing routes do not relax existing sales, catalog, old orders, settings or financial write gates',async()=>{
 for(const [path,method] of [['/orders','get'],['/orders/:id','get'],['/bootstrap','get'],['/products/search','get'],['/settings','get'],
  ['/settings/rates','post'],['/sales/submit','post'],['/sales/cancel','post'],['/sales/status','post'],['/sales/:invoiceId/pdf-share','post']]){
  const {error}=await runRoute(path,{method});assert.equal(error.code,'AUTH_PERMISSION_DENIED',path);
 }
 assert.equal(queries.length,0);assert.equal(listCalls.length,0);
 actor.permissions=['terminal.sales.create'];
 const oldOrders=await runRoute('/orders');assert.equal(oldOrders.res.statusCode,403);assert.equal(oldOrders.res.body.error.code,'AUTH_PERMISSION_DENIED');
 const rates=await runRoute('/settings/rates',{method:'post'});assert.equal(rates.error.code,'AUTH_PERMISSION_DENIED');
});
