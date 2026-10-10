import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the actual native adapter functions with offline requests. The request
// double captures bound SQL; this is not a claim of database execution proof.
const invoiceSource=fs.readFileSync(new URL('./invoiceDraftService.js',import.meta.url),'utf8');
const financeSource=fs.readFileSync(new URL('./financeService.js',import.meta.url),'utf8');
const currencySource=fs.readFileSync(new URL('./nativeCurrencyAccount.mjs',import.meta.url),'utf8');
const dailySource=fs.readFileSync(new URL('./testDailyService.mjs',import.meta.url),'utf8');
const BUSINESS='MELISA_ERP_CRM_SHARED_TEST_20261009_02',LEGACY='MELISA_ERP_STAGE04_COPY_TEST_20261008_01';
function harness({database=BUSINESS,registered=true,nativeParty='161',nativeCurrency='TRY',actualDatabase=database}={}){
 const copy={target:{database},copyId:'ab9ab06a-6b0f-4b48-8898-43b13c140c93',date:'2026-10-09',actors:[{id:'16'}],customers:[{id:'99',accountId:'9',currency:'TRY'},{id:'161',accountId:'10',currency:'TRY'}],suppliers:[{id:'88',accountId:'644',currency:'TRY'},{id:'13123',accountId:'645',currency:'TRY'}],financeAccounts:[{id:'20043',currency:'TRY'}]};
 const selection=registered?{customerAccountId:'10',supplierAccountId:'645',financeAccountId:'20043',currency:'TRY',productIds:['29983']}:null,calls=[],tx={};
 class Request{
  constructor(transaction){assert.equal(transaction,tx);this.params={};}
  input(key,type,value){this.params[key]=value;return this;}
  async query(sql){calls.push({sql,params:this.params});
   if('copyFinancePartyMovementId' in this.params)return {recordset:[{id:nativeParty,currency:nativeCurrency}]};
   if(sql.includes('INSERT INTO dbo.finance_account_movements')){
    assert.match(sql,/DB_NAME\(\).*<>@copyFinanceMovementDatabase/);
    assert.match(sql,/session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID\(\)/);
    if(actualDatabase!==this.params.copyFinanceMovementDatabase)throw Object.assign(new Error('Offline target mismatch'),{code:'ISOLATED_COPY_FINANCE_ACCOUNT_SCOPE'});
    return {recordset:[]};
   }
   if('updatedFinanceAccountId' in this.params)return {recordset:[{id:20043,currency_code:'TRY',account_type:'cash',is_active:true,current_balance:100}]};
   if('copyStampParty' in this.params)return {recordset:this.params.copyStampParty===nativeParty?[{id:90}]:[]};
   throw Error('Unexpected offline native query');
  }
 }
 const driver={Request,BigInt:0,UniqueIdentifier:0,Date:0,NVarChar:()=>0,Decimal:()=>0,Char:()=>0};
 const sandbox={BUSINESS_COPY_DATABASE:BUSINESS,isIsolatedOperationCopyRuntime:()=>true,getIsolatedOperationCopyConfig:()=>copy,isolatedCopyTransactionContext:transaction=>{assert.equal(transaction,tx);return copy;},getBusinessDailySelection:()=>selection,getBusinessDailyScopeHash:()=>selection?'A'.repeat(64):null,getBusinessInboundSelection:()=>null,makeServiceError:(code,message,statusCode)=>Object.assign(new Error(message),{code,statusCode}),copyAssert:(ok,code,statusCode)=>{if(!ok)throw Object.assign(new Error(code),{code,statusCode});},copyInvoiceDocumentDate:v=>v,mapFinanceAccount:v=>v,writeAuditLog:async()=>{}};
 const selector=invoiceSource.slice(invoiceSource.indexOf('function businessInvoiceSelection('),invoiceSource.indexOf('async function assertBusinessInvoiceAccount('));
 const binding=invoiceSource.slice(invoiceSource.indexOf('function copyInvoiceMovementBinding('),invoiceSource.indexOf('// Only the registered copy enters this adapter.'));
 const stamp=invoiceSource.slice(invoiceSource.indexOf('export async function stampInvoiceMovement('),invoiceSource.indexOf('async function assertInvoiceSettlementParty(')).replace('export async','async');
 const finance=financeSource.slice(financeSource.indexOf('export async function writeFinanceAccountMovement('),financeSource.indexOf('function mapFinanceMovement(')).replace('export async','async');
 const currency=currencySource.slice(currencySource.indexOf('export async function postIsolatedCopyCurrencyMovement('),currencySource.indexOf('// Runs inside the native sale')).replace('export async','async');
 const daily=dailySource.slice(dailySource.indexOf('export function resolveBusinessDailyScope('),dailySource.indexOf('async function purchaseReturnSources(')).replace('export function','function');
 vm.createContext(sandbox);vm.runInContext(selector+binding+stamp+finance+currency+daily+';globalThis.api={copyInvoiceMovementBinding,stampInvoiceMovement,writeFinanceAccountMovement,postIsolatedCopyCurrencyMovement,resolveBusinessDailyScope};',sandbox);
 const actor={id:'16'},snapshot={documentCurrency:'TRY',accountCurrency:'TRY',documentRateToTry:1,accountRateToTry:1,documentAmount:10,accountAmount:10,amountTry:10};
 const payload={sourceType:'collection',partyType:'customer',partyMovementId:'90',account:{id:20043,currency:'TRY',isActive:true},amount:10,currency:'TRY',documentDate:copy.date,actor};
 return {...sandbox.api,copy,selection,calls,driver,tx,actor,snapshot,payload};
}

test('daily invoice stamp selects the sealed account even when another TRY party appears first',async()=>{
 const h=harness();await h.stampInvoiceMovement(h.driver,h.tx,'sales',80,'sales_invoice',h.snapshot,1,h.actor);
 assert.equal(h.calls[0].params.copyStampParty,'161');assert.doesNotMatch(h.calls[0].sql,/INSERT|UPDATE/);
 const wrong=harness({nativeParty:'99'});await assert.rejects(wrong.stampInvoiceMovement(wrong.driver,wrong.tx,'sales',80,'sales_invoice',wrong.snapshot,1,wrong.actor),{code:'INVOICE_MOVEMENT_SNAPSHOT_AMBIGUOUS'});
});
test('DB02 invoice adapter has no first-party fallback without a registered daily selection',()=>{
 const h=harness({registered:false});assert.throws(()=>h.copyInvoiceMovementBinding(h.tx,'sales',80,'sales_invoice',h.snapshot,1,h.actor),{code:'ISOLATED_COPY_INVOICE_MOVEMENT_SCOPE'});
});
test('finance binds exact native party and sealed finance account before its guarded insert',async()=>{
 const h=harness();await h.writeFinanceAccountMovement(h.tx,h.driver,h.payload);
 const insert=h.calls.find(c=>c.sql.includes('INSERT INTO dbo.finance_account_movements'));
 assert.equal(insert.params.copyFinanceMovementPartyId,'161');assert.equal(insert.params.copyFinanceMovementDatabase,BUSINESS);assert.equal(insert.params.copyFinanceMovementScopeHash,'A'.repeat(64));
 assert.match(insert.sql,/businessDailyScopeHash/);assert.match(insert.sql,/created_by=@accountMovementCreatedBy/);
});
test('unregistered selection, wrong party/currency and wrong finance account cannot insert',async()=>{
 for(const options of [{registered:false},{nativeParty:'99'},{nativeCurrency:'USD'}]){
  const h=harness(options);await assert.rejects(h.writeFinanceAccountMovement(h.tx,h.driver,h.payload),{code:'ISOLATED_COPY_FINANCE_ACCOUNT_SCOPE'});assert(!h.calls.some(c=>c.sql.includes('INSERT INTO')));
 }
 const h=harness();await assert.rejects(h.writeFinanceAccountMovement(h.tx,h.driver,{...h.payload,account:{...h.payload.account,id:999}}),{code:'ISOLATED_COPY_FINANCE_ACCOUNT_SCOPE'});assert(!h.calls.some(c=>c.sql.includes('INSERT INTO')));
});
test('foreign database is rejected by captured target guard; legacy target stays bound',async()=>{
 const wrong=harness({actualDatabase:'OTHER_DATABASE'});await assert.rejects(wrong.writeFinanceAccountMovement(wrong.tx,wrong.driver,wrong.payload),{code:'ISOLATED_COPY_FINANCE_ACCOUNT_SCOPE'});
 const legacy=harness({database:LEGACY,registered:false});await legacy.writeFinanceAccountMovement(legacy.tx,legacy.driver,legacy.payload);
 const insert=legacy.calls.find(c=>c.sql.includes('INSERT INTO'));assert.equal(insert.params.copyFinanceMovementDatabase,LEGACY);assert.equal(insert.params.copyFinanceMovementScopeHash,null);
});
test('registered uppercase SHA256 scope supports the finite native currency bridge',async()=>{
 const h=harness();h.copy.currencyRates=[{currency:'TRY',rateExact8:'1.00000000',date:h.copy.date}];
 const calls=[];class Request{constructor(tx){assert.equal(tx,h.tx);}input(key,type,value){calls.push({key,value});return this;}async query(sql){assert.match(sql,/businessDailyScopeHash/);return {recordset:[{accountId:'10',partyId:'21',movementId:'90',effect:'-1.00000000',beforeBalance:'2.00000000',afterBalance:'1.00000000'}]};}}
 await h.postIsolatedCopyCurrencyMovement({role:'customer',partyId:'161',currency:'TRY',movementId:'90',effectExact8:'-1.00000000'},{transaction:h.tx,sqlDriver:{...h.driver,Request}},h.actor);
 assert(calls.some(c=>c.key==='businessDailyScopeHash'&&c.value==='A'.repeat(64)));
});
test('finite count/return context keeps uppercase source seal and one selected product',()=>{
 const h=harness();h.copy.products=[{id:'29983',stockCode:'OFFLINE-CODE',sourceKnown:true,unit:'ADET',unitFactorExact8:'1.00000000'},{id:'999',stockCode:'UNSELECTED'}];
 h.copy.customers[1].sourceKnown=true;h.copy.suppliers[1].sourceKnown=true;h.copy.currencyRates=[{currency:'TRY',rateExact8:'1.00000000',date:h.copy.date}];
 const dto={meta:{businessDailyScopeHash:'A'.repeat(64)},scope:{products:[{id:'29983',stockCode:'OFFLINE-CODE'}],supplier:{...h.copy.suppliers[1]}}};
 const bound=h.resolveBusinessDailyScope(h.copy,dto);assert.equal(bound.products.length,1);assert.equal(bound.products[0].id,'29983');assert.equal(bound.supplier.id,'13123');
 const wrong={...dto,scope:{...dto.scope,products:[{id:'999',stockCode:'UNSELECTED'}]}};assert.throws(()=>h.resolveBusinessDailyScope(h.copy,wrong),{code:'BUSINESS_DAILY_CONTEXT_IDENTITY'});
});
