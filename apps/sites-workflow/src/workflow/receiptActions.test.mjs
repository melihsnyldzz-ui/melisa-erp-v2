import test from 'node:test';
import assert from 'node:assert/strict';
import '../../public/workflow-settlement.js';
import {initialOperations,stockQuantity,acceptGoods,savePurchaseDraft,finalizePurchaseDraft,invoicedQuantity} from './demoOperationsModel.js';
const api=globalThis.MelisaReceiptPreview;
const receipt=()=>api.create('SF-T','Peşin Dolar',[{code:'M-100',name:'Triko',category:'Takım',qty:10,priceCents:1000}]);
test('return approval credits the customer, restores stock once and preserves payment/refund history',()=>{
 const r=receipt(),s=initialOperations([['M-100','Triko','',24,10,'Aktif','Takım']]);api.collect(r,10000,'Nakit','İlker');
 const row=api.requestReturn(r,0,3,'Yanlış beden','Satış');assert.equal(api.total(r),10000);assert.equal(stockQuantity(s,'M-100',[r]),14);
 assert.throws(()=>api.decideReturn(r,row.id,true,'Satış'));api.decideReturn(r,row.id,true,'İlker');
 assert.equal(stockQuantity(s,'M-100',[r]),17);assert.equal(api.total(r),7000);assert.equal(api.credit(r),3000);assert.equal(api.remaining(r),0);
 assert.throws(()=>api.decideReturn(r,row.id,true,'İlker'));assert.throws(()=>api.requestReturn(r,0,8,'Fazla miktar','Satış'));
 api.refund(r,3000,'Nakit','İlker');assert.equal(api.credit(r),0);assert.equal(r.payments.length,1);assert.equal(r.refunds.length,1);assert.throws(()=>api.refund(r,1,'Nakit','İlker'));
});
test('discount authorization and rounding remain exact across split returns',()=>{
 const r=api.create('SF-2','Peşin Dolar',[{code:'M-100',name:'A',qty:3,priceCents:101},{code:'M-142',name:'B',qty:7,priceCents:99}]);
 api.requestDiscount(r,300,'Satış indirimi','Satış');const old=api.total(r);api.requestDiscount(r,500,'Müdür onayı','Satış');assert.equal(api.total(r),old);
 assert.throws(()=>api.decideDiscount(r,true,'İlker'));api.decideDiscount(r,true,'Angela');assert.equal(api.total(r),946);
 for(const [index,qty] of [[0,1],[0,2],[1,3],[1,4]]){const row=api.requestReturn(r,index,qty,'İade sayıldı','Satış');api.decideReturn(r,row.id,true,'İlker')}
 assert.equal(api.total(r),0);assert.equal(api.ready(r),false);
});
test('correction and cancellation preserve original payment and reverse only their own stock effect',()=>{
 const r=receipt(),s=initialOperations([['M-100','Triko','',24,10,'Aktif','Takım']]);api.collect(r,10000,'Nakit','İlker');
 api.correctLine(r,0,8,1000,'Miktar hatası','İlker');assert.equal(stockQuantity(s,'M-100',[r]),16);assert.equal(api.credit(r),2000);assert.equal(r.history[0].details.before.qty,10);
 api.cancel(r,'Yanlış fiş','İlker');assert.equal(stockQuantity(s,'M-100',[r]),24);assert.equal(api.credit(r),10000);assert.throws(()=>api.cancel(r,'Yeniden','İlker'));assert.throws(()=>api.collect(r,1,'Nakit','İlker'));
});
test('detailed purchase validates all allocations before posting, preserves null VAT and never adds stock twice',()=>{
 const s=initialOperations([['M-100','Triko','',24,10,'Aktif','Takım']]);acceptGoods(s,'MK-00418','İlker');
 const data={supplier:'Concept',reference:'LISTE-1',currency:'USD',discountBps:100,lines:[{code:'M-100',qty:40,priceCents:1000},{code:'M-100',qty:32,priceCents:1200}],documentNumber:'F-1',documentDate:'2026-09-28',documentCurrency:'USD',documentTotalCents:77616,vatCents:null};
 const d=savePurchaseDraft(s,data,'İlker');assert.equal(d.vatCents,null);assert.throws(()=>finalizePurchaseDraft(s,d.id,['MK-00418','MK-00418'],'İlker'));
 const corrected=savePurchaseDraft(s,{...data,id:d.id,vatCents:0},'İlker');finalizePurchaseDraft(s,corrected.id,['MK-00418','MK-00418'],'İlker');assert.equal(s.purchases[0].total,77616);assert.equal(invoicedQuantity(s,'MK-00418'),72);assert.equal(stockQuantity(s,'M-100'),144);assert.throws(()=>finalizePurchaseDraft(s,d.id,['MK-00418','MK-00418'],'İlker'));
});
