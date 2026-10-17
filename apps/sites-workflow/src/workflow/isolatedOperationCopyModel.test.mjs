import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOperationCopyBootstrap,operationCopyFromMeta,operationCopyEntity,operationCopyQuote} from './isolatedOperationCopyModel.mjs';
import {tradeContext} from './workTradeModel.mjs';
import {receivingContext,purchaseContext,supplierContext} from './workInboundModel.mjs';
import {paymentContext,createPaymentJournal} from './workSupplierPaymentsModel.mjs';
const location={protocol:'http:',hostname:'127.0.0.1',port:'5204'},origin='ISOLATED_TEST_COPY',copyId='00000000-0000-4000-8000-000000000001',sealHash='a'.repeat(64),revision='b'.repeat(64);
function bootstrap(){return {schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:origin,copyId,sealHash,backupSHA:'C'.repeat(64),sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_STAGE04_COPY_TEST_20261008_01'},date:'2026-10-08',actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:['301','302'].map((id,i)=>({id,sourceKey:['VEGA2026','F0102TBLSTOKLAR',''].join('/')+id,stockCode:'K-'+id,unit:'ADET',unitFactorExact8:'1.00000000',priceIds:[String(801+i)],barcodes:[i?'000302':'000301']})),customers:[{id:'501',partyId:'901',accountId:'1001',currency:'TRY',sourceKey:['VEGA2026','F0102TBLCARI','501'].join('/')}],suppliers:[{id:'601',partyId:'902',accountId:'1002',currency:'TRY',sourceKey:['VEGA2026','F0103TBLCARI','601'].join('/')}],financeAccounts:[{id:'701',currency:'TRY'}]};}
const meta=schemaVersion=>({schemaVersion,timeZone:'Europe/Istanbul',source:'native-test',date:'2026-10-08',operationOrigin:origin,copyId,sealHash});
test('shared preparation bootstrap cannot cross into the normal or earlier copy target, including LAN',()=>{
 const p=bootstrap();p.target.database='MELISA_ERP_CRM_SHARED_TEST_20261009_01';p.date='2026-10-09';
 const shared={...location,port:'5224'};
 for(const hostname of ['127.0.0.1','localhost','192.168.1.46'])assert.equal(validateOperationCopyBootstrap(p,{...shared,hostname}),p);
 for(const other of [location,{...location,port:'5194'},{...shared,hostname:'192.168.1.47'},{...shared,protocol:'https:'}])assert.throws(()=>validateOperationCopyBootstrap(p,other));
 assert.throws(()=>validateOperationCopyBootstrap(bootstrap(),shared));
 assert.throws(()=>operationCopyFromMeta({...meta('example'),date:p.date,copyId:'00000000-0000-4000-8000-000000000002'},{profile:p,location:shared}));
 assert.equal(operationCopyFromMeta({...meta('example'),date:p.date},{profile:p,location:shared}),p);
});
const entity=(id,extra={})=>({id,synthetic:false,operationOrigin:origin,writeEligible:true,...extra});
const products=()=>bootstrap().products.map((p,i)=>entity(p.id,{stockCode:p.stockCode,name:'Ürün '+p.id,barcode:p.barcodes[0],unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:'5.000',revision,prices:[{quoteId:p.priceIds[0],currency:'TRY',unitPriceExact8:'10.00000000',revision,source:{kind:'isolated-test-copy',copyId,sealHash}}],purchasePriceExact8:'8.00000000'}));
const customer=()=>entity('501',{code:'C-501',name:'Müşteri',currency:'TRY',balanceExact4:'0.0000',revision});
const supplier=()=>entity('601',{code:'S-601',name:'Tedarikçi',currency:'TRY',balanceExact4:'0.0000'});
const account=()=>entity('701',{code:'A-701',name:'Kasa',currency:'TRY',type:'cash',balanceExact4:'100.0000',openingBalanceExact4:'100.0000',openingVerified:false,openingOrigin:'UNKNOWN',startingBalanceVerified:true,startingBalanceExact4:'100.0000'});
async function onCopy(run){const previous=globalThis.window;globalThis.window={location,__MELISA_OPERATION_COPY__:bootstrap()};try{return await run();}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}}
function trade(){return {meta:meta('melisa-work-trade.v1'),revision,capabilities:Object.fromEntries(['canCreate','canFinalize','canCancel','canCollect','canCancelCollection'].map(k=>[k,true])),scope:{synthetic:false,operationOrigin:origin,customer:customer(),products:products(),accounts:[account()]},supportedCurrencies:['TRY'],limits:{maxItems:20,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000'}};}
const inboundCaps=()=>Object.fromEntries(['canCount','canSubmit','canApprove','canReject','canViewPurchase','canViewSupplier','canCreatePurchase','canFinalizePurchase','canCancelPurchase'].map(k=>[k,true]));

test('server bootstrap binds exact isolated target, origin, date and known identities; original port never enables it',()=>{
 const p=bootstrap();assert.equal(validateOperationCopyBootstrap(p,location),p);
 assert.equal(operationCopyFromMeta(meta('example'),{profile:p,location}),p);
 for(const mutate of [x=>x.target.database=x.sourceDatabase,x=>x.target.server='OTHER',x=>x.copyId='bad',x=>x.sealHash='bad',x=>x.backupSHA='bad',x=>x.operationOrigin='OTHER',x=>x.date='2026-10-09',x=>x.products[0].unitFactorExact8='0.00000000',x=>x.products.push(x.products[0]),x=>x.suppliers[0].currency='USD',x=>x.actors[0].id='14']){const invalid=structuredClone(p);mutate(invalid);assert.throws(()=>validateOperationCopyBootstrap(invalid,location));}
 for(const changed of [{...location,port:'5194'},{...location,hostname:'192.168.1.46'},{...location,protocol:'https:'}])assert.throws(()=>validateOperationCopyBootstrap(p,changed));
 assert.throws(()=>operationCopyFromMeta({source:'native-test'},{profile:p,location}));
 assert.throws(()=>operationCopyFromMeta({...meta('example'),sealHash:'d'.repeat(64)},{profile:p,location}));
 assert.throws(()=>operationCopyFromMeta({...meta('example'),testProfile:{}},{profile:p,location}));
 assert.equal(operationCopyFromMeta({source:'native-test'},{location:{...location,port:'5194'}}),null);
});

test('real copied card and price bindings reject foreign IDs, synthetic relabeling and wrong price evidence',()=>{
 const p=bootstrap(),product=products()[0],quote=product.prices[0];assert.equal(operationCopyEntity(product,'products',p),product);assert.equal(operationCopyQuote(quote,product.id,p),quote);
 for(const patch of [{id:'999'},{synthetic:true},{operationOrigin:'OTHER'},{stockCode:'K-OTHER'},{barcode:'000999'},{unit:{label:'ADET',factorExact8:'2.00000000'}}])assert.throws(()=>operationCopyEntity({...product,...patch},'products',p));
 for(const patch of [{quoteId:'999'},{currency:'USD'},{source:{...quote.source,copyId:'OTHER'}},{source:{...quote.source,sealHash:'d'.repeat(64)}},{source:{...quote.source,kind:'synthetic-test'}}])assert.throws(()=>operationCopyQuote({...quote,...patch},product.id,p));
});

test('normal sales and collection scope accepts verified copied native cards without mutating DTO or accepting foreign accounts',async()=>onCopy(()=>{
 const c=trade(),before=JSON.stringify(c);assert.equal(tradeContext(c),c);assert.equal(JSON.stringify(c),before);
 for(const mutate of [x=>x.scope.synthetic=true,x=>x.scope.customer.id='999',x=>x.scope.products[0].synthetic=true,x=>x.scope.accounts[0].id='999',x=>x.scope.products[0].prices[0].quoteId='999',x=>x.meta.copyId='00000000-0000-4000-8000-000000000002']){const invalid=structuredClone(c);mutate(invalid);assert.throws(()=>tradeContext(invalid));}
}));

test('receiving, purchase and supplier contexts keep native-copy origin separate from historical synthetic scope',async()=>onCopy(()=>{
 const ps=products().map(p=>{const {prices,purchasePriceExact8,revision,...received}=p;return received;}),s=supplier();delete s.balanceExact4;
 const receiving={meta:meta('melisa-work-inbound.v1'),capabilities:inboundCaps(),scope:{synthetic:false,operationOrigin:origin,supplier:s,warehouse:{id:'11',label:'Depo'},products:ps},countDrafts:[],receipts:[]};
 assert.equal(receivingContext(receiving),receiving);
 const purchase={meta:meta('melisa-work-inbound.v1'),capabilities:inboundCaps(),scope:{synthetic:false,operationOrigin:origin,supplier:supplier(),products:products()},receipts:[],drafts:[]};assert.equal(purchaseContext(purchase),purchase);
 const context={meta:meta('melisa-work-inbound.v1'),supplier:supplier(),movements:[]};assert.equal(supplierContext(context),context);
 for(const mutate of [x=>x.scope.supplier.id='999',x=>x.scope.products[0].operationOrigin='OTHER',x=>x.meta.sealHash='d'.repeat(64)]){const invalid=structuredClone(receiving);mutate(invalid);assert.throws(()=>receivingContext(invalid));}
}));

test('copied supplier payment scope accepts only selected real native entities and exact copy receipt type',async()=>onCopy(()=>{
 const c={meta:meta('melisa-work-supplier-payment.v1'),revision,capabilities:{canView:true,canPay:true,canCancel:true},suppliers:[{...supplier(),debtKind:'invoice',invoices:[]}],accounts:[account()],rates:[],payments:[],limits:{maxAmountExact4:'500.0000',maxPayments:30}};
 assert.equal(paymentContext(c),c);
 c.suppliers[0].invoices=[{id:'901',receiptId:'902',receiptKind:'work-stage4-copy-batch-receipt',number:'TSTB-COPY-FIXTURE',status:'finalized',documentDate:c.meta.date,documentCurrency:'TRY',accountCurrency:'TRY',documentAmountExact4:'1.0000',accountAmountExact4:'1.0000',paidExact4:'1.0000',returnedExact4:'0.0000',remainingExact4:'0.0000'}];
 c.payments=[{id:'903',supplierId:'601',accountId:'701',invoiceId:'901',receiptId:'902',receiptKind:'work-stage4-copy-batch-receipt',invoiceNumber:'TSTB-COPY-FIXTURE',ownership:'work',canCancel:true,kind:'payment',direction:'out',currency:'TRY',accountCurrency:'TRY',amountExact4:'1.0000',accountAmountExact4:'1.0000',amountTryExact4:'1.0000',documentRateExact8:'1.00000000',accountRateExact8:'1.00000000',documentDate:c.meta.date,description:'Fixture',number:'OD-FIXTURE',originalId:null,reversedById:null}];
 assert.equal(paymentContext(c),c);
 for(const mutate of [x=>x.payments[0].receiptKind='work-goal8-batch-receipt',x=>x.payments[0].receiptKind='UNKNOWN',x=>x.payments[0].supplierId='999',x=>x.payments[0].accountId='999']){const invalid=structuredClone(c);mutate(invalid);assert.throws(()=>paymentContext(invalid));}
 for(const mutate of [x=>x.suppliers[0].synthetic=true,x=>x.accounts[0].id='999',x=>x.meta.sealHash='d'.repeat(64),x=>x.meta.testProfile={}]){const invalid=structuredClone(c);mutate(invalid);assert.throws(()=>paymentContext(invalid));}
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 const original=createPaymentJournal({storage,actorId:'16',apiBase:'http://127.0.0.1:4144'}),copy=createPaymentJournal({storage,actorId:'16',apiBase:'http://127.0.0.1:4154'});copy.backup({amount:'1'});assert.equal(original.read().draft,null);assert.equal(copy.read().draft.amount,'1');
 assert.throws(()=>createPaymentJournal({storage,actorId:'16',apiBase:'http://192.168.1.46:4154'}));
}));

test('copy snapshot starting balance remains verified while historical cash opening stays explicitly unknown',async()=>onCopy(()=>{
 const c={meta:meta('melisa-work-supplier-payment.v1'),revision,capabilities:{canView:true,canPay:true,canCancel:true},suppliers:[{...supplier(),debtKind:'opening',invoices:[]}],accounts:[account()],rates:[],payments:[],limits:{maxAmountExact4:'500.0000',maxPayments:30}};
 const before=JSON.stringify(c);assert.equal(paymentContext(c),c);assert.equal(JSON.stringify(c),before);
 assert.equal(c.accounts[0].openingVerified,false);assert.equal(c.accounts[0].openingOrigin,'UNKNOWN');assert.equal(c.accounts[0].startingBalanceVerified,true);
 const nullRecordedOpening=structuredClone(c);nullRecordedOpening.accounts[0].openingBalanceExact4=null;assert.equal(paymentContext(nullRecordedOpening),nullRecordedOpening);
 for(const mutate of [x=>x.accounts[0].openingVerified=true,x=>x.accounts[0].openingOrigin='VERIFIED_SOURCE',x=>delete x.accounts[0].startingBalanceVerified,x=>x.accounts[0].startingBalanceVerified=false,x=>delete x.accounts[0].startingBalanceExact4,x=>x.accounts[0].startingBalanceExact4='unknown']){const invalid=structuredClone(c);mutate(invalid);assert.throws(()=>paymentContext(invalid));}
}));
