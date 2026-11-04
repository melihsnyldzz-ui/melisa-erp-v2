import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the existing production functions with an isolated request driver.
// No SQL connection, admission installation, runtime or commercial write occurs.
const invoiceSource=fs.readFileSync(new URL('./invoiceDraftService.js',import.meta.url),'utf8');
const accountSource=fs.readFileSync(new URL('./nativeCurrencyAccount.mjs',import.meta.url),'utf8');
const part=(start,end)=>invoiceSource.slice(invoiceSource.indexOf(start),invoiceSource.indexOf(end)).replaceAll('export async function','async function').replaceAll('export function','function');
const bindings=part('function businessInvoiceSelection(','// Trigger row-count messages');
const currencyFunctions=part('async function prepareInvoiceCurrency(','async function hasPurchaseDiscountSchema(');
const normalizers=part('function trimText(','async function hasPersonnelSalesSchema(')+part('function numberValue(','function normalizeCancelReason(')+part('function invoiceDocumentRate(','export function normalizePurchasePayload(');
const create=part('export async function createSalesDraft(','export async function updateSalesDraft(');
const finalize=part('export async function finalizeSalesInvoice(','export async function cancelSalesInvoice(');
const cancelEnd=invoiceSource.indexOf('\nexport ',invoiceSource.indexOf('export async function cancelSalesInvoice(')+1);
const actualCancel=invoiceSource.slice(invoiceSource.indexOf('export async function cancelSalesInvoice('),cancelEnd).replace('export async function','async function');
const account=accountSource.slice(accountSource.indexOf('export async function postNativeCurrencyAccount('),accountSource.indexOf('export async function verifyNativeCurrencyAccount(')).replace('export async function','async function');
const serial=part('async function insertSalesItem(','async function updatePurchaseItems(');
const math=part('export function calculateSalesProfitSnapshot(','function invoiceDocumentRate(');
const error=(code,message='rejected',statusCode=409)=>Object.assign(Error(message),{code,statusCode});
const deepFreeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;};

function fixture({operation='sale_draft',currency='USD',registered=true,grant=true,count=1,change=()=>{}}={}){
 const transaction={},calls=[],audits=[],posted=[];
 const products=Array.from({length:count},(_,i)=>({productId:String(12+i),quoteId:String(81+i),stockCode:'000'+i,name:i===0?' Kaynak ürün ':'Diğer ürün',barcode:i===0?'0000120000':null,unitSourceId:'9',unit:'ADET',factorExact8:'1.00000000',quantityExact3:'2.000',unitPriceExact8:'2.12345678',unitPriceExact4:'2.1235',lineTotalExact4:'4.2470',averageCostTryExact4:'60.0000',sourceKey:'SYNTHETIC-SOURCE-'+i,sourceWitnessHash:'A'.repeat(64)}));
 const amount=(4.247*count).toFixed(4),rate=currency==='TRY'?'1.00000000':'47.80000000';
 const proof={database:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',profileHash:'A'.repeat(64),sessionId:71,transactionId:'991',requestId:'11111111-1111-4111-8111-111111111111',operation,actorId:'17',customerId:'155',partyEntityId:'20',accountId:'7',currency,rateExact8:rate,invoiceId:operation==='sale_draft'?null:'901',selectionHash:'B'.repeat(64),bodyHash:'C'.repeat(64),products,grandTotalExact4:amount,amountTryExact4:(Number(amount)*Number(rate)).toFixed(4)};
 const payload={documentNo:'SYNTHETIC-SALE',documentDate:'2026-10-28',customerId:155,customerCurrency:currency,documentCurrency:currency,exchangeRate:Number(rate),accountExchangeRate:Number(rate),items:products.map(p=>({productId:Number(p.productId),stockCode:p.stockCode,productName:p.name,barcode:p.barcode,quantity:2,unitPrice:2.1235,currency,averageCostTry:60}))};
 const before={id:901,documentNo:'SYNTHETIC-SALE',documentDate:'2026-10-28',status:operation==='sale_cancel'?'FINALIZED':'DRAFT',customerId:155,customerName:'Synthetic customer',customerCode:'SYNTHETIC',customerCurrency:currency,accountCurrency:currency,documentCurrency:currency,exchangeRate:Number(rate),accountExchangeRate:Number(rate),accountAmount:Number(amount),grandTotal:Number(amount),subtotal:Number(amount),amountTry:Number(proof.amountTryExact4),discountRate:0,discountTotal:0,items:products.map((p,i)=>({id:100+i,productId:Number(p.productId),stockCode:p.stockCode,productName:p.name,barcode:p.barcode,quantity:2,unitPrice:2.1235,lineTotal:4.247,currency,averageCostTry:60,productAverageCostTry:999,currentStockQty:3}))};
 change({proof,payload,before});deepFreeze(proof);
 let state=before.status.toLowerCase(),postingCalls=0,postingResult=null;
 const getter=(tx,options={})=>{if(!grant||tx!==transaction)return null;for(const key of ['operation','actorId','invoiceId'])if(Object.hasOwn(options,key)&&options[key]!==proof[key])throw error('CANONICAL_SALE_PROOF_INVALID');return proof;};
 class Request{
  constructor(tx){assert.equal(tx,transaction);this.parent=tx;this.params={};}
  input(name,type,value){this.params[name]=value;return this;}
  async query(text){
   calls.push({text,params:this.params});
   if(text.includes('canonicalStampInvoice'))return {recordset:[{id:'701'}]};
   if(text.includes('canonicalAccount')&&text.includes('UPDATE dbo.party_currency_accounts')){
    postingCalls++;if(postingCalls>1)throw Object.assign(error('EREQUEST'),{number:51904});
    assert.equal(this.params.canonicalAccount,'7');assert.equal(this.params.canonicalParty,'20');assert.equal(this.params.canonicalCustomer,'155');assert.equal(state,operation==='sale_cancel'?'cancelled':'finalized');
    const effect=(operation==='sale_cancel'?'-':'')+proof.grandTotalExact4+'0000',start=739528000001n,delta=BigInt(effect.replace('.','')),end=start+delta,exact=n=>`${n/100000000n}.${String(n%100000000n).padStart(8,'0')}`;
    const result=postingResult??{accountId:'7',partyId:'20',customerId:'155',currency,beforeBalance:exact(start),effect,afterBalance:exact(end)};return {recordset:[result]};
   }
   if(text.includes('SELECT CASE WHEN EXISTS'))return {recordset:[{valid:1}]};
   if(text.includes('SELECT currency_code, is_active'))return {recordset:[{currency_code:'TRY',is_active:true,is_deleted:false}]};
   if(text.includes('INSERT INTO dbo.sales_invoices'))return {recordset:[{invoiceId:901}]};
   if(text.includes('DECLARE @profitIds')||text.includes('DECLARE @productIds')||text.includes('DECLARE @stockIds'))return {recordset:[{verifiedCount:String(count)}]};
   if(text.includes('status = N\'finalized\''))state='finalized';
   if(text.includes('status = N\'cancelled\''))state='cancelled';
   return {rowsAffected:[1],recordset:[]};
  }
 }
 const sql={Request,BigInt:'bigint',Int:'int',Bit:'bit',Date:'date',MAX:-1,NVarChar:n=>['nvarchar',n],Decimal:(p,s)=>['decimal',p,s]};
 const noop=async()=>{};
 const settlement={documentCurrency:currency,accountCurrency:currency,documentAmount:Number(amount),accountAmount:Number(amount),documentRateToTry:Number(rate),accountRateToTry:Number(rate),amountTry:Number(proof.amountTryExact4)};
 const sandbox={getCanonicalBusinessSaleTransaction:getter,getCanonicalBusinessSession:()=>registered?{}:null,makeServiceError:error,sql,BUSINESS_COPY_DATABASE:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',isIsolatedOperationCopyRuntime:()=>false,getIsolatedOperationCopyConfig:()=>null,cleanDirectSaleActorId:()=>null,assertMelisaWriteEnabled:()=>{},assertOperationQuarantineAllowed:noop,invoiceQuarantineEntities:()=>[],quarantineTransactionContext:()=>{},assertAccountingPeriodOpen:noop,hasPersonnelSalesSchema:async()=>false,assertPilotCashCustomer:async()=>{if(grant)assert.fail('canonical selection must not fall back to cash-customer authority');},assertPilotSaleProducts:noop,assertCurrencySnapshotSchema:noop,resolveCurrencySettlement:async(_request,input)=>{assert.equal(input.accountCurrency,currency);return settlement;},writeInvoiceCurrencySnapshot:noop,writeMovementCurrencySnapshot:async(_request,_kind,id,snapshot,effect)=>{assert.equal(id,'701');posted.push({snapshot,effect});},getSalesSnapshot:async()=>({...before,status:state.toUpperCase()}),getSalesFinalizeSnapshot:async()=>({...before,status:state.toUpperCase()}),writeAuditLog:async(_request,event)=>audits.push(event),isNativeInvoiceTransaction:()=>false,getSqlDriver:()=>sql,readCurrencyRateMap:async()=>{assert.fail('canonical proof cannot borrow latest FX rates');},safeNumber:(v,f=0)=>Number.isFinite(Number(v))?Number(v):f,getCashCustomerCurrency:()=>null,isCashCustomerCode:()=>true,settlementFromInvoice:()=>settlement,toFinalizeResult:v=>v,assertWebInvoiceMutationSupported:noop,assertInvoiceNotExported:noop,assertInvoiceHasNoReturns:noop,assertSelectedSaleCashlessCancellation:noop,normalizeCancelReason:v=>v,reverseSaleCashCollection:async()=>({reversed:false}),nativeError:(code,message,status)=>{throw error(code,message,status);}};
 vm.createContext(sandbox);vm.runInContext(bindings+currencyFunctions+normalizers+serial+math+account+create+finalize+actualCancel+';globalThis.api={createSalesDraft,finalizeSalesInvoice,cancelSalesInvoice,assertSelectedSaleInvocation,businessInvoiceSelection,postNativeCurrencyAccount,stampInvoiceMovement};',sandbox);
 return {api:sandbox.api,transaction,sql,payload,before,proof,calls,audits,posted,context:{transaction,sqlDriver:sql,pool:{}},setPostingResult:value=>{postingResult=value;},setState:value=>{state=value;}};
}

test('canonical draft uses the exact selected USD account and native currency snapshots without TRY-card fallback',async()=>{
 const f=fixture({count:2});await f.api.createSalesDraft(f.payload,{id:17},f.context);
 const insert=f.calls.find(x=>x.text.includes('INSERT INTO dbo.sales_invoices'));
 assert.equal(insert.params.initialSalesAccountCurrency,'USD');assert.equal(insert.params.initialSalesAccountAmount,8.494);assert.equal(insert.params.initialSalesAccountRate,47.8);assert.equal(insert.params.initialSalesActor,'17');
 const items=JSON.parse(f.calls.find(x=>x.params.selectedItemsJSON).params.selectedItemsJSON);assert.equal(items[0].productName,' Kaynak ürün ');assert.equal(items[0].barcode,'0000120000');assert.equal(items[0].averageCostTry,'60.0000');assert.equal(f.calls.some(x=>x.text.includes('UPDATE dbo.party_currency_accounts')),false);
});
test('missing, foreign transaction and wrong-actor proof cannot write a canonical draft',async()=>{
 for(const options of [{grant:false},{}]){
  const f=fixture(options),context=options.grant===false?f.context:{...f.context,transaction:{}};
  await assert.rejects(f.api.createSalesDraft(f.payload,{id:17},context));assert.equal(f.calls.some(x=>/\bINSERT\b|\bUPDATE\b/.test(x.text)),false);
 }
 const f=fixture();await assert.rejects(f.api.createSalesDraft(f.payload,{id:15},f.context),{code:'CANONICAL_SALE_PROOF_INVALID'});assert.equal(f.calls.some(x=>/\bINSERT\b/.test(x.text)),false);
});
test('changed header, price, quantity, source name, unit, barcode or unknown cost rejects before invoice DML',async()=>{
 const edits=[({payload})=>payload.customerId=156,({payload})=>payload.documentCurrency='EUR',({payload})=>payload.exchangeRate=1,({payload})=>payload.items[0].unitPrice=3,({payload})=>payload.items[0].quantity=1,({payload})=>payload.items[0].productName='forged',({payload})=>payload.items[0].barcode='12',({proof})=>proof.products[0].unit='KOLI',({proof})=>proof.products[0].averageCostTryExact4=null,({proof})=>proof.amountTryExact4='1.0000'];
 for(const change of edits){const f=fixture({change});await assert.rejects(f.api.createSalesDraft(f.payload,{id:17},f.context));assert.equal(f.calls.some(x=>/\bINSERT\b|\bUPDATE\b/.test(x.text)),false);}
});
test('canonical finalization uses sealed cost, stamps once, preserves main-card currency and posts exact account once',async()=>{
 const f=fixture({operation:'sale_finalize',count:2});await f.api.finalizeSalesInvoice(901,{id:17},f.context);
 assert.equal(f.posted.length,1);assert.equal(f.posted[0].effect,8.494);assert.equal(f.calls.filter(x=>x.text.includes('UPDATE dbo.party_currency_accounts')).length,1);
 const main=f.calls.find(x=>x.text.includes('balance = balance + @customerBalanceEffect'));assert.match(main.text,/AND currency_code=N'USD'/);
 const profit=JSON.parse(f.calls.find(x=>x.params.selectedFinalizeJSON).params.selectedFinalizeJSON);assert.equal(profit[0].averageCostTry,'60.0000');assert.equal(f.audits.filter(x=>x.action==='canonical_sale_currency_account_posted').length,1);
});
test('canonical finalize rejects insufficient or unknown current stock and changed original line/cost',async()=>{
 for(const change of [({before})=>before.items[0].currentStockQty=1,({before})=>before.items[0].currentStockQty=null,({before})=>before.items[0].averageCostTry=61,({before})=>before.items[0].productName='forged']){
  const f=fixture({operation:'sale_finalize',change});await assert.rejects(f.api.finalizeSalesInvoice(901,{id:17},f.context));assert.equal(f.calls.some(x=>/\bINSERT\b|\bUPDATE\b/.test(x.text)),false);
 }
});
test('native account completion retains decimal28,8 residue and refuses a second posting',async()=>{
 const f=fixture({operation:'sale_finalize'});f.setState('finalized');const result=await f.api.postNativeCurrencyAccount(901,f.context,{id:17});
 assert.equal(result.beforeBalance,'7395.28000001');assert.equal(result.effect,'4.24700000');assert.equal(result.afterBalance,'7399.52700001');
 const call=f.calls.at(-1);assert.equal(call.params.canonicalAccount,'7');assert.match(call.text,/@effect decimal\(28,8\)/);assert.match(call.text,/current_balance=current_balance\+@effect/);assert.doesNotMatch(call.text,/MIN\(|UPDATE dbo.customers/);
 await assert.rejects(f.api.postNativeCurrencyAccount(901,f.context,{id:17}),{number:51904});assert.equal(f.audits.length,1);
});
test('wrong account result and foreign operation/invoice cannot masquerade as a completed account effect',async()=>{
 const f=fixture({operation:'sale_finalize'});f.setState('finalized');f.setPostingResult({accountId:'8',partyId:'20',customerId:'155',currency:'USD',beforeBalance:'7395.28000001',effect:'4.24700000',afterBalance:'7399.52700001'});await assert.rejects(f.api.postNativeCurrencyAccount(901,f.context,{id:17}),{code:'CANONICAL_SALE_ACCOUNT_RESULT'});assert.equal(f.audits.length,0);
 for(const [id,cancel]of [[902,false],[901,true]]){const g=fixture({operation:'sale_finalize'});await assert.rejects(g.api.postNativeCurrencyAccount(id,g.context,{id:17},{cancel}),{code:'CANONICAL_SALE_PROOF_INVALID'});assert.equal(g.calls.length,0);}
});
test('canonical cancellation uses the original proof account/rate and posts its exact inverse once',async()=>{
 const f=fixture({operation:'sale_cancel'});await f.api.cancelSalesInvoice(901,{reason:'Synthetic cancellation'},{id:17},f.context);
 assert.equal(f.posted.length,1);assert.equal(f.posted[0].effect,-4.247);const account=f.calls.find(x=>x.text.includes('UPDATE dbo.party_currency_accounts'));assert.equal(account.params.canonicalAccount,'7');assert.equal(account.params.canonicalRate,'47.80000000');assert.equal(account.params.canonicalCancel,true);assert.match(account.text,/CANONICAL_SALE_ACCOUNT_ORIGINAL/);assert.equal(f.audits.filter(x=>x.action==='canonical_sale_currency_account_reversed').length,1);
 const main=f.calls.find(x=>x.text.includes('balance = balance - @cancelCustomerBalanceEffect'));assert.match(main.text,/AND currency_code=N'USD'/);
});
test('unregistered legacy non-isolated selection stays outside canonical account and selected-sale dispatch',()=>{
 const f=fixture({registered:false,grant:false});assert.equal(f.api.businessInvoiceSelection(f.transaction,'sales','155','TRY'),null);assert.equal(f.api.assertSelectedSaleInvocation(f.transaction,'sale_draft',{id:15},null,{}),null);assert.equal(f.calls.length,0);
});
