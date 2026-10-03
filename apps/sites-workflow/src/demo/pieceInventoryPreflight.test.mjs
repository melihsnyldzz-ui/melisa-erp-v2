import test from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations } from './operationsStore.js';
import { preflightPieceInventory } from './pieceInventoryPreflight.js';

const card = { name: 'Beşli Takım', code: 'BESLI', barcode: 'BESLI-KOLI', supplierId: '501',
  cost: '10', salePrice: '20', series: [{ size: 'A', quantity: 3 }, { size: 'B', quantity: 2 }] };
const productState = () => transitionOperations(seedOperations(), { type: 'save-card', entity: 'products', input: card });
const receipt = (state, productId, amount) => {
  const draft = transitionOperations(state, { type: 'save', input: { kind: 'receipt', date: '2026-09-26',
    currency: 'TRY', partyId: '501', items: [{ productId, quantity: amount }] } });
  return transitionOperations(draft, { type: 'approve', id: draft.nextId - 1 });
};

test('read-only preflight reconciles package ledger and reserved pieces without rewriting v2', () => {
  let state = productState();
  const id = state.products.at(-1).id;
  state = receipt(state, id, 4);
  const orderInput = { date: '2026-09-26', validUntil: '2026-09-30', customerId: '201', currency: 'TRY',
    items: [{ productId: id, quantity: 2, unitPrice: '20' }], taxRate: '0' };
  state = transitionOperations(state, { type: 'save-order', input: orderInput });
  for (let i = 0; i < 3; i++) state = transitionOperations(state, { type: 'advance-order', id: 1 });
  const before = structuredClone(state);
  const plan = preflightPieceInventory(state);
  const row = plan.rows.find(item => item.productId === id);
  assert.equal(plan.preflightPassed, true);
  assert.equal(plan.readyForAutomaticConversion, false);
  assert.deepEqual(row, { productId: id, code: 'BESLI', factor: 5, factorInferred: false,
    onHandPackages: 4, reservedPackages: 2, movementPackages: 4,
    openingPackages: 0, availablePackages: 2, onHandPieces: 20, reservedPieces: 10,
    movementPieces: 20, openingPieces: 0, availablePieces: 10 });
  assert.deepEqual(state, before);
  assert.equal(state.version, 2);
});

test('legacy simple product infers one piece while ambiguous series factor fails closed', () => {
  const legacy = preflightPieceInventory(seedOperations());
  assert.equal(legacy.preflightPassed, true);
  assert.equal(legacy.rows[0].factorInferred, true);
  const state = productState();
  delete state.products.at(-1).unitFactor;
  assert.ok(preflightPieceInventory(state).issues.some(item => item.code === 'INVALID_FACTOR'));
});

test('historical factor change, missing movement and reserved stock excess block preflight', () => {
  let state = productState();
  const id = state.products.at(-1).id;
  state = receipt(state, id, 4);
  state.products.at(-1).unitFactor = 6;
  assert.ok(preflightPieceInventory(state).issues.some(item => item.code === 'HISTORICAL_FACTOR_MISMATCH'));
  state.products.at(-1).unitFactor = 5;
  state.movements = [];
  assert.ok(preflightPieceInventory(state).issues.some(item => item.code === 'DOCUMENT_MOVEMENT_MISMATCH'));
  state = receipt(productState(), id, 4);
  state.products.at(-1).stock = 0;
  assert.ok(preflightPieceInventory(state).issues.some(item => item.code === 'INVENTORY_RECONCILIATION_FAILED'));
});

test('piece multiplication beyond a safe integer is rejected', () => {
  const state = productState();
  state.products.at(-1).stock = Number.MAX_SAFE_INTEGER;
  const plan = preflightPieceInventory(state);
  assert.equal(plan.preflightPassed, false);
  assert.ok(plan.issues.some(item => item.code === 'PIECE_OVERFLOW'));
});

test('an opening stock assigned a new series and a draft with stock movements require review', () => {
  const opening = seedOperations();
  opening.products[0].series = card.series;
  opening.products[0].unitFactor = 5;
  assert.ok(preflightPieceInventory(opening).issues.some(item => item.code === 'UNVERIFIED_OPENING_FACTOR'));
  let state = productState();
  const id = state.products.at(-1).id;
  state = receipt(state, id, 1);
  state.documents[0].status = 'DRAFT';
  assert.ok(preflightPieceInventory(state).issues.some(item => item.code === 'DOCUMENT_MOVEMENT_MISMATCH'));
});
