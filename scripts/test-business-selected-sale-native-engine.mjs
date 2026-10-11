import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
let runtime=null,active=null,calls=[],stop='header';
class Request{
 constructor(transaction){assert.equal(transaction,active.transaction);this.parent=transaction;this.params={};}
 input(name,_type,value){this.params[name]=value;return this;}
 async query(query){
  calls.push({query,params:{...this.params}});
  if(query.includes('INSERT INTO dbo.sales_invoices')&&stop==='header')throw Object.assign(Error('GUARDED_HEADER_REACHED'),{code:'STOP_HEADER'});
  if(query.includes('WHERE id = @customerBalanceId')||query.includes('WHERE id = @cancelCustomerBalanceId'))throw Object.assign(Error('GUARDED_CARD_REACHED'),{code:'STOP_CARD'});
  if(query.includes(' AS currency_snapshot_ready'))return {recordset:[{currency_snapshot_ready:1}]};
  if(query.includes('WHERE id = @currencySnapshotInvoiceId'))return {recordset:[{account_currency:active.selected.currency,account_amount:600,account_exchange_rate_snapshot:Number(active.selected.rateExact8)}]};
  if(query.includes('WHERE si.id = @finalizeSnapshotId'))return {recordset:[{id:500,customerId:100,customerName:'Synthetic customer',customerCode:'OFFLINE',customerCurrency:active.selected.currency,documentCurrency:active.selected.currency,exchangeRate:Number(active.selected.rateExact8),documentDate:active.copy.date,grandTotal:600,subtotal:600,amountTry:600*Number(active.selected.rateExact8),status:active.operation==='sale_cancel'?'finalized':'draft'}]};
  if(query.includes('WHERE sii.sales_invoice_id = @finalizeItemsSnapshotId'))return {recordset:[{id:1,productId:444,stockCode:'OFFLINE-444',productName:'Synthetic product',quantity:1,currentStockQty:10,currency:active.selected.currency,unitPrice:600,lineTotal:600,averageCostTry:1.25,productAverageCostTry:1.25}]};
  if(query.includes('WHERE event_type='))return {recordset:[{id:1}]};
  if(query.includes('movement_type=N\'collection\''))return {recordset:[]};
  if(query.includes('SELECT currency_code, is_active'))return {recordset:[{currency_code:'TRY',is_active:true,is_deleted:false}]};
  if(query.includes('UPDATE dbo.party_currency_accounts'))return {recordset:[{accountId:active.selected.customerAccountId,partyId:active.selected.partyId,movementId:'50',beforeBalance:'10.00000000',effect:this.params.effect,afterBalance:'610.00000000'}]};
  if(query.includes('SELECT m.id FROM dbo.customer_movements'))return {recordset:[{id:50}]};
  if(query.includes('SELECT CASE WHEN EXISTS(SELECT 1 FROM dbo.party_currency_accounts'))return {recordset:[{valid:1}]};
  return {recordset:[],recordsets:[[]],rowsAffected:[1]};
 }
}
const driver={Request,BigInt:0,UniqueIdentifier:0,Date:0,Bit:0,Int:0,MAX:-1,NVarChar:()=>0,Decimal:()=>0};
mock.module('../apps/api/src/config/database.js',{namedExports:{getSqlDriver:()=>driver,getSqlPool:async()=>{throw Error('A native request must not open another pool');},isCanonicalTest:()=>false,isIsolatedOperationCopyRuntime:()=>!!runtime,getIsolatedOperationCopyConfig:()=>runtime}});
mock.module('../apps/api/src/services/writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{}}});
mock.module('../apps/api/src/services/operationQuarantineService.js',{namedExports:{assertOperationQuarantineAllowed:async()=>{},quarantineTransactionContext:()=>({})}});
mock.module('../apps/api/src/services/vegaInvoiceExportJournal.mjs',{namedExports:{assertInvoiceNotExported:async()=>{}}});
mock.module('../apps/api/src/services/auditService.js',{namedExports:{writeAuditLog:async()=>{}}});
const {selectedSaleWriteHarness}=await import('../apps/api/src/services/businessSelectedSaleWriteScope.test-fixture.mjs');
const {createSalesDraft,finalizeSalesInvoice,cancelSalesInvoice,insertIsolatedCopyInvoiceMovement,stampInvoiceMovement}=await import('../apps/api/src/services/invoiceDraftService.js');
const {postIsolatedCopyCurrencyMovement}=await import('../apps/api/src/services/nativeCurrencyAccount.mjs');
const ctx=h=>({transaction:h.transaction,sqlDriver:driver,pool:{},nativeTerminalV1:true,nativeApproval:true});
async function scoped(options,run){const h=await selectedSaleWriteHarness(options);runtime=h.copy;active=h;calls=[];try{return await h.withScope(()=>run(h));}finally{runtime=null;active=null;}}
const draft=h=>({documentNo:'OFFLINE-SELECTED',documentDate:h.copy.date,customerId:'100',customerCurrency:h.selected.currency,documentCurrency:h.selected.currency,exchangeRate:Number(h.selected.rateExact8),accountExchangeRate:Number(h.selected.rateExact8),items:[{productId:'444',stockCode:'OFFLINE-444',productName:'Synthetic product',currency:h.selected.currency,quantity:1,unitPrice:600}]});

test('real selected scope permits USD native draft first header with account snapshot despite TRY main card',async()=>scoped({},async h=>{
 stop='header';await assert.rejects(createSalesDraft(draft(h),h.actor,ctx(h)),{code:'STOP_HEADER'});
 const header=calls.at(-1);assert.match(header.query,/account_currency, account_amount, account_exchange_rate_snapshot/);assert.equal(header.params.initialSalesAccountCurrency,'USD');assert.equal(header.params.initialSalesAccountAmount,600);assert.equal(header.params.initialSalesAccountRate,47.8);assert.equal(header.params.amountTry,28680);
}));
test('selected draft rejects actor, product set, quantity, FX, customer, and document-cap drift before INSERT',async()=>scoped({},async h=>{
 const p=draft(h);for(const [body,actor] of [[p,{...h.actor,id:'16'}],[{...p,customerId:'101'},h.actor],[{...p,items:[...p.items,...p.items]},h.actor],[{...p,items:[{...p.items[0],productId:'445'}]},h.actor],[{...p,items:[{...p.items[0],quantity:1.5}]},h.actor],[{...p,exchangeRate:1},h.actor],[{...p,items:[{...p.items[0],unitPrice:20001}]},h.actor]]){
  calls=[];await assert.rejects(createSalesDraft(body,actor,ctx(h)));assert(!calls.some(c=>/INSERT|UPDATE/.test(c.query)));
 }
}));
for(const operation of ['sale_finalize','sale_cancel'])test(`selected ${operation} executes native stock/movement branches with matching-currency main card filter`,async()=>scoped({operation},async h=>{
 stop='card';await assert.rejects(operation==='sale_finalize'?finalizeSalesInvoice(500,h.actor,ctx(h)):cancelSalesInvoice(500,{reason:'Synthetic test cancellation'},h.actor,ctx(h)),{code:'STOP_CARD'});
 assert(calls.some(c=>c.query.includes('UPDATE dbo.products')));assert(calls.some(c=>c.query.includes('INSERT dbo.customer_movements')));
 const card=calls.at(-1);assert.match(card.query,/AND currency_code=N'USD'/);assert.equal(card.params.customerBalanceEffect??card.params.cancelCustomerBalanceEffect,600);
 const movement=calls.find(c=>c.query.includes('INSERT dbo.customer_movements'));assert.equal(movement.params.copyMovementOperation,operation);assert.equal(movement.params.copyMovementAmount,'600.0000');assert.equal(movement.params.copyMovementTry,'28680.0000');assert.equal(movement.params.selectedSalePolicyHash,h.selected.policyHash);
}));
for(const operation of ['sale_finalize','sale_cancel'])test(`selected ${operation} movement/account completion binds native request, invoice, actor and sign`,async()=>scoped({operation},async h=>{
 const cancel=operation==='sale_cancel',snapshot={documentCurrency:'USD',accountCurrency:'USD',documentRateToTry:47.8,accountRateToTry:47.8,documentAmount:600,accountAmount:600,amountTry:28680};
 const args={kind:'sales',invoiceId:500,movementType:cancel?'sales_invoice_cancel':'sales_invoice',direction:cancel?-1:1,snapshot,actor:h.actor,partyId:'100',documentDate:h.copy.date};
 await insertIsolatedCopyInvoiceMovement(driver,h.transaction,args);await stampInvoiceMovement(driver,h.transaction,'sales',500,args.movementType,snapshot,args.direction,h.actor);
 const movement={role:'customer',partyId:'100',currency:'USD',movementId:'50',effectExact8:cancel?'-600.00000000':'600.00000000'};
 await postIsolatedCopyCurrencyMovement(movement,ctx(h),h.actor);const post=calls.at(-1);assert.equal(post.params.account,'5100');assert.equal(post.params.selectedSaleInvoice,'500');assert.equal(post.params.selectedSaleRequestId,h.requestId);assert.equal(post.params.copyAccountOperation,operation);assert.match(post.query,/m.sales_invoice_id=@selectedSaleInvoice/);assert.match(post.query,/businessSelectedSalePolicyHash/);assert.doesNotMatch(post.query,/UPDATE dbo.customers/);
 for(const patch of [{invoiceId:501},{actor:{...h.actor,id:'16'}},{partyId:'101'},{movementType:cancel?'sales_invoice':'sales_invoice_cancel'},{snapshot:{...snapshot,documentRateToTry:1}},{snapshot:{...snapshot,documentAmount:20001,accountAmount:20001,amountTry:956047.8}}])await assert.rejects(insertIsolatedCopyInvoiceMovement(driver,h.transaction,{...args,...patch}));
 await assert.rejects(postIsolatedCopyCurrencyMovement({...movement,effectExact8:cancel?'600.00000000':'-600.00000000'},ctx(h),h.actor));await assert.rejects(postIsolatedCopyCurrencyMovement(movement,ctx(h),{...h.actor,id:'16'}));
}));
test('unverified or forged native intent never reaches an engine callback',async()=>{
 for(const mutate of [(stage,row)=>{if(stage==='execute')row.intent_json='{}';},(stage,row)=>{if(stage==='metadata')row.copyLockMode='Shared';}]){const h=await selectedSaleWriteHarness({mutate});let reached=false;await assert.rejects(h.withScope(()=>{reached=true;}));assert.equal(reached,false);}
});

test('native client flags without owner witness cannot enable a selected USD draft',async()=>{
 const h=await selectedSaleWriteHarness(),{withIsolatedOperationCopyScope}=await import('../apps/api/src/services/isolatedOperationCopyScope.mjs');runtime=h.copy;active=h;calls=[];
 try{await withIsolatedOperationCopyScope({context:h.copy,transaction:h.transaction,identity:h.identity,readProof:h.proof,write:true},async()=>{
  await assert.rejects(createSalesDraft({...draft(h),businessSelectedSale:true,businessSelectedSalePolicyHash:h.selected.policyHash},h.actor,ctx(h)),{code:'INVOICE_PARTY_CURRENCY_CHANGED'});assert(!calls.some(c=>/INSERT|UPDATE/.test(c.query)));
 });}finally{runtime=null;active=null;}
});
test('scope operation and foreign transaction cannot be substituted by native engine calls',async()=>scoped({},async h=>{
 await assert.rejects(finalizeSalesInvoice(500,h.actor,ctx(h)),{code:'ISOLATED_COPY_SELECTED_SALE_SCOPE'});assert(!calls.some(c=>/INSERT|UPDATE/.test(c.query)));
 await assert.rejects(insertIsolatedCopyInvoiceMovement(driver,{}, {kind:'sales',invoiceId:500,movementType:'sales_invoice',direction:1,actor:h.actor,snapshot:{documentCurrency:'USD',accountCurrency:'USD',documentRateToTry:47.8,accountRateToTry:47.8,documentAmount:600,accountAmount:600,amountTry:28680},partyId:'100',documentDate:h.copy.date}),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
}));
