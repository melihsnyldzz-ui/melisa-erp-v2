import test from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations } from './operationsStore.js';
import { scanPackage, appendScannedPackage } from './operationsScan.js';
const card={name:'Bedenli Set',code:'SET-12',barcode:'SET-PACK',barcodes:['SET-PACK-ALT'],unitBarcodes:[{size:'56',barcode:'SET-56'},{size:'62',barcode:'SET-62'}],supplierId:'501',cost:'10',salePrice:'20',series:[{size:'56',quantity:2},{size:'62',quantity:1}]};
const setup=()=>transitionOperations(seedOperations(),{type:'save-card',entity:'products',input:card});
const document=(state,input)=>{const draft=transitionOperations(state,{type:'save',input:{date:'2026-09-26',currency:'TRY',...input}});return transitionOperations(draft,{type:'approve',id:draft.nextId-1});};
test('individual sizes collect into a full package without creating fractional stock',()=>{
 let state=setup(),pending=null,items=[];const id=state.products.at(-1).id;
 for(const code of ['SET-56','SET-62']){const result=scanPackage(state,pending,code);assert.equal(result.complete,false);pending=result.pending;assert.equal(state.products.at(-1).stock,0);}
 assert.throws(()=>scanPackage(state,pending,'SET-62'),/zaten okutuldu/);
 assert.throws(()=>scanPackage(state,pending,'SET-PACK'),/Eksik seri/);
 state=transitionOperations(state,{type:'save-card',entity:'products',input:{...card,name:'Başka Set',code:'SET-OTHER',barcode:'OTHER-PACK',barcodes:[],unitBarcodes:[{size:'56',barcode:'OTHER-56'},{size:'62',barcode:'OTHER-62'}]}});
 assert.throws(()=>scanPackage(state,pending,'OTHER-PACK'),/Önce açık serinin/);
 const completed=scanPackage(state,pending,'SET-56');assert.equal(completed.complete,true);assert.equal(completed.pending,null);
 items=appendScannedPackage(items,completed);assert.equal(items[0].quantity,'1');assert.deepEqual(items[0].unitScans,['SET-56','SET-62','SET-56']);
 state=document(state,{kind:'receipt',partyId:'501',items});assert.equal(state.products.find(p=>p.id===id).stock,1);assert.equal(state.documents[0].items[0].unitFactor,3);
 const oneMore=scanPackage(state,null,'SET-PACK');assert.throws(()=>appendScannedPackage(items,oneMore),/farklı barkod/);
 assert.equal(state.products.find(p=>p.id===id).stock,1);
});
test('partial or forged unit scan cannot create receipt, sale, count, purchase or offer',()=>{
 let state=setup(),id=state.products.at(-1).id;
 const line={productId:id,quantity:1,unitScans:['SET-56','SET-62']};
 for(const kind of ['receipt','sale','count']){
  const input={kind,date:'2026-09-26',currency:'TRY',partyId:kind==='receipt'?'501':'201',reason:'Sayım',items:[{...line,unitPrice:'20'}]};
  assert.throws(()=>transitionOperations(state,{type:'save',input}),/tüm bedenler/);
  assert.throws(()=>transitionOperations(state,{type:'save',input:{...input,items:[{productId:id,quantity:1,barcode:'SET-56',unitPrice:'20'}]}}),/Parça barkodu/);
 }
 state=document(state,{kind:'receipt',partyId:'501',items:[{productId:id,quantity:2}]});
 assert.throws(()=>transitionOperations(state,{type:'save',input:{kind:'purchase',date:'2026-09-26',currency:'TRY',partyId:'501',referenceId:1,items:[{...line,quantity:2,unitPrice:'10'}]}}),/tüm bedenler/);
 assert.throws(()=>transitionOperations(state,{type:'save-order',input:{date:'2026-09-26',validUntil:'2026-09-29',currency:'TRY',customerId:'201',items:[{...line,unitPrice:'20'}]}}),/tüm bedenler/);
});
test('two complete scanned packages reserve and sell exactly two stock rows',()=>{
 let state=setup(),id=state.products.at(-1).id;
 state=document(state,{kind:'receipt',partyId:'501',items:[{productId:id,quantity:2}]});
 let items=[];for(let pack=0;pack<2;pack++){
  let pending=null;for(const code of ['SET-56','SET-56','SET-62']){const result=scanPackage(state,pending,code);pending=result.pending;if(result.complete)items=appendScannedPackage(items,result,{unitPrice:'20'});}
 }
 assert.equal(items[0].quantity,'2');assert.equal(items[0].unitScans.length,6);
 state=transitionOperations(state,{type:'save-order',input:{date:'2026-09-26',validUntil:'2026-09-29',currency:'TRY',customerId:'201',items}});
 for(let i=0;i<3;i++)state=transitionOperations(state,{type:'advance-order',id:1});
 assert.equal(state.orders[0].status,'AWAITING_PAYMENT');assert.equal(state.products.at(-1).stock,2);
 state=transitionOperations(state,{type:'record-order-payment',id:1,amount:'40',channel:'BANK'});
 assert.equal(state.products.at(-1).stock,0);assert.equal(state.documents.at(-1).items[0].unitScans.length,6);
 assert.throws(()=>transitionOperations(state,{type:'save-card',entity:'products',id,input:{...card,unitBarcodes:[{size:'56',barcode:'CHANGED'},{size:'62',barcode:'SET-62'}]}}),/parça barkodları değiştirilemez/);
});
test('unit barcode identity is unique across package and size labels',()=>{
 const state=setup();assert.throws(()=>transitionOperations(state,{type:'save-card',entity:'products',input:{...card,code:'SET-13',barcode:'SET-56',unitBarcodes:[]}}),/barkod/);
 assert.throws(()=>transitionOperations(seedOperations(),{type:'save-card',entity:'products',input:{...card,unitBarcodes:[{size:'56',barcode:'SET-56'}]}}),/her bedene barkod/);
});
