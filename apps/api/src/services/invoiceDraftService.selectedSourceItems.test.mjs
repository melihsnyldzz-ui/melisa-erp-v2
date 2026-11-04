import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./invoiceDraftService.js',import.meta.url),'utf8');
const selected=source.slice(source.indexOf('function businessInvoiceSelection('),source.indexOf('// Trigger row-count messages'));
const trim=source.slice(source.indexOf('function trimText('),source.indexOf('async function hasPersonnelSalesSchema('));
const numbers=source.slice(source.indexOf('function numberValue('),source.indexOf('function normalizeCancelReason('));
const normalize=source.slice(source.indexOf('function invoiceDocumentRate('),source.indexOf('export function normalizePurchasePayload(')).replaceAll('export function','function');
const create=source.slice(source.indexOf('export async function createSalesDraft('),source.indexOf('export async function updateSalesDraft(')).replace('export async function','async function');
const serial=source.slice(source.indexOf('async function insertSalesItem('),source.indexOf('async function updatePurchaseItems('));
async function run({count=2,selectedEnabled=true,mutate=()=>{},actorId=15,foreignTransaction=false,bindingValid=true}={}){
 const transaction={},scope={operation:'sale_draft',actorId:'15',invoiceId:null,customerId:'161',customerAccountId:'10',partyId:'18',currency:'USD',rateExact8:'47.80000000',maxInvoiceAmountExact4:'20000.0000',productIds:Array.from({length:count},(_,n)=>String(30000+n))};
 const products=scope.productIds.map((id,n)=>({id,name:n===0?' Kaynak adı':n===1?'Kaynak adı ':'Kaynak '+n,sourceKnown:true,identityVerified:true}));
 const copy={target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},customers:[{id:'161',accountId:'10',partyId:'18',currency:'USD'}],products};
 const payload={documentNo:'NIGHT-FIXTURE',documentDate:'2026-10-09',customerId:161,customerCurrency:'USD',documentCurrency:'USD',exchangeRate:47.8,accountExchangeRate:47.8,selectedSale:true,items:products.map((p,n)=>({productId:Number(p.id),stockCode:'000'+n,barcode:n===0?'0000001':null,productName:p.name,quantity:n===0?24:1,currency:'USD',unitPrice:1.3457,averageCostTry:60,stockStatus:null,note:null}))};mutate({payload,products,scope,copy});
 const queries=[],rows=[];let afterDraft;
 class Request{constructor(tx){assert.equal(tx,transaction);this.params={};}input(k,_type,v){this.params[k]=v;return this;}async query(text){queries.push(text);if(/SELECT CASE WHEN EXISTS/.test(text))return {recordset:[{valid:bindingValid?1:0}]};if(/INSERT INTO dbo\.sales_invoices/.test(text))return {recordset:[{invoiceId:901}]};if(/INSERT INTO dbo\.sales_invoice_items/.test(text)){if(this.params.selectedItemsJSON){const items=JSON.parse(this.params.selectedItemsJSON);assert.match(text,/ORDER BY CONVERT\(int,j\.\[key\]\) ASC/);rows.push(...items);}else rows.push({...this.params});return {rowsAffected:[rows.length]};}assert.fail('unexpected SQL');}}
 const sql={Request,NVarChar:()=>{},Decimal:()=>{},Date:'date',BigInt:'bigint',MAX:'max'};
 const noop=async()=>{};const sandbox={getCanonicalBusinessSaleTransaction:()=>null,getCanonicalBusinessSession:()=>null,cleanDirectSaleActorId:()=>null,BUSINESS_COPY_DATABASE:copy.target.database,isIsolatedOperationCopyRuntime:()=>selectedEnabled,getIsolatedOperationCopyConfig:()=>copy,isolatedCopyTransactionContext:()=>foreignTransaction?{...copy}:copy,getBusinessSelectedSaleWriteScope:(c,tx)=>{if(c!==copy||tx!==transaction)throw Object.assign(Error('scope'),{code:'SELECTED_SALE_SCOPE_TRANSACTION_CHANGED'});return selectedEnabled?scope:null;},makeServiceError:(code,message,statusCode)=>Object.assign(Error(message),{code,statusCode}),assertMelisaWriteEnabled:()=>{},assertOperationQuarantineAllowed:noop,invoiceQuarantineEntities:()=>[],quarantineTransactionContext:()=>{},hasPersonnelSalesSchema:async()=>false,assertAccountingPeriodOpen:noop,assertPilotCashCustomer:noop,assertPilotSaleProducts:noop,prepareInvoiceCurrency:async(_sql,_tx,_kind,draft)=>{afterDraft=JSON.parse(JSON.stringify(draft));return {accountCurrency:'USD',accountAmount:draft.grandTotal,accountRateToTry:47.8};},writeInvoiceCurrencySnapshot:noop,getSalesSnapshot:async()=>{throw Object.assign(Error('STOP_AFTER_ITEMS'),{code:'STOP_AFTER_ITEMS'});},sql};
 vm.createContext(sandbox);vm.runInContext(trim+numbers+normalize+selected+serial+create+';globalThis.create=createSalesDraft;globalThis.normalize=normalizeSalesPayload;',sandbox);
 let error;try{await sandbox.create(payload,{id:actorId},{pool:{},sqlDriver:sql,transaction});}catch(e){error=e;}
 return {error,queries,rows,afterDraft,payload,normalized:JSON.parse(JSON.stringify(sandbox.normalize(payload)))};
}
test('selected SOURCE preserves two literal edge-space names; general normalize and mathematics remain unchanged',async()=>{
 const r=await run();assert.equal(r.error.code,'STOP_AFTER_ITEMS');assert.deepEqual(r.afterDraft.items.map(i=>i.productName),[' Kaynak adı','Kaynak adı ']);assert.deepEqual(r.normalized.items.map(i=>i.productName),['Kaynak adı','Kaynak adı']);for(const key of ['subtotal','grandTotal','amountTry'])assert.equal(r.afterDraft[key],r.normalized[key]);assert.equal(r.queries.filter(q=>/INSERT INTO dbo\.sales_invoice_items/.test(q)).length,1);
});
test('200 selected items use one parameterized native INSERT, exact target fields, decimals, nulls and ordinal identity order',async()=>{
 const r=await run({count:200});assert.equal(r.error.code,'STOP_AFTER_ITEMS');assert.equal(r.rows.length,200);assert.equal(r.queries.filter(q=>/INSERT INTO dbo\.sales_invoice_items/.test(q)).length,1);assert.equal(new Set(r.rows.map(i=>i.productId)).size,200);assert.equal(r.rows[0].quantity,'24.000');assert.equal(r.rows[0].unitPrice,'1.3457');assert.equal(r.rows[0].lineTotal,'32.2968');assert.equal(r.rows[0].averageCostTry,'60.0000');assert.equal(r.rows[0].barcode,'0000001');assert.equal(r.rows[1].barcode,null);assert.equal(r.rows[0].note,null);assert.equal(r.rows[0].stockStatus,null);assert.equal(r.rows[199].productId,'30199');
 const target=r.queries.find(q=>/INSERT INTO dbo\.sales_invoice_items/.test(q)).match(/sales_invoice_items \(([^)]+)\)/)[1].split(',');assert.equal(target.length,12);assert.equal(target[0],'sales_invoice_id');assert.equal(target.at(-1),'note');
});
test('one selected item and general multi-item sales retain original serial insert and legacy trim',async()=>{
 const one=await run({count:1});assert.equal(one.rows.length,1);assert.equal(one.rows[0].productName,' Kaynak adı');assert.equal(one.rows[0].selectedItemsJSON,undefined);
 const ordinary=await run({count:3,selectedEnabled:false});assert.equal(ordinary.error.code,'STOP_AFTER_ITEMS');assert.equal(ordinary.queries.filter(q=>/INSERT INTO dbo\.sales_invoice_items/.test(q)).length,3);assert.equal(ordinary.rows[0].productName,'Kaynak adı');assert.equal(ordinary.rows[1].productName,'Kaynak adı');
});
test('forged source name, foreign ID, oversized/blank source, unverified identity and field overflow reject before DML',async()=>{
 const mutations=[({payload})=>payload.items[0].productName='forged',({payload})=>payload.items[0].productId=999,({products,payload})=>{products[0].name='x'.repeat(251);payload.items[0].productName=products[0].name;},({products,payload})=>{products[0].name='  ';payload.items[0].productName='  ';},({products})=>products[0].sourceKnown=false,({products})=>products[0].identityVerified=false,({payload})=>payload.items[0].barcode='0'.repeat(81),({payload})=>payload.items[0].stockCode='x'.repeat(51)];
 for(const mutate of mutations){const r=await run({mutate});assert.equal(r.error.code,'ISOLATED_COPY_SELECTED_SALE_SCOPE');assert.equal(r.queries.some(q=>/\bINSERT\b/.test(q)),false);}
});
test('same-transaction, actor and native account binding checks remain before any selected insertion',async()=>{
 for(const options of [{actorId:16},{foreignTransaction:true},{bindingValid:false}]){const r=await run(options);assert(r.error);assert.notEqual(r.error.code,'STOP_AFTER_ITEMS');assert.equal(r.queries.some(q=>/\bINSERT\b/.test(q)),false);}
});
