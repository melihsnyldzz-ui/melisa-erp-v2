import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {receivingContext,countLines,countDraft,purchaseSelection,purchasePreview,purchaseInvoice,purchaseInvoiceRead,purchaseContext,supplierContext,inboundError} from './workInboundModel.mjs';
import {recordedPurchaseBasisHtml,historicalPurchaseRateUnknown} from './workPurchasePresentation.mjs';
import {createInboundJournal} from './workInboundJournal.mjs';
import {countInput,countDto} from '../../../api/src/services/workInboundModel.mjs';
import {supplierPaymentContext as nativePaymentContext} from '../../../api/src/services/workSupplierPaymentModel.mjs';
import {rawPaymentFixture,paymentActor} from '../../../api/src/services/workSupplierPaymentFixture.mjs';
import {paymentContext as clientPaymentContext} from './workSupplierPaymentsModel.mjs';
const revision='a'.repeat(64),requestId='00000000-0000-4000-8000-000000000001';
const caps=()=>Object.fromEntries(['canCount','canSubmit','canApprove','canReject','canViewPurchase','canViewSupplier','canCreatePurchase','canFinalizePurchase','canCancelPurchase','canView'].map(k=>[k,true]));
const context=()=>({meta:{schemaVersion:'melisa-work-inbound.v1',source:'native-test',timeZone:'Europe/Istanbul'},capabilities:caps(),scope:{synthetic:true,supplier:{id:'13370',code:'SUPPLIER',name:'Tedarikçi'},warehouse:{id:'1',label:'Depo'},products:['301985','325503'].map((id,i)=>({id,stockCode:'FULL '+id,name:'Ürün '+i,barcode:null,unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:i?'0.000':null,writeEligible:true}))},countDrafts:[],receipts:[]});
const line=(productId='301985')=>({clientLineId:'line-1',productId,barcode:productId===null?'0000099':null,stockCode:null,physicalQuantityExact3:'2.000',expectedQuantityExact3:null,issue:'short',note:''});
const receipt=()=>({id:'7',supplierId:'13370',warehouseId:'1',state:'accepted',note:'',lines:context().scope.products.map((p,i)=>({id:String(i+1),clientLineId:'line-'+(i+1),productId:p.id,stockCode:p.stockCode,name:p.name,quantityExact3:'2.000',unit:p.unit,receivedQuantityExact3:'2.000',invoiceableQuantityExact3:'2.000'}))});
const purchases=()=>({...context(),scope:{synthetic:true,supplier:{...context().scope.supplier,currency:'TRY',balanceExact4:'0.0000'},products:context().scope.products.map((p,i)=>({id:p.id,stockCode:p.stockCode,name:p.name,purchasePriceExact8:(i?'80':'60')+'.00000000'}))},receipts:[receipt()],drafts:[]});
const selection=()=>({receiptId:'7',number:'TSTB-ONE',documentDate:'2026-10-06',currency:'TRY',lines:[{receiptLineId:'1',quantityExact3:'2.000'},{receiptLineId:'2',quantityExact3:'1.000'}]});
const invoice=()=>({id:'8',receiptId:'7',status:'draft',number:'TSTB-ONE',documentDate:'2026-10-06',currency:'TRY',items:receipt().lines.map((l,i)=>({id:l.id,receiptLineId:l.id,productId:l.productId,stockCode:l.stockCode,name:l.name,quantityExact3:i?'1.000':'2.000',purchasePriceExact8:(i?'80':'60')+'.00000000',lineTotalExact4:(i?'80':'120')+'.0000'})),totals:{subtotalExact4:'200.0000',grandTotalExact4:'200.0000'}});
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('one-product receiving and purchase scope requires the exact clean environment and native identity',()=>{
 const c=context();c.meta={...c.meta,environment:'CLEAN_SYNTHETIC_TEST',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67'};
 c.scope.supplier={id:'1',code:'ORNEK-T01',name:'Örnek Tedarikçi'};
 c.scope.products=[{...c.scope.products[0],id:'1',stockCode:'0007 MELISA',barcode:'0000000000007'}];
 assert.equal(receivingContext(c),c);
 const p={...structuredClone(c),scope:{...c.scope,supplier:{...c.scope.supplier,currency:'TRY',balanceExact4:'0.0000'},products:[{id:'1',stockCode:'0007 MELISA',name:'Ürün',purchasePriceExact8:'60.00000000'}]},drafts:[]};
 assert.equal(purchaseContext(p),p);
 for(const change of [x=>delete x.meta.environment,x=>x.meta.environmentId='foreign',x=>x.scope.products[0].id='2',x=>x.scope.supplier.code='foreign']){const bad=structuredClone(c);change(bad);assert.throws(()=>receivingContext(bad));}
});

for(const found of [true,false])test(`pending accepted approval recovers by GET only; journal found=${found}`,async()=>{
 const previous=globalThis.window,{profile,receiving:c}=historicalPurchaseFixture();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:profile};
 try{
  const store=storage(),d=dom(),calls=[],key='melisa-work-inbound-count:local:16:13370:USD';
  const journal=createInboundJournal({storage:store,key,makeUuid:()=>requestId}),pending=journal.begin('/api/work-receiving/receipts/7/approve',{}),before=store.getItem(key);
  const raw={id:7,state:'accepted',supplierId:13370,currency:'USD',warehouseId:1,replayed:false,lines:c.receipts[0].lines.map(l=>({id:Number(l.id),productId:Number(l.productId),clientLineId:l.clientLineId,stockCode:l.stockCode,unit:'ADET',quantity:2,receivedQuantity:2}))};
  const selection={get:()=>({...profile.suppliers[0]}),members:profile.suppliers,eligible:()=>true,journalSuffix:()=>':13370:USD'};
  const {createWorkReceiving}=await controller('workReceiving'),ui=createWorkReceiving({root:d.root,storage:store,user:{id:16},session:{businessSupplierSelection:()=>selection,media:async()=>{},inbound:async(path,options)=>{assert.equal(options,undefined);calls.push(path);if(path==='/api/work-receiving/context')return structuredClone(c);if(path==='/api/work-receiving/requests/'+requestId){if(!found)throw Object.assign(Error('not yet found'),{status:404});return {requestId,operation:'goods_accept',response:raw};}throw Error(path);}}});
  ui.mount();await tick();await tick();
  assert.deepEqual(calls,['/api/work-receiving/context','/api/work-receiving/requests/'+requestId]);
  if(found){assert.equal(journal.read().request.status,'done');assert.equal(journal.read().request.result.recoveredReadOnly,true);assert.equal(journal.read().request.body.requestId,pending.body.requestId);assert.match(d.root.innerHTML,/Önceki kabul sonucu kayıttan doğrulandı/);assert.doesNotMatch(d.root.innerHTML,/Son kaydın sonucu henüz doğrulanmadı/);}
  else{assert.equal(store.getItem(key),before);await d.node('[data-count-retry]').onclick();assert.equal(calls.at(-1),'/api/work-receiving/requests/'+requestId);assert.equal(store.getItem(key),before);assert.equal(journal.read().request.status,'pending');assert.match(d.root.innerHTML,/Son kaydın sonucu henüz doğrulanmadı/);}
  ui.dispose();
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
const copyProfile=()=>({schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:'ISOLATED_TEST_COPY',copyId:requestId,sealHash:revision,backupSHA:'b'.repeat(64),sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_STAGE04_COPY_TEST_20261008_01'},date:'2026-10-08',actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:context().scope.products.map(p=>({id:p.id,stockCode:p.stockCode,sourceKey:['VEGA2026','F0102TBLSTOKLAR',''].join('/')+p.id,unit:'ADET',unitFactorExact8:'1.00000000',priceIds:[p.id],barcodes:[]})),customers:[{id:'501',partyId:'21',accountId:'22',currency:'TRY',sourceKey:['VEGA2026','F0102TBLCARI','23'].join('/')}],suppliers:[{id:'13370',partyId:'31',accountId:'32',currency:'TRY',sourceKey:['VEGA2026','F0103TBLCARI','33'].join('/')}],financeAccounts:[{id:'701',currency:'TRY'}]});

function historicalPurchaseFixture({priceChanged=true,dateChanged=true}={}){
 const profile={...copyProfile(),scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'c'.repeat(64),businessInvoiceMaxExact4:'20000.0000',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},date:'2026-10-09',currencyRates:[{currency:'TRY',rateExact8:'1.00000000',id:null,date:'2026-10-09',source:'IDENTITY_TRY'},{currency:'USD',rateExact8:'47.81234567',id:'9',date:'2026-09-12',source:'stored-source'}]};
 profile.products=profile.products.map(p=>({...p,supplierId:'13370'}));profile.suppliers=[{...profile.suppliers[0],currency:'USD',code:'SUPPLIER',name:'Tedarikçi'}];
 const origin={synthetic:false,operationOrigin:profile.operationOrigin},meta={...context().meta,date:profile.date,operationOrigin:profile.operationOrigin,copyId:profile.copyId,sealHash:profile.sealHash,scopeKind:profile.scopeKind};
 const i={...invoice(),status:'finalized',currency:'USD',documentDate:dateChanged?'2026-10-06':profile.date};
 i.recordedInvoiceBasis={source:'stored-native-invoice',invoiceId:i.id,supplierId:'13370',receiptId:i.receiptId,documentCurrency:'USD',accountCurrency:'USD',documentExchangeRateExact8:'47.80000000',accountExchangeRateExact8:'47.80000000',accountAmountExact4:'200.0000',amountTryExact4:'9560.0000'};
 const r=receipt();r.lines.forEach(l=>{l.invoiceableQuantityExact3='0.000';});
 const supplier={...profile.suppliers[0],...origin,balanceExact4:'200.0000'},products=context().scope.products.map((p,n)=>({...p,...origin,purchasePriceExact8:(priceChanged?n?'100':'90':n?'80':'60')+'.00000000'}));
 const c={meta,capabilities:{...caps(),canCancelPurchase:false},scope:{...origin,supplier,products},receipts:[r],drafts:[i]};
 const receiving={meta,capabilities:c.capabilities,scope:{...origin,supplier:{...profile.suppliers[0],...origin},warehouse:context().scope.warehouse,products:products.map(({purchasePriceExact8,...p})=>p)},receipts:[r],countDrafts:[]};
 return {profile,c,receiving,i};
}

for(const mode of ['lost-ack','different-warehouse','different-account','revoked','missing-scope'])test('approval retry refreshes committed context without POST: '+mode,async()=>{
 const previous=globalThis.window,{profile,receiving:c}=historicalPurchaseFixture();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:profile};
 try{
  const store=storage(),d=dom(),calls=[],key='melisa-work-inbound-count:local:16:13370:USD',journal=createInboundJournal({storage:store,key,makeUuid:()=>requestId});journal.begin('/api/work-receiving/receipts/7/approve',{});const before=store.getItem(key);
  const accepted=structuredClone(c);c.receipts[0].state='pending';c.receipts[0].lines.forEach(l=>l.receivedQuantityExact3='0.000');
  if(mode==='different-warehouse')accepted.scope.warehouse.id='2';if(mode==='different-account')accepted.scope.supplier.accountId='999';if(mode==='revoked')accepted.capabilities.canApprove=false;if(mode==='missing-scope'){delete c.meta.scopeKind;delete accepted.meta.scopeKind;}
  const raw={id:7,state:'accepted',supplierId:13370,currency:'USD',warehouseId:1,replayed:false,lines:accepted.receipts[0].lines.map(l=>({id:Number(l.id),productId:Number(l.productId),clientLineId:l.clientLineId,stockCode:l.stockCode,unit:'ADET',quantity:2,receivedQuantity:2}))};let contexts=0;
  const selection={get:()=>({...profile.suppliers[0]}),members:profile.suppliers,eligible:()=>true,journalSuffix:()=>':13370:USD'};
  const {createWorkReceiving}=await controller('workReceiving'),ui=createWorkReceiving({root:d.root,storage:store,user:{id:16},session:{businessSupplierSelection:()=>selection,media:async()=>{},inbound:async(path,options)=>{assert.equal(options,undefined);calls.push(path);if(path==='/api/work-receiving/context')return structuredClone(++contexts===1?c:accepted);if(path==='/api/work-receiving/requests/'+requestId)return {requestId,operation:'goods_accept',response:raw};throw Error('Unexpected mutation');}}});
  ui.mount();await tick();await tick();assert.equal(store.getItem(key),before);await d.node('[data-count-retry]').onclick();await tick();
  if(mode==='lost-ack'){assert.equal(journal.read().request.status,'done');assert.equal(journal.read().request.result.recoveredReadOnly,true);assert.equal(ui.requestClose(),true);assert.deepEqual(calls,['/api/work-receiving/context','/api/work-receiving/requests/'+requestId,'/api/work-receiving/context','/api/work-receiving/requests/'+requestId]);}
  else{assert.equal(store.getItem(key),before);assert.equal(ui.requestClose(),false);}
  assert(calls.every(p=>p==='/api/work-receiving/context'||p==='/api/work-receiving/requests/'+requestId));ui.dispose();
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

for(const mode of ['revoked','different-body','storage-failure','disposed'])test('approval read recovery preserves the pending request: '+mode,async()=>{
 const previous=globalThis.window,{profile,receiving:c}=historicalPurchaseFixture();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:profile};
 try{
  const store=storage(),d=dom(),calls=[],key='melisa-work-inbound-count:local:16:13370:USD',journal=createInboundJournal({storage:store,key,makeUuid:()=>requestId});
  journal.begin('/api/work-receiving/receipts/7/approve',mode==='different-body'?{reason:'different body'}:{});const before=store.getItem(key);
  if(mode==='revoked')c.capabilities.canApprove=false;
  if(mode==='storage-failure')store.setItem=()=>{throw Error('storage denied');};
  const raw={id:7,state:'accepted',supplierId:13370,currency:'USD',warehouseId:1,replayed:false,lines:c.receipts[0].lines.map(l=>({id:Number(l.id),productId:Number(l.productId),clientLineId:l.clientLineId,stockCode:l.stockCode,unit:'ADET',quantity:2,receivedQuantity:2}))};
  let finish;const selection={get:()=>({...profile.suppliers[0]}),members:profile.suppliers,eligible:()=>true,journalSuffix:()=>':13370:USD'};
  const {createWorkReceiving}=await controller('workReceiving'),ui=createWorkReceiving({root:d.root,storage:store,user:{id:16},session:{businessSupplierSelection:()=>selection,media:async()=>{},inbound:async(path,options)=>{assert.equal(options,undefined);calls.push(path);if(path==='/api/work-receiving/context')return structuredClone(c);if(path==='/api/work-receiving/requests/'+requestId){if(mode==='disposed')return new Promise(resolve=>{finish=resolve;});return {requestId,operation:'goods_accept',response:raw};}throw Error(path);}}});
  ui.mount();await tick();await tick();
  if(mode==='disposed'){ui.dispose();finish({requestId,operation:'goods_accept',response:raw});await tick();}
  else{await d.node('[data-count-retry]').onclick();await tick();ui.dispose();}
  assert.equal(store.getItem(key),before);assert.equal(journal.read().request.status,'pending');assert(calls.every(path=>path==='/api/work-receiving/context'||path==='/api/work-receiving/requests/'+requestId));
  if(mode==='revoked'||mode==='different-body')assert.deepEqual(calls,['/api/work-receiving/context']);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

for(const change of [{priceChanged:true,dateChanged:false},{priceChanged:false,dateChanged:true},{priceChanged:true,dateChanged:true}])test(`historical finalized purchase reopens with its stored price and rate after price=${change.priceChanged} date=${change.dateChanged} drift`,async()=>{
 const previous=globalThis.window,{profile,c,receiving,i}=historicalPurchaseFixture(change);globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:profile};
 try{
  const {createWorkPurchases}=await controller('workPurchases'),d=dom(),store=storage(),calls=[],selection={get:()=>({...profile.suppliers[0]}),members:profile.suppliers,eligible:()=>true,journalSuffix:()=>':13370:USD'};
  const ui=createWorkPurchases({root:d.root,session:{businessSupplierSelection:()=>selection,inbound:async(path,options)=>{calls.push({path,options});if(path==='/api/work-receiving/context')return structuredClone(receiving);if(path==='/api/work-purchases/context')return structuredClone(c);if(path==='/api/work-purchases/drafts/8')return structuredClone(i);throw Error(path);}},user:{id:16},storage:store});
  ui.mount();await tick();assert.match(d.root.innerHTML,/TSTB-ONE/);d.root.querySelectorAll('[data-purchase-open]')[0].onclick();await tick();
  assert.match(d.root.innerHTML,/Faturaya kayıtlı alış fiyatı: 60,00 USD/);assert.match(d.root.innerHTML,/Faturaya kayıtlı kur: 1 USD = 47,8 TRY/);assert.match(d.root.innerHTML,/Kayıtlı TRY karşılığı: 9\.560,00 TRY/);assert.match(d.root.innerHTML,new RegExp(i.documentDate));assert.doesNotMatch(d.root.innerHTML,/data-purchase-source-rate|47,81234567/);
  const journal=JSON.stringify([...store.values]);d.node('[data-purchase-reread]').onclick();await tick();await ui.refresh();assert.match(d.root.innerHTML,/Faturaya kayıtlı alış fiyatı: 60,00 USD/);assert.equal(JSON.stringify([...store.values]),journal);assert.ok(calls.every(call=>call.options?.method!=='POST'));ui.dispose();
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('historical GET keeps its own prices and native rates while default invoice, selection and preview remain strict',()=>{
 const previous=globalThis.window,{profile,c,i}=historicalPurchaseFixture();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:profile};
 try{
  const before=JSON.stringify({profile,c,i});assert.equal(purchaseInvoiceRead(i,c),i);assert.equal(purchaseContext(c,{readOnly:true}),c);assert.equal(JSON.stringify({profile,c,i}),before);
  assert.throws(()=>purchaseInvoice(i,c));assert.throws(()=>purchaseContext(c));
  const draft={...structuredClone(i),status:'draft'};assert.throws(()=>purchaseInvoiceRead(draft,c));assert.throws(()=>purchaseInvoice(draft,c));
  const s={...selection(),currency:'USD'};assert.throws(()=>purchaseSelection(s,c));
  const current={...s,documentDate:profile.date},available=structuredClone(c);available.receipts[0].lines.forEach(l=>l.invoiceableQuantityExact3='2.000');
  const p={selection:current,currency:'USD',items:i.items.map(({receiptLineId,productId,quantityExact3,purchasePriceExact8,lineTotalExact4})=>({receiptLineId,productId,quantityExact3,purchasePriceExact8,lineTotalExact4})),totals:i.totals};assert.throws(()=>purchasePreview(p,current,available));
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('same-date same-price finalized GET verifies its recorded invoice and receipt identities',()=>{
 const previous=globalThis.window;
 try{
  for(const [name,change] of [
   ['invoice basis',f=>{f.i.recordedInvoiceBasis.invoiceId='9';}],
   ['receipt link',f=>{f.i.receiptId='9';}]
  ]){
   const f=historicalPurchaseFixture({priceChanged:false,dateChanged:false});
   globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:f.profile};
   assert.equal(purchaseInvoiceRead(f.i,f.c),f.i);
   assert.equal(purchaseContext(f.c,{readOnly:true}),f.c);
   change(f);
   assert.throws(()=>purchaseInvoiceRead(f.i,f.c),name);
   assert.throws(()=>purchaseContext(f.c,{readOnly:true}),name);
  }
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('purchase screen refuses same-date same-price GET with a foreign receipt or recorded invoice ID without posting',async()=>{
 const previous=globalThis.window;
 try{
  for(const [name,change] of [
   ['receipt ID',i=>{i.receiptId='9';}],
   ['recorded invoice ID',i=>{i.recordedInvoiceBasis.invoiceId='9';}]
  ]){
   const {profile,c,receiving,i}=historicalPurchaseFixture({priceChanged:false,dateChanged:false}),detail=structuredClone(i),calls=[],store=storage(),d=dom();
   change(detail);
   globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:profile};
   const {createWorkPurchases}=await controller('workPurchases'),selected={get:()=>({...profile.suppliers[0]}),members:profile.suppliers,eligible:()=>true,journalSuffix:()=>':13370:USD'};
   const ui=createWorkPurchases({root:d.root,session:{businessSupplierSelection:()=>selected,inbound:async(path,options)=>{
    calls.push({path,options});
    if(path==='/api/work-receiving/context')return structuredClone(receiving);
    if(path==='/api/work-purchases/context')return structuredClone(c);
    if(path==='/api/work-purchases/drafts/8')return structuredClone(detail);
    throw Error(path);
   }},user:{id:16},storage:store});
   ui.mount();await tick();assert.match(d.root.innerHTML,/data-purchase-open="8"/,name);
   const before=JSON.stringify([...store.values]);d.root.querySelectorAll('[data-purchase-open]')[0].onclick();await tick();
   assert.equal(calls.filter(call=>call.path==='/api/work-purchases/drafts/8').length,1,name);
   assert.doesNotMatch(d.root.innerHTML,/data-purchase-receipt-details|data-purchase-recorded-rate|Faturaya kayÄ±tlÄ± alÄ±ÅŸ fiyatÄ±/,name);
   assert.equal(JSON.stringify([...store.values]),before,name);
   assert.ok(calls.every(call=>call.options?.method!=='POST'),name);
   ui.dispose();
  }
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('same-date same-price legacy finalized GET without a recorded basis remains readable',()=>{
 const previous=globalThis.window,f=historicalPurchaseFixture({priceChanged:false,dateChanged:false});
 globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:f.profile};
 try{
  delete f.i.recordedInvoiceBasis;
  assert.equal(purchaseInvoiceRead(f.i,f.c),f.i);
  assert.equal(purchaseContext(f.c,{readOnly:true}),f.c);
  assert.ok(recordedPurchaseBasisHtml(f.i,f.c).includes(historicalPurchaseRateUnknown));
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('historical GET rejects unproved basis, foreign identities, duplicate links, excessive accepted quantities and changed totals',()=>{
 const previous=globalThis.window;
 const invalid=[
  ['missing basis',f=>delete f.i.recordedInvoiceBasis],['current quote basis',f=>f.i.recordedInvoiceBasis.source='current-context'],
  ['basis invoice',f=>f.i.recordedInvoiceBasis.invoiceId='9'],['basis receipt',f=>f.i.recordedInvoiceBasis.receiptId='9'],['basis supplier',f=>f.i.recordedInvoiceBasis.supplierId='9'],
  ['basis document currency',f=>f.i.recordedInvoiceBasis.documentCurrency='TRY'],['basis account currency',f=>f.i.recordedInvoiceBasis.accountCurrency='TRY'],
  ['basis amount',f=>f.i.recordedInvoiceBasis.accountAmountExact4='201.0000'],['zero rate',f=>f.i.recordedInvoiceBasis.documentExchangeRateExact8='0.00000000'],['short rate',f=>f.i.recordedInvoiceBasis.accountExchangeRateExact8='47.8'],['missing TRY',f=>delete f.i.recordedInvoiceBasis.amountTryExact4],['extra basis',f=>f.i.recordedInvoiceBasis.extra=true],
  ['document currency',f=>f.i.currency='TRY'],['foreign receipt',f=>f.i.receiptId='9'],['foreign product',f=>f.i.items[0].productId='9'],
  ['duplicate item',f=>f.i.items[1].id=f.i.items[0].id],['duplicate receipt line',f=>f.i.items[1].receiptLineId=f.i.items[0].receiptLineId],['duplicate product',f=>f.i.items[1].productId=f.i.items[0].productId],
  ['duplicate receipt',f=>f.c.receipts.push(structuredClone(f.c.receipts[0]))],['duplicate accepted line',f=>f.c.receipts[0].lines.push(structuredClone(f.c.receipts[0].lines[0]))],
  ['pending receipt',f=>f.c.receipts[0].state='pending'],['foreign supplier',f=>f.c.receipts[0].supplierId='9'],['unreceived quantity',f=>f.c.receipts[0].lines[0].receivedQuantityExact3='1.000'],
  ['excessive accepted quantity',f=>{f.i.items[0].quantityExact3='3.000';f.i.items[0].lineTotalExact4='180.0000';f.i.totals={subtotalExact4:'260.0000',grandTotalExact4:'260.0000'};f.i.recordedInvoiceBasis.accountAmountExact4='260.0000';}],
  ['changed price arithmetic',f=>f.i.items[0].purchasePriceExact8='61.00000000'],['changed total',f=>f.i.totals.grandTotalExact4='201.0000'],
  ['code drift',f=>f.i.items[0].stockCode='OTHER'],['name drift',f=>f.i.items[0].name='OTHER'],['future date',f=>f.i.documentDate='2026-10-10'],
  ['cancelled',f=>f.i.status='cancelled'],['draft',f=>f.i.status='draft'],['scope account',f=>f.c.scope.supplier.accountId='9'],['scope party',f=>f.c.scope.supplier.partyId='9'],['scope origin',f=>f.c.scope.supplier.synthetic=true],['scope seal',f=>f.c.meta.sealHash='d'.repeat(64)],['invalid current rate',f=>f.profile.currencyRates[1].rateExact8='0.00000000']
 ];
 try{for(const [name,change]of invalid){const f=historicalPurchaseFixture();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:f.profile};change(f);assert.throws(()=>purchaseInvoiceRead(f.i,f.c),name);assert.throws(()=>purchaseContext(f.c,{readOnly:true}),name);}}
 finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('purchase POST response cannot borrow the historical GET exception even when it carries a stored basis',async()=>{
 const previous=globalThis.window,{profile,c,receiving,i}=historicalPurchaseFixture();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:profile};
 try{
  const {createWorkPurchases}=await controller('workPurchases'),d=dom(),store=storage(),selection={get:()=>({...profile.suppliers[0]}),members:profile.suppliers,eligible:()=>true,journalSuffix:()=>':13370:USD'};
  const journal=createInboundJournal({storage:store,key:'melisa-work-inbound-purchase:local:16:13370:USD',makeUuid:()=>requestId}),sent=journal.begin('/api/work-purchases/drafts/8/finalize',{}),before=JSON.stringify(journal.read());let posts=0;
  const ui=createWorkPurchases({root:d.root,session:{businessSupplierSelection:()=>selection,inbound:async(path,options)=>{if(options?.method==='POST'){posts++;assert.equal(path,sent.path);assert.deepEqual(options.body,sent.body);return {invoice:structuredClone(i),requestId,replayed:true};}if(path==='/api/work-receiving/context')return structuredClone(receiving);if(path==='/api/work-purchases/context')return structuredClone(c);if(path==='/api/work-purchases/drafts/8')return structuredClone(i);throw Error(path);}},user:{id:16},storage:store});
  ui.mount();await tick();assert.match(d.root.innerHTML,/TSTB-ONE/);d.node('[data-purchase-retry]').onclick();await tick();assert.equal(posts,1);assert.equal(JSON.stringify(journal.read()),before);assert.equal(journal.read().request.status,'pending');assert.equal(ui.requestClose(),false);assert.doesNotMatch(d.root.innerHTML,/Aynı fatura işlemi doğrulandı|Fatura işlemi kaydedildi/);ui.dispose();
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('saved historical invoice selection requires a typed requested ID and the exact named GET response',async()=>{
 const previous=globalThis.window;
 try{for(const target of ['9','../8']){
  const {profile,c,receiving,i}=historicalPurchaseFixture();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:profile};
  const {createWorkPurchases}=await controller('workPurchases'),d=dom(),store=storage(),selection={get:()=>({...profile.suppliers[0]}),members:profile.suppliers,eligible:()=>true,journalSuffix:()=>':13370:USD'},calls=[];
  createInboundJournal({storage:store,key:'melisa-work-inbound-purchase:local:16:13370:USD'}).backup({receiptId:'7',number:'TSTB-ONE',date:profile.date,quantities:{},invoiceId:target});
  const ui=createWorkPurchases({root:d.root,session:{businessSupplierSelection:()=>selection,inbound:async(path,options)=>{calls.push({path,options});if(path==='/api/work-receiving/context')return structuredClone(receiving);if(path==='/api/work-purchases/context')return structuredClone(c);return structuredClone(i);}},user:{id:16},storage:store});
  ui.mount();await tick();assert.doesNotMatch(d.root.innerHTML,/TSTB-ONE|Faturaya kayıtlı alış fiyatı/);assert.equal(calls.filter(call=>call.path.includes('/drafts/')).length,target==='9'?1:0);assert.ok(calls.every(call=>call.options?.method!=='POST'));ui.dispose();
 }}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
test('bound copy receiving retains exact native product/supplier IDs while normal labels contain no fixture badge or depot name',async()=>{
 const previous=globalThis.window,profile=copyProfile();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5204'},__MELISA_OPERATION_COPY__:profile};
 try{const c=context();Object.assign(c.meta,{date:profile.date,operationOrigin:profile.operationOrigin,copyId:profile.copyId,sealHash:profile.sealHash});Object.assign(c.scope,{synthetic:false,operationOrigin:profile.operationOrigin});Object.assign(c.scope.supplier,{synthetic:false,operationOrigin:profile.operationOrigin,currency:'TRY'});c.scope.products.forEach(p=>Object.assign(p,{synthetic:false,operationOrigin:profile.operationOrigin}));c.scope.warehouse.label='TEST V70';const {createWorkReceiving}=await controller('workReceiving'),d=dom(),calls=[],ui=createWorkReceiving({root:d.root,session:{inbound:async path=>{calls.push(path);return c;},media:async()=>{}},user:{id:15,permissions:[]},storage:storage()});ui.mount();await tick();d.node('[data-count-new]').onclick();assert.match(d.root.innerHTML,/Mal kabul deposu/);assert.match(d.root.innerHTML,/Ürün seçimi/);assert.match(d.root.innerHTML,/yalnız bu işlem için seçilebilen ürünler/);assert.doesNotMatch(d.root.innerHTML,/Deneme kaydı|Deneme ürününü|TEST V70|deneme kabulüne/);assert.match(d.root.innerHTML,/value="13370"/);assert.match(d.root.innerHTML,/value="301985"/);assert.deepEqual(calls,['/api/work-receiving/context']);ui.dispose();}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
async function controller(name){let s=await readFile(new URL('./'+name+'.js',import.meta.url),'utf8');s=s.replace("import './workInbound.css';",'').replace("import './workTaskHandoff.css';",'');for(const file of ['workPurchasePresentation.mjs','businessSupplierSelection.mjs','isolatedOperationCopyModel.mjs','workCopyPresentation.mjs','workTaskHandoff.mjs','currencyAccountPresentation.mjs','workInboundFx.js','workInboundModel.mjs','workReceivingHandoff.mjs','workReceivingRecovery.mjs','workInboundJournal.mjs','workTradeModel.mjs','workCatalogModel.mjs','workCatalogPhoto.mjs','testSuppliersModel.mjs','workSupplierPaymentsModel.mjs'])s=s.replace("'./"+file+"'",JSON.stringify(new URL('./'+file,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));}
function dom(){let html='',paints=0;const nodes=new Map();const node=k=>{if(!nodes.has(k))nodes.set(k,{isConnected:true,innerHTML:'',value:'',dataset:{},elements:{scan:{value:''},query:{value:''},number:{value:'',addEventListener(e,f){this['on'+e]=f;}},date:{value:'',addEventListener(e,f){this['on'+e]=f;}}},setAttribute(k,v){this[k]=v;},remove(){this.removed=true;},addEventListener(e,f){this['on'+e]=f;},querySelector:node,querySelectorAll:()=>[]});return nodes.get(k);};const root={isConnected:true,get innerHTML(){return html;},set innerHTML(v){html=v;paints++;},querySelector:node,querySelectorAll(selector){if(selector.includes(',')||selector.includes(' '))return [];const field=selector.slice(1,-1),key=field.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return [...html.matchAll(new RegExp(field+'="([^"]+)"','g'))].map(m=>{const n=node(selector+m[1]);n.dataset[key]=m[1];if(!n.initialized){n.value=new RegExp(field+'="'+m[1]+'"[^>]*value="([^"]*)"').exec(html)?.[1]??'';n.initialized=true;}return n;});}};return {root,node,paints:()=>paints};}

test('new receiving count preserves populated unsaved draft and invalid quantity without sending any request',async()=>{
 const {createWorkReceiving}=await controller('workReceiving'),d=dom(),store=storage(),c=context(),calls=[];
 const ui=createWorkReceiving({root:d.root,session:{media:async()=>{},inbound:async(path,options)=>{calls.push({path,options});assert.equal(options,undefined);return c;}},user:{id:15,permissions:[]},storage:store,uuid:()=>requestId});ui.mount();await tick();
 d.node('[data-count-new]').onclick();d.node('[data-count-new]').onclick();assert.match(d.root.innerHTML,/Henüz sayım satırı yok/);
 d.node('[data-count-scan]').elements.scan.value=c.scope.products[0].stockCode;d.node('[data-count-scan]').onsubmit({preventDefault(){}});
 const key='melisa-work-inbound-count:local:15',before=store.getItem(key);d.node('[data-count-new]').onclick();assert.equal(store.getItem(key),before);assert.match(d.root.innerHTML,/Önce açık sayımı kaydedin/);assert.match(d.root.innerHTML,/FULL 301985/);
 const input=d.root.querySelectorAll('[data-count-qty]')[0];input.value='not-a-quantity';input.oninput();const invalid=store.getItem(key);d.node('[data-count-new]').onclick();assert.equal(store.getItem(key),invalid);assert.match(d.root.innerHTML,/not-a-quantity/);assert.match(d.root.innerHTML,/cihaz yedeğiniz korunuyor/);
 assert.deepEqual(calls,[{path:'/api/work-receiving/context',options:undefined}]);ui.dispose();
});

test('new receiving count preserves note-only unsaved editor',async()=>{
 const {createWorkReceiving}=await controller('workReceiving'),d=dom(),store=storage(),c=context();const ui=createWorkReceiving({root:d.root,session:{media:async()=>{},inbound:async()=>c},user:{id:15,permissions:[]},storage:store});ui.mount();await tick();d.node('[data-count-new]').onclick();
 d.node('[data-count-note]').oninput({target:{value:'Paketler henüz açılmadı'}});const before=store.getItem('melisa-work-inbound-count:local:15');d.node('[data-count-new]').onclick();assert.equal(store.getItem('melisa-work-inbound-count:local:15'),before);assert.match(d.root.innerHTML,/Paketler henüz açılmadı/);assert.match(d.root.innerHTML,/Önce açık sayımı kaydedin/);ui.dispose();
});

test('clean registered receiving draft can start another count while keeping original history; dirty registered draft cannot',async()=>{
 const {createWorkReceiving}=await controller('workReceiving'),d=dom(),store=storage(),c=context();const draft=countDto({id:'1',version:1,state:'draft',created_by:15,note:'Kaydedilmiş sayım',lines:[line()],receipt_id:null});c.countDrafts=[draft];const original=JSON.stringify(c.countDrafts);
 const ui=createWorkReceiving({root:d.root,session:{media:async()=>{},inbound:async(path,options)=>{assert.equal(options,undefined);return c;}},user:{id:15,permissions:[]},storage:store});ui.mount();await tick();d.root.querySelectorAll('[data-count-open]')[0].onclick();d.node('[data-count-new]').onclick();assert.match(d.root.innerHTML,/<h2>Yeni sayım/);assert.equal(JSON.stringify(c.countDrafts),original);assert.match(d.root.innerHTML,/Sayım #1/);
 // A new unsaved count must no longer be discarded by reopening an old count.
 const unsaved=store.getItem('melisa-work-inbound-count:local:15');d.root.querySelectorAll('[data-count-open]')[0].onclick();assert.equal(store.getItem('melisa-work-inbound-count:local:15'),unsaved);assert.match(d.root.innerHTML,/<h2>Yeni sayım/);assert.match(d.root.innerHTML,/Önce açık sayımı kaydedin/);assert.equal(JSON.stringify(c.countDrafts),original);ui.dispose();
 // Exercise dirty REGISTERED preservation independently, without discarding the new editor.
 const registered=dom(),registeredStore=storage(),registeredUi=createWorkReceiving({root:registered.root,session:{media:async()=>{},inbound:async(path,options)=>{assert.equal(options,undefined);return c;}},user:{id:15,permissions:[]},storage:registeredStore});registeredUi.mount();await tick();registered.root.querySelectorAll('[data-count-open]')[0].onclick();const input=registered.root.querySelectorAll('[data-count-qty]')[0];input.value='4';input.oninput();const before=registeredStore.getItem('melisa-work-inbound-count:local:15');registered.node('[data-count-new]').onclick();assert.equal(registeredStore.getItem('melisa-work-inbound-count:local:15'),before);assert.equal(JSON.stringify(c.countDrafts),original);assert.match(registered.root.innerHTML,/Önce açık sayımı kaydedin/);assert.match(registered.root.innerHTML,/value="4"/);registeredUi.dispose();
});

test('mobile supplier name/code search narrows 406 exact accounts, retains selected account and disabled eligibility, and respects open-count lock',async()=>{
 const previous=globalThis.document;globalThis.document={body:{classList:{contains:name=>name==='work-task-terminal'}}};
 try{
  const {createWorkReceiving}=await controller('workReceiving'),d=dom(),store=storage(),c=context(),calls=[],sets=[];
  const members=[{...c.scope.supplier,currency:'TRY'},{id:'20001',code:'TRIKO-028',name:'İNCİ TRİKO',currency:'TRY'},{id:'20001',code:'TRIKO-028',name:'İNCİ TRİKO',currency:'USD'},...Array.from({length:403},(_,i)=>({id:String(21000+i),code:'OTHER-'+i,name:'Diğer tedarikçi '+i,currency:'TRY'}))];let selected=members[0];Object.assign(c.scope.supplier,selected);
  const selection={members,get:()=>selected,eligible:s=>s.id==='13370'||s.id==='20001'&&s.currency==='TRY',journalSuffix:()=>':'+selected.id+':'+selected.currency,set(id,currency){const found=members.find(s=>s.id===id&&s.currency===currency);if(!found||!this.eligible(found))throw Error('not eligible');sets.push({id,currency});selected=found;c.scope.supplier={...found};}};
  const ui=createWorkReceiving({root:d.root,session:{businessSupplierSelection:()=>selection,media:async()=>{},inbound:async(path,options)=>{assert.equal(options,undefined);calls.push(path);return c;}},user:{id:15,permissions:[]},storage:store});ui.mount();await tick();assert.match(d.root.innerHTML,/Tedarikçi ara/);assert.equal((d.root.innerHTML.match(/<option value="\d+:(?:TRY|USD)"/g)??[]).length,406);
  const search=d.node('[data-business-supplier-search]'),select=d.node('[data-business-supplier]');search.oninput({target:{value:'inci'}});
  assert.equal((select.innerHTML.match(/<option /g)??[]).length,3);assert.match(select.innerHTML,/value="13370:TRY" selected/);assert.match(select.innerHTML,/value="20001:TRY"/);assert.match(select.innerHTML,/value="20001:USD"\s+disabled/);assert.deepEqual(sets,[]);assert.equal(calls.length,1);
  search.oninput({target:{value:'TRIKO-028'}});assert.equal((select.innerHTML.match(/<option /g)??[]).length,3);search.oninput({target:{value:'not found'}});assert.equal((select.innerHTML.match(/<option /g)??[]).length,1);assert.match(select.innerHTML,/13370:TRY/);
  search.oninput({target:{value:''}});assert.equal((select.innerHTML.match(/<option /g)??[]).length,406);search.oninput({target:{value:'inci'}});select.onchange({target:{value:'20001:TRY'}});await tick();assert.deepEqual(sets,[{id:'20001',currency:'TRY'}]);assert.equal(selected.name,'İNCİ TRİKO');assert.equal(calls.length,2);
  d.node('[data-count-new]').onclick();assert.match(d.root.innerHTML,/data-business-supplier-search[^>]*disabled/);assert.match(d.root.innerHTML,/data-business-supplier disabled/);const before=[...store.values];d.node('[data-business-supplier-search]').oninput({target:{value:'OTHER'}});d.node('[data-business-supplier]').onchange({target:{value:'13370:TRY'}});assert.deepEqual(sets,[{id:'20001',currency:'TRY'}]);assert.deepEqual([...store.values],before);assert.equal(calls.length,2);ui.dispose();
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('supplier search is absent from the existing desktop presentation',async()=>{
 const previous=globalThis.document;globalThis.document={body:{classList:{contains:()=>false}}};try{const {createWorkReceiving}=await controller('workReceiving'),d=dom(),c=context(),selected={...c.scope.supplier,currency:'TRY'};c.scope.supplier=selected;const ui=createWorkReceiving({root:d.root,session:{businessSupplierSelection:()=>({members:[selected],get:()=>selected,eligible:()=>true,journalSuffix:()=>':'+selected.id+':TRY'}),media:async()=>{},inbound:async()=>c},user:{id:15,permissions:[]},storage:storage()});ui.mount();await tick();assert.doesNotMatch(d.root.innerHTML,/data-business-supplier-search/);assert.match(d.root.innerHTML,/data-business-supplier/);ui.dispose();}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
test('verified copy purchase never mounts legacy synthetic FX adapter, while original purchase still reads it',async()=>{
 const previous=globalThis.window,{createWorkPurchases}=await controller('workPurchases');
 try{for(const copied of [true,false]){
  const profile=copyProfile();globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:copied?'5204':'5194'},__MELISA_OPERATION_COPY__:profile};
  const receiving=context(),purchase=purchases(),calls=[],d=dom(),store=storage();
  if(copied)for(const c of [receiving,purchase]){
   Object.assign(c.meta,{date:profile.date,operationOrigin:profile.operationOrigin,copyId:profile.copyId,sealHash:profile.sealHash});Object.assign(c.scope,{synthetic:false,operationOrigin:profile.operationOrigin});Object.assign(c.scope.supplier,{synthetic:false,operationOrigin:profile.operationOrigin,currency:'TRY'});c.scope.products.forEach(p=>Object.assign(p,{synthetic:false,operationOrigin:profile.operationOrigin,unit:{label:'ADET',factorExact8:'1.00000000'}}));
  }
  const ui=createWorkPurchases({root:d.root,session:{inbound:async(path,options)=>{assert.equal(options,undefined);calls.push(path);if(path==='/api/work-receiving/context')return receiving;if(path==='/api/work-purchases/context')return purchase;throw {status:403};}},user:{id:16},storage:store});
  ui.mount();await tick();await tick();assert.match(d.root.innerHTML,/Alış faturaları/);assert.match(d.root.innerHTML,/Döviz<input value="TRY"/);
  assert.deepEqual(calls,copied?['/api/work-receiving/context','/api/work-purchases/context']:['/api/work-receiving/context','/api/work-purchases/context','/api/work-purchases/fx/context']);
  if(copied){assert.equal(d.node('[data-inbound-fx-slot]').innerHTML,'');await ui.refresh();assert.equal(calls.some(p=>p.includes('/fx/')),false);assert.equal(store.values.size,0);}
  ui.dispose();
 }}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
test('backend count DTO accepts literal unknown barcode, null expected count and canonical identity without inferred cards',()=>{
 const c=context(),raw={requestId,note:'',lines:[line(null)]},parsed=countInput(raw,c.scope.products),d=countDto({id:'1',version:1,created_by:15,state:'needs_review',note:parsed.note,lines:parsed.lines,receipt_id:null});assert.equal(countDraft(d,c).lines[0].barcode,'0000099');assert.equal(d.lines[0].productId,null);assert.equal(d.lines[0].expectedQuantityExact3,null);
 for(const mutate of [l=>l.physicalQuantityExact3='0.000',l=>l.physicalQuantityExact3='1.500',l=>l.expectedQuantityExact3='2.000',l=>l.productId='301986',l=>l.barcode='made-up',l=>l.clientLineId='x'.repeat(65)]){const l=line();mutate(l);assert.throws(()=>countLines([l],c));}
 const literal=line(null);literal.barcode=' ';assert.equal(countLines([literal],c)[0].barcode,' ');assert.equal(countInput({requestId,note:'',lines:[literal]},c.scope.products).lines[0].barcode,' ');
});
test('receiving never accepts financial leakage and preserves unknown versus actual zero stock',()=>{const c=receivingContext(context());assert.equal(c.scope.products[0].stockQuantityExact3,null);assert.equal(c.scope.products[1].stockQuantityExact3,'0.000');for(const path of ['price','balance','invoice']){const d=context();if(path==='price')d.scope.products[0].purchasePriceExact8='60.00000000';if(path==='balance')d.scope.supplier.balanceExact4='0.0000';if(path==='invoice')d.drafts=[];assert.throws(()=>receivingContext(d));}});
test('purchase validates receipt remaining, frozen source price, date and zero/null without currency guesses',()=>{const c=purchases(),s=selection(),p={selection:s,items:s.lines.map((l,i)=>({...l,productId:c.scope.products[i].id,purchasePriceExact8:c.scope.products[i].purchasePriceExact8,lineTotalExact4:(i?'80':'120')+'.0000'})),totals:invoice().totals,currency:'TRY'};assert.equal(purchasePreview(p,s,c),p);for(const patch of [x=>x.lines[0].quantityExact3='3.000',x=>x.currency='USD',x=>x.documentDate='',x=>x.lines[0].quantityExact3='0.000']){const x=structuredClone(s);patch(x);assert.throws(()=>purchaseSelection(x,c));}const changed=structuredClone(p);changed.items[0].purchasePriceExact8='0.00000000';assert.throws(()=>purchasePreview(changed,s,c));c.scope.products[0].purchasePriceExact8=null;assert.throws(()=>purchaseSelection(s,c));c.scope.products[0].purchasePriceExact8='0.00000000';assert.equal(purchaseSelection(s,c),s);});
test('journal persists exact UUID/body before send, refuses pending edits, restores and rejects late completion',()=>{const store=storage(),j=createInboundJournal({storage:store,key:'k',makeUuid:()=>requestId});j.backup({lines:[line(null)]});const sent=j.begin('/api/work-receiving/count-drafts',{note:'',lines:[line(null)]});assert.deepEqual(createInboundJournal({storage:store,key:'k'}).read().request,sent);assert.throws(()=>j.backup({lines:[]}));assert.throws(()=>j.begin('/api/work-receiving/count-drafts',{}));assert.equal(j.complete({...sent,body:{...sent.body,note:'different'}},{}),null);j.complete(sent,{replayed:true});j.backup({lines:[line()]});assert.equal(j.read().request.result.replayed,true);const failure=createInboundJournal({storage:{getItem:()=>null,setItem(){throw Error();}},key:'k',makeUuid:()=>requestId});assert.throws(()=>failure.begin('/api/work-purchases/drafts',{}),/Kayıt gönderilmedi/);assert.throws(()=>createInboundJournal({storage:store,key:'other',makeUuid(){throw Error();}}).begin('/api/work-purchases/drafts',{}),/Kayıt gönderilmedi/);});
test('personnel actual capability prevents financial GET even with purchase.view; late mount cannot paint',async()=>{const {createWorkPurchases}=await controller('workPurchases'),d=dom(),calls=[],c=context();c.capabilities.canViewPurchase=false;const ui=createWorkPurchases({root:d.root,session:{inbound:async path=>{calls.push(path);return c;}},user:{id:15,permissions:['purchase.view']},storage:storage()});ui.mount();await tick();assert.deepEqual(calls,['/api/work-receiving/context']);assert.match(d.root.innerHTML,/görüntüleme yetkiniz yok/);ui.dispose();let resolve;const e=dom(),late=createWorkPurchases({root:e.root,session:{inbound:()=>new Promise(r=>resolve=r)},user:{id:16},storage:storage()});late.mount();const before=e.root.innerHTML;late.dispose();resolve(context());await tick();assert.equal(e.root.innerHTML,before);});
test('receiving input persists without replacing clicked controls; unknown saved and restored, submit remains closed',async()=>{const {createWorkReceiving}=await controller('workReceiving'),d=dom(),store=storage(),calls=[],c=context();const session={media:async()=>{},api:async()=>{throw Error();},inbound:async(path,o)=>{calls.push({path,o});if(!o)return c;const draft=countDto({id:'1',version:1,state:'needs_review',created_by:15,note:o.body.note,lines:o.body.lines,receipt_id:null});c.countDrafts=[draft];return {draft,receipt:null,requestId:o.body.requestId,replayed:false};}};const ui=createWorkReceiving({root:d.root,session,user:{id:15,permissions:[]},storage:store,uuid:()=>requestId});ui.mount();await tick();d.node('[data-count-new]').onclick();const supplier=d.node('[data-count-supplier]');supplier.value='13370';supplier.onchange({target:supplier});d.node('[data-count-scan]').elements.scan.value='0000099';d.node('[data-count-scan]').onsubmit({preventDefault(){}});await tick();const q=d.root.querySelectorAll('[data-count-qty]')[0],before=d.paints();q.value='3';q.oninput();q.onchange();assert.equal(d.paints(),before);d.node('[data-count-note]').value='Eksik paket';d.node('[data-count-save]').onclick();await tick();const sent=calls.find(x=>x.o);assert.equal(sent.o.body.lines[0].physicalQuantityExact3,'3.000');assert.equal(sent.o.body.lines[0].barcode,'0000099');assert.equal(sent.o.body.lines[0].productId,null);assert.match(d.root.innerHTML,/Stok kartı gerekli/);assert.match(d.root.innerHTML,/data-count-submit disabled/);ui.dispose();const e=dom(),next=createWorkReceiving({root:e.root,session,user:{id:15,permissions:[]},storage:store});next.mount();await tick();assert.match(e.root.innerHTML,/0000099/);assert.match(e.root.innerHTML,/Sayım #1/);next.dispose();});
test('purchase captures actual DOM input before busy paint; preview and permanent draft are distinct writes',async()=>{const {createWorkPurchases}=await controller('workPurchases'),d=dom(),store=storage(),calls=[],c=purchases();const session={inbound:async(path,o)=>{calls.push({path,o});if(path.endsWith('/work-receiving/context'))return context();if(path.endsWith('/work-purchases/context'))return c;if(path.endsWith('/preview'))return {selection:o.body,currency:'TRY',items:o.body.lines.map((l,i)=>({...l,productId:c.scope.products[i].id,purchasePriceExact8:c.scope.products[i].purchasePriceExact8,lineTotalExact4:(i?'80':'120')+'.0000'})),totals:invoice().totals};if(path.endsWith('/drafts'))return {invoice:invoice(),requestId:o.body.requestId,replayed:false};if(path.endsWith('/drafts/8'))return invoice();throw Error(path);}};const ui=createWorkPurchases({root:d.root,session,user:{id:16},storage:store,uuid:()=>requestId});ui.mount();await tick();d.node('[data-purchase-receipt]').onchange({target:{value:'7'}});const form=d.node('[data-purchase-entry]');form.elements.number.value='TSTB-ONE';form.elements.date.value='2026-10-06';const qs=d.root.querySelectorAll('[data-purchase-qty]');qs[0].value='2';qs[1].value='1';const before=d.paints();qs[0].oninput();assert.equal(d.paints(),before);d.node('[data-purchase-preview]').onclick();await tick();assert.equal(calls.filter(x=>x.o).length,1);assert.deepEqual(calls.find(x=>x.path.endsWith('/preview')).o.body,selection());d.node('[data-purchase-create]').onclick();await tick();assert.match(d.root.innerHTML,/Taslak stok ve tedarikçi borcunu değiştirmez/);assert.match(d.root.innerHTML,/data-purchase-finalize/);assert.equal(calls.filter(x=>x.o).length,2);d.node('[data-purchase-new]').onclick();await ui.refresh();assert.doesNotMatch(d.root.innerHTML,/data-purchase-finalize/);ui.dispose();});
test('supplier history keeps cancellation debt reversal distinct and errors never expose server text',()=>{const c={meta:context().meta,supplier:{...context().scope.supplier,currency:'TRY',balanceExact4:'0.0000'},movements:[{id:'1',invoiceId:'8',receiptId:'7',invoiceNumber:'TSTB-ONE',invoiceStatus:'cancelled',type:'purchase_invoice_cancel',documentDate:null,currency:'TRY',amountExact4:'200.0000',balanceEffectExact4:'-200.0000',amountTryExact4:'200.0000'}]};assert.equal(supplierContext(c),c);assert.match(inboundError({status:409,code:'INBOUND_NEEDS_REVIEW',message:'private SQL'}),/Stok kartı gerekli/);assert.doesNotMatch(inboundError({status:500,message:'private SQL'}),/private/);});
test('known manual scope selection keeps null barcodes; delayed save locks edits and reload retries the identical UUID/body',async()=>{
 const {createWorkReceiving}=await controller('workReceiving'),d=dom(),store=storage(),c=context(),writes=[];let resolve,sequence=0;
 const session={media:async()=>{},inbound:async(path,o)=>{if(!o)return c;writes.push(structuredClone(o.body));return new Promise(r=>resolve=r);}};
 const ui=createWorkReceiving({root:d.root,session,user:{id:16,permissions:[]},storage:store,uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`});ui.mount();await tick();d.node('[data-count-new]').onclick();const supplier=d.node('[data-count-supplier]');supplier.value='13370';supplier.onchange({target:supplier});
 for(const p of c.scope.products){d.node('[data-count-product]').value=p.id;d.node('[data-count-add-product]').onclick();}
 assert.match(d.root.innerHTML,/FULL 301985/);assert.match(d.root.innerHTML,/Barkod: Bilinmiyor/);d.node('[data-count-save]').onclick();await tick();const before=store.getItem('melisa-work-inbound-count:local:16');d.node('[data-count-new]').onclick();const q=d.root.querySelectorAll('[data-count-qty]')[0];q.value='5';q.oninput();assert.equal(store.getItem('melisa-work-inbound-count:local:16'),before);assert.equal(ui.requestClose(),false);ui.dispose();
 const draft=countDto({id:'1',version:1,state:'draft',created_by:16,note:writes[0].note,lines:writes[0].lines,receipt_id:null}),result={draft,receipt:null,requestId:writes[0].requestId,replayed:false};resolve(result);await tick();assert.equal(writes[0].lines.length,2);assert.ok(writes[0].lines.every(l=>l.barcode===null));
 // A completed response is persisted even after unmount; an ambiguous response uses the same POST.
 const journal=createInboundJournal({storage:store,key:'melisa-work-inbound-count:local:16'});assert.equal(journal.read().request.status,'done');const sent=journal.begin('/api/work-receiving/count-drafts/1/submit',{expectedRevision:draft.revision});c.countDrafts=[draft];const e=dom(),retrySession={media:async()=>{},inbound:async(path,o)=>{if(!o)return c;writes.push(structuredClone(o.body));throw {status:503};}},next=createWorkReceiving({root:e.root,session:retrySession,user:{id:16,permissions:[]},storage:store});next.mount();await tick();assert.equal(next.requestClose(),false);e.node('[data-count-retry]').onclick();await tick();assert.deepEqual(writes.at(-1),sent.body);assert.equal(journal.read().request.status,'pending');next.dispose();
});
test('supplier controller reads one financial context and renders native cancellation separately; restricted personnel does not fetch balances',async()=>{
 const {createWorkSuppliers}=await controller('workSuppliers'),c=context(),calls=[],d=dom(),value={meta:c.meta,supplier:{...c.scope.supplier,currency:'TRY',balanceExact4:'0.0000'},movements:[{id:'3',invoiceId:'8',receiptId:'7',invoiceNumber:'TSTB-ONE',invoiceStatus:'cancelled',type:'purchase_invoice_cancel',documentDate:'2026-10-06',currency:'TRY',amountExact4:'200.0000',balanceEffectExact4:'-200.0000',amountTryExact4:'200.0000'}]};
 const ui=createWorkSuppliers({root:d.root,session:{inbound:async path=>{calls.push(path);return path.includes('receiving')?c:value;}},user:{id:16,permissions:['goods.view','supplier.view']}});ui.mount();await tick();assert.deepEqual(calls,['/api/work-receiving/context','/api/work-suppliers/context']);assert.match(d.root.innerHTML,/Fatura iptali/);assert.match(d.root.innerHTML,/Borç azalması: −200,00 TRY/);assert.doesNotMatch(d.root.innerHTML,/Kasa bakiyesi/);ui.dispose();c.capabilities.canViewSupplier=false;calls.length=0;const e=dom(),denied=createWorkSuppliers({root:e.root,session:{inbound:async path=>{calls.push(path);return c;}},user:{id:15,permissions:['goods.view','purchase.view']}});denied.mount();await tick();assert.deepEqual(calls,['/api/work-receiving/context']);assert.match(e.root.innerHTML,/borç ve fatura hareketlerini görüntüleme yetkiniz yok/);denied.dispose();
});
test('supplier chain uses verified native receipt and invoice for original/reversal; orphan nulls are explicit and never inferred',async()=>{
 const {createWorkSuppliers}=await controller('workSuppliers'),c=context(),d=dom(),common={invoiceId:'8',receiptId:'7',invoiceNumber:'TSTB-00001',invoiceStatus:'cancelled',documentDate:'2026-10-06',currency:'TRY',amountExact4:'200.0000',amountTryExact4:'200.0000'},value={meta:c.meta,supplier:{...c.scope.supplier,currency:'TRY',balanceExact4:'0.0000'},movements:[{...common,id:'1',type:'purchase_invoice',balanceEffectExact4:'200.0000'},{...common,id:'2',type:'purchase_invoice_cancel',balanceEffectExact4:'-200.0000'},{...common,id:'3',invoiceId:null,receiptId:null,invoiceNumber:null,invoiceStatus:null,type:'other',balanceEffectExact4:'0.0000'}]};
 const ui=createWorkSuppliers({root:d.root,session:{inbound:async path=>path.includes('receiving')?c:value},user:{id:16,permissions:['goods.view']}});ui.mount();await tick();assert.equal((d.root.innerHTML.match(/Mal kabul #7 → Fatura TSTB-00001/g)||[]).length,2);assert.match(d.root.innerHTML,/Mal kabul #7 → Fatura TSTB-00001 → Borç artışı/);assert.match(d.root.innerHTML,/Mal kabul #7 → Fatura TSTB-00001 → Borç azalması/);assert.match(d.root.innerHTML,/Kabul bağı bilinmiyor → Fatura numarası bilinmiyor/);assert.match(d.root.innerHTML,/Fatura durumu bilinmiyor/);assert.doesNotMatch(d.root.innerHTML,/Mal kabul #8/);ui.dispose();
 for(const patch of [m=>delete m.receiptId,m=>m.receiptId=7,m=>m.invoiceNumber=123,m=>m.invoiceStatus=false]){const changed=structuredClone(value);patch(changed.movements[0]);assert.throws(()=>supplierContext(changed));}const duplicate=structuredClone(value);duplicate.movements.push({...duplicate.movements[0]});assert.throws(()=>supplierContext(duplicate));
});
test('supplier card joins accepted receipt, invoice, partial payment and reversal using the exact same supplier identity',async()=>{
 const {createWorkSuppliers}=await controller('workSuppliers'),raw=rawPaymentFixture(),supplier=raw.suppliers[0],invoice=supplier.invoices[0];supplier.balanceExact4='200.0000';invoice.paidExact4='100.0000';invoice.remainingExact4='200.0000';raw.accounts[0].balanceExact4='900.0000';
 const movement=(id,kind,extra={})=>({ownership:'work',canCancel:false,receiptKind:'work-finops-physical-receipt',id,supplierId:supplier.id,accountId:raw.accounts[0].id,invoiceId:invoice.id,receiptId:invoice.receiptId,invoiceNumber:invoice.number,kind,direction:kind==='payment'?'out':'in',currency:'TRY',amountExact4:'100.0000',accountCurrency:'TRY',accountAmountExact4:'100.0000',amountTryExact4:'100.0000',documentRateExact8:'1.00000000',accountRateExact8:'1.00000000',documentDate:'2026-10-06',description:'Kısmi ödeme',number:`${kind==='payment_cancel'?'ODI':'OD'}-${id}`,originalId:null,reversedById:null,...extra});
 raw.payments=[movement('9010','payment',{reversedById:'9011'}),movement('9011','payment_cancel',{originalId:'9010'}),movement('9012','payment')];
 const validated=clientPaymentContext(nativePaymentContext(raw,paymentActor)),c=context(),d=dom(),calls=[];
 const ui=createWorkSuppliers({root:d.root,session:{inbound:async path=>path.includes('receiving')?c:{meta:c.meta,supplier:{...c.scope.supplier,currency:'TRY',balanceExact4:'0.0000'},movements:[]},supplierPayments:async path=>{calls.push(path);return validated;}},user:{id:16,permissions:['goods.view','supplier.view','finance.view']}});
 ui.mount();await tick();assert.deepEqual(calls,['/api/work-supplier-payments/context']);assert.match(d.root.innerHTML,/Mal kabul #9004 → Alış faturası TDAY-FINOPS-20261006/);assert.match(d.root.innerHTML,/Ödenen 100,00 · İade 0,00/);assert.match(d.root.innerHTML,/Kalan borç: <b>200,00 TRY/);assert.match(d.root.innerHTML,/ODI-9011/);assert.match(d.root.innerHTML,/Ödeme ters kaydı/);assert.match(d.root.innerHTML,/OD-9012/);assert.doesNotMatch(d.root.innerHTML,/Mal kabul #9003/);ui.dispose();
 const limited=context();limited.capabilities.canViewSupplier=false;const e=dom(),deniedCalls=[],denied=createWorkSuppliers({root:e.root,session:{inbound:async path=>{deniedCalls.push(path);return limited;},supplierPayments:async()=>{throw Error('unexpected financial read');}},user:{id:15,permissions:['goods.view','supplier.view']}});denied.mount();await tick();assert.deepEqual(deniedCalls,['/api/work-receiving/context']);assert.doesNotMatch(e.root.innerHTML,/Deneme kaydı|200,00 TRY/);assert.match(e.root.innerHTML,/Ödeme geçmişini görüntüleme yetkiniz yok/);denied.dispose();
});

for(const refreshStatus of [403,503])test('purchase committed result survives following context refresh '+refreshStatus,async()=>{
 const {createWorkPurchases}=await controller('workPurchases'),d=dom(),store=storage(),c=purchases(),calls=[];let committed=false;
 const ui=createWorkPurchases({root:d.root,user:{id:16},storage:store,uuid:()=>requestId,session:{inbound:async(path,o)=>{
  calls.push({path,o});if(path==='/api/work-receiving/context')return context();
  if(path==='/api/work-purchases/context'){if(committed)throw {status:refreshStatus};return c;}
  if(path.endsWith('/preview'))return {selection:o.body,currency:'TRY',items:o.body.lines.map((l,i)=>({...l,productId:c.scope.products[i].id,purchasePriceExact8:c.scope.products[i].purchasePriceExact8,lineTotalExact4:(i?'80':'120')+'.0000'})),totals:invoice().totals};
  if(path==='/api/work-purchases/drafts'){committed=true;return {invoice:invoice(),requestId:o.body.requestId,replayed:false};}throw Error(path);
 }}});
 ui.mount();await tick();d.node('[data-purchase-receipt]').onchange({target:{value:'7'}});
 const form=d.node('[data-purchase-entry]');form.elements.number.value='TSTB-ONE';form.elements.date.value='2026-10-06';const quantities=d.root.querySelectorAll('[data-purchase-qty]');quantities[0].value='2';quantities[1].value='1';quantities[0].oninput();
 d.node('[data-purchase-preview]').onclick();await tick();d.node('[data-purchase-create]').onclick();await tick();
 const journal=createInboundJournal({storage:store,key:'melisa-work-inbound-purchase:local:16'}).read();
 assert.equal(journal.request.status,'done');assert.equal(journal.draft.invoiceId,'8');assert.equal(journal.request.result.invoice.id,'8');
 assert.match(d.root.innerHTML,/Fatura işlemi kaydedildi/);assert.match(d.root.innerHTML,/Güncel alış bilgileri yenilenemedi/);assert.doesNotMatch(d.root.innerHTML,/Bu işlem için yetkiniz yok|Son faturanın sonucu doğrulanmalı/);assert.match(d.root.innerHTML,/TSTB-ONE/);
 assert.equal(calls.filter(call=>call.path==='/api/work-purchases/drafts').length,1);assert.equal(ui.requestClose(),true);ui.dispose();
});
