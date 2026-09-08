import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual named handlers in a VM. React setters and storage/API ports
// are in-memory doubles; no React render, device, database or upstream is invoked.
const source = fs.readFileSync(new URL('../apps/terminal-app/src/screens/NewSaleScreen.js', import.meta.url), 'utf8');
const tree = ts.createSourceFile('screen.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const selected = new Set(['persistCurrentSaleToQueue', 'finishSale', 'saveDraftToQueue', 'clearSale', 'requestLeaveSale', 'requestDiscardSaleAndLeave', 'discardSaleAndLeave']);
const handlers = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && selected.has(node.name?.text)) handlers.push(source.slice(node.getStart(tree), node.end));
  ts.forEachChild(node, visit);
}
visit(tree);
assert.equal(handlers.length, selected.size);

function harness(overrides = {}) {
  const calls = {persist: [], submit: [], working: [], clear: 0, navigation: 0};
  const context = vm.createContext({
    session: {accessToken: 'synthetic-test-session'},
    selectedCustomer: {id: 7, customerName: 'TEST'}, lines: [{product: {id: 3, source: 'fixture'}, quantity: 1}],
    itemQuantity: 1, editingEventId: '', saleQueueActionInFlightRef: {current: false},
    activeSaleEventIdRef: {current: ''}, saleQueuePersistenceUncertainRef: {current: false},
    createTerminalSaleClientEventId: () => 'TEST-STABLE-EVENT',
    buildSalePayloadSnapshot: () => ({customerId: 7, items: [{productId: 3, quantity: 1, unitPrice: 10}]}),
    saveWorkingSaleDraft: async (draft) => { calls.working.push(draft); return draft; },
    persistTerminalSaleEvent: async (id, payload) => {calls.persist.push({id, payload}); return {clientEventId: id};},
    syncTerminalSaleEvent: async (id) => {calls.submit.push(id); return {duplicate: false, response: {invoiceId: 44}};},
    clearWorkingSaleDraft: async () => {calls.clear++;},
    isAuthenticationError: () => false, isTerminalSaleManualReviewErrorCode: code => code === 'TERMINAL_SALE_OUTCOME_UNVERIFIED',
    onRefresh: async () => {}, navigation: {goHome: () => {calls.navigation++;}, openSyncStatus: () => {calls.navigation++;}},
    ...overrides,
  });
  for (const key of ['Error','Message','SaleResult','Loading','Lines','Barcode','Quantity','ReviewMode','EditingEventId','ExitConfirmationOpen','DiscardConfirmationOpen']) {
    const name = key[0].toLowerCase()+key.slice(1);
    context[`set${key}`] = value => {context[name] = typeof value === 'function' ? value(context[name]) : value;};
  }
  vm.runInContext(handlers.join('\n'), context);
  return {context, calls};
}

test('rapid save taps persist one queue record', async () => {
  let release;
  const gate = new Promise(resolve => {release=resolve;});
  const {context, calls} = harness();
  context.saveWorkingSaleDraft = async draft => {calls.working.push(draft); await gate;};
  const first = context.saveDraftToQueue();
  const second = context.saveDraftToQueue();
  context.clearSale();
  context.requestLeaveSale();
  await context.discardSaleAndLeave();
  assert.equal(context.lines.length, 1);
  assert.equal(calls.navigation, 0);
  assert.equal(calls.clear, 0);
  release();
  await Promise.all([first, second]);
  assert.equal(calls.persist.length, 1);
  assert.equal(calls.clear, 1);
  assert.equal(calls.submit.length, 0);
  assert.equal(context.lines.length, 0);
  assert.equal(context.saleQueueActionInFlightRef.current, false);
});

test('working-draft failure keeps lines and never persists or submits', async () => {
  const {context, calls} = harness({saveWorkingSaleDraft: async () => {throw new Error('disk unavailable');}});
  await context.finishSale();
  assert.equal(calls.persist.length, 0);
  assert.equal(calls.submit.length, 0);
  assert.equal(context.lines.length, 1);
  assert.equal(context.editingEventId, 'TEST-STABLE-EVENT');
  assert.equal(context.loading, false);
});

test('uncertain queue write retains stable id and blocks discard until retry succeeds', async () => {
  const {context, calls} = harness();
  const persist = context.persistTerminalSaleEvent;
  context.persistTerminalSaleEvent = async (id, payload) => {calls.persist.push({id,payload}); throw new Error('write acknowledgement lost');};
  await context.saveDraftToQueue();
  assert.equal(context.lines.length, 1);
  assert.equal(context.saleQueuePersistenceUncertainRef.current, true);
  assert.equal(calls.working[0].editingEventId, 'TEST-STABLE-EVENT');
  context.clearSale();
  context.requestLeaveSale();
  await context.discardSaleAndLeave();
  assert.equal(context.lines.length, 1);
  assert.equal(calls.clear, 0);
  assert.equal(calls.navigation, 0);
  context.persistTerminalSaleEvent = persist;
  await context.saveDraftToQueue();
  assert.deepEqual(calls.persist.map(row=>row.id), ['TEST-STABLE-EVENT','TEST-STABLE-EVENT']);
  assert.equal(context.saleQueuePersistenceUncertainRef.current, false);
});

test('double submit uses one locked queue send and refresh failure preserves success', async () => {
  const {context, calls} = harness({onRefresh: async () => {throw new Error('refresh unavailable');}});
  await Promise.all([context.finishSale(),context.finishSale()]);
  assert.equal(calls.persist.length, 1);
  assert.equal(calls.submit.length, 1);
  assert.equal(context.saleResult.status, 'synced');
  assert.match(context.error, /ekran yenilenemedi/);
  assert.equal(context.lines.length, 0);
});

test('unverified server outcome is presented as manual review after queue persistence', async () => {
  const {context, calls} = harness({syncTerminalSaleEvent: async () => {throw Object.assign(new Error('uncertain commit'), {code:'TERMINAL_SALE_OUTCOME_UNVERIFIED'});}});
  await context.finishSale();
  assert.equal(calls.persist.length, 1);
  assert.equal(context.saleResult.status, 'manual_review');
  assert.equal(context.saleResult.clientEventId, 'TEST-STABLE-EVENT');
  assert.equal(context.lines.length, 0);
});

test('Vega and explicitly read-only product guards remain before persistence and submit', async () => {
  for (const product of [{id:3,source:'vega'},{id:'vega-3'},{id:3,saleWritable:false}]) {
    const {context,calls} = harness({lines:[{product,quantity:1}]});
    await context.finishSale();
    assert.equal(calls.persist.length,0);
    assert.equal(calls.submit.length,0);
    assert.equal(context.lines.length,1);
    assert.match(context.error,/satis kaydi kapali/);
  }
});
