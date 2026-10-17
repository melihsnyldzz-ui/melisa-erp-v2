import test from 'node:test';import assert from 'node:assert/strict';
import {initialOperations,ensureCustomers,customerForReceipt,saveCustomer,updateProduct,acceptGoods,addPurchase,stockQuantity,requestSupplierReturn,decideSupplierReturn,supplierBalance} from './demoOperationsModel.js';
import '../../public/workflow-settlement.js';const api=globalThis.MelisaReceiptPreview;
const seed=()=>initialOperations([['M-100','Triko','6’lı',24,10.5,'Aktif','Takım']]);
test('customer rename retains identity and historical receipt ownership; duplicates and role changes reject',()=>{
 const s=seed();ensureCustomers(s);const c=saveCustomer(s,{name:'Test müşteri',currency:'USD'},'İlker'),r=api.create('SF-1',c.name,[{code:'M-100',qty:1,price:10}]);
 saveCustomer(s,{...c,name:'Yeni isim'},'İlker');assert.equal(customerForReceipt(s,r).id,c.id);assert.equal(customerForReceipt(s,r).name,'Yeni isim');
 assert.throws(()=>saveCustomer(s,{name:'Test müşteri',currency:'USD'},'İlker'));assert.throws(()=>saveCustomer(s,{...c,currency:'EUR'},'İlker'));assert.throws(()=>saveCustomer(s,{name:'Başka müşteri',currency:'USD'},'Satış'));
});
test('price update preserves inventory and prior receipt, records history and checks authority',()=>{
 const s=seed(),r=api.create('SF-1','Peşin Dolar',[{code:'M-100',qty:2,price:10.5}]),d={name:'Yeni ürün adı',priceCents:1400,reason:'Yeni satış fiyatı',sizes:'6’lı',category:'Takım'};
 assert.throws(()=>updateProduct(s,'M-100',d,'Satış'));updateProduct(s,'M-100',d,'Angela');assert.equal(s.products[0][4],14);assert.equal(stockQuantity(s,'M-100',[r]),22);assert.equal(api.total(r),2100);assert.equal(s.products[0][7].priceHistory.length,1);
});
test('supplier return keeps invoice, waits approval, changes stock/debt exactly once and blocks excess',()=>{
 const s=seed();acceptGoods(s,'MK-00418','İlker');const p=addPurchase(s,{goodsId:'MK-00418',number:'F1',date:'2026-09-28',currency:'USD',quantity:3,priceCents:333,vatCents:1},'İlker');
 const a=requestSupplierReturn(s,{purchaseId:p.id,index:0,quantity:1,reason:'Yanlış ürün'},'Satış');assert.equal(stockQuantity(s,'M-100'),144);assert.equal(supplierBalance(s,'Concept','USD'),1000);assert.throws(()=>decideSupplierReturn(s,a.id,true,'Satış'));
 decideSupplierReturn(s,a.id,true,'İlker');assert.equal(stockQuantity(s,'M-100'),143);assert.equal(supplierBalance(s,'Concept','USD'),667);assert.throws(()=>decideSupplierReturn(s,a.id,true,'İlker'));
 const b=requestSupplierReturn(s,{purchaseId:p.id,index:0,quantity:2,reason:'Kalan iade'},'İlker');assert.throws(()=>requestSupplierReturn(s,{purchaseId:p.id,index:0,quantity:1,reason:'Fazla iade'},'İlker'));decideSupplierReturn(s,b.id,true,'İlker');assert.equal(supplierBalance(s,'Concept','USD'),0);assert.equal(s.purchases[0].total,1000);assert.equal(stockQuantity(s,'M-100'),141);
});
