import test from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, deriveWorkflowTasks } from './operationsStore.js';
import { operationsReport, operationsReportOutput, operationsDueOutput, operationsStockOutput } from './operationsReports.js';

test('report filters share on-screen and export amounts without combining currencies', () => {
  const state = seedOperations();
  state.documents.push({ id: 1, number: 'DEMO-00001', kind: 'sale', status: 'APPROVED', date: '2026-09-26', dueDate: '2026-10-26', currency: 'TRY', partyId: '201', net: 30000, tax: 3000, amount: 33000, items: [{ productId: '101', total: 10000 }, { productId: '102', total: 20000 }] });
  state.documents.push({ id: 2, number: 'DEMO-00002', kind: 'sale', status: 'APPROVED', date: '2026-09-26', currency: 'EUR', partyId: '203', net: 10000, tax: 0, amount: 10000, items: [{ productId: '103', total: 10000 }] });
  const report = operationsReport(state, { productId: '101', dateFrom: '2026-09-01', dateTo: '2026-09-30' });
  assert.equal(report.documentRows.length, 1);
  assert.equal(report.documentRows[0].amount, 11000);
  assert.equal(report.totals.sale.TRY, 11000);
  assert.equal(report.totals.sale.EUR, 0);
  assert.equal(operationsReportOutput(report, { productId: '101' }).rows[0].amount, '110.00');
  assert.ok(operationsReportOutput(report, { productId: '101' }).rows.some(row => row.kind === 'Satış alt toplam' && row.currency === 'TRY' && row.amount === '110.00'));
  assert.equal(report.dueRows[0].amount, 33000);
  assert.equal(operationsDueOutput(report).rows[0].amount, '330.00');
  assert.equal(operationsReport(state, { dateTo: '2026-08-31' }).documentRows.length, 0);
});
test('unknown cost stays unknown and tasks expose owner, due status and exact route', () => {
  const state = seedOperations(); state.products[0].cost = null;
  state.documents.push({ id: 1, number: 'DEMO-00001', kind: 'receipt', status: 'DRAFT', date: '2026-09-26', intake: { stage: 'REVIEW', unknownItems: [] }, items: [{ productId: '101', quantity: 1 }] });
  const task = deriveWorkflowTasks(state).find(row => row.id === 'draft-1');
  assert.equal(task.owner, 'Muhasebe');
  assert.equal(task.payload.selectedDocumentId, 1);
  assert.equal(task.documentNumber, 'DEMO-00001');
  assert.equal(operationsReport(state).stockRows[0].estimatedCost, null);
  assert.equal(operationsStockOutput(operationsReport(state)).rows[0].estimatedCost, 'Bilinmiyor');
});
