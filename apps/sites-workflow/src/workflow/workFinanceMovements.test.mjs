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

function cleanPanelInputs(){
 const revision='b'.repeat(64),day='2026-10-22',environmentId='e662fd94-d797-4b3b-938a-d143ad758b67',cc=['TRY','TRY','USD','EUR'];
 const accounts=cc.map((currency,n)=>({id:String(n+1),code:'K-'+(n+1),name:currency+' hesap '+(n+1),currency,type:n===2?'bank':'cash',synthetic:true,openingVerified:true,openingBalanceExact4:'0.0000',balanceExact4:'500.0000'}));
 const received=['50.0000','5.1250','2.0001','3.2500'],outstanding=['50.0000','94.8750','97.9999','96.7500'];
 const collectionContexts=cc.map((currency,n)=>{
  const id=String(n+1),customer={id,code:'M-'+id,name:'Yapay müşteri '+id,currency,synthetic:true,writeEligible:true,balanceExact4:outstanding[n],revision};
  const collection=(offset,amount,status)=>({id:String(100+n*10+offset),invoiceId:id,accountId:id,amountExact4:amount,currency,documentDate:day,status,revision});
  const active=collection(1,received[n],'active'),cancelled={...collection(2,'1.0000','cancelled'),reversalId:String(103+n*10),reversalAccountId:id,reversalAmountExact4:'1.0000',reversalCurrency:currency,reversalDocumentDate:day,reversalCreatedAt:'2026-10-25 01:00:00'};
  const invoice={id,documentNo:'YAPAY-'+id,documentDate:day,status:'finalized',customerId:id,currency,revision,subtotalExact4:'100.0000',grandTotalExact4:'100.0000',amountTryExact4:'100.0000',customerBalanceExact4:outstanding[n],items:[{productId:'301',stockCode:'0007',name:'Yapay ürün',quantityExact3:'1.000',unitPriceExact8:'100.00000000',unitPriceExact4:'100.0000',lineTotalExact4:'100.0000',currency}],collections:{revision,receivedExact4:received[n],outstandingExact4:outstanding[n],items:[active,cancelled]}};
  return {invoice,customer,accounts:[structuredClone(accounts[n])],capabilities:{canCollect:true,canCancelCollection:false},revision};
 });
 const invoices=collectionContexts.map(c=>structuredClone(c.invoice));
 const salesContext={meta:{schemaVersion:'melisa-work-trade.v1',source:'native-test',date:day,timeZone:'Europe/Istanbul',environment:'CLEAN_SYNTHETIC_TEST',environmentId,synthetic:true,actualT1:false,externalOperations:false,cleanSaleReadOnly:true},revision,scope:{synthetic:true,customer:structuredClone(collectionContexts[0].customer),accounts:[structuredClone(accounts[0])],products:[]},capabilities:{canCreate:false,canFinalize:false,canCancel:false,canCollect:true,canCancelCollection:false},supportedCurrencies:['TRY'],limits:{maxItems:0,maxQuantityPerLine:0,maxInvoiceAmountExact4:'0.0000'}};
 const suppliers=cc.map((currency,n)=>({id:String(n+1),code:'T-'+(n+1),name:'Yapay tedarikçi '+(n+1),currency,synthetic:true,writeEligible:true,balanceExact4:'200.0000',debtKind:'invoice',invoices:[{id:String(n+4),number:'AL-'+(n+4),status:'finalized',documentDate:day,documentCurrency:currency,accountCurrency:currency,documentAmountExact4:'200.0000',accountAmountExact4:'200.0000',paidExact4:'0.0000',returnedExact4:'0.0000',remainingExact4:'200.0000',receiptId:n===0?'3':null,receiptKind:n===0?'work-clean-store-day-receipt':null}]}));
 const p={id:'900',supplierId:'3',accountId:'3',invoiceId:'6',invoiceNumber:'AL-6',receiptId:null,receiptKind:null,ownership:'work',canCancel:false,kind:'payment',direction:'out',currency:'USD',accountCurrency:'USD',amountExact4:'2.0000',accountAmountExact4:'2.0000',amountTryExact4:'80.0000',documentRateExact8:'40.00000000',accountRateExact8:'40.00000000',documentDate:day,description:'Yapay ödeme',number:'OD-900',originalId:null,reversedById:'901'};
 const paymentContext={meta:{schemaVersion:'melisa-work-supplier-payment.v1',source:'native-test',date:day,timeZone:'Europe/Istanbul',environmentId,financeCase:'B4-TRY-20261023',financeFxCases:['B4-USD-20261023','B4-EUR-20261023']},revision,capabilities:{canView:true,canPay:true,canCancel:false},suppliers,accounts,rates:[{id:'1',currency:'USD',rateToTryExact8:'40.00000000',date:day,source:'explicit-synthetic-B4-input',caseId:'B4-USD-20261023'},{id:'2',currency:'EUR',rateToTryExact8:'45.00000000',date:day,source:'explicit-synthetic-B4-input',caseId:'B4-EUR-20261023'}],payments:[p,{...p,id:'901',kind:'payment_cancel',direction:'in',originalId:'900',reversedById:null},{...p,id:'902',supplierId:'4',accountId:'4',invoiceId:'7',invoiceNumber:'AL-7',currency:'EUR',accountCurrency:'EUR',amountExact4:'1.0000',accountAmountExact4:'1.0000',amountTryExact4:'45.0000',documentRateExact8:'45.00000000',accountRateExact8:'45.00000000',reversedById:null}],limits:{maxAmountExact4:'500.0000',maxPayments:30}};
 return {salesContext,invoices,paymentContext,collectionContexts};
}

test('clean panel resolves four exact invoice contexts and keeps three exact currency totals',()=>{
 const input=cleanPanelInputs(),before=JSON.stringify(input);
 // Neither the first context nor its first account is the requested source.
 input.collectionContexts.reverse();input.collectionContexts.find(c=>c.invoice.id==='2').accounts.unshift(structuredClone(input.paymentContext.accounts[0]));
 const result=buildWorkFinanceMovements(input);
 assert.equal(result.rows.length,15);assert.deepEqual([...new Set(result.rows.filter(r=>r.partyType==='customer').map(r=>r.partyName))].sort(),['1','2','3','4'].map(n=>'Yapay müşteri '+n));
 assert.deepEqual(result.summary.map(({currency,netExact4})=>({currency,netExact4})),[{currency:'TRY',netExact4:'55.1250'},{currency:'USD',netExact4:'2.0001'},{currency:'EUR',netExact4:'2.2500'}]);
 assert.equal(result.rows.find(r=>r.id==='collection-111').accountId,'2');assert.equal(result.bankAccounts[0].currency,'USD');
 const stable=JSON.stringify(input);buildWorkFinanceMovements(input);assert.equal(JSON.stringify(input),stable);assert.notEqual(stable,before);
});

const both=(v,n,change)=>{change(v.invoices[n]);v.collectionContexts[n].invoice=structuredClone(v.invoices[n]);};
for(const [name,change]of [
 ['missing context',v=>v.collectionContexts.pop()],
 ['duplicate context',v=>v.collectionContexts[1]=structuredClone(v.collectionContexts[0])],
 ['duplicate invoice',v=>v.invoices[1]=structuredClone(v.invoices[0])],
 ['foreign customer',v=>v.collectionContexts[1].customer.id='999'],
 ['unknown customer name',v=>v.collectionContexts[1].customer.name=''],
 ['foreign customer currency',v=>v.collectionContexts[1].customer.currency='USD'],
 ['unverified customer',v=>v.collectionContexts[1].customer.synthetic=false],
 ['missing accounts',v=>v.collectionContexts[1].accounts=[]],
 ['duplicate account',v=>v.collectionContexts[1].accounts.push(structuredClone(v.collectionContexts[1].accounts[0]))],
 ['unknown account name',v=>v.collectionContexts[1].accounts[0].name=''],
 ['conflicting account metadata',v=>v.collectionContexts[1].accounts[0].type='bank'],
 ['stale invoice revision',v=>v.collectionContexts[1].invoice.revision='c'.repeat(64)],
 ['different history snapshot',v=>v.collectionContexts[1].invoice.collections.items.pop()],
 ['wrong collection currency',v=>both(v,1,i=>i.collections.items[0].currency='USD')],
 ['wrong collection account',v=>both(v,1,i=>i.collections.items[0].accountId='1')],
 ['duplicate collection identity',v=>both(v,1,i=>i.collections.items[0].id=v.invoices[0].collections.items[0].id)],
 ['missing reversal evidence',v=>both(v,1,i=>delete i.collections.items[1].reversalId)],
 ['wrong reversal amount',v=>both(v,1,i=>i.collections.items[1].reversalAmountExact4='1.0001')],
 ['reused reversal identity',v=>both(v,1,i=>i.collections.items[1].reversalId=v.invoices[0].collections.items[1].reversalId)],
 ['reversal is another original',v=>both(v,1,i=>i.collections.items[1].reversalId=v.invoices[0].collections.items[0].id)],
 ['active reversal contradiction',v=>both(v,1,i=>i.collections.items[0].reversalId='999')],
 ['wrong finite document day',v=>both(v,1,i=>i.collections.items[1].reversalDocumentDate='2026-10-21')],
 ['invalid reversal timestamp',v=>both(v,1,i=>i.collections.items[1].reversalCreatedAt='2026-02-30 01:00:00')],
 ['wrong received sum',v=>both(v,1,i=>i.collections.receivedExact4='5.1251')],
 ['wrong outstanding sum',v=>both(v,1,i=>i.collections.outstandingExact4='94.8751')],
 ['missing supplier reversal',v=>v.paymentContext.payments.splice(1,1)],
 ['wrong supplier reversal link',v=>v.paymentContext.payments[1].originalId='999'],
 ['duplicate supplier movement',v=>v.paymentContext.payments.push(structuredClone(v.paymentContext.payments[0]))],
 ['foreign payment context',v=>v.paymentContext.meta.environmentId='other'],
 ['foreign context meta',v=>v.collectionContexts[0].meta={environmentId:'other'}],
 ['false clean marker',v=>v.salesContext.meta.actualT1=true],
 ['changed write admission',v=>v.salesContext.capabilities.canCreate=true],
])test('clean panel rejects all totals for '+name,()=>{const v=cleanPanelInputs();change(v);assert.throws(()=>buildWorkFinanceMovements(v));});

test('legacy and selected-copy calls cannot opt into clean contexts',()=>{const v=inputs();assert.throws(()=>buildWorkFinanceMovements({...v,collectionContexts:[]}));});
