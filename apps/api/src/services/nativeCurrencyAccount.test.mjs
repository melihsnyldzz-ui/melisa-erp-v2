import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
let records;
mock.module('../config/database.js',{namedExports:{getSqlDriver:()=>({BigInt:0})}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async()=>{}}});
const {verifyNativeCurrencyAccount,postNativeCurrencyAccount,postIsolatedCopyCurrencyMovement}=await import('./nativeCurrencyAccount.mjs');
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

test('copied currency completion binds exact8 account effect and never adds a second scalar balance',async()=>{
 const {fixtureContext,fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {validateIsolatedOperationCopyContext}=await import('./isolatedOperationCopyContext.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const copy=validateIsolatedOperationCopyContext(fixtureContext()),transaction={},calls=[];
 class Request{constructor(tx){assert.equal(tx,transaction);this.params={};}input(k,t,v){this.params[k]=v;return this;}async query(sql){calls.push({sql,params:this.params});return{recordset:[{accountId:'22',partyId:'21',movementId:'50',beforeBalance:'7395.28000001',effect:'-92.00000000',afterBalance:'7303.28000001'}]};}}
 const driver={Request,UniqueIdentifier:0,BigInt:0,NVarChar:()=>0,Decimal:(p,s)=>{assert.equal(p,28);assert.equal(s,8);return 0;}};
 await assert.rejects(postIsolatedCopyCurrencyMovement({role:'customer',partyId:'20',currency:'TRY',movementId:'50',effectExact8:'-92.00000000'},{transaction,sqlDriver:driver},{id:'16'}));
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction,write:true},async()=>{
  const post=await postIsolatedCopyCurrencyMovement({role:'customer',partyId:'20',currency:'TRY',movementId:'50',effectExact8:'-92.00000000'},{transaction,sqlDriver:driver},{id:'16'});
  assert.equal(post.afterBalance,'7303.28000001');
  await assert.rejects(postIsolatedCopyCurrencyMovement({role:'customer',partyId:'20',currency:'USD',movementId:'50',effectExact8:'-92.00000000'},{transaction,sqlDriver:driver},{id:'16'}));
 });
 assert.equal(calls.length,1);assert.equal(calls[0].params.effect,'-92.00000000');
 assert.match(calls[0].sql,/transaction_id=CURRENT_TRANSACTION_ID\(\)/);
 assert.match(calls[0].sql,/UPDATE dbo.party_currency_accounts SET current_balance=current_balance\+@effect/);
 assert.doesNotMatch(calls[0].sql,/UPDATE dbo.customers SET balance/);
 assert.match(calls[0].sql,/N'sales_invoice',N'sales_invoice_cancel',N'collection'/);
});
