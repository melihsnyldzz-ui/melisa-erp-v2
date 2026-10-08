import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
let records,copyRuntime=null;
mock.module('../config/database.js',{namedExports:{getSqlDriver:()=>({BigInt:0}),getSqlPool:async()=>{throw Error('No new pool may be opened by a native adapter');},isCanonicalTest:()=>false,isIsolatedOperationCopyRuntime:()=>!!copyRuntime,getIsolatedOperationCopyConfig:()=>copyRuntime}});
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

test('copy inbound native adapter avoids driver positional variables and preserves the original product supplier',async()=>{
 const {withIsolatedCopyPurchaseBatchContext}=await import('./testPurchaseService.mjs');
 const {fixtureContext,fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {validateIsolatedOperationCopyContext,isolatedCopyHash,bindIsolatedCopyOperationDTO}=await import('./isolatedOperationCopyContext.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const raw=fixtureContext();raw.suppliers[0].currency='TRY';raw.products.push({...raw.products[0],id:'30003',sourceKey:'VEGA2026/F0102TBLSTOKLAR/14568',stockCode:'004 KİNDO',priceIds:['101'],barcodes:['0004']});const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const context=bindIsolatedCopyOperationDTO(copy,{meta:{date:copy.date,operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash},scope:{...origin,supplier:{...origin,id:'30',currency:'TRY',code:'BABY HOOD',name:'BABY HOOD',balanceExact4:'166600.0000'},warehouse:{id:'1',label:'Mevcut depo'},products:copy.products.map((p,i)=>({...origin,id:p.id,stockCode:p.stockCode,unit:{label:'ADET',factorExact8:'1.00000000'},writeEligible:true,purchasePriceExact8:i?'85.00000000':'75.00000000'}))}});
 const transaction={},inputs=[];
 class Request{constructor(tx){assert.equal(tx,transaction);}input(k,t,v){assert.doesNotMatch(k,/^p\d+$/,'driver reserves positional @p1/@p2');inputs.push([k,v]);return this;}async query(sql){assert.match(sql,/@copyInboundProductA,@copyInboundProductB/);return{recordset:copy.products.map((p,i)=>({id:p.id,stock_code:p.stockCode,name:'Ürün',unit:'ADET',current_stock_qty:i?21:153,average_cost_try:i?85:75,supplier_id:123}))};}}
 await withIsolatedOperationCopyScope({context:copy,transaction,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),write:false},async()=>{
  const result=await withIsolatedCopyPurchaseBatchContext({id:'16'},{context,nativeContext:{transaction,pool:{},sqlDriver:{Request,BigInt:0}}},async(ctx,d)=>d,{write:false});
  assert.equal(result.copyProducts[0].actual_supplier,123);assert.equal(result.s.supplier_id,'30');assert.equal(result.copyProducts[1].stock_code,'004 KİNDO');
 });
 assert.deepEqual(inputs,[['copyInboundProductA',34765],['copyInboundProductB',30003]]);
});
test('received copy purchase accepts only sealed supplier/products while preserving different master supplier and original strict behavior',async()=>{
 const {assertPurchaseItemsBelongToSupplier}=await import('./invoiceDraftService.js');
 const {fixtureContext,fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {validateIsolatedOperationCopyContext,isolatedCopyHash}=await import('./isolatedOperationCopyContext.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const raw=fixtureContext();raw.suppliers[0].currency='TRY';const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),tx={};
 const card={id:34765,stock_code:'0161 MOLLY',supplier_id:123,is_active:true},sql={Request:class{constructor(t){assert.equal(t,tx);}input(){return this;}async query(){return{recordset:[{...card}]};}}};
 const items=[{productId:34765}];
 await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,items),{code:'PURCHASE_PRODUCT_SUPPLIER_MISMATCH'});
 copyRuntime=copy;
 try{
  await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,items),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
  await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
   await assertPurchaseItemsBelongToSupplier(sql,tx,30,items);assert.equal(card.supplier_id,123);
   await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,31,items),{code:'PURCHASE_PRODUCT_SUPPLIER_MISMATCH'});
   await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,[{productId:34765},{productId:99}]),{code:'PURCHASE_PRODUCT_SUPPLIER_MISMATCH'});
   card.stock_code='161';await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,items),{code:'PURCHASE_PRODUCT_SUPPLIER_MISMATCH'});card.stock_code='0161 MOLLY';
   card.is_active=false;await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,items),{code:'PURCHASE_PRODUCT_INACTIVE'});
  });
 }finally{copyRuntime=null;}
});
