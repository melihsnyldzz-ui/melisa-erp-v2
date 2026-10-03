import test from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations } from './operationsStore.js';
const card=(state,input,id)=>transitionOperations(state,{type:'save-card',entity:'products',input,id});
const price={name:'Serili Örnek',code:'SER-1',barcode:'869101',barcodes:['86910156','86910162'],supplierId:'501',cost:'100',salePrice:'200',prices:{TRY:'200',USD:'8.50',EUR:'7.25'},brand:'Melisa',category:'Takım',ageGroup:'0-6 ay',size:'56-62',series:[{size:'56',quantity:2},{size:'62',quantity:3}]};
const document=(state,input)=>{const saved=transitionOperations(state,{type:'save',input:{date:'2026-09-26',currency:'TRY',...input}});return transitionOperations(saved,{type:'approve',id:saved.nextId-1});};
test('series has one stock identity, barcode aliases stay unique and used series cannot be rewritten',()=>{
 let state=card(seedOperations(),price);const product=state.products.at(-1);assert.equal(product.unitFactor,5);assert.equal(product.stock,0);
 assert.throws(()=>card(state,{...price,code:'SER-2',barcode:'86910156',barcodes:[]}),/barkod/);
 state=document(state,{kind:'receipt',partyId:'501',items:[{productId:product.id,quantity:3}]});
 assert.equal(state.products.at(-1).stock,3);assert.equal(state.products.at(-1).stock*state.products.at(-1).unitFactor,15);
 assert.deepEqual(state.documents[0].items[0].series,price.series);
 assert.throws(()=>card(state,{...price,series:[{size:'56',quantity:3}]},product.id),/seri içeriği/);
});
test('currency label, dated FX and historical document prices are independent',()=>{
 let state=card(seedOperations(),price);const id=state.products.at(-1).id;
 state=document(state,{kind:'receipt',partyId:'501',items:[{productId:id,quantity:2}]});
 state=transitionOperations(state,{type:'save-rate',date:'2026-09-26',currency:'USD',value:'34.1234'});
 state=document(state,{kind:'sale',currency:'USD',partyId:'201',items:[{productId:id,quantity:1,unitPrice:'8.50'}]});
 const snapshot=structuredClone(state.documents[1]);assert.equal(snapshot.exchangeRate,34.1234);assert.equal(snapshot.items[0].unitPrice,850);
 state=transitionOperations(state,{type:'save-rate',date:'2026-09-26',currency:'USD',value:'35.001'});
 state=card(state,{...price,prices:{...price.prices,USD:'10'}},id);
 assert.deepEqual(state.documents[1],snapshot);assert.equal(state.products.at(-1).prices.USD,1000);
 state=document(state,{kind:'sale',currency:'EUR',partyId:'201',items:[{productId:id,quantity:1,unitPrice:'7.25'}]});
 assert.equal(state.documents[2].exchangeRate,null);assert.equal(state.documents[2].currency,'EUR');
});
test('approved purchase updates last buying price without overwriting estimated cost or historical invoices',()=>{
 let state=card(seedOperations(),price),id=state.products.at(-1).id;
 state=document(state,{kind:'receipt',partyId:'501',items:[{productId:id,quantity:2}]});
 state=document(state,{kind:'purchase',partyId:'501',referenceId:1,items:[{productId:id,quantity:2,unitPrice:'90'}]});
 assert.equal(state.products.at(-1).lastPurchasePrice.amount,9000);assert.equal(state.products.at(-1).cost,10000);
 assert.equal(state.documents[1].items[0].unitPrice,9000);
 state=card(state,{...price,cost:'105'},id);assert.equal(state.documents[1].items[0].unitPrice,9000);
 state=transitionOperations(state,{type:'cancel',id:2,reason:'Düzeltme'});assert.equal(state.products.at(-1).lastPurchasePrice,null);
});
test('passive product cannot enter new sale and discount limit matches offer',()=>{
 let state=card(seedOperations(),price),id=state.products.at(-1).id;
 state=card(state,{...price,active:false},id);
 assert.throws(()=>transitionOperations(state,{type:'save',input:{kind:'sale',date:'2026-09-26',currency:'TRY',partyId:'201',items:[{productId:id,quantity:1,unitPrice:'200'}]}}),/pasif/);
 assert.throws(()=>transitionOperations(state,{type:'save-order',input:{date:'2026-09-26',validUntil:'2026-09-29',currency:'TRY',customerId:'201',items:[{productId:id,quantity:1,unitPrice:'200'}]}}),/pasif/);
 assert.throws(()=>transitionOperations(seedOperations(),{type:'save',input:{kind:'sale',date:'2026-09-26',currency:'TRY',partyId:'201',items:[{productId:'101',quantity:1,unitPrice:'200',discount:11}]}}),/gerçek sahip onayı/);
});
