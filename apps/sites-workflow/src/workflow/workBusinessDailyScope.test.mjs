import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOperationCopyBootstrap,operationCopyDailySelection} from './isolatedOperationCopyModel.mjs';
import {tradeContext} from './workTradeModel.mjs';
import {paymentContext,paymentSelection,createPaymentJournal} from './workSupplierPaymentsModel.mjs';
import {dailyCopyContext,dailyCopyCountLines} from './workDailyCopyModel.mjs';
const rev='b'.repeat(64),seal='A'.repeat(64),dailyHash='C'.repeat(64),origin='ISOLATED_TEST_COPY',copyId='00000000-0000-4000-8000-000000000001';
const location={protocol:'http:',hostname:'127.0.0.1',port:'5234'};
const scopeEntity=(p,extra={})=>({...p,synthetic:false,operationOrigin:origin,writeEligible:true,...extra});
function profile(){return{schemaVersion:'melisa-stage4-isolated-operation-copy.v1',scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'D'.repeat(64),businessInvoiceMaxExact4:'20000.0000',operationOrigin:origin,copyId,sealHash:seal,backupSHA:'E'.repeat(64),sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},date:'2026-10-09',actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:['301','302','303'].map((id,i)=>({id,supplierId:'601',sourceKey:'VEGA2026/F0102TBLSTOKLAR/'+id,stockCode:'CODE-'+id,unit:'ADET',unitFactorExact8:'1.00000000',priceIds:[String(801+i)],barcodes:['000'+id]})),customers:[{id:'501',partyId:'901',accountId:'1001',currency:'TRY',sourceKey:'VEGA2026/F0102TBLCARI/501'}],suppliers:[{id:'601',partyId:'902',accountId:'1002',currency:'TRY',sourceKey:'VEGA2026/F0103TBLCARI/601'}],financeAccounts:[{id:'701',currency:'TRY'}],businessDaily:{scopeHash:dailyHash,selection:{currency:'TRY',productIds:['301'],customerAccountId:'1001',supplierAccountId:'1002',financeAccountId:'701'}}};}
const meta=schemaVersion=>({schemaVersion,source:'native-test',timeZone:'Europe/Istanbul',date:'2026-10-09',operationOrigin:origin,copyId,sealHash:seal,businessDailyScopeHash:dailyHash});
function trade(p){const source=p.products[0];return{meta:meta('melisa-work-trade.v1'),revision:rev,capabilities:{canCreate:true,canFinalize:true,canCancel:true,canCollect:true,canCancelCollection:true},scope:{synthetic:false,operationOrigin:origin,customer:scopeEntity(p.customers[0],{code:'C-501',name:'Synthetic customer',balanceExact4:'0.0000',revision:rev}),products:[scopeEntity(source,{name:'Synthetic product',barcode:source.barcodes[0],unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:'5.000',revision:rev,prices:[{quoteId:source.priceIds[0],currency:'TRY',unitPriceExact8:'10.00000000',revision:rev,source:{kind:'isolated-test-copy',copyId,sealHash:seal}}]})],accounts:[scopeEntity(p.financeAccounts[0],{code:'A-701',name:'Synthetic account',type:'cash',balanceExact4:'100.0000'})]},supportedCurrencies:['TRY'],limits:{maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000'}};}
function payments(p){return{meta:meta('melisa-work-supplier-payment.v1'),revision:rev,capabilities:{canView:true,canPay:true,canCancel:true},suppliers:[scopeEntity(p.suppliers[0],{code:'S-601',name:'Synthetic supplier',balanceExact4:'0.0000',debtKind:'unverified-opening',invoices:[]})],accounts:[scopeEntity(p.financeAccounts[0],{code:'A-701',name:'Synthetic account',type:'cash',balanceExact4:'100.0000',openingBalanceExact4:null,openingVerified:false,openingOrigin:'UNKNOWN',startingBalanceVerified:true,startingBalanceExact4:'100.0000'})],rates:[],payments:[],limits:{maxAmountExact4:'500.0000',maxPayments:30}};}
async function onBusiness(fn){const previous=globalThis.window,p=profile();globalThis.window={location,__MELISA_OPERATION_COPY__:p};try{return await fn(p);}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}}
test('registered finite bootstrap accepts one selected product without treating all business products as daily scope',()=>{
 const p=profile();assert.equal(validateOperationCopyBootstrap(p,location),p);assert.equal(operationCopyDailySelection(p,meta('example')),p.businessDaily.selection);
 for(const edit of [p=>p.businessDaily.scopeHash='invalid',p=>p.businessDaily.selection.productIds=['999'],p=>p.businessDaily.selection.productIds=['301','301'],p=>p.businessDaily.selection.customerAccountId='1002',p=>p.businessDaily.selection.supplierAccountId='1001',p=>p.businessDaily.selection.financeAccountId='999',p=>p.businessDaily.selection.currency='USD']){const bad=structuredClone(p);edit(bad);assert.throws(()=>validateOperationCopyBootstrap(bad,location));}
 assert.throws(()=>operationCopyDailySelection(p,{...meta('example'),businessDailyScopeHash:'F'.repeat(64)}));
});
test('normal sales reader accepts exact one-product daily context and rejects broader membership, changed accounts, missing seal',async()=>onBusiness(p=>{
 const c=trade(p),before=JSON.stringify(c);assert.equal(tradeContext(c),c);assert.equal(JSON.stringify(c),before);
 for(const edit of [c=>c.scope.products[0].id='302',c=>c.scope.products.push(c.scope.products[0]),c=>c.scope.customer.accountId='1002',c=>c.scope.customer.partyId='902',c=>c.scope.accounts[0].id='999',c=>c.scope.customer.sourceKey='VEGA2026/F0102TBLCARI/999',c=>delete c.meta.businessDailyScopeHash,c=>c.meta.businessDailyScopeHash='F'.repeat(64)]){const bad=structuredClone(c);edit(bad);assert.throws(()=>tradeContext(bad));}
}));
test('unknown cash opening is read-only metadata, supplier opening cannot authorize a daily payment',async()=>onBusiness(p=>{
 const c=payments(p);assert.equal(paymentContext(c),c);assert.equal(c.accounts[0].openingVerified,false);
 assert.throws(()=>paymentSelection({supplierId:'601',invoiceId:null,accountId:'701',currency:'TRY',amountExact4:'1.0000',documentDate:c.meta.date,description:'Synthetic request'},c));
 const i={id:'801',receiptId:'802',receiptKind:'work-stage4-copy-batch-receipt',number:'Synthetic invoice',status:'finalized',documentDate:c.meta.date,documentCurrency:'TRY',accountCurrency:'TRY',documentAmountExact4:'10.0000',accountAmountExact4:'10.0000',paidExact4:'0.0000',returnedExact4:'0.0000',remainingExact4:'10.0000'};
 c.suppliers[0].invoices=[i];c.suppliers[0].debtKind='mixed';c.suppliers[0].balanceExact4='10.0000';assert.equal(paymentContext(c),c);
 const s={supplierId:'601',invoiceId:'801',accountId:'701',currency:'TRY',amountExact4:'1.0000',documentDate:c.meta.date,description:'Synthetic request'};assert.equal(paymentSelection(s,c),s);assert.throws(()=>paymentSelection({...s,invoiceId:null},c));
 for(const edit of [c=>c.suppliers[0].accountId='1001',c=>c.accounts[0].id='999',c=>c.accounts[0].openingVerified=true,c=>c.suppliers[0].debtKind='unverified-opening',c=>delete c.meta.businessDailyScopeHash]){const bad=structuredClone(c);edit(bad);assert.throws(()=>paymentContext(bad));}
}));
test('DB02 payment journal uses only paired host/API with validated finite bootstrap and retains pending UUID/body',async()=>onBusiness(p=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},j=createPaymentJournal({storage,actorId:'16',apiBase:'http://127.0.0.1:4184',makeUuid:()=>copyId});
 const sent=j.begin('/api/work-supplier-payments/payments',{supplierId:'601'});assert.equal(j.read().request.body.requestId,copyId);assert.deepEqual(j.read().request,sent);
 assert.throws(()=>createPaymentJournal({storage,actorId:'16',apiBase:'http://192.168.1.46:4184'}));
 delete p.businessDaily;assert.throws(()=>createPaymentJournal({storage,actorId:'16',apiBase:'http://127.0.0.1:4184'}));
}));
test('count public projection can omit daily hash but must match bootstrap-selected product and exact live fingerprint',async()=>onBusiness(p=>{
 const m=meta('example');delete m.businessDailyScopeHash;
 const data={meta:m,operationOrigin:origin,scope:{flow:'count',product_id:301,stock_code:'CODE-301'},countProducts:[{id:'301',stockCode:'CODE-301',unit:'ADET',stockQuantity:5,movementFingerprint:rev,barcode:'000301'}]};
 assert.equal(dailyCopyContext(data,'count'),p);const lines=[{productId:'301',stockCode:'CODE-301',physical:6,system:5,reason:'Synthetic count',movementFingerprint:rev}];assert.equal(dailyCopyCountLines(lines,data,p),lines);
 assert.throws(()=>dailyCopyCountLines([{...lines[0],productId:'302'}],data,p));assert.throws(()=>dailyCopyContext({...data,countProducts:[...data.countProducts,{...data.countProducts[0],id:'302',stockCode:'CODE-302'}]},'count'));
}));
