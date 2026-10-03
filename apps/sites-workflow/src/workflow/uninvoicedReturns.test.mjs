import test from 'node:test';import assert from 'node:assert/strict';
import {initialOperations,acceptGoods,addPurchase,savePurchaseDraft,finalizePurchaseDraft,stockQuantity,invoiceableQuantity,requestUninvoicedReturn,decideSupplierReturn,supplierBalance} from './demoOperationsModel.js';
const seed=()=>{const s=initialOperations([['M-100','Triko','6',0,10,'Aktif','Takım']]);acceptGoods(s,'MK-00418','İlker');return s};
const purchase=(s,quantity,number='F1')=>addPurchase(s,{goodsId:'MK-00418',number,date:'2026-09-28',currency:'USD',quantity,priceCents:100,vatCents:0},'İlker');
const request=(s,quantity)=>requestUninvoicedReturn(s,{goodsId:'MK-00418',quantity,reason:'Hatalı ürün'},'Satış');
test('uninvoiced return reserves only remaining unbilled goods; approval reduces stock once without debt',()=>{
 const s=seed();purchase(s,100);const r=request(s,15);assert.equal(invoiceableQuantity(s,'MK-00418'),5);assert.equal(stockQuantity(s,'M-100'),120);assert.equal(supplierBalance(s,'Concept','USD'),10000);
 assert.throws(()=>request(s,6));assert.throws(()=>purchase(s,6,'F2'));purchase(s,5,'F2');
 for(const actor of ['Satış','Angela'])assert.throws(()=>decideSupplierReturn(s,r.id,true,actor));
 decideSupplierReturn(s,r.id,true,'İlker');assert.equal(stockQuantity(s,'M-100'),105);assert.equal(supplierBalance(s,'Concept','USD'),10500);assert.equal(invoiceableQuantity(s,'MK-00418'),0);assert.equal(s.goods[0].qty,120);
 const persisted=JSON.parse(JSON.stringify(s));assert.equal(stockQuantity(persisted,'M-100'),105);assert.throws(()=>decideSupplierReturn(persisted,r.id,true,'Semih'));assert.throws(()=>request(persisted,1));
});
test('rejection releases invoice reservation without stock/debt change and detailed invoice obeys reservation',()=>{
 const s=seed(),r=request(s,20);const d=savePurchaseDraft(s,{supplier:'Concept',reference:'R1',currency:'USD',documentNumber:'F1',documentDate:'2026-09-28',documentCurrency:'USD',lines:[{code:'M-100',qty:110,priceCents:100}],discountBps:0,vatCents:0,documentTotalCents:11000},'İlker');
 const before=structuredClone(s);assert.throws(()=>finalizePurchaseDraft(s,d.id,['MK-00418'],'İlker'));assert.deepEqual(s,before);
 decideSupplierReturn(s,r.id,false,'Semih');assert.equal(invoiceableQuantity(s,'MK-00418'),120);assert.equal(stockQuantity(s,'M-100'),120);assert.equal(supplierBalance(s,'Concept','USD'),0);finalizePurchaseDraft(s,d.id,['MK-00418'],'İlker');assert.equal(invoiceableQuantity(s,'MK-00418'),10);
});
test('invalid requests and insufficient stock fail without partial writes; pending acceptance cannot return',()=>{
 const s=seed();for(const quantity of [0,-1,1.5,121,NaN]){const before=structuredClone(s);assert.throws(()=>request(s,quantity));assert.deepEqual(s,before)}
 const r=request(s,20),before=structuredClone(s);assert.throws(()=>decideSupplierReturn(s,r.id,true,'İlker',[{items:[{code:'M-100',qty:110}]}]));assert.deepEqual(s,before);assert.equal(r.state,'pending');
 const pending=initialOperations(s.products);assert.throws(()=>request(pending,1));
});
