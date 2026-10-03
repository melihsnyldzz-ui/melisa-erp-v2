import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
let records;
mock.module('../config/database.js',{namedExports:{getSqlDriver:()=>({BigInt:0})}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async()=>{}}});
const {verifyNativeCurrencyAccount,postNativeCurrencyAccount}=await import('./nativeCurrencyAccount.mjs');
const request=()=>({input(){return this;},query:async()=>({recordsets:records})});
function sample(currency='USD',cancelled=false){
 records=[[{linkedAccount:'16',linkedParty:'14',customer_id:'168',document_currency:currency,account_amount:0.44,accountId:'16',partyId:'14',accountCustomer:'168',accountCurrency:currency}],
 [{movement_type:'sales_invoice',accountId:'16',partyId:'14',effect:0.44,affects:true,currency_code:currency,customer_id:'168'},...(cancelled?[{movement_type:'sales_invoice_cancel',accountId:'16',partyId:'14',effect:-0.44,affects:true,currency_code:currency,customer_id:'168'}]:[])]];
}
for(const currency of ['USD','TRY','EUR'])test(currency+' linked sale and reversal are verified',async()=>{sample(currency);await verifyNativeCurrencyAccount(1,request,{required:true});sample(currency,true);await verifyNativeCurrencyAccount(1,request,{required:true,cancelled:true});});
test('missing, wrong customer/currency/account and duplicate ledger effects fail closed',async()=>{
 const corruptions=[()=>records[0][0].linkedAccount=null,()=>records[0][0].accountCustomer='169',()=>records[0][0].accountCurrency='EUR',()=>records[1][0].accountId='17',()=>records[1][0].effect=0,()=>records[1][0].affects=null,()=>records[1].push({...records[1][0]})];
 for(const corrupt of corruptions){sample();corrupt();await assert.rejects(verifyNativeCurrencyAccount(1,request,{required:true}),{code:'NATIVE_CURRENCY_EFFECT_UNVERIFIED'});}
});
test('old unlinked receipt remains readable; new unlinked receipt cannot claim success',async()=>{sample();records[0][0].linkedAccount=null;await verifyNativeCurrencyAccount(1,request);await assert.rejects(verifyNativeCurrencyAccount(1,request,{required:true}));});
test('currency posting cannot escape its native transaction',async()=>{await assert.rejects(postNativeCurrencyAccount(1,{},{}),{code:'NATIVE_ACCOUNT_TRANSACTION_REQUIRED'});});
