import test from 'node:test';
import assert from 'node:assert/strict';
import '../../public/workflow-settlement.js';
const api=globalThis.MelisaReceiptPreview;
const make=(currency='USD')=>api.create('CHECK','Test',[{code:'A',name:'Test',qty:4,priceCents:api.priceInCurrency(1100,currency==='EUR'?'0.9':currency==='TRY'?'40':'1')}],currency);
test('USD EUR TRY receipts retain their currency across collection return refund correction and cancellation',()=>{
 for(const c of ['USD','EUR','TRY']){const r=make(c),original=api.total(r);api.collect(r,original,'Banka','İlker');const row=api.requestReturn(r,0,1,'Beden iadesi','Satış');api.decideReturn(r,row.id,true,'İlker');assert.equal(api.credit(r),original/4);api.refund(r,original/4,'Banka','Semih');assert.equal(api.credit(r),0);assert.equal(r.currency,c);const other=make(c);api.correctLine(other,0,2,other.items[0].priceCents,'Adet düzeltme','İlker');assert.equal(api.total(other),original/2);api.cancel(other,'Hatalı fiş','Semih');assert.equal(api.total(other),0);assert.equal(other.currency,c);}
 const rows=['USD','EUR','TRY'].map(make);assert.deepEqual(api.currencyTotals(rows,api.total),{USD:4400,EUR:3960,TRY:176000});
 assert.equal(api.priceInCurrency(1050,'0,9'),945);assert.equal(api.priceInCurrency(101,'0.5'),51);
 for(const rate of ['','0','-1','Infinity','1.1234567'])assert.throws(()=>api.priceInCurrency(100,rate));assert.throws(()=>make('XXX'));
});
test('receipt authority matrix permits only the defined example role actions',()=>{
 for(const actor of ['Satış','İlker','Angela','Semih']){
  const office=['İlker','Semih'].includes(actor),manager=['Angela','Semih'].includes(actor);
  for(const action of [r=>api.collect(r,100,'Nakit',actor),r=>api.approve(r,api.today(),actor),r=>api.correctLine(r,0,2,1100,'Adet hatası',actor),r=>api.cancel(r,'Yanlış fiş',actor),r=>api.transferCustomer(r,'Yeni',actor,['Yeni'])]){const r=make();if(office)assert.doesNotThrow(()=>action(r));else assert.throws(()=>action(r));}
  const r=make();api.requestDiscount(r,400,'Özel indirim',actor);if(manager)api.decideDiscount(r,true,actor);else assert.throws(()=>api.decideDiscount(r,true,actor));
  const ret=make();const row=api.requestReturn(ret,0,1,'İade kontrolü',actor);if(office)api.decideReturn(ret,row.id,true,actor);else assert.throws(()=>api.decideReturn(ret,row.id,true,actor));
  const ship=make();api.collect(ship,api.total(ship),'Nakit','İlker');if(office)api.ship(ship,actor);else assert.throws(()=>api.ship(ship,actor));
  const refund=make();api.collect(refund,api.total(refund),'Nakit','İlker');api.cancel(refund,'Yanlış fiş','İlker');if(office)api.refund(refund,100,'Nakit',actor);else assert.throws(()=>api.refund(refund,100,'Nakit',actor));
 }
});
