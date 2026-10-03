import { before, after, mock } from 'node:test';
before(()=>mock.timers.enable({apis:['Date'],now:new Date('2026-09-26T12:00:00Z')}));
after(()=>mock.timers.reset());
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations as step, deriveWorkflowTasks } from './operationsStore.js';
import { microExportContract, remainingToShip } from './operationsShipping.js';
import { orderOutput, saleOutput, shipmentOutput, statementOutput, receiptOutput } from './operationsOutput.js';

const date='2026-09-26';
function paidOrder(){let s=step(seedOperations(),{type:'save-order',input:{date,validUntil:'2026-10-02',customerId:'201',currency:'TRY',taxRate:10,items:[{productId:'101',quantity:3,unitPrice:'100'},{productId:'102',quantity:1,unitPrice:'200'}]}});for(let n=0;n<3;n++)s=step(s,{type:'advance-order',id:1});return step(s,{type:'record-order-payment',id:1,amount:'550',channel:'BANK'});}
const pack=(code,quantity,remainingNote='Kalan paket sonraki kolide')=>({type:'pack-order',id:1,checkedBy:'Depo',note:'Koli barkodları sayıldı',differenceReason:remainingNote,checked:{'101':quantity,'102':0},boxes:[{code,items:[{productId:'101',quantity}]}]});
const ship=(code,address='Berlin teslimat deposu')=>({type:'ship-order',id:1,address,carrier:'Örnek kargo',trackingNumber:code,shipDate:date});

test('two partial shipments use checked boxes, original totals and delivery confirmation',()=>{
 let s=paidOrder();assert.equal(s.products[0].stock,17);
 assert.throws(()=>step(s,{...pack('K-1',1),checked:{'101':2,'102':0}}),/kontrol edilen adet/);
 assert.throws(()=>step(s,{...pack('K-1',1),differenceReason:''}),/fark nedenini/);
 s=step(s,pack('K-1',1));assert.equal(s.orders[0].status,'PACKING');
 assert.throws(()=>step(s,ship('T-1','')),/adres/);
 s=step(s,ship('T-1'));assert.equal(s.orders[0].fulfillment.shipments[0].amount,11000);assert.equal(s.products[0].stock,17);
 assert.equal(remainingToShip(s,s.orders[0]).find(l=>l.productId==='101').remaining,2);
 assert.ok(deriveWorkflowTasks(s).some(t=>t.id==='order-pack-1'));assert.ok(deriveWorkflowTasks(s).some(t=>t.id==='order-delivery-1-1'));
 s=step(s,{...pack('K-2',2),checked:{'101':2,'102':1},boxes:[{code:'K-2',items:[{productId:'101',quantity:2},{productId:'102',quantity:1}]}],differenceReason:''});
 assert.throws(()=>step(s,ship('T-1')),/takip numarası/);
 s=step(s,ship('T-2'));assert.equal(s.orders[0].fulfillment.shipments[1].amount,44000);
 assert.throws(()=>step(s,{type:'confirm-delivery',id:1,shipmentId:2,deliveredDate:'2026-09-25',receivedBy:'Depo'}),/Teslim tarihi/);
 s=step(s,{type:'confirm-delivery',id:1,shipmentId:1,deliveredDate:date,receivedBy:'Berlin depo'});assert.equal(s.orders[0].status,'SHIPPED');
 s=step(s,{type:'confirm-delivery',id:1,shipmentId:2,deliveredDate:date,receivedBy:'Berlin depo'});assert.equal(s.orders[0].status,'COMPLETED');
 assert.equal(s.orders[0].fulfillment.shipments.reduce((sum,item)=>sum+item.amount,0),s.orders[0].amount);
 assert.equal(remainingToShip(s,s.orders[0]).reduce((sum,l)=>sum+l.remaining,0),0);
 assert.ok(!deriveWorkflowTasks(s).some(t=>t.id.startsWith('order-')));
});

test('unconfirmed shipment void restores capacity once and keeps tracking history',()=>{
 let s=paidOrder();s=step(s,pack('K-1',1));s=step(s,ship('T-1'));
 assert.throws(()=>step(s,{type:'void-shipment',id:1,shipmentId:1,reason:''}),/gerekçeyle/);
 s=step(s,{type:'void-shipment',id:1,shipmentId:1,reason:'Taşıyıcı etiketi iptal etti'});
 assert.equal(s.orders[0].status,'PAID');assert.equal(remainingToShip(s,s.orders[0])[0].remaining,3);
 assert.throws(()=>step(s,{type:'confirm-delivery',id:1,shipmentId:1,deliveredDate:date,receivedBy:'Depo'}),/bekleyen sevk/);
 assert.throws(()=>step(s,pack('K-1',1)),/Koli kodu/);
});

test('outputs share source quantity, currency, receipt and shipment contract',()=>{
 let s=paidOrder(),o=s.orders[0];
 assert.equal(orderOutput(s,o).rows.reduce((sum,l)=>sum+Number(l.net),0),500);
 assert.equal(saleOutput(s,s.documents.find(d=>d.id===o.saleDocumentId)).rows[0].quantity,3);
 s=step(s,pack('K-1',1));s=step(s,ship('T-1'));o=s.orders[0];
 const output=shipmentOutput(s,o,o.fulfillment.shipments[0]);assert.equal(output.rows[0].quantity,1);assert.equal(output.rows[0].currency,'TRY');assert.match(output.subtitle,/110.00 TRY/);
 const contract=microExportContract(s,o);assert.equal(contract.schema,'melisa.micro-export.v1');assert.equal(contract.shipments[0].boxes[0].items[0].quantity,1);
 assert.equal(receiptOutput(s,s.documents.find(d=>d.kind==='order-payment')).rows[0].amount,'550.00');
 assert.equal(statementOutput(s,'201','TRY').rows.at(-1).balance,'0.00');
});
