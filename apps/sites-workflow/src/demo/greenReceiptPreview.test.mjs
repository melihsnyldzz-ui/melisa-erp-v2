import test from 'node:test';
import assert from 'node:assert/strict';
import '../../public/workflow-settlement.js';
const api=globalThis.MelisaReceiptPreview;
test('green receipt keeps product quantities and cents accurate through partial payment and dispatch',()=>{
 const r=api.sample();
 assert.equal(api.total(r),129660);assert.equal(r.items.reduce((n,i)=>n+i.qty,0),114);
 assert.equal(new Map(api.summary(r)).get('Takım'),20);
 assert.throws(()=>api.ship(r,'İlker'));
 api.collect(r,100000,'Nakit','İlker');assert.equal(api.remaining(r),29660);
 assert.throws(()=>api.collect(r,30000,'Banka','İlker'));
 assert.throws(()=>api.approve(r,api.today(),'Satış'));
 api.approve(r,api.today(),'İlker');assert.ok(api.ready(r));assert.equal(r.approval.actor,'İlker');assert.ok(Date.parse(r.approval.at));
 const items=JSON.stringify(r.items);api.ship(r,'İlker');
 assert.equal(JSON.stringify(r.items),items);assert.equal(api.total(r),129660);assert.equal(api.remaining(r),29660);
 assert.throws(()=>api.ship(r,'İlker'));
 api.collect(r,29660,'Banka','İlker');assert.equal(api.remaining(r),0);assert.equal(api.paid(r),129660);
});
test('approval has no amount cap; sales role cannot collect or approve',()=>{
 const r=api.create('TEST','Örnek',[{code:'A',name:'Takım',category:'Takım',qty:10,price:100000}]);
 assert.throws(()=>api.collect(r,100,'Nakit','Satış'));
 assert.throws(()=>api.approve(r,'2020-01-01','İlker'));
 api.approve(r,api.today(),'İlker');assert.equal(r.approval.amount,100000000);assert.ok(api.ready(r));
});
test('customer transfer preserves the receipt, payment, approval and shipment trail',()=>{
 const r=api.sample();api.collect(r,100000,'Nakit','İlker');api.approve(r,api.today(),'İlker');api.ship(r,'İlker');
 const before={total:api.total(r),paid:api.paid(r),remaining:api.remaining(r),items:JSON.stringify(r.items),shipment:JSON.stringify(r.shipment)};
 assert.throws(()=>api.transferCustomer(r,'Alfa Kids · USD','Satış'));
 api.transferCustomer(r,'Alfa Kids · USD','İlker');
 assert.equal(r.customer,'Alfa Kids · USD');assert.deepEqual([api.total(r),api.paid(r),api.remaining(r),JSON.stringify(r.items),JSON.stringify(r.shipment)],[before.total,before.paid,before.remaining,before.items,before.shipment]);
 assert.equal(r.customerHistory.length,1);assert.deepEqual([r.customerHistory[0].from,r.customerHistory[0].to,r.customerHistory[0].actor],['Peşin Dolar','Alfa Kids · USD','İlker']);
 assert.throws(()=>api.transferCustomer(r,'Alfa Kids · USD','İlker'));
});
