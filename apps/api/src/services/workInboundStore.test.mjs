import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorkInboundStore,workInboundSupplierMovement,readRecordedInvoiceBases,RECORDED_INVOICE_BASIS_SQL} from './workInboundStore.mjs';
test('recorded invoice basis reads one typed batch inside parent request and preserves native decimals without current rates',async()=>{
 const invoices=[{id:91,batchId:9,number:'TSTB-PROOF',currency:'USD',lines:[{},{}]}],supplier={id:'71',currency:'USD'},copy={copyId:'25826e43-f3f2-4ffc-9b10-5a9a412c7bcb'};
 const row={invoiceId:'91',receiptId:'9',supplierId:'71',documentCurrency:'USD',accountCurrency:'USD',documentExchangeRateExact8:'47.80000000',accountExchangeRateExact8:'47.80000000',accountAmountExact4:'9.1000',amountTryExact4:'434.9800',itemCount:2,linkCount:2};
 const inputs=[],queries=[];let rows=[row];const sql={BigInt:'bigint',NVarChar:n=>'nvarchar'+n,UniqueIdentifier:'uuid',MAX:'MAX'};
 const request=()=>({input(name,type,value){inputs.push({name,type,value});return this;},async query(query){queries.push(query);return {recordset:rows};}});
 const read=()=>readRecordedInvoiceBases({request,sql,copy,supplier,invoices});
 const basis=(await read()).get('91');assert.equal(basis.documentExchangeRateExact8,'47.80000000');assert.equal(basis.accountAmountExact4,'9.1000');assert.equal(basis.source,'stored-native-invoice');assert.equal(queries.length,1);
 assert.equal(inputs.find(i=>i.name==='supplier').type,'bigint');assert.equal(inputs.find(i=>i.name==='copy').type,'uuid');assert.deepEqual(JSON.parse(inputs.find(i=>i.name==='admitted').value),[{invoiceId:'91',receiptId:'9',number:'TSTB-PROOF'}]);
 for(const fragment of ['p.supplier_id=@supplier','p.document_currency=@currency','d.batch_id=a.receiptId','g.batch_id<>d.batch_id','i.product_id<>g.product_id','i.quantity<>l.quantity','l.invoice_item_id=i.id'])assert.ok(RECORDED_INVOICE_BASIS_SQL.includes(fragment));
 assert.equal(/currency_rates|dbo\.products|UPDATE|INSERT|DELETE/.test(RECORDED_INVOICE_BASIS_SQL),false);
 rows=[{...row,documentExchangeRateExact8:null}];assert.equal((await read()).size,0,'unknown rate must never become identity or context rate');
 for(const patch of [{documentExchangeRateExact8:'0.00000000'},{accountAmountExact4:'0.0000'},{accountCurrency:'GBP'}]){rows=[{...row,...patch}];assert.equal((await read()).size,0);}
 rows=[];assert.equal((await read()).size,0);
 for(const patch of [{supplierId:'72'},{receiptId:'8'},{documentCurrency:'TRY'},{accountCurrency:'TRY'},{linkCount:1},{itemCount:1},{amountTryExact4:'434.98'},{invoiceId:'92'}]){rows=[{...row,...patch}];await assert.rejects(read(),{statusCode:503});}
 rows=[row,row];await assert.rejects(read(),{statusCode:503});
 rows=[{...row,accountAmountExact4:null},{...row,accountAmountExact4:null}];await assert.rejects(read(),{statusCode:503});
 assert.equal(basis.invoiceId,'91');
});
test('recorded bases batch admitted partial invoices on the same receipt without one query per invoice/product',async()=>{
 const invoices=[{id:91,batchId:9,number:'TSTB-A',currency:'TRY',lines:[{}]},{id:92,batchId:9,number:'TSTB-B',currency:'TRY',lines:[{}]}];let calls=0;
 const rows=invoices.map(i=>({invoiceId:String(i.id),receiptId:'9',supplierId:'71',documentCurrency:'TRY',accountCurrency:'TRY',documentExchangeRateExact8:'1.00000000',accountExchangeRateExact8:'1.00000000',accountAmountExact4:'10.0000',amountTryExact4:'10.0000',itemCount:1,linkCount:1}));
 const bases=await readRecordedInvoiceBases({invoices,supplier:{id:'71',currency:'TRY'},copy:{copyId:'25826e43-f3f2-4ffc-9b10-5a9a412c7bcb'},sql:{BigInt:1,NVarChar:()=>2,MAX:3,UniqueIdentifier:4},request:()=>({input(){return this;},async query(){calls++;return {recordset:rows};}})});
 assert.equal(calls,1);assert.equal(bases.size,2);assert.equal(bases.get('92').invoiceId,'92');
 const source=fs.readFileSync(new URL('./workInboundStore.mjs',import.meta.url),'utf8');assert.ok(source.includes('if(!write&&business)c.recordedInvoiceBases='));
});
const proof={readyHash:'A'.repeat(64)},actor={id:'15',permissions:['goods.view','goods.create']};
function fixture({drift=false,wrongTarget=false,wrongRole=false}={}){
 const events=[],transaction={},loaded={s:{supplier_code:'TEST-V70-GOODS-S',supplier_name:'Tedarikçi',balance:-100,warehouse_name:'Depo'}};let context;
 class Request{constructor(tx){assert.equal(tx,transaction);}input(){return this;}async execute(name){events.push(name);return{recordset:[{readyHash:drift?'BAD':proof.readyHash}]};}async query(sql){events.push(sql);if(sql.includes('DB_NAME() db'))return{recordset:[{db:wrongTarget?'LIVE':'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',login:'melisa_sirket_sales_test_20260929_01',admin:0,control:0,live:0}]};if(sql.includes('SELECT u.id,r.code'))return{recordsets:[[{id:15,code:wrongRole?'admin':'isolated_test_sales'}],[{permission_key:'goods.view'},{permission_key:'goods.create'}]]};if(sql.includes('purchasePriceExact8'))return{recordset:[{id:'301985',stockCode:'TEST-V70-GOODS-P',name:'1',barcode:'0001',stockQuantityExact3:'29.000',purchasePriceExact8:'60.00000000'},{id:'325503',stockCode:'TEST-FINISH-GOODS-P2',name:'2',barcode:null,stockQuantityExact3:'2.000',purchasePriceExact8:'80.00000000'}]};if(sql.includes('SELECT TOP(100) CONVERT(varchar(20),id) id,state'))return{recordsets:[[{id:'1',state:'needs_review'}],[{id:'7',state:'pending'}],[{id:'9',status:'finalized'}]]};return{recordset:[]};}}
 const runtime={withTestPurchaseBatchContext:async(a,fn,{write})=>{events.push(write?'begin-write':'begin-read');context={sql:{Request,BigInt:'bigint'},tx:transaction};try{const value=await fn(context,loaded);events.push('commit');return value;}catch(e){events.push('rollback');throw e;}},createTestBatchInContext:async(ctx,d,input,a)=>{assert.equal(ctx,context);assert.equal(d,loaded);assert.equal(a,actor);events.push('native-batch');return{id:7};}};
 return{events,store:createWorkInboundStore({getRuntime:async()=>runtime,proof})};
}
test('identity, independent owner proof and actual role are checked before any adapter work',async()=>{
 for(const opts of [{wrongTarget:true},{drift:true},{wrongRole:true}]){const f=fixture(opts);let called=false;await assert.rejects(f.store.read(actor,()=>{called=true;}),{statusCode:opts.wrongRole?403:503});assert.equal(called,false);assert.equal(f.events.at(-1),'rollback');}
});
test('native batch submit receives exact parent context and HOME stays bounded and financial-free',async()=>{
 const f=fixture();await f.store.mutate(actor,c=>c.createBatch({requestId:'known'}));assert.equal(f.events.filter(x=>x==='begin-write').length,1);assert.equal(f.events.filter(x=>x==='native-batch').length,1);assert.equal(f.events.at(-1),'commit');
 const home=await f.store.read(actor,c=>c.home(false));assert.deepEqual(home.drafts,[]);assert.equal(home.countDrafts[0].state,'needs_review');assert.equal(JSON.stringify(home).includes('80.00000000'),false);assert.ok(f.events.find(sql=>typeof sql==='string'&&sql.includes('WHERE created_by=@actor OR @actor=16')));
});
test('two invoice items preserve one movement and the same verified receipt/document on debt and reversal',()=>{
 const row={id:'71',invoiceId:'44',receiptId:'7',invoiceNumber:'TSTB-CHAIN-1',invoiceStatus:'cancelled',linkCount:2,batchCount:1,invalidLinks:0,invoiceItemCount:2,type:'purchase_invoice',documentDate:'2026-10-06',currency:'TRY',amountExact4:'280.0000',balanceEffectExact4:'-280.0000',amountTryExact4:'280.0000'};
 const debt=workInboundSupplierMovement(row),reversal=workInboundSupplierMovement({...row,id:'72',type:'purchase_invoice_cancel',balanceEffectExact4:'280.0000'});assert.equal(debt.receiptId,'7');assert.equal(reversal.receiptId,debt.receiptId);assert.equal(reversal.invoiceNumber,debt.invoiceNumber);assert.equal(reversal.invoiceStatus,'cancelled');assert.equal(Object.hasOwn(debt,'linkCount'),false);
});
test('orphan chain stays explicitly unknown; multi-receipt and contradictory line links fail closed',()=>{
 const row={id:'71',invoiceId:'44',receiptId:null,invoiceNumber:null,invoiceStatus:null,linkCount:0,batchCount:0,invalidLinks:0,invoiceItemCount:0,type:'purchase_invoice',documentDate:null,currency:'TRY',amountExact4:'280.0000',balanceEffectExact4:'-280.0000',amountTryExact4:null};
 const unknown=workInboundSupplierMovement(row);assert.equal(unknown.receiptId,null);assert.equal(unknown.invoiceNumber,null);assert.equal(unknown.invoiceStatus,null);
 for(const patch of [{linkCount:2,batchCount:2},{linkCount:1,batchCount:1,invoiceItemCount:2,receiptId:'7',invoiceNumber:'TSTB-X',invoiceStatus:'finalized'},{linkCount:1,batchCount:1,receiptId:'7',invalidLinks:1},{linkCount:1,batchCount:0},{linkCount:1,batchCount:1,receiptId:'7'}])assert.throws(()=>workInboundSupplierMovement({...row,...patch}),{statusCode:503});
});
test('supplier history aggregation keeps header ownership outside SUM and rejects linked missing headers',()=>{
 const source=fs.readFileSync(new URL('./workInboundStore.mjs',import.meta.url),'utf8');
 const sum=source.match(/COALESCE\(SUM\(CASE WHEN ([\s\S]*?)END\),0\) invalidLinks/)[1];
 assert.equal(/\bp\./.test(sum),false,'SQL Server 8124 forbids mixing outer p.id with local aggregate columns');
 assert.ok(source.includes('CASE WHEN p.id IS NULL AND chain.linkCount>0 THEN chain.invalidLinks+1 ELSE chain.invalidLinks END invalidLinks'));
 assert.throws(()=>workInboundSupplierMovement({id:'71',invoiceId:'44',receiptId:'7',invoiceNumber:null,invoiceStatus:null,linkCount:2,batchCount:1,invalidLinks:1,invoiceItemCount:2}),{statusCode:503});
});
