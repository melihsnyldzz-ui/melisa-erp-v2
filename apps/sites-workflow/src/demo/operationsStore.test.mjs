import { before, after, mock } from 'node:test';
before(()=>mock.timers.enable({apis:['Date'],now:new Date('2026-09-26T12:00:00Z')}));
after(()=>mock.timers.reset());
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedOperations,transitionOperations as transition,balance,deriveWorkflowTasks,availableStock,reservedQuantity} from './operationsStore.js';
const input=(kind,extra={})=>({kind,date:'2026-09-26',currency:'TRY',partyId:['sale','collection','customer-refund'].includes(kind)?'201':'501',amount:'100',reason:'Demo kontrolü',items:[{productId:'101',quantity:'10',unitPrice:'164'}],...extra});
function save(s,p){return transition(s,{type:'save',input:p});}
function approve(s,id=s.nextId-1){return transition(s,{type:'approve',id});}
function post(s,p){return approve(save(s,p));}
test('complete receipt → purchase → sale → collection → payment → returns → count chain reconciles',()=>{
 let s=seedOperations();s=save(s,input('receipt'));assert.equal(s.products[0].stock,20);s=approve(s);assert.equal(s.products[0].stock,30);
 s=post(s,input('purchase',{referenceId:1}));assert.equal(s.products[0].stock,30);assert.equal(balance(s,'501','TRY'),164000);
 s=post(s,input('sale',{items:[{productId:'101',quantity:'4',unitPrice:'285'}]}));assert.equal(s.products[0].stock,26);assert.equal(balance(s,'201','TRY'),114000);
 s=post(s,input('cash-open',{amount:'1000'}));s=post(s,input('collection',{amount:'500'}));s=post(s,input('payment',{amount:'600'}));assert.equal(s.cash.TRY,90000);assert.equal(balance(s,'201','TRY'),64000);assert.equal(balance(s,'501','TRY'),104000);
 s=post(s,input('sales-return',{referenceId:3,items:[{productId:'101',quantity:'1'}]}));assert.equal(s.products[0].stock,27);assert.equal(balance(s,'201','TRY'),35500);
 s=post(s,input('purchase-return',{referenceId:2,items:[{productId:'101',quantity:'2'}]}));assert.equal(s.products[0].stock,25);assert.equal(balance(s,'501','TRY'),71200);
 s=post(s,input('count',{items:[{productId:'101',quantity:'24'}]}));assert.equal(s.products[0].stock,24);
 const totalStock=s.movements.filter(m=>m.productId==='101').reduce((n,m)=>n+m.stockDelta,0);assert.equal(s.products[0].stock,20+totalStock);
 assert.equal(s.cash.TRY,s.movements.reduce((n,m)=>n+m.cashDelta,0));
 s=transition(s,{type:'cancel',id:9,reason:'Sayım tekrar edildi'});assert.equal(s.products[0].stock,25);
 assert.equal(transition(s,{type:'cancel',id:9,reason:'tekrar'}),s);
});
test('duplicate approval, stock shortage and excess returns cannot double-post or partially change state',()=>{
 let s=post(seedOperations(),input('sale',{items:[{productId:'101',quantity:'4',unitPrice:'100'}]}));assert.equal(approve(s,1),s);
 let bad=save(s,input('sale',{items:[{productId:'101',quantity:'99',unitPrice:'100'}]}));const before=structuredClone(bad);assert.throws(()=>approve(bad),/Yetersiz stok/);assert.deepEqual(bad,before);
 s=post(s,input('sales-return',{referenceId:1,items:[{productId:'101',quantity:'4'}]}));bad=save(s,input('sales-return',{referenceId:1,items:[{productId:'101',quantity:'1'}]}));assert.throws(()=>approve(bad),/kalan belge/);
});
test('receipt billing is single-use and exact; stale counts and unsupported payments fail',()=>{
 let s=post(seedOperations(),input('receipt'));
 assert.throws(()=>post(s,input('purchase',{referenceId:1,items:[{productId:'101',quantity:'9',unitPrice:'10'}]})),/aynı olmalı/);
 s=post(s,input('purchase',{referenceId:1}));assert.throws(()=>post(s,input('purchase',{referenceId:1})),/zaten faturalandı/);
 s=save(s,input('count'));const count=s.nextId-1;s=post(s,input('sale'));assert.throws(()=>approve(s,count),/başka işlem/);
 assert.throws(()=>post(s,input('collection')),/kasayı açın/);
 s=post(s,input('cash-open',{amount:'10'}));assert.throws(()=>post(s,input('payment',{amount:'100'})),/Kasa bakiyesi/);
 assert.throws(()=>post(s,input('collection',{currency:'EUR'})),/açık bakiye/);
});
test('partial returns preserve original discount and tax cents; currencies never mingle',()=>{
 let s=post(seedOperations(),input('sale',{currency:'EUR',taxRate:'10',items:[{productId:'101',quantity:'3',unitPrice:'0.05',discount:'3'}]}));
 const amount=s.documents[0].amount;
 for(let i=0;i<3;i++)s=post(s,input('sales-return',{referenceId:1,items:[{productId:'101',quantity:'1'}]}));
 assert.equal(balance(s,'201','EUR'),0);assert.equal(s.documents.slice(1).reduce((n,d)=>n+d.amount,0),amount);assert.equal(s.cash.TRY,0);assert.equal(s.cash.EUR,0);
});
test('legacy sale without manager policy cannot introduce a four percent discount',()=>{
 const state=seedOperations();
 assert.throws(()=>save(state,input('sale',{items:[{productId:'101',quantity:1,unitPrice:'285',discount:4}]})),/%3 üzeri satış iskontosu/);
});
test('invalid quantities, duplicate lines, mismatched supplier and invalid dates are rejected',()=>{
 const s=seedOperations();for(const qty of ['','-1','1.5','NaN'])assert.throws(()=>save(s,input('receipt',{items:[{productId:'101',quantity:qty}]})));
 assert.throws(()=>save(s,input('receipt',{partyId:'502'})),/tedarikçiye/);
 assert.throws(()=>save(s,input('receipt',{date:'2026-02-30'})),/tarihi/);
 assert.throws(()=>save(s,input('sale',{items:[{productId:'101',quantity:1,unitPrice:1},{productId:'101',quantity:1,unitPrice:1}]})),/tek satır/);
});
test('cancellation preserves dependency order and reverses the latest posting exactly',()=>{
 let s=post(seedOperations(),input('receipt'));s=post(s,input('purchase',{referenceId:1}));assert.throws(()=>transition(s,{type:'cancel',id:1,reason:'test'}),/bağlı/);
 s=transition(s,{type:'cancel',id:2,reason:'test'});assert.equal(balance(s,'501','TRY'),0);s=transition(s,{type:'cancel',id:1,reason:'test'});assert.equal(s.products[0].stock,20);
});
test('closing verifies all currencies, reopening preserves carry-forward instead of doubling cash',()=>{
 let s=post(seedOperations(),input('cash-open',{amount:'100'}));
 assert.throws(()=>post(s,input('cash-close',{counted:{TRY:'100',USD:'1',EUR:'0'}})),/sayımları/);
 s=post(s,input('cash-close',{counted:{TRY:'100',USD:'0',EUR:'0'}}));assert.equal(s.cashOpen,false);
 s=post(s,input('cash-open',{amount:'100'}));assert.equal(s.cash.TRY,10000);assert.equal(s.cashOpen,true);
});
test('an empty cash register opens with zero and accepts the first customer collection',()=>{
 let s=post(seedOperations(),input('cash-open',{amount:'0',reason:''}));
 assert.equal(s.cashOpen,true);assert.equal(s.cash.TRY,0);
 s=post(s,input('sale',{items:[{productId:'101',quantity:'1',unitPrice:'285'}]}));
 s=post(s,input('collection',{amount:'285'}));
 assert.equal(s.cash.TRY,28500);assert.equal(balance(s,'201','TRY'),0);
});
test('approved documents derive the next work and resolved effects remove it',()=>{
 let s=seedOperations();assert.deepEqual(deriveWorkflowTasks(s).map(t=>t.id),['cash-open']);
 s=save(s,input('receipt'));assert.ok(deriveWorkflowTasks(s).some(t=>t.id==='draft-1'));
 s=approve(s);let tasks=deriveWorkflowTasks(s);const bill=tasks.find(t=>t.id==='bill-1');assert.equal(bill.screenId,'purchase-invoice');assert.equal(bill.payload.referenceId,1);
 s=post(s,input('purchase',{referenceId:1}));tasks=deriveWorkflowTasks(s);assert.ok(!tasks.some(t=>t.id==='bill-1'));assert.ok(tasks.some(t=>t.id==='pay-501-TRY'));
 s=post(s,input('sale',{items:[{productId:'101',quantity:'4',unitPrice:'285'}]}));assert.ok(deriveWorkflowTasks(s).some(t=>t.id==='collect-201-TRY'));
 s=post(s,input('collection',{amount:'1140',channel:'BANK'}));assert.equal(balance(s,'201','TRY'),0);assert.ok(!deriveWorkflowTasks(s).some(t=>t.id==='collect-201-TRY'));
 s=post(s,input('payment',{amount:'1640',channel:'BANK'}));assert.equal(balance(s,'501','TRY'),0);assert.ok(!deriveWorkflowTasks(s).some(t=>t.id==='pay-501-TRY'));
});
test('bank/card finance settles ledgers without opening or changing physical cash',()=>{
 let s=post(seedOperations(),input('sale',{items:[{productId:'101',quantity:'1',unitPrice:'285'}]}));
 s=post(s,input('collection',{amount:'285',channel:'CARD'}));assert.equal(s.cashOpen,false);assert.equal(s.cash.TRY,0);assert.equal(balance(s,'201','TRY'),0);assert.equal(s.documents.at(-1).channel,'CARD');
 s=post(s,input('expense',{amount:'10',channel:'BANK'}));assert.equal(s.cash.TRY,0);
 assert.throws(()=>post(s,input('expense',{amount:'10',channel:'WIRE'})),/kanalı/);
 assert.throws(()=>post(s,input('expense',{amount:'10',channel:'CASH'})),/kasayı açın/);
});
test('paid returns trigger customer refund and supplier recovery until negative balances close',()=>{
 let s=post(seedOperations(),input('sale',{items:[{productId:'101',quantity:1,unitPrice:'100'}]}));
 s=post(s,input('collection',{amount:'100',channel:'BANK'}));
 s=post(s,input('sales-return',{referenceId:1,items:[{productId:'101',quantity:1}]}));
 assert.equal(balance(s,'201','TRY'),-10000);assert.ok(deriveWorkflowTasks(s).some(t=>t.id==='refund-customer-201-TRY'));
 s=post(s,input('customer-refund',{amount:'100',channel:'BANK'}));assert.equal(balance(s,'201','TRY'),0);assert.ok(!deriveWorkflowTasks(s).some(t=>t.id==='refund-customer-201-TRY'));
 s=post(s,input('receipt',{items:[{productId:'101',quantity:1}]}));const receipt=s.nextId-1;
 s=post(s,input('purchase',{referenceId:receipt,items:[{productId:'101',quantity:1,unitPrice:'100'}]}));const purchase=s.nextId-1;
 s=post(s,input('payment',{amount:'100',channel:'BANK'}));
 s=post(s,input('purchase-return',{referenceId:purchase,items:[{productId:'101',quantity:1}]}));
 assert.equal(balance(s,'501','TRY'),-10000);assert.ok(deriveWorkflowTasks(s).some(t=>t.id==='refund-supplier-501-TRY'));
 s=post(s,input('supplier-refund',{amount:'100',channel:'BANK'}));assert.equal(balance(s,'501','TRY'),0);
 assert.throws(()=>post(s,input('supplier-refund',{amount:'1',channel:'BANK'})),/iade bakiyesini/);
});
const orderInput=(extra={})=>({date:'2026-09-26',validUntil:'2026-09-29',customerId:'201',currency:'TRY',taxRate:'0',items:[{productId:'101',quantity:'5',unitPrice:'100',discount:'0'}],...extra});
const saveOrder=(s,input=orderInput())=>transition(s,{type:'save-order',input});
const advanceOrder=(s,id=1)=>transition(s,{type:'advance-order',id});
test('quotation reserves only after customer approval and protects allocated stock',()=>{
 let s=saveOrder(seedOperations());assert.equal(reservedQuantity(s,'101'),0);assert.equal(availableStock(s,'101'),20);
 s=advanceOrder(s);s=advanceOrder(s);assert.equal(s.orders[0].status,'CUSTOMER_APPROVAL');assert.equal(reservedQuantity(s,'101'),0);
 s=advanceOrder(s);assert.equal(s.orders[0].status,'AWAITING_PAYMENT');assert.equal(reservedQuantity(s,'101'),5);assert.equal(availableStock(s,'101'),15);
 const sale=save(s,input('sale',{items:[{productId:'101',quantity:'16',unitPrice:'10'}]}));assert.throws(()=>approve(sale),/Yetersiz stok/);
 assert.ok(deriveWorkflowTasks(s).some(task=>task.id==='order-payment-1'&&task.screenId==='sales-order'));
});
test('partial order payment keeps reservation and cancellation creates a customer refund task',()=>{
 let s=saveOrder(seedOperations());s=advanceOrder(advanceOrder(advanceOrder(s)));
 s=transition(s,{type:'record-order-payment',id:1,amount:'100',channel:'BANK'});assert.equal(s.orders[0].status,'PARTIALLY_PAID');assert.equal(balance(s,'201','TRY'),-10000);assert.equal(reservedQuantity(s,'101'),5);assert.ok(!deriveWorkflowTasks(s).some(task=>task.id==='refund-customer-201-TRY'));
 s=transition(s,{type:'cancel-order',id:1,reason:'Müşteri vazgeçti'});assert.equal(availableStock(s,'101'),20);assert.ok(deriveWorkflowTasks(s).some(task=>task.id==='refund-customer-201-TRY'));
});
test('full payment atomically posts sale and then unlocks packing to completion',()=>{
 let s=saveOrder(seedOperations(),orderInput({items:[{productId:'101',quantity:'2',unitPrice:'100',discount:'0'}]}));s=advanceOrder(advanceOrder(advanceOrder(s)));
 s=transition(s,{type:'record-order-payment',id:1,amount:'200',channel:'CARD'});assert.equal(s.orders[0].status,'PAID');assert.equal(s.products[0].stock,18);assert.equal(reservedQuantity(s,'101'),0);assert.equal(balance(s,'201','TRY'),0);assert.equal(s.documents.filter(doc=>doc.kind==='sale').length,1);assert.equal(s.documents.filter(doc=>doc.kind==='order-payment').length,1);
 assert.throws(()=>advanceOrder(s),/koli, takip ve teslim kaydı/);
 s=transition(s,{type:'pack-order',id:1,boxes:[{code:'K-1',items:[{productId:'101',quantity:2}]}],checked:{'101':2},checkedBy:'Depo',note:'İki paket kontrol edildi'});assert.equal(s.orders[0].status,'PACKING');
 s=transition(s,{type:'ship-order',id:1,address:'Berlin depo adresi',carrier:'Örnek taşıyıcı',trackingNumber:'TR-1',shipDate:'2026-09-26'});assert.equal(s.orders[0].status,'SHIPPED');
 s=transition(s,{type:'confirm-delivery',id:1,shipmentId:1,deliveredDate:'2026-09-26',receivedBy:'Müşteri'});assert.equal(s.orders[0].status,'COMPLETED');assert.ok(!deriveWorkflowTasks(s).some(task=>task.id.startsWith('order-')));
});
test('active advance cannot refund or hide another invoice debt; cancellation releases its balance',()=>{
 let s=saveOrder(seedOperations());s=advanceOrder(advanceOrder(advanceOrder(s)));
 s=transition(s,{type:'record-order-payment',id:1,amount:'100',channel:'BANK',expectedPaidAmount:0});
 assert.throws(()=>post(s,input('customer-refund',{amount:'100',channel:'BANK'})),/iade bakiyesini/);
 s=post(s,input('sale',{items:[{productId:'102',quantity:1,unitPrice:'150'}]}));
 assert.equal(deriveWorkflowTasks(s).find(t=>t.id==='collect-201-TRY').payload.amount,'150');
 s=post(s,input('collection',{amount:'150',channel:'BANK'}));
 assert.equal(balance(s,'201','TRY'),-10000);
 assert.ok(!deriveWorkflowTasks(s).some(t=>t.id==='refund-customer-201-TRY'));
 s=transition(s,{type:'cancel-order',id:1,reason:'İptal'});
 s=post(s,input('customer-refund',{amount:'100',channel:'BANK'}));assert.equal(balance(s,'201','TRY'),0);
});
test('stale payment click cannot charge twice; paid order documents cannot be detached',()=>{
 let s=saveOrder(seedOperations());s=advanceOrder(advanceOrder(advanceOrder(s)));
 const payment={type:'record-order-payment',id:1,amount:'100',channel:'BANK',expectedPaidAmount:0};
 s=transition(s,payment);const before=structuredClone(s);
 assert.throws(()=>transition(s,payment),/ödemesi değişti/);assert.deepEqual(s,before);
 s=transition(s,{...payment,amount:'400',expectedPaidAmount:10000});
 assert.throws(()=>transition(s,{type:'cancel',id:s.orders[0].saleDocumentId,reason:'İptal'}),/Siparişe bağlı/);
 assert.equal(s.orderAudit.at(-1).paidAfter,50000);
 s=post(s,input('sales-return',{referenceId:s.orders[0].saleDocumentId,items:[{productId:'101',quantity:1}]}));
 assert.equal(balance(s,'201','TRY'),-10000);
 assert.equal(deriveWorkflowTasks(s).find(t=>t.id==='refund-customer-201-TRY').payload.amount,'100');
});
