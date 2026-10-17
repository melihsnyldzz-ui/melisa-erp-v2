import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations as run, balance, deriveWorkflowTasks, reservedQuantity } from './operationsStore.js';
import { returnableLines } from './operationsCorrections.js';

const date='2026-09-26';
const input=(kind,extra={})=>({kind,date,currency:'TRY',partyId:['sale','sales-return','delivery-correction','collection','customer-refund'].includes(kind)?'201':'501',reason:'Kontrol edildi',items:[],...extra});
function save(s,kind,extra={}){return run(s,{type:'save',input:input(kind,extra)});}
function approve(s,id=s.nextId-1){return run(s,{type:'approve',id});}
function post(s,kind,extra={}){return approve(save(s,kind,extra));}
const line=(id,quantity,unitPrice='100')=>({productId:id,quantity,unitPrice});
const flow=(code='WRONG',boxCount='1')=>({reasonCode:code,boxCount,countedBy:'Satış personeli',note:'Koli ve kaynak fiş karşılaştırıldı'});

test('physical return and missing delivery share the original discounted tax ceiling',()=>{
 let s=post(seedOperations(),'sale',{taxRate:'10',items:[{...line('101',2),discount:3}]});
 const source=s.documents[0],original=source.amount;
 s=save(s,'sales-return',{referenceId:source.id,items:[line('101',1)],returnFlow:flow()});
 assert.throws(()=>approve(s),/muhasebe incelemesine/);
 s=run(s,{type:'submit-review',id:2});s=approve(s);
 assert.equal(s.documents[1].amount,original/2);
 assert.equal(s.documents[1].items[0].unitPrice,source.items[0].unitPrice);
 assert.equal(s.documents[1].items[0].discount,3);
 s=save(s,'delivery-correction',{referenceId:source.id,items:[line('101',1)],returnFlow:flow('MISSING','0')});
 s=run(s,{type:'submit-review',id:3});s=approve(s);
 assert.equal(s.documents[2].amount,original/2);
 assert.equal(balance(s,'201','TRY'),0);
 assert.equal(returnableLines(s,source,'sales-return')[0].remaining,0);
 assert.throws(()=>save(s,'sales-return',{referenceId:source.id,items:[line('101',1)],returnFlow:flow('MISSING')}),/düzeltme belgesi/);
 const excess=save(s,'sales-return',{referenceId:source.id,items:[line('101',1)],returnFlow:flow()});
 assert.throws(()=>approve(run(excess,{type:'submit-review',id:4}),4),/kalan belge/);
});

test('return review can be sent back with reason and corrected without posting twice',()=>{
 let s=post(seedOperations(),'sale',{items:[line('101',1)]});
 s=save(s,'sales-return',{referenceId:1,items:[line('101',1)],returnFlow:flow('EXCESS')});
 s=run(s,{type:'submit-review',id:2});
 assert.throws(()=>run(s,{type:'save',id:2,input:input('sales-return',{referenceId:1,items:[line('101',1)],returnFlow:flow('WRONG')})}),/gerekçeli geri/);
 s=run(s,{type:'return-review',id:2,reason:'Kolideki model uyuşmadı'});
 assert.throws(()=>run(s,{type:'approve',id:2}),/muhasebe incelemesine/);
 s=run(s,{type:'save',id:2,input:input('sales-return',{referenceId:1,items:[line('101',1)],returnFlow:flow('WRONG'),correctionReason:'Model tekrar sayıldı'})});
 s=run(s,{type:'submit-review',id:2});s=approve(s,2);
 assert.equal(s.documents[1].returnFlow.history.length,4);
 assert.equal(s.products[0].stock,20);
 assert.equal(balance(s,'201','TRY'),0);
});

test('count requires investigation and only changed counted products trigger recount',()=>{
 let s=save(seedOperations(),'count',{items:[line('101',19)],countSession:{countedBy:'Depo',note:'Raf sayıldı',investigation:{}}});
 assert.throws(()=>run(s,{type:'submit-review',id:1}),/fark nedenini/);
 s=run(s,{type:'save',id:1,input:input('count',{items:[line('101',19)],countSession:{countedBy:'Depo',note:'Raf sayıldı',investigation:{'101':'Bir paket eksik'}}})});
 s=run(s,{type:'submit-review',id:1});
 s=post(s,'sale',{items:[line('102',1)]});
 s=approve(s,1);
 assert.equal(s.products[0].stock,19);
 assert.equal(s.products[1].stock,11);
 let t=save(s,'count',{items:[line('101',18)],countSession:{countedBy:'Depo',note:'Tekrar',investigation:{'101':'Fark bulundu'}}});
 t=run(t,{type:'submit-review',id:3});
 t=post(t,'sale',{items:[line('101',1)]});
 assert.throws(()=>approve(t,3),/stoku değişti/);
 assert.equal(t.products[0].stock,18);
});

test('unrelated sale can be cancelled out of order; allocated invoice remains protected',()=>{
 let s=post(seedOperations(),'sale',{items:[line('101',1)]});
 s=post(s,'sale',{items:[line('102',1)]});
 s=run(s,{type:'cancel',id:1,reason:'Yanlış müşteri'});
 assert.equal(s.products[0].stock,20);
 assert.equal(s.products[1].stock,11);
 assert.equal(balance(s,'201','TRY'),10000);
 s=post(s,'collection',{channel:'BANK',amount:'50',settlementDocumentId:2});
 assert.throws(()=>run(s,{type:'cancel',id:2,reason:'Test'}),/bağlı/);
 s=run(s,{type:'cancel',id:3,reason:'Banka işlemi düzeltildi'});
 s=run(s,{type:'cancel',id:2,reason:'Satış iptal'});
 assert.equal(balance(s,'201','TRY'),0);
});

test('refund dependency and later stock count prevent unsafe return cancellation',()=>{
 let s=post(seedOperations(),'sale',{items:[line('101',1)]});
 s=post(s,'collection',{amount:'100',channel:'BANK'});
 s=post(s,'sales-return',{referenceId:1,items:[line('101',1)]});
 s=post(s,'customer-refund',{amount:'100',channel:'BANK'});
 assert.throws(()=>run(s,{type:'cancel',id:3,reason:'Geri al'}),/geri ödeme/);
 s=run(s,{type:'cancel',id:4,reason:'Geri ödeme düzeltildi'});
 s=post(s,'count',{items:[line('101',20)]});
 assert.throws(()=>run(s,{type:'cancel',id:3,reason:'Geri al'}),/sonraki sayım/);
});

test('returned order cannot pack returned units but still allows the remaining units',()=>{
 let s=run(seedOperations(),{type:'save-order',input:{date,validUntil:'2026-10-02',customerId:'201',currency:'TRY',taxRate:0,items:[line('101',2)]}});
 for(let n=0;n<3;n++)s=run(s,{type:'advance-order',id:1});
 s=run(s,{type:'record-order-payment',id:1,amount:'200',channel:'BANK'});
 assert.equal(s.orders[0].status,'PAID');
 s=post(s,'sales-return',{referenceId:s.orders[0].saleDocumentId,items:[line('101',1)]});
 const pack={type:'pack-order',id:1,boxes:[{code:'K-1',items:[{productId:'101',quantity:2}]}],checked:{'101':2},checkedBy:'Depo',note:'İade sonrası sayım'};
 assert.throws(()=>run(s,pack),/kalan sevk adedini/);
 assert.match(deriveWorkflowTasks(s).find(t=>t.id==='order-pack-1').title,/1 paket/);
 s=run(s,{...pack,boxes:[{code:'K-1',items:[{productId:'101',quantity:1}]}],checked:{'101':1}});assert.equal(s.orders[0].status,'PACKING');
});

test('count difference cannot consume stock reserved for an active order',()=>{
 let s=run(seedOperations(),{type:'save-order',input:{date,validUntil:'2026-10-02',customerId:'201',currency:'TRY',taxRate:0,items:[line('101',5)]}});
 for(let n=0;n<3;n++)s=run(s,{type:'advance-order',id:1});
 assert.equal(reservedQuantity(s,'101'),5);
 s=save(s,'count',{items:[line('101',4)],countSession:{countedBy:'Depo',note:'Raf ve ayrılan koli sayıldı',investigation:{'101':'Ayrılmış koliler elde görünmüyor'}}});
 s=run(s,{type:'submit-review',id:s.nextId-1});
 assert.throws(()=>approve(s),/ayrılmış ürünler tüketilemez/);
 assert.equal(s.products[0].stock,20);
});
