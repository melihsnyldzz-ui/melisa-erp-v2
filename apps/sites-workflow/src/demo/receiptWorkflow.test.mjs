import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations as step, deriveWorkflowTasks, balance } from './operationsStore.js';

const date='2026-09-26';
const receipt=(extra={})=>({kind:'receipt',date,currency:'TRY',partyId:'501',items:[{productId:'101',quantity:5}],intake:{boxCount:2,countedBy:'Personel',note:'İrsaliye ile sayıldı',samples:{'101':'ORNEK-101'},expected:{'101':6},unknownItems:[]},...extra});
const invoice=(qty,number='A-1',extra={})=>({kind:'purchase',date,currency:'TRY',partyId:'501',referenceId:1,supplierInvoiceNumber:number,taxRate:20,items:[{productId:'101',quantity:qty,unitPrice:'100',discount:10}],...extra});

test('personnel recount, accounting return, unknown card mapping and one stock posting',()=>{
 let state=seedOperations();
 state=step(state,{type:'save',input:receipt({intake:{...receipt().intake,unknownItems:[{id:'u1',barcode:'YENI-PAKET',name:'Yeni zıbın',quantity:2}]}})});
 assert.throws(()=>step(state,{type:'approve',id:1}),/muhasebeye/);
 state=step(state,{type:'submit-receipt',id:1});
 assert.match(deriveWorkflowTasks(state).find(t=>t.id==='draft-1').detail,/Bilinmeyen/);
 assert.throws(()=>step(state,{type:'approve',id:1}),/Bilinmeyen/);
 state=step(state,{type:'return-receipt',id:1,reason:'İrsaliyede altı, sayımda beş paket'});
 assert.throws(()=>step(state,{type:'submit-receipt',id:1}),/gerekçeli düzeltip/);
 assert.throws(()=>step(state,{type:'save',id:1,input:receipt()}),/Düzeltme gerekçesi/);
 state=step(state,{type:'save',id:1,input:receipt({correctionReason:'Eksik gelen bir paket doğrulandı',intake:{...state.documents[0].intake,boxCount:2,note:'Bir paket eksik; tedarikçiye bildirildi',samples:{'101':'ORNEK-101'}}})});
 state=step(state,{type:'submit-receipt',id:1});
 assert.throws(()=>step(state,{type:'map-unknown',id:1,unknownId:'u1',productId:'101'}),/paket barkodu/);
 state=step(state,{type:'save-card',entity:'products',input:{name:'Yeni zıbın',code:'YENI-01',barcode:'YENI-PAKET',supplierId:'501',cost:'90',prices:{TRY:'150'}}});
 const newProduct=state.products.at(-1);state=step(state,{type:'map-unknown',id:1,unknownId:'u1',productId:newProduct.id});
 assert.equal(state.products[0].stock,20);state=step(state,{type:'approve',id:1});
 assert.equal(state.products[0].stock,25);assert.equal(state.products.at(-1).stock,2);
 assert.equal(state.documents[0].intake.expected['101'],6);
 assert.equal(state.documents[0].items[0].quantity-state.documents[0].intake.expected['101'],-1);
 assert.equal(deriveWorkflowTasks(state).find(t=>t.id==='bill-1').payload.referenceId,1);
});

test('dated FX rate converts only invoiced net cost; KDV stays in supplier balance',()=>{
 let state=step(seedOperations(),{type:'save-rate',date,currency:'EUR',value:'40.0000'});
 state=step(state,{type:'save',input:receipt()});state=step(state,{type:'submit-receipt',id:1});state=step(state,{type:'approve',id:1});
 state=step(state,{type:'save',input:invoice(2,'EU-1',{currency:'EUR',taxRate:20,items:[{productId:'101',quantity:2,unitPrice:'10',discount:10}]})});
 state=step(state,{type:'approve',id:2});
 assert.equal(state.documents[1].exchangeRate,40);
 assert.equal(state.products[0].actualPurchaseCostTry,36000);
 assert.equal(balance(state,'501','EUR'),2160);
 assert.equal(balance(state,'501','TRY'),0);
});

test('partial invoices track remaining quantity, cost, currency and cancellation',()=>{
 let state=step(seedOperations(),{type:'save',input:receipt()});
 state=step(state,{type:'submit-receipt',id:1});state=step(state,{type:'approve',id:1});
 assert.throws(()=>step(state,{type:'save',input:invoice(2,'')}),/numarası zorunlu/);
 state=step(state,{type:'save',input:invoice(2)});state=step(state,{type:'approve',id:2});
 assert.equal(state.products[0].stock,25);assert.equal(state.products[0].actualPurchaseCostTry,9000);
 assert.equal(balance(state,'501','TRY'),21600);assert.match(deriveWorkflowTasks(state).find(t=>t.id==='bill-1').detail,/3 paket/);
 state=step(state,{type:'save',input:invoice(4,'A-2',{currency:'USD',taxRate:0})});
 assert.throws(()=>step(state,{type:'approve',id:3}),/kalan adedini/);
 state=step(state,{type:'save',id:3,input:invoice(3,'A-2',{currency:'USD',taxRate:0})});
 state=step(state,{type:'approve',id:3});
 assert.equal(state.documents[2].exchangeRate,null);assert.equal(state.products[0].actualPurchaseCostTry,9000);
 assert.equal(state.products[0].stock,25);assert.ok(!deriveWorkflowTasks(state).some(t=>t.id==='bill-1'));
 const duplicate=step(state,{type:'save',input:invoice(1,'a-1')});
 assert.throws(()=>step(duplicate,{type:'approve',id:4}),/zaten kullanıldı/);
 state=step(state,{type:'cancel',id:3,reason:'Fatura iadesi'});
 assert.equal(state.products[0].actualPurchaseCostTry,9000);assert.match(deriveWorkflowTasks(state).find(t=>t.id==='bill-1').detail,/3 paket/);
 state=step(state,{type:'cancel',id:2,reason:'İskonto düzeltmesi'});
 assert.equal(state.products[0].actualPurchaseCostTry,null);assert.equal(balance(state,'501','TRY'),0);
 assert.equal(state.products[0].stock,25);
 state=step(state,{type:'cancel',id:1,reason:'Sayım iptali'});assert.equal(state.products[0].stock,20);
});
