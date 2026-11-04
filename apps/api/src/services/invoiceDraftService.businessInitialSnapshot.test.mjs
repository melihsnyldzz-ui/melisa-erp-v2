import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./invoiceDraftService.js',import.meta.url),'utf8');
const selector=source.slice(source.indexOf('function businessInvoiceSelection('),source.indexOf('async function assertBusinessInvoiceAccount('));
const create=source.slice(source.indexOf('export async function createPurchaseDraft('),source.indexOf('export async function updatePurchaseDraft(')).replace('export async function','async function');

// Execute the production create function up to its first header INSERT. The
// fake database applies the same initial account equality the SQL guard checks.
async function header({currency='TRY',business=true,database='MELISA_ERP_CRM_SHARED_TEST_20261009_02',foreignTransaction=false}={}){
 const rate=currency==='TRY'?1:47.8,amount=currency==='TRY'?1179.8:9.1;
 const transaction={},copy={target:{database},suppliers:[{id:'10155',accountId:'1007',currency}],currencyRates:[{currency,rateExact8:rate.toFixed(8)}],businessInvoiceMaxExact4:'20000.0000'};
 const draft={supplierId:10155,supplierCurrency:currency,documentCurrency:currency,exchangeRate:rate,accountExchangeRate:rate,documentDate:'2026-10-09',grandTotal:amount,subtotal:amount,amountTry:Number((amount*rate).toFixed(4)),stockCostEffectTry:0,items:[]};
 const settlement={accountCurrency:currency,accountAmount:amount,accountRateToTry:rate};
 const queries=[];let headerRow;
 class Request{
  constructor(tx){assert.equal(tx,transaction);this.parameters={};}
  input(name,_type,value){this.parameters[name]=value;return this;}
  async query(sql){
   queries.push(sql);const columns=sql.match(/INSERT INTO dbo\.purchase_invoices\s*\(([\s\S]*?)\)\s*OUTPUT/)[1].split(',').map(x=>x.trim());
   const values=sql.match(/VALUES\s*\(([\s\S]*?)\);/)[1].split(',').map(x=>x.trim());
   headerRow=Object.fromEntries(columns.map((c,i)=>[c,values[i].startsWith('@')?this.parameters[values[i].slice(1)]:values[i]]));
   if(business&&database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02'){
    assert.equal(headerRow.account_currency,currency,'initial header must already contain sealed account currency');
    assert.equal(headerRow.account_amount,headerRow.grand_total,'initial header account amount must equal native same-currency total');
    assert.equal(headerRow.account_exchange_rate_snapshot,headerRow.exchange_rate_snapshot,'initial account rate must equal sealed document rate');
   }
   throw Object.assign(Error('STOP_AFTER_GUARDED_HEADER'),{code:'STOP_AFTER_GUARDED_HEADER'});
  }
 }
 const sql={Request,NVarChar:()=>{},Decimal:()=>{},Date:'date',BigInt:'bigint'};
 const noop=async()=>{};
 const sandbox={getCanonicalBusinessSaleTransaction:()=>null,getCanonicalBusinessSession:()=>null,BUSINESS_COPY_DATABASE:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',isIsolatedOperationCopyRuntime:()=>business,getIsolatedOperationCopyConfig:()=>copy,isolatedCopyTransactionContext:()=>foreignTransaction?{...copy}:copy,getBusinessInboundSelection:()=>({supplierId:'10155',accountId:'1007',currency}),makeServiceError:(code,message,statusCode)=>Object.assign(Error(message),{code,statusCode}),assertMelisaWriteEnabled:()=>{},normalizePurchasePayload:()=>draft,assertOperationQuarantineAllowed:noop,invoiceQuarantineEntities:()=>[],quarantineTransactionContext:()=>{},assertAccountingPeriodOpen:noop,ensureSupplier:async()=>10155,prepareInvoiceCurrency:async()=>settlement,assertDailyPurchaseSupplierCurrency:noop,assertPurchaseItemsBelongToSupplier:noop,sql};
 vm.createContext(sandbox);vm.runInContext(selector+create+';globalThis.create=createPurchaseDraft;',sandbox);
 await assert.rejects(()=>sandbox.create({}, {id:16},{pool:{},sqlDriver:sql,transaction}),e=>e.code===(foreignTransaction?'ISOLATED_COPY_INVOICE_ACCOUNT_SCOPE':'STOP_AFTER_GUARDED_HEADER'));
 return {queries,headerRow};
}

for(const currency of ['TRY','USD'])test(`business ${currency} header passes amount/rate guard on its first INSERT`,async()=>{
 const {queries,headerRow}=await header({currency});assert.equal(queries.length,1);assert.equal(headerRow.account_currency,currency);assert(headerRow.account_amount>0);
});
test('old shared copy and ordinary native header retain their original INSERT columns',async()=>{
 for(const options of [{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'},{business:false}]){
  const {headerRow}=await header(options);assert.equal(Object.hasOwn(headerRow,'account_currency'),false);assert.equal(Object.hasOwn(headerRow,'account_amount'),false);assert.equal(Object.hasOwn(headerRow,'account_exchange_rate_snapshot'),false);
 }
});
test('foreign transaction cannot obtain a business initial snapshot or execute the header INSERT',async()=>{
 const {queries}=await header({foreignTransaction:true});assert.equal(queries.length,0);
});
