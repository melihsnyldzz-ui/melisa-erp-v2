import test from 'node:test';
import assert from 'node:assert/strict';
import {seedOperations,transitionOperations,balance,today} from './operationsStore.js';
const card=(state,entity,input,id)=>transitionOperations(state,{type:'save-card',entity,input,id});
const product={name:'Örnek Yeni Ürün',code:'YENI-1',barcode:'000123456789012345',supplierId:'501',cost:'10.25',salePrice:'20.50'};
test('created masters join receipt, purchase and sale without initial balance writes',()=>{
 let s=card(seedOperations(),'suppliers',{name:'Demo Yeni Tedarikçi'});const supplier=s.suppliers.at(-1).id;
 s=card(s,'customers',{name:'Demo Yeni Müşteri',phone:'+90 000',country:'TR'});const customer=s.customers.at(-1).id;
 s=card(s,'products',{...product,supplierId:supplier,stock:999});const p=s.products.at(-1);
 assert.equal(p.stock,0);assert.equal(p.barcode,product.barcode);assert.equal(s.movements.length,0);
 const post=input=>{s=transitionOperations(s,{type:'save',input:{date:today(),currency:'TRY',...input}});const id=s.nextId-1;s=transitionOperations(s,{type:'approve',id});return id;};
 const receipt=post({kind:'receipt',partyId:supplier,items:[{productId:p.id,quantity:10}]});
 post({kind:'purchase',partyId:supplier,referenceId:receipt,items:[{productId:p.id,quantity:10,unitPrice:'10.25'}]});
 post({kind:'sale',partyId:customer,items:[{productId:p.id,quantity:2,unitPrice:'20.50'}]});
 assert.equal(s.products.at(-1).stock,8);assert.equal(balance(s,supplier,'TRY'),10250);assert.equal(balance(s,customer,'TRY'),4100);
 assert.throws(()=>card(s,'products',product,p.id),/tedarikçisi/);
 const edited=card(s,'products',{...product,name:'Güncel Ürün',supplierId:supplier,cost:'12',stock:200},p.id);
 assert.equal(edited.products.at(-1).stock,8);assert.deepEqual(edited.movements,s.movements);
 assert.equal(edited.cardAudit.at(-1).before.name,product.name);
});
test('duplicate codes and barcodes reject atomically; invalid IDs and money reject',()=>{
 const original=seedOperations(),s=card(original,'products',product);
 assert.throws(()=>card(s,'products',{...product,code:'yeni-1'}),/stok kodu/);
 assert.throws(()=>card(s,'products',{...product,code:'YENI-2'}),/barkod/);
 assert.throws(()=>card(s,'products',{...product,code:'YENI-2',barcode:'2',cost:'1.001'}),/ondalık/);
 assert.throws(()=>card(s,'customers',{name:'Yeni'},'missing'),/bulunamadı/);
 assert.throws(()=>card(s,'cash',{name:'Yeni'}),/türü/);
 assert.equal(original.products.length,3);assert.equal(s.products.length,4);assert.equal(s.cardAudit.length,1);
});
