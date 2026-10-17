import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureContext} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,validateIsolatedOperationCopyContext,bindIsolatedCopyOperationDTO,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';
import {workSalePreview,workBusinessDailySelection,workBusinessCurrencyRate,workSelection} from './workSalesModel.mjs';
import {validateBusinessTradeContext,buildIsolatedCopyTradeDomain} from './workTradeStore.mjs';
import {buildIsolatedCopyPaymentDomain} from './workSupplierPaymentStore.mjs';
import {validateIsolatedCopySupplierPaymentContext,supplierPaymentPreview} from './workSupplierPaymentModel.mjs';
import {createWorkCollectionService} from './workCollectionService.mjs';

// Entirely offline witnesses: no real account, source balance or credential.
function fixture(){
 const raw=fixtureContext(),currencies=['TRY','USD','EUR'];
 raw.target={...raw.target,database:BUSINESS_COPY_DATABASE,login:'melisa_shared_test_rw_20261009_02',databaseUser:'melisa_shared_test_rw_20261009_02'};
 Object.assign(raw,{date:'2026-10-09',scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'d'.repeat(64),businessInvoiceMaxExact4:'20000.0000',externalOperations:false,humanAccepted:false,currencyRates:currencies.map((currency,i)=>({currency,rateExact8:['1.00000000','47.80000000','55.12000000'][i],source:'offline-witness',id:String(i+1),date:'2026-09-12'}))});
 const product=raw.products[0];product.costExact4='9.2500';product.priceIds=['100','101','102'];product.quotes=currencies.map((currency,i)=>({quoteId:product.priceIds[i],currency,priceExact8:['100.00000000','2.12345678','3.12345678'][i],type:'sale',mainUnit:true,verified:true}));
 for(const kind of ['customers','suppliers'])raw[kind]=currencies.map((currency,i)=>({...raw[kind][0],accountId:String(Number(raw[kind][0].accountId)+i),currency,sourceKnown:true,sourceWitnessHash:'e'.repeat(64)}));
 raw.financeAccounts=currencies.map((currency,i)=>({...raw.financeAccounts[0],id:String(40+i),currency,baselineBalanceExact4:'1000.0000'}));
 const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const meta={date:copy.date,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin};
 const trade=currency=>{
  const witness=copy.customers.find(p=>p.currency===currency),quote=copy.products[0].quotes.find(q=>q.currency===currency),account=copy.financeAccounts.find(a=>a.currency===currency);
  const context={meta,revision:'a'.repeat(64),capabilities:{canCreate:true,canCollect:true,canCancelCollection:true},scope:{...origin,customer:{...witness,...origin,writeEligible:true},products:[{...origin,id:product.id,stockCode:product.stockCode,name:'Offline product',barcode:'00161',unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:'10.000',costExact4:product.costExact4,writeEligible:true,prices:[{quoteId:quote.quoteId,currency,unitPriceExact8:quote.priceExact8,source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}}]}],accounts:[{...account,...origin,name:'Offline cash',type:'cash'}]},limits:{maxInvoiceAmountExact4:'500.0000'}};
  return bindIsolatedCopyOperationDTO(copy,context);
 };
 const payment=()=>bindIsolatedCopyOperationDTO(copy,{meta,suppliers:copy.suppliers.map((p,i)=>({...p,...origin,writeEligible:true,debtKind:'invoice',balanceExact4:'100.0000',invoices:[{id:String(60+i),receiptKind:'work-stage4-copy-batch-receipt',receiptId:String(70+i),number:'Offline receipt',status:'finalized',documentDate:copy.date,documentCurrency:p.currency,accountCurrency:p.currency,documentAmountExact4:'100.0000',accountAmountExact4:'100.0000',paidExact4:'0.0000',returnedExact4:'0.0000',remainingExact4:'100.0000'}]})),accounts:copy.financeAccounts.map(p=>({...p,...origin,type:'cash',openingVerified:false,openingOrigin:'UNKNOWN',openingBalanceExact4:null,startingBalanceVerified:true,startingBalanceExact4:p.baselineBalanceExact4,balanceExact4:p.baselineBalanceExact4})),rates:copy.currencyRates.filter(r=>r.currency!=='TRY').map(r=>({id:r.id,currency:r.currency,date:r.date,rateToTryExact8:r.rateExact8})),payments:[],limits:{maxAmountExact4:'500.0000',maxPayments:30}});
 return {copy,trade,payment};
}
const saleSelection=(copy,currency)=>({customerId:'20',documentDate:copy.date,currency,items:[{productId:'34765',quoteId:{TRY:'100',USD:'101',EUR:'102'}[currency],quantityExact3:'1.000'}]});
test('bound business sales keep separate source currencies and dated exact rate snapshots',()=>{
 const {copy,trade}=fixture();
 for(const currency of ['TRY','USD','EUR']){const dto=trade(currency);validateBusinessTradeContext(dto,copy);const preview=workSalePreview(saleSelection(copy,currency),dto);assert.equal(preview.currency,currency);assert.equal(preview.settlement.accountId,dto.scope.customer.accountId);assert.equal(preview.settlement.rateSource.date,'2026-09-12');assert.equal(preview.items[0].stockCode,'0161 MOLLY');assert.equal(preview.items[0].unitPriceExact8,copy.products[0].quotes.find(q=>q.currency===currency).priceExact8);if(currency==='USD')assert.equal(preview.amountTryExact4,'101.5033');}
 assert.throws(()=>workSelection(saleSelection(copy,'USD')),{code:'WORK_CURRENCY_UNSUPPORTED'});
});
test('customer account/party, source quote and private cost drift fail before native callback',()=>{
 const {copy,trade}=fixture();for(const mutate of [c=>c.scope.customer.accountId='999',c=>c.scope.customer.partyId='999',c=>c.scope.products[0].prices[0].unitPriceExact8='1.00000000',c=>c.scope.products[0].costExact4='1.0000']){const dto=trade('USD');mutate(dto);assert.throws(()=>validateBusinessTradeContext(dto,copy));}
 const dto=trade('USD');dto.scope.customer.accountId='999';assert.throws(()=>workSalePreview(saleSelection(copy,'USD'),dto));
 assert.throws(()=>workSalePreview(saleSelection(copy,'USD'),structuredClone(trade('USD'))),{code:'ISOLATED_COPY_UNBOUND_DTO'});
});
test('explicit selectors retain identity and never infer a different currency or product',()=>{
 const {copy}=fixture(),input={customerId:'20',accountId:'41',currency:'USD',productIds:['34765']};const selected=workBusinessDailySelection(copy,input);assert.equal(selected.customerAccountId,'23');assert.deepEqual(selected.productIds,['34765']);assert.equal(Object.isFrozen(selected),true);
 for(const patch of [{accountId:'40'},{customerId:'999'},{productIds:['34765','34765']},{productIds:['999']},{currency:'LL'},{actorId:'16'}])assert.throws(()=>workBusinessDailySelection(copy,{...input,...patch}));
 assert.throws(()=>workBusinessDailySelection(structuredClone(copy),input),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
});
test('currency rate missing from the sealed source remains unsupported; no market fallback',()=>{
 const {copy}=fixture();assert.throws(()=>workBusinessCurrencyRate(copy,'LL'));assert.equal(workBusinessCurrencyRate(copy,'TRY').rateExact8,'1.00000000');
});
test('payment read/preview selects a supplier currency tuple and preserves UNKNOWN opening',()=>{
 const {copy,payment}=fixture(),dto=payment(),actor={id:'16',permissions:['finance.view','supplier.view','finance.payment']},actual={id:'16',role:'isolated_test_ilker',permissions:actor.permissions};validateIsolatedCopySupplierPaymentContext(dto,actor,actual);
 for(const currency of ['TRY','USD','EUR']){const supplier=dto.suppliers.find(s=>s.currency===currency),account=dto.accounts.find(a=>a.currency===currency),input={supplierId:supplier.id,invoiceId:supplier.invoices[0].id,accountId:account.id,currency,amountExact4:'1.0000',documentDate:copy.date,description:'Offline payment'};const preview=supplierPaymentPreview(input,dto);assert.equal(preview.currency,currency);assert.equal(preview.balanceAfterExact4,'99.0000');assert.equal(account.openingVerified,false);assert.equal(account.openingBalanceExact4,null);assert.throws(()=>supplierPaymentPreview({...input,accountId:currency==='TRY'?'41':'40'},dto));}
});
test('payment scope rejects duplicate currency tuples, altered dated rate and opening invention',()=>{
 const {payment}=fixture(),actor={id:'16',permissions:[]},actual={id:'16',role:'isolated_test_ilker',permissions:[]};
 for(const mutate of [c=>c.suppliers[1]=c.suppliers[0],c=>c.rates[0].rateToTryExact8='48.00000000',c=>c.suppliers[0].accountId='999',c=>c.accounts[0].openingOrigin='VERIFIED']){const dto=payment();mutate(dto);assert.throws(()=>validateIsolatedCopySupplierPaymentContext(dto,actor,actual));}
});
test('invoice-linked collection keeps matching source currency/account and exact TRY valuation',async()=>{
 const {copy,trade}=fixture(),context=trade('USD'),actor={id:'16',permissions:['customer.view','finance.collection']};
 const invoice={id:'80',customerId:'20',currency:'USD',status:'finalized',collections:{outstandingExact4:'2.1235',receivedExact4:'0.0000',revision:'b'.repeat(64)}};
 const service=createWorkCollectionService({getStore:async()=>({read:async(_,fn)=>fn({context,invoice:async()=>invoice})})});
 const preview=await service.preview({invoiceId:'80',accountId:'41',amountExact4:'1.0000',documentDate:copy.date},actor);assert.equal(preview.currency,'USD');assert.equal(preview.outstandingAfterExact4,'1.1235');assert.equal(preview.settlement.amountTryExact4,'47.8000');
 await assert.rejects(service.preview({invoiceId:'80',accountId:'40',amountExact4:'1.0000',documentDate:copy.date},actor));
});
test('native collection callback uses the selected matching cash account and dated currency rate',async()=>{
 const {copy,trade}=fixture(),context=trade('USD'),actor={id:'16'},calls=[];
 const q={BigInt:'id',NVarChar:()=>'',Date:'date',UniqueIdentifier:'uuid'},request=()=>({input(){return this;},async query(sql){if(sql.includes('WHERE id=@m AND customer_id=@customer'))return {recordset:[{currency:'USD',effect:'-1.00000000'}]};if(sql.includes('FROM dbo.work_collection_links l'))return {recordset:[{id:'91',invoiceId:'80',accountId:'41',amountExact4:'1.0000',currency:'USD',documentDate:copy.date,status:'active',reversalId:null}]};return {recordset:[]};}});
 const runtime={sql:q,finance:{async createCustomerCollection(input){calls.push(input);return {id:91};}},currency:{async postIsolatedCopyCurrencyMovement(input){calls.push(input);}}};
 const domain=await buildIsolatedCopyTradeDomain({runtime,copyContext:copy,context,actor,nativeContext:{transaction:{}},request,reloadContext:async()=>{Object.assign(context,trade('USD'));bindIsolatedCopyOperationDTO(copy,context);}});
 await domain.collect({selection:{accountId:'41',invoiceId:'80',amountExact4:'1.0000',documentDate:copy.date},currency:'USD'},'9c0075ed-7f4b-42f8-b056-f27b8369ad9c');
 assert.equal(calls[0].accountId,41);assert.equal(calls[0].currency,'USD');assert.equal(calls[0].exchangeRate,47.8);assert.equal(calls[1].currency,'USD');assert.equal('costExact4' in context.scope.products[0],false);
 await assert.rejects(domain.collect({selection:{accountId:'40',invoiceId:'80',amountExact4:'1.0000',documentDate:copy.date},currency:'USD'},'9c0075ed-7f4b-42f8-b056-f27b8369ad9c'),{code:'WORK_COLLECTION_SCOPE'});assert.equal(calls.length,2);
});
test('native payment callback posts the selected supplier currency rather than the first supplier tuple',async()=>{
 const {copy,payment}=fixture(),context=payment(),actor={id:'16',permissions:['finance.view','supplier.view','finance.payment']},actual={id:'16',role:'isolated_test_ilker',permissions:actor.permissions},calls=[];
 const q={BigInt:'id',NVarChar:()=>'',UniqueIdentifier:'uuid'},request=()=>({input(){return this;},async query(sql){if(sql.includes('WHERE id=@m'))return {recordset:[{supplierId:'30',currency:'USD',effect:'-1.00000000'}]};if(sql.includes('FROM dbo.supplier_movements m JOIN'))return {recordset:[{id:'91',supplierId:'30',accountId:'41',invoiceId:'61',kind:'payment',direction:'out',currency:'USD',amountExact4:'1.0000',accountCurrency:'USD',accountAmountExact4:'1.0000',amountTryExact4:'47.8000',documentRateExact8:'47.80000000',accountRateExact8:'47.80000000',documentDate:copy.date,description:'Offline',number:'Offline-91'}]};return {recordset:[]};}});
 const runtime={sql:q,finance:{async createSupplierPayment(input){calls.push(input);return {id:91};}},currency:{async postIsolatedCopyCurrencyMovement(input){calls.push(input);}}};
 const domain=await buildIsolatedCopyPaymentDomain({runtime,copyContext:copy,context,actor,actual,nativeContext:{transaction:{}},request,reloadContext:async()=>{}}),input={supplierId:'30',invoiceId:'61',accountId:'41',currency:'USD',amountExact4:'1.0000',documentDate:copy.date,description:'Offline'};
 const result=await domain.pay(input,supplierPaymentPreview(input,context));assert.equal(result.currency,'USD');assert.equal(result.receiptId,'71');assert.equal(calls[1].currency,'USD');assert.equal(calls[0].exchangeRate,47.8);
});

test('unverified supplier opening remains visible but cannot authorize an unlinked business payment',()=>{
 const {payment}=fixture(),dto=payment(),actor={id:'16',permissions:[]},actual={id:'16',role:'isolated_test_ilker',permissions:[]};
 const supplier=dto.suppliers[0];supplier.debtKind='unverified-opening';supplier.invoices=[];
 validateIsolatedCopySupplierPaymentContext(dto,actor,actual);assert.equal(dto.accounts[0].openingVerified,false);
 assert.throws(()=>supplierPaymentPreview({supplierId:supplier.id,invoiceId:null,accountId:dto.accounts[0].id,currency:supplier.currency,amountExact4:'1.0000',documentDate:dto.meta.date,description:'Offline opening'},dto),{code:'WORK_PAYMENT_SCOPE'});
});
