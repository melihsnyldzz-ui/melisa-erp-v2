import test from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations } from './operationsStore.js';
import { createOperationsRepository } from './operationsRepository.js';
import { queueTerminalTicket, flushTerminalTicket, readTerminalQueue } from './terminalQueue.js';

function memory() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; }
function receipt() { return { kind: 'receipt', date: '2026-09-26', currency: 'TRY', partyId: '501', items: [{ productId: '101', quantity: '2' }], intake: { boxCount: '1', countedBy: 'Personel', note: 'İki paket sayıldı', samples: { '101': 'STK-100245' }, unknownItems: [] } }; }
test('terminal receipt is one review draft and never posts stock before accounting', () => {
  const state = transitionOperations(seedOperations(), { type: 'terminal-submit', kind: 'receipt', input: receipt(), actorRole: 'depo', requestId: 'ticket-0001' });
  assert.equal(state.revision, 1);
  assert.equal(state.documents.length, 1);
  assert.equal(state.documents[0].intake.stage, 'REVIEW');
  assert.equal(state.products[0].stock, 20);
  assert.deepEqual(state.movements, []);
  assert.throws(() => transitionOperations(state, { type: 'approve', id: 999 }), /bulunamadı/);
});
test('terminal ticket survives retry after commit and retains one document', async () => {
  const storage = memory(), queueStorage = memory();
  const repo = createOperationsRepository({ storage, seed: seedOperations, lock: (_key, task) => task() });
  const ticket = queueTerminalTicket(queueStorage, 'receipt', receipt(), 'depo', 'ticket-0002');
  await repo.execute({ ...ticket.command, expectedRevision: 0 }, transitionOperations);
  const dispatch = async command => repo.execute({ ...command, expectedRevision: repo.read().revision }, transitionOperations);
  await flushTerminalTicket(queueStorage, ticket.requestId, dispatch, () => repo.read());
  await flushTerminalTicket(queueStorage, ticket.requestId, dispatch, () => repo.read());
  assert.equal(repo.read().documents.length, 1);
  assert.equal(readTerminalQueue(queueStorage)[0].status, 'sent');
});
test('terminal sale posts stock and customer balance once when completed', async () => {
  const storage = memory(), queueStorage = memory();
  const seed = () => {
    const state = seedOperations();
    state.products[0].prices = { TRY: 28500, EUR: 28500 };
    state.customers[0].creditLimits = { TRY: 0, USD: 0, EUR: 200000 };
    return state;
  };
  const repo = createOperationsRepository({ storage, seed, lock: (_key, task) => task() });
  const input = { kind: 'sale', date: '2026-09-28', currency: 'EUR', partyId: '201',
    salesPolicyVersion: 2, dueDate: '2026-10-28', taxRate: '0',
    items: [{ productId: '101', quantity: '4', unitPrice: '285', discount: '0' }] };
  const ticket = queueTerminalTicket(queueStorage, 'sale', input, 'satis', 'ticket-sale-0001');
  const dispatch = command => repo.execute({ ...command, expectedRevision: repo.read().revision }, transitionOperations);
  await flushTerminalTicket(queueStorage, ticket.requestId, dispatch, () => repo.read());
  await flushTerminalTicket(queueStorage, ticket.requestId, dispatch, () => repo.read());
  const state = repo.read();
  assert.equal(state.revision, 1);
  assert.equal(state.documents.length, 1);
  assert.equal(state.documents[0].status, 'APPROVED');
  assert.equal(state.products[0].stock, 16);
  assert.equal(state.movements.filter(row => row.stockDelta === -4).length, 1);
  assert.equal(state.movements.find(row => row.partyDelta === 114000).partyId, '201');
  assert.equal(state.cash.EUR, 0);
});
test('terminal sale cannot post when stock is insufficient', () => {
  const state = seedOperations();
  state.products[0].prices = { TRY: 28500, EUR: 28500 };
  state.customers[0].creditLimits = { TRY: 0, USD: 0, EUR: 1000000 };
  assert.throws(() => transitionOperations(state, { type: 'terminal-submit', kind: 'sale', actorRole: 'satis', requestId: 'ticket-sale-0002', input: {
    kind: 'sale', date: '2026-09-28', currency: 'EUR', partyId: '201', salesPolicyVersion: 2,
    dueDate: '2026-10-28', items: [{ productId: '101', quantity: '21', unitPrice: '285' }],
  } }), /stok/i);
  assert.equal(state.products[0].stock, 20);
  assert.equal(state.documents.length, 0);
});
test('terminal rejects finance commands and mismatched ticket types', () => {
  assert.throws(() => transitionOperations(seedOperations(), { type: 'terminal-submit', kind: 'collection', input: { kind: 'collection' }, actorRole: 'satis', requestId: 'ticket-0003' }), /geçersiz/);
  assert.throws(() => transitionOperations(seedOperations(), { type: 'terminal-submit', kind: 'receipt', input: { ...receipt(), kind: 'count' }, actorRole: 'depo', requestId: 'ticket-0004' }), /uyuşmuyor/);
  assert.throws(() => transitionOperations(seedOperations(), { type: 'terminal-submit', kind: 'order', input: {}, actorRole: 'depo', requestId: 'ticket-0005' }), /satış/);
});
test('offline count detects a stock change before creating a review draft', () => {
  const state = seedOperations(); state.products[0].stock = 19;
  assert.throws(() => transitionOperations(state, { type: 'terminal-submit', kind: 'count', actorRole: 'depo', requestId: 'ticket-0006', input: { kind: 'count', items: [{ productId: '101', quantity: '20' }], terminalStockSnapshot: { '101': 20 } } }), /stok değişti/);
  assert.equal(state.documents.length, 0);
});
test('terminal count and physical customer return wait for accounting approval', () => {
  const counted = transitionOperations(seedOperations(), { type: 'terminal-submit', kind: 'count', actorRole: 'depo', requestId: 'ticket-0007', input: { kind: 'count', date: '2026-09-26', currency: 'TRY', reason: 'Sayım farkı', items: [{ productId: '101', quantity: '19' }], terminalStockSnapshot: { '101': 20 }, countSession: { countedBy: 'Depo', note: 'Tekrar sayıldı', investigation: { '101': 'Bir paket eksik' } } } });
  assert.equal(counted.documents[0].countSession.stage, 'REVIEW');
  assert.equal(counted.products[0].stock, 20);
  const original = { id: 10, kind: 'sale', status: 'APPROVED', partyId: '201', currency: 'TRY', date: '2026-09-26', taxRate: 0, items: [{ productId: '101', quantity: 2, total: 57000, unitPrice: 28500, discount: 0 }] };
  const state = seedOperations(); state.documents.push(original); state.nextId = 11;
  const returned = transitionOperations(state, { type: 'terminal-submit', kind: 'sales-return', actorRole: 'satis', requestId: 'ticket-0008', input: { kind: 'sales-return', date: '2026-09-26', currency: 'TRY', partyId: '201', referenceId: 10, reason: 'Yanlış ürün', items: [{ productId: '101', quantity: '1' }], returnFlow: { countedBy: 'Satış', note: 'Bir koli', boxCount: '1', reasonCode: 'WRONG' } } });
  assert.equal(returned.documents.at(-1).returnFlow.stage, 'REVIEW');
  assert.equal(returned.products[0].stock, 20);
  assert.equal(returned.cash.TRY, 0);
});
