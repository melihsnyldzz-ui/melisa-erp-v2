import { before, after, mock } from 'node:test';
before(()=>mock.timers.enable({apis:['Date'],now:new Date('2026-09-26T12:00:00Z')}));
after(()=>mock.timers.reset());
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations as step, reservedQuantity, availableStock, balance, deriveWorkflowTasks } from './operationsStore.js';

const date='2026-09-26';
const init=()=>{let state=seedOperations();state.products[0].prices={TRY:28500,EUR:20000};return state;};
const offer=(extra={})=>({date,validUntil:'2026-10-02',customerId:'201',currency:'EUR',taxRate:20,salesPolicyVersion:2,paymentTerms:'PREPAID',items:[{productId:'101',quantity:5,unitPrice:'200',discount:0}],...extra});
const save=(s,input,id)=>step(s,{type:'save-order',input,id});
const advance=(s,id=1,customerApprovalRef='2026-09-26 müşteri onayı')=>step(s,{type:'advance-order',id,customerApprovalRef});

test('quote version, manager exception, customer approval and released reservation remain auditable',()=>{
 let state=init();
 assert.throws(()=>save(state,offer({items:[{productId:'101',quantity:1,unitPrice:'200',discount:6}]})),/gerçek sahip onayı/);
 assert.throws(()=>save(state,offer({items:[{productId:'101',quantity:1,unitPrice:'180',discount:0}],priceExceptionReason:'Fiyat değişikliği',minimumExceptionReason:'Numune'})),/toplam indirim.*sahip onayı/);
 assert.throws(()=>save(state,offer({items:[{productId:'101',quantity:1,unitPrice:'194',discount:3}],priceExceptionReason:'Fiyat değişikliği',minimumExceptionReason:'Numune'})),/toplam indirim.*sahip onayı/);
 assert.throws(()=>save(state,offer({items:[{productId:'101',quantity:1,unitPrice:'200',discount:4}],minimumExceptionReason:'Numune'})),/%3 üzeri iskonto/);
 assert.throws(()=>save(state,offer({items:[{productId:'101',quantity:1,unitPrice:'200',discount:0}]})),/istisna gerekçesi/);
 state=save(state,offer({items:[{productId:'101',quantity:1,unitPrice:'200',discount:4}],minimumExceptionReason:'Numune denemesi',priceExceptionReason:'İskonto müdür onayı'}));
 assert.equal(state.orders[0].quoteVersion,1);
 state=advance(state);assert.throws(()=>advance(state),/yönetici onaylamalı/);
 state=step(state,{type:'authorize-order-policy',id:1,reason:'Müdür numuneyi kabul etti'});
 state=advance(state);assert.equal(state.orders[0].status,'CUSTOMER_APPROVAL');
 assert.throws(()=>step(state,{type:'advance-order',id:1}),/Müşteri onayı/);
 state=advance(state);assert.equal(reservedQuantity(state,'101'),1);assert.equal(state.orders[0].customerApprovedVersion,1);
 assert.throws(()=>save(state,offer(),1),/düzenlenemez/);
 assert.throws(()=>step(state,{type:'release-order-reservation',id:1,reason:''}),/gerekçesi/);
 state=step(state,{type:'release-order-reservation',id:1,reason:'Müşteri yeni renk istedi'});
 assert.equal(reservedQuantity(state,'101'),0);assert.equal(availableStock(state,'101'),20);
 state=step(state,{type:'cancel-order',id:1,reason:'Renk yok'});
 assert.equal(state.orders[0].status,'CANCELLED');
});

test('open account uses down payment and limit, posts stock once, and can ship while receivable remains',()=>{
 let state=init();state.customers[0].creditLimits={TRY:0,USD:0,EUR:110000};
 state=save(state,offer({paymentTerms:'OPEN_ACCOUNT',dueDate:'2026-10-20'}));
 state=advance(advance(advance(state)));
 assert.equal(state.orders[0].status,'AWAITING_PAYMENT');assert.equal(reservedQuantity(state,'101'),5);
 assert.throws(()=>step(state,{type:'finalize-open-account',id:1}),/limiti/);
 state=step(state,{type:'record-order-payment',id:1,amount:'100',channel:'BANK',expectedPaidAmount:0});
 assert.equal(state.orders[0].status,'PARTIALLY_PAID');
 const before=structuredClone(state);assert.throws(()=>step(state,{type:'record-order-payment',id:1,amount:'100',channel:'BANK',expectedPaidAmount:0}),/değişti/);assert.deepEqual(state,before);
 state=step(state,{type:'finalize-open-account',id:1});
 assert.equal(state.orders[0].status,'ON_ACCOUNT');assert.equal(state.orders[0].creditDecision.exposure,110000);
 assert.equal(state.products[0].stock,15);assert.equal(reservedQuantity(state,'101'),0);
 assert.equal(balance(state,'201','EUR'),110000);assert.equal(state.documents.filter(d=>d.kind==='sale').length,1);
 const posted=structuredClone(state);
 assert.throws(()=>step(state,{type:'cancel-order',id:1,reason:'Yanlış sipariş'}),/Satışa dönüşmüş sipariş/);
 assert.deepEqual(state,posted);
 assert.ok(deriveWorkflowTasks(state).some(t=>t.id==='order-pack-1'));
 assert.match(deriveWorkflowTasks(state).find(t=>t.id==='collect-201-EUR').detail,/2026-10-20/);
 state=step(state,{type:'pack-order',id:1,boxes:[{code:'K-1',items:[{productId:'101',quantity:5}]}],checked:{'101':5},checkedBy:'Depo',note:'Beş paket kontrol edildi'});
 state=step(state,{type:'ship-order',id:1,address:'Müşteri depo adresi',carrier:'Örnek taşıyıcı',trackingNumber:'EU-1',shipDate:date});assert.equal(state.orders[0].status,'SHIPPED');
 state=step(state,{type:'save',input:{kind:'collection',date,currency:'EUR',partyId:'201',amount:'1100',channel:'BANK'}});
 state=step(state,{type:'approve',id:state.nextId-1});assert.equal(balance(state,'201','EUR'),0);
 assert.ok(!deriveWorkflowTasks(state).some(t=>t.id==='collect-201-EUR'));
});

test('credit exception and direct sale share price, minimum and limit checks',()=>{
 let state=init();
 state=save(state,offer({paymentTerms:'OPEN_ACCOUNT',dueDate:'2026-10-20'}));state=advance(advance(advance(state)));
 state=step(state,{type:'finalize-open-account',id:1,creditExceptionReason:'Müdür risk limitini onayladı'});
 assert.equal(state.orders[0].creditDecision.limit,0);assert.equal(balance(state,'201','EUR'),120000);
 const doc={kind:'sale',date,currency:'EUR',partyId:'201',taxRate:20,salesPolicyVersion:2,dueDate:'2026-10-25',creditExceptionReason:'Müdür tekrar onayı',items:[{productId:'101',quantity:1,unitPrice:'200',discount:0}]};
 assert.throws(()=>step(state,{type:'save',input:doc}),/istisna gerekçesi/);
 state=step(state,{type:'save',input:{...doc,minimumExceptionReason:'İkinci teslimat'}});
 const docId=state.nextId-1;
 assert.throws(()=>step(state,{type:'approve',id:docId}),/yönetici onayı/);
 state=step(state,{type:'authorize-sale-policy',id:docId,reason:'İkinci teslimatı onayladı'});
 state=step(state,{type:'approve',id:docId});assert.equal(state.documents.at(-1).creditDecision.exposure,144000);
 assert.equal(state.products[0].stock,14);assert.equal(balance(state,'201','EUR'),144000);
});

test('minimum TRY equivalent uses dated EUR rate and rejects unapproved price changes',()=>{
 let state=init();state=step(state,{type:'save-rate',date,currency:'EUR',value:'40'});
 const doc={kind:'sale',date,currency:'TRY',partyId:'201',salesPolicyVersion:2,dueDate:'2026-10-15',items:[{productId:'101',quantity:2,unitPrice:'285',discount:0}]};
 assert.throws(()=>step(state,{type:'save',input:doc}),/1.000 EUR altındaki/);
 assert.throws(()=>step(state,{type:'save',input:{...doc,minimumExceptionReason:'Numune',items:[{productId:'101',quantity:2,unitPrice:'280'}]}}),/fiyat istisnası/);
 state=step(state,{type:'save',input:{...doc,minimumExceptionReason:'Numune',creditExceptionReason:'Yönetici kredi onayı'}});
 assert.equal(state.documents[0].salesPolicy.minimumEur,1425);
});

test('two customer reservations cannot consume the same stock and expired quote cannot reserve',()=>{
 let state=init();state.products[0].stock=1;
 const small=offer({customerId:'201',items:[{productId:'101',quantity:1,unitPrice:'200'}],minimumExceptionReason:'Demo tek paket'});
 state=save(state,small);state=step(state,{type:'authorize-order-policy',id:1,reason:'Demo istisna'});state=advance(advance(state));state=advance(state);
 state=save(state,{...small,customerId:'202'});state=step(state,{type:'authorize-order-policy',id:2,reason:'Demo istisna'});state=advance(advance(state,2),2);
 assert.throws(()=>advance(state,2),/stok yetersiz/);assert.equal(reservedQuantity(state,'101'),1);
 state=step(state,{type:'cancel-order',id:1,reason:'Müşteri vazgeçti'});
 state=advance(state,2);assert.equal(reservedQuantity(state,'101'),1);
 const stale=save(init(),offer({date:'2026-09-20',validUntil:'2026-09-25'}));
 assert.throws(()=>advance(advance(advance(stale))),/süresi doldu/);
});
