import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations as step, balance, deriveWorkflowTasks } from './operationsStore.js';
import { today } from './operationsShared.js';

const date = today();
const later = days => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

test('Melisa günlük zinciri: koli → alış → vadeli satış → sevk → tahsilat', () => {
  let state = seedOperations();
  state.products[0].prices = { TRY: 28500, EUR: 20000 };
  state.customers[0].creditLimits = { TRY: 0, USD: 0, EUR: 110000 };

  state = step(state, { type: 'save', input: {
    kind: 'receipt', date, currency: 'TRY', partyId: '501',
    items: [{ productId: '101', quantity: 5 }],
    intake: { boxCount: 1, countedBy: 'Personel', note: 'Koli sayıldı',
      samples: { '101': 'ORNEK-101' }, expected: { '101': 5 }, unknownItems: [] },
  } });
  assert.equal(state.products[0].stock, 20);
  assert.throws(() => step(state, { type: 'approve', id: 1 }), /muhasebeye/);
  state = step(state, { type: 'submit-receipt', id: 1 });
  state = step(state, { type: 'approve', id: 1 });
  assert.equal(state.products[0].stock, 25);
  assert.equal(deriveWorkflowTasks(state).find(task => task.id === 'bill-1').payload.referenceId, 1);

  state = step(state, { type: 'save', input: {
    kind: 'purchase', date, currency: 'TRY', partyId: '501', referenceId: 1,
    supplierInvoiceNumber: 'GUN-1', taxRate: 20,
    items: [{ productId: '101', quantity: 5, unitPrice: '100', discount: 0 }],
  } });
  state = step(state, { type: 'approve', id: 2 });
  assert.equal(state.products[0].stock, 25);
  assert.equal(balance(state, '501', 'TRY'), 60000);

  state = step(state, { type: 'save-order', input: {
    date, validUntil: later(30), customerId: '201', currency: 'EUR',
    taxRate: 20, salesPolicyVersion: 2, paymentTerms: 'OPEN_ACCOUNT', dueDate: later(45),
    items: [{ productId: '101', quantity: 5, unitPrice: '200', discount: 0 }],
  } });
  for (let i = 0; i < 3; i++) state = step(state, {
    type: 'advance-order', id: 1, customerApprovalRef: 'Müşteri teklif sürümünü onayladı',
  });
  state = step(state, { type: 'record-order-payment', id: 1, amount: '100', channel: 'BANK', expectedPaidAmount: 0 });
  state = step(state, { type: 'finalize-open-account', id: 1 });
  assert.equal(state.products[0].stock, 20);
  assert.equal(balance(state, '201', 'EUR'), 110000);
  assert.equal(state.documents.filter(doc => doc.kind === 'sale').length, 1);
  assert.throws(() => step(state, { type: 'cancel-order', id: 1, reason: 'İptal' }), /Satışa dönüşmüş sipariş/);

  state = step(state, { type: 'pack-order', id: 1,
    boxes: [{ code: 'K-1', items: [{ productId: '101', quantity: 5 }] }],
    checked: { '101': 5 }, checkedBy: 'Depo', note: 'Beş paket sayıldı' });
  state = step(state, { type: 'ship-order', id: 1, address: 'Müşteri depo adresi',
    carrier: 'Örnek taşıyıcı', trackingNumber: 'GUN-1', shipDate: date });
  assert.equal(state.orders[0].status, 'SHIPPED');
  assert.equal(balance(state, '201', 'EUR'), 110000);
  state = step(state, { type: 'confirm-delivery', id: 1, shipmentId: 1,
    deliveredDate: date, receivedBy: 'Müşteri deposu' });

  state = step(state, { type: 'save', input: { kind: 'collection', date,
    currency: 'EUR', partyId: '201', amount: '1100', channel: 'BANK' } });
  state = step(state, { type: 'approve', id: state.nextId - 1 });
  assert.equal(state.orders[0].status, 'COMPLETED');
  assert.equal(balance(state, '201', 'EUR'), 0);
  assert.equal(state.cash.EUR, 0);
  assert.equal(state.products[0].stock, 20);
  assert.equal(state.documents.filter(doc => doc.kind === 'sale').length, 1);
  assert.ok(!deriveWorkflowTasks(state).some(task => task.id === 'collect-201-EUR'));
});
