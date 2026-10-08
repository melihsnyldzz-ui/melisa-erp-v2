import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkFinanceMovements} from './workFinanceMovements.mjs';

const inputs=()=>({
 salesContext:{scope:{synthetic:true,customer:{id:'501',code:'NIGHT',name:'Deneme müşterisi',synthetic:true},accounts:[{id:'99',name:'TRY Kasa',currency:'TRY',synthetic:true}]}},
 invoices:[{id:'601',customerId:'501',documentNo:'NIGHT-601',collections:{items:[{id:'701',invoiceId:'601',accountId:'99',amountExact4:'50.0000',currency:'TRY',documentDate:'2026-10-06',status:'active'},{id:'702',invoiceId:'601',accountId:'99',amountExact4:'20.0000',currency:'TRY',documentDate:'2026-10-06',status:'cancelled',reversalId:'703',reversalAccountId:'99',reversalAmountExact4:'20.0000',reversalCurrency:'TRY',reversalDocumentDate:'2026-10-06',reversalCreatedAt:'2026-10-06 12:00:00'}]}}],
 paymentContext:{suppliers:[{id:'801',code:'SUP-1',name:'Tedarikçi A',currency:'USD'}],accounts:[{id:'901',name:'USD Kasa',type:'cash',currency:'USD'}],payments:[{id:'1001',supplierId:'801',accountId:'901',kind:'payment',direction:'out',currency:'USD',amountExact4:'10.0000',documentDate:'2026-10-06',number:'OD-1001',reversedById:'1002'},{id:'1002',supplierId:'801',accountId:'901',kind:'payment_cancel',direction:'in',currency:'USD',amountExact4:'10.0000',documentDate:'2026-10-06',number:'ODI-1002',reversedById:null}]}
});

test('finance ledger shows incoming and outgoing reversal rows and keeps currency totals separate',()=>{
 const ledger=buildWorkFinanceMovements(inputs());
 assert.equal(ledger.rows.length,5);
 assert.deepEqual(ledger.summary.map(({currency,incomingExact4,outgoingExact4,netExact4})=>({currency,incomingExact4,outgoingExact4,netExact4})),[
  {currency:'TRY',incomingExact4:'70.0000',outgoingExact4:'20.0000',netExact4:'50.0000'},
  {currency:'USD',incomingExact4:'10.0000',outgoingExact4:'10.0000',netExact4:'0.0000'},
  {currency:'EUR',incomingExact4:'0.0000',outgoingExact4:'0.0000',netExact4:'0.0000'},
 ]);
 assert.equal(ledger.rows.find(row=>row.id==='collection-reversal-703').at,'2026-10-06 12:00:00');
 assert.equal(ledger.rows.find(row=>row.id==='supplier-1001').status,'Geri alındı');
 assert.equal(ledger.rows.find(row=>row.id==='supplier-1002').direction,'in');
 assert.equal(ledger.bankAccounts.length,0);
});

test('finance ledger rejects an unlinked, wrong-currency, or mismatched reversal',()=>{
 const badInvoice=inputs();badInvoice.invoices[0].customerId='999';assert.throws(()=>buildWorkFinanceMovements(badInvoice));
 const badCurrency=inputs();badCurrency.paymentContext.payments[0].currency='TRY';assert.throws(()=>buildWorkFinanceMovements(badCurrency));
 const badReversal=inputs();badReversal.invoices[0].collections.items[1].reversalAmountExact4='19.0000';assert.throws(()=>buildWorkFinanceMovements(badReversal));
});

function copyInputs(){
 const origin='ISOLATED_TEST_COPY',copyId='00000000-0000-4000-8000-000000000001',sealHash='a'.repeat(64),revision='b'.repeat(64),day='2026-10-08';
 const profile={schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:origin,copyId,sealHash,backupSHA:'c'.repeat(64),sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_STAGE04_COPY_TEST_20261008_01'},date:day,actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:['301','302'].map(id=>({id,stockCode:'K-'+id,unit:'ADET',unitFactorExact8:'1.00000000',priceIds:[id],barcodes:[],sourceKey:['VEGA2026','F0102TBLSTOKLAR',id].join('/')})),customers:[{id:'501',partyId:'21',accountId:'22',currency:'TRY',sourceKey:['VEGA2026','F0102TBLCARI','23'].join('/')}],suppliers:[{id:'801',partyId:'31',accountId:'32',currency:'TRY',sourceKey:['VEGA2026','F0103TBLCARI','33'].join('/')}],financeAccounts:[{id:'99',currency:'TRY'}]};
 const meta=schemaVersion=>({schemaVersion,operationOrigin:origin,copyId,sealHash,date:day,timeZone:'Europe/Istanbul',source:'native-test'}),entity={synthetic:false,operationOrigin:origin};
 const account={...entity,id:'99',code:'CASH',name:'TRY Kasa',currency:'TRY',type:'cash',balanceExact4:'452.2500',openingBalanceExact4:null,openingVerified:false,openingOrigin:'UNKNOWN',startingBalanceVerified:true,startingBalanceExact4:'500.0000'};
 const products=profile.products.map(p=>({...entity,id:p.id,stockCode:p.stockCode,name:'Ürün',barcode:null,unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:'153.000',revision,writeEligible:true,prices:[{quoteId:p.id,currency:'TRY',unitPriceExact8:'12.00000000',revision,source:{kind:'isolated-test-copy',copyId,sealHash}}]}));
 const value=inputs();value.salesContext={meta:meta('melisa-work-trade.v1'),revision,capabilities:{canCreate:true,canFinalize:true,canCancel:true,canCollect:true,canCancelCollection:true},scope:{...entity,customer:{...entity,id:'501',code:'CUSTOMER',name:'Müşteri',currency:'TRY',writeEligible:true,balanceExact4:'100.0000',revision},accounts:[account],products},supportedCurrencies:['TRY'],limits:{maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000'}};
 const invoice=value.invoices[0];Object.assign(invoice,{documentDate:day,status:'finalized',currency:'TRY',revision,subtotalExact4:'100.0000',grandTotalExact4:'100.0000',amountTryExact4:'100.0000',customerBalanceExact4:'100.0000',items:[{productId:'301',stockCode:'K-301',name:'Ürün',quantityExact3:'1.000',unitPriceExact8:'12.00000000',unitPriceExact4:'12.0000',lineTotalExact4:'12.0000',currency:'TRY'}]});Object.assign(invoice.collections,{receivedExact4:'50.0000',outstandingExact4:'50.0000',revision});invoice.collections.items.forEach(c=>Object.assign(c,{revision,documentDate:day,...(c.status==='cancelled'?{reversalDocumentDate:day}:{})}));
 const payments=value.paymentContext.payments;payments.forEach(p=>Object.assign(p,{accountId:'99',currency:'TRY',documentDate:day,invoiceId:null,receiptId:null,receiptKind:null,invoiceNumber:null,ownership:'work',canCancel:false,accountCurrency:'TRY',accountAmountExact4:p.amountExact4,amountTryExact4:p.amountExact4,documentRateExact8:'1.00000000',accountRateExact8:'1.00000000',description:'İşlem',originalId:p.kind==='payment_cancel'?'1001':null}));payments.push({...payments[0],id:'1003',amountExact4:'97.7500',accountAmountExact4:'97.7500',amountTryExact4:'97.7500',reversedById:null});
 value.paymentContext={meta:meta('melisa-work-supplier-payment.v1'),revision,capabilities:{canView:true,canPay:true,canCancel:true},suppliers:[{...entity,id:'801',code:'SUPPLIER',name:'Tedarikçi',currency:'TRY',balanceExact4:'100.0000',debtKind:'invoice',writeEligible:true,invoices:[]}],accounts:[structuredClone(account)],rates:[],payments,limits:{maxAmountExact4:'500.0000',maxPayments:30}};
 return {value,profile};
}

test('finite verified copy finance rows keep own payments and collections separate from unknown cash opening and preserve negative cents',()=>{
 const previous=globalThis.window,{value,profile}=copyInputs();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5204'},__MELISA_OPERATION_COPY__:profile};
 try{const before=JSON.stringify(value),result=buildWorkFinanceMovements(value);assert.equal(result.rows.length,6);assert.equal(result.summary[0].netExact4,'-47.7500');assert.equal(result.summary[1].count,0);assert.equal(result.summary[2].count,0);assert.equal(JSON.stringify(value),before);assert.equal(value.paymentContext.accounts[0].openingVerified,false);assert.equal(value.paymentContext.accounts[0].openingBalanceExact4,null);assert.doesNotMatch(JSON.stringify(result),/opening|startingBalance/);}
 finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('copy finance rejects mismatched copy seal, foreign entities, legacy records, unknown amount and unlinked collection evidence',()=>{
 const previous=globalThis.window,{value,profile}=copyInputs();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5204'},__MELISA_OPERATION_COPY__:profile};
 try{for(const change of [v=>delete v.paymentContext.meta,v=>v.paymentContext.meta.sealHash='d'.repeat(64),v=>v.paymentContext.suppliers[0].id='999',v=>v.paymentContext.accounts[0].id='999',v=>v.paymentContext.payments[0].ownership='legacy',v=>v.paymentContext.payments[0].amountExact4=null,v=>v.invoices[0].customerId='999',v=>v.invoices[0].documentDate='2026-10-09',v=>v.invoices[0].collections.items[0].accountId='999',v=>v.invoices[0].collections.items[0].documentDate='2026-10-09',v=>v.salesContext.scope.customer.synthetic=true]){const changed=structuredClone(value);change(changed);assert.throws(()=>buildWorkFinanceMovements(changed));}globalThis.window.location.port='5194';assert.throws(()=>buildWorkFinanceMovements(value));}
 finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
