import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoCashRegisterResponse,
  demoCloseCashRegister,
  demoCreateCashExpense,
  demoCreateCashTransfer,
  demoOpenCashRegister,
  resetDemoFinance,
} from './demoFinance.js';

test('demo cash register supports open, expense, transfer and close without real writes', () => {
  resetDemoFinance();
  const businessDate = '2026-09-26';
  assert.equal(demoCashRegisterResponse({ businessDate }).data.session, null);

  const opened = demoOpenCashRegister({ businessDate, counts: {
    TRY: { physicalOpening: 1000, openingTransfer: 200 },
    USD: { physicalOpening: 100, openingTransfer: 0 },
    EUR: { physicalOpening: 50, openingTransfer: 0 },
  } });
  const sessionId = opened.data.sessionId;
  demoCreateCashExpense({ sessionId, categoryId: 1, currency: 'TRY', amount: 75, description: 'Demo kargo' });
  demoCreateCashTransfer({ sessionId, currency: 'TRY', amount: 100, direction: 'main_to_drawer', description: 'Demo ek para' });

  const active = demoCashRegisterResponse({ businessDate });
  assert.equal(active.meta.writePerformed, false);
  assert.equal(active.data.session.status, 'open');
  assert.equal(active.data.movements.length, 2);
  assert.equal(active.data.currencies.find(row => row.currency === 'TRY').expected, '1225.00000000');

  demoCloseCashRegister({ sessionId, closingNote: 'Demo kapanış', counts: {
    TRY: { physicalClosing: 1225, carryForward: 225 },
    USD: { physicalClosing: 100, carryForward: 100 },
    EUR: { physicalClosing: 50, carryForward: 50 },
  } });
  const closed = demoCashRegisterResponse({ businessDate });
  assert.equal(closed.data.session.status, 'closed');
  assert.equal(closed.data.currencies.find(row => row.currency === 'TRY').difference, '0.00000000');
});
