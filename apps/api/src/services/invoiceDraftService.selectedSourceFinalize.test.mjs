import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./invoiceDraftService.js',import.meta.url),'utf8');
const bindings=source.slice(source.indexOf('function businessInvoiceSelection('),source.indexOf('// Trigger row-count messages'));
const math=source.slice(source.indexOf('export function calculateSalesProfitSnapshot('),source.indexOf('function invoiceDocumentRate(')).replaceAll('export function','function');
const finalize=source.slice(source.indexOf('export async function finalizeSalesInvoice('),source.indexOf('export async function cancelSalesInvoice(')).replace('export async function','async function');
async function run({count=200,selected=true,actorId=15,foreignTransaction=false,binding=true,change=()=>{},counts=[],failPhase=0,owns=false}={}){
 let rollbackCount=0,commitCount=0; const transaction={begin:async()=>{},rollback:async()=>{rollbackCount++;},commit:async()=>{commitCount++;}},scope={operation:'sale_finalize',invoiceId:'901',actorId:'15',customerId:'161',customerAccountId:'10',partyId:'18',currency:'USD',rateExact8:'47.80000000',maxInvoiceAmountExact4:'20000.0000',productIds:Array.from({length:count},(_,i)=>String(30000+i))};
 const copy={target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},customers:[{id:'161',accountId:'10',partyId:'18',currency:'USD'}]};
 const before={id:901,status:'DRAFT',customerId:161,customerName:'Source fixture',customerCode:'SOURCE',customerCurrency:'USD',accountCurrency:'USD',documentCurrency:'USD',documentDate:'2026-10-12',exchangeRate:47.8,grandTotal:1000,items:scope.productIds.map((id,i)=>({id:1000+i,productId:Number(id),quantity:i===0?24:1,currentStockQty:30,unitPrice:1.3457,lineTotal:(i===0?24:1)*1.3457,currency:'USD',stockCode:'000'+i,productAverageCostTry:i===1?100:i===2?null:60,averageCostTry:i===2?null:60}))};
 change({before,scope,copy});
 const queries=[],steps=[];let batchIndex=0,audit;
 class Request{constructor(tx){assert.equal(tx,transaction);this.params={};}input(key,_type,value){this.params[key]=value;return this;}async query(text){queries.push({text,params:this.params});if(/SELECT CASE WHEN EXISTS/.test(text))return {recordset:[{valid:binding?1:0}]};if(/latest_rates/.test(text))return {recordset:[{currency_code:'USD',rate_to_try:47.8}]};steps.push(/UPDATE s SET/.test(text)?'profit':/UPDATE p SET/.test(text)?'product':/INSERT INTO dbo.stock_movements/.test(text)?'stock':/UPDATE dbo.sales_invoice_items/.test(text)?'profit':/UPDATE dbo.products/.test(text)?'product':'unexpected');if(this.params.selectedFinalizeJSON){batchIndex++;if(failPhase===batchIndex)throw Object.assign(Error('database failure'),{code:'EREQUEST'});return {recordset:[{verifiedCount:batchIndex<=counts.length?counts[batchIndex-1]:String(count)}]};}return {rowsAffected:[1]};}}
 const sql={Request,Transaction:class{constructor(){return transaction;}},BigInt:'bigint',Date:'date',MAX:'max',NVarChar:()=>{},Decimal:()=>{}};
 const noop=async()=>{},error=(code,message,statusCode)=>Object.assign(Error(message),{code,statusCode});
 const sandbox={BUSINESS_COPY_DATABASE:copy.target.database,sql,isIsolatedOperationCopyRuntime:()=>selected,getIsolatedOperationCopyConfig:()=>copy,isolatedCopyTransactionContext:()=>foreignTransaction?{}:copy,getBusinessSelectedSaleWriteScope:(c,tx)=>{if(selected&&(c!==copy||tx!==transaction))throw error('SELECTED_SALE_SCOPE_TRANSACTION_CHANGED','scope');return selected?scope:null;},makeServiceError:error,isNativeInvoiceTransaction:()=>false,assertMelisaWriteEnabled:()=>{},getSqlPool:async()=>({}),getSqlDriver:()=>sql,ensureCashCustomers:noop,ensureFinanceAccountTables:noop,getSalesFinalizeSnapshot:async()=>before,assertOperationQuarantineAllowed:noop,invoiceQuarantineEntities:()=>[],quarantineTransactionContext:()=>{},assertCurrencySnapshotSchema:noop,settlementFromInvoice:()=>({}),assertInvoiceSettlementParty:noop,assertAccountingPeriodOpen:noop,assertPilotCashCustomer:async()=>steps.push('cash-proof'),assertPilotSaleProducts:async(_factory,items,options)=>{assert.equal(items,before.items);assert.equal(options.consume,true);steps.push('product-lock-proof');},getCashCustomerCurrency:()=>null,safeNumber:(v,f=0)=>Number.isFinite(Number(v))?Number(v):f,normalizeCurrency:v=>v,writeAuditLog:async(_request,value)=>{audit=value;throw error('STOP_AFTER_ITEM_EFFECTS','stop');}};
 vm.createContext(sandbox);vm.runInContext(bindings+math+finalize+';globalThis.runFinalize=finalizeSalesInvoice;',sandbox);
 let failure;try{await sandbox.runFinalize('901',{id:actorId},{...(owns?{}:{transaction}),pool:{},sqlDriver:sql});}catch(e){failure=e;}
 return {failure,queries,steps,audit,before,scope,rollbackCount,commitCount};
}
test('200 selected SOURCE finalization retains product locks and performs only three ordered native item-effect statements',async()=>{
 const r=await run();assert.equal(r.failure.code,'STOP_AFTER_ITEM_EFFECTS');assert.deepEqual(r.steps,['product-lock-proof','profit','product','stock']);
 const dml=r.queries.filter(q=>q.params.selectedFinalizeJSON);assert.equal(dml.length,3);assert(dml.every(q=>q.params.selectedFinalizeJSON===dml[0].params.selectedFinalizeJSON));
 const rows=JSON.parse(dml[0].params.selectedFinalizeJSON);assert.equal(rows.length,200);assert.equal(rows[0].quantity,'24.000');assert.equal(rows[199].itemId,'1199');assert.equal(rows[199].productId,'30199');assert.equal(rows[0].unitPrice,'1.3457');assert.equal(rows[0].amountTry,(24*1.3457*47.8).toFixed(4));assert.equal(rows[0].averageCostTry,'60.0000');assert.equal(rows[1].grossProfitTry,(1.3457*47.8-100).toFixed(4));assert.equal(rows[2].averageCostTry,null);assert.equal(rows[2].grossProfitTry,null);assert.equal(rows[2].grossProfitRate,null);
 assert.match(dml[0].text,/s\.id=v\.itemId AND s\.product_id=v\.productId AND s\.sales_invoice_id=@invoiceId/);assert.match(dml[1].text,/current_stock_qty=p\.current_stock_qty-v\.quantity/);assert.match(dml[2].text,/ORDER BY CONVERT\(int,j\.\[key\]\) ASC/);assert.match(dml[2].text,/0,v\.quantity,-v\.quantity,v\.averageCostTry,v\.averageCostTry/);
 const columns=dml[2].text.match(/stock_movements\(([^)]+)\)/)[1].split(',');assert.equal(columns.length,16);assert.equal(dml[2].params.documentDate,r.before.documentDate);assert.equal(dml[2].params.customerId,161);assert.equal(dml[2].params.actorId,15);
 assert.equal(r.audit.action,'sales_profit_snapshot_created');assert.equal(r.audit.afterSnapshot.snapshots.length,200);
});
test('one selected line and ordinary multiple lines retain serial statements and native math',async()=>{
 const single=await run({count:1});assert.equal(single.failure.code,'STOP_AFTER_ITEM_EFFECTS');assert.deepEqual(single.steps,['product-lock-proof','profit','product','stock']);assert.equal(single.queries.some(q=>q.params.selectedFinalizeJSON),false);
 const ordinary=await run({count:3,selected:false});assert.equal(ordinary.failure.code,'STOP_AFTER_ITEM_EFFECTS');assert.deepEqual(ordinary.steps,['cash-proof','product-lock-proof','profit','product','stock','profit','product','stock','profit','product','stock']);assert.equal(ordinary.queries.some(q=>q.params.selectedFinalizeJSON),false);
 const batch=await run({count:3});assert.deepEqual(JSON.parse(JSON.stringify(batch.audit.afterSnapshot.snapshots)),JSON.parse(JSON.stringify(ordinary.audit.afterSnapshot.snapshots)));
});
test('missing, malformed or partial OUTPUT counts stop the next native phase',async()=>{
 for(const counts of [[199],[null],[0],['0200'],[-1],[200,199],[200,200,199]]){const r=await run({counts});assert.equal(r.failure.code,'ISOLATED_COPY_SELECTED_SALE_SCOPE');assert.equal(r.audit,undefined);assert.equal(r.steps.length,counts.length+1);}
});
test('foreign product, duplicate item IDs, actor, transaction and native account drift fail before item DML',async()=>{
 const cases=[{actorId:16},{foreignTransaction:true},{binding:false},{change:({scope})=>scope.productIds[0]='999'},{change:({before})=>before.items[1].id=before.items[0].id},{change:({before})=>before.items[1].productId=before.items[0].productId},{change:({before})=>before.items[0].quantity=1.5},{change:({before})=>before.items[0].currency='EUR'}];
 for(const options of cases){const r=await run(options);assert(['ISOLATED_COPY_SELECTED_SALE_SCOPE','ISOLATED_COPY_INVOICE_ACCOUNT_SCOPE','SELECTED_SALE_SCOPE_TRANSACTION_CHANGED'].includes(r.failure.code));assert.equal(r.queries.some(q=>/\bUPDATE\b|\bINSERT\b/.test(q.text)),false);}
});
test('second and third native phase errors propagate and roll back an owned transaction without commit or later effects',async()=>{
 for(const failPhase of [2,3]){const r=await run({failPhase,owns:true});assert.equal(r.failure.code,'EREQUEST');assert.equal(r.rollbackCount,1);assert.equal(r.commitCount,0);assert.equal(r.audit,undefined);assert.deepEqual(r.steps,['product-lock-proof','profit','product',...(failPhase===3?['stock']:[])]);}
 const partial=await run({counts:[200,199],owns:true});assert.equal(partial.failure.code,'ISOLATED_COPY_SELECTED_SALE_SCOPE');assert.equal(partial.rollbackCount,1);assert.equal(partial.commitCount,0);assert.equal(partial.steps.includes('stock'),false);
});
