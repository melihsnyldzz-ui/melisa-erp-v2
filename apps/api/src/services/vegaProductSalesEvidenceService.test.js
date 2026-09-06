import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductSalesEvidenceReader, normalizeProductSalesEvidenceQuery, PRODUCT_SALES_EVIDENCE_SQL, toProductSalesEvidence } from './vegaProductSalesEvidenceService.js';

const now = () => new Date('2026-09-06T12:00:00Z');
const query = { sourceId: '42', dateFrom: '2026-06-01', dateTo: '2026-09-05' };
const configuration = { companyCode: 'F0102', periodCode: 'D0007', year: 2026, database: 'VEGA2026' };
const row = (extra = {}) => ({ source_id: 42, is_active: 1, movement_row_count: 0, sales_code_row_count: 0,
  gross_outbound_row_count: 0, gross_outbound_quantity: 0, undated_movement_row_count: 0,
  unclassified_outbound_row_count: 0, ...extra });

test('sales evidence requires exact identity and explicit real in-period date boundaries', () => {
  assert.deepEqual(normalizeProductSalesEvidenceQuery(query, now()), query);
  for (const extra of [{ sourceId: '42 OR 1=1' }, { sourceId: '042' }, { sourceId: ['42', '43'] },
    { sourceId: '2147483648' }, { dateFrom: undefined }, { dateFrom: '2026-02-30' },
    { dateFrom: '2025-12-31' }, { dateTo: '2026-09-07' }, { dateFrom: '2026-09-06' },
    { dateTo: '2027-01-01' }, { limit: '1' }, { search: 'fixture' }]) {
    assert.throws(() => normalizeProductSalesEvidenceQuery({ ...query, ...extra }, now()), /./);
  }
});

test('complete exact-product zero aggregate provides bounded absence including the zero-movement row', async () => {
  const calls = [];
  const read = createProductSalesEvidenceReader({ configuration, now, execute: async (options) => {
    calls.push(options); return { recordset: [row()] };
  } });
  const result = await read(query);
  assert.deepEqual(calls, [query]);
  assert.equal(result.data.sourceId, '42');
  assert.equal(result.data.state, 'NO_SALES_IN_WINDOW');
  assert.equal(result.data.noSalesInWindow, true);
  assert.equal(result.data.movementRowCount, 0);
  assert.equal(result.data.grossOutboundQuantity, 0);
  assert.equal(result.meta.scope.aggregationComplete, true);
  assert.equal(result.meta.scope.rowLimit, null);
  assert.equal(result.meta.scope.pagination, false);
  assert.equal(result.meta.companyCode, 'F0102');
  assert.equal(result.meta.periodCode, 'D0007');
  assert.equal(result.meta.scope.dateFrom, query.dateFrom);
  assert.equal(result.meta.scope.dateTo, query.dateTo);
  assert.equal(result.meta.writePerformed, false);
});

test('positive gross movement cannot be called no-sales even when absent from ranking', () => {
  const result = toProductSalesEvidence(row({ movement_row_count: 4, sales_code_row_count: 1,
    gross_outbound_row_count: 1, gross_outbound_quantity: 0.25 }), query, now().toISOString());
  assert.equal(result.data.state, 'HAS_SALES_MOVEMENT');
  assert.equal(result.data.noSalesInWindow, false);
  assert.equal(result.data.grossOutboundQuantity, 0.25);
});

test('non-sales movements do not hide a valid bounded absence', () => {
  const result = toProductSalesEvidence(row({ movement_row_count: 3 }), query, now().toISOString());
  assert.equal(result.data.noSalesInWindow, true);
  assert.equal(result.data.movementRowCount, 3);
});

test('undated, zero/unknown quantity sales-code rows and uncategorized exits are indeterminate', () => {
  for (const extra of [{ undated_movement_row_count: 1 },
    { movement_row_count: 1, sales_code_row_count: 1 },
    { movement_row_count: 1, unclassified_outbound_row_count: 1 }]) {
    const result = toProductSalesEvidence(row(extra), query, now().toISOString());
    assert.equal(result.data.state, 'INDETERMINATE');
    assert.equal(result.data.noSalesInWindow, null);
  }
});

test('inactive exact products remain distinct from discovery candidates', () => {
  const result = toProductSalesEvidence(row({ is_active: 0 }), query, now().toISOString());
  assert.equal(result.data.state, 'INACTIVE');
  assert.equal(result.data.noSalesInWindow, null);
});

test('missing, wrong identity, incomplete and inconsistent aggregate data never becomes zero', async () => {
  for (const extra of [{ source_id: 43 }, { movement_row_count: null }, { gross_outbound_quantity: '' },
    { sales_code_row_count: -1 }, { sales_code_row_count: 1 }, { gross_outbound_quantity: 1 },
    { is_active: undefined }, { undated_movement_row_count: 1.5 }]) {
    assert.throws(() => toProductSalesEvidence(row(extra), query, now().toISOString()), { code: 'VEGA_SALES_EVIDENCE_RESULT_INVALID' });
  }
  for (const result of [{ recordset: [] }, {}, { recordset: [row(), row()] }]) {
    const read = createProductSalesEvidenceReader({ configuration, now, execute: async () => result });
    await assert.rejects(read(query), (error) => error.statusCode === (result.recordset?.length === 0 ? 404 : 503));
  }
});

test('source mismatch is rejected before reading and read failures propagate without an absence result', async () => {
  let calls = 0;
  for (const extra of [{ companyCode: 'F0103' }, { periodCode: 'D0006' }, { year: 2025 }, { database: 'OTHER' }]) {
    const read = createProductSalesEvidenceReader({ configuration: { ...configuration, ...extra }, now,
      execute: async () => { calls++; return { recordset: [row()] }; } });
    await assert.rejects(read(query), { code: 'VEGA_SALES_EVIDENCE_SCOPE_UNSUPPORTED' });
  }
  assert.equal(calls, 0);
  const read = createProductSalesEvidenceReader({ configuration, now, execute: async () => { throw new Error('fixture timeout'); } });
  await assert.rejects(read(query), /fixture timeout/);
});

test('movement evidence projects only identity, counts and scope without commercial or customer details', () => {
  const result = toProductSalesEvidence(row({ customer_name: 'PRIVATE_FIXTURE', cost: 'PRIVATE_FIXTURE',
    price: 'PRIVATE_FIXTURE', document_no: 'PRIVATE_FIXTURE', supplier: 'PRIVATE_FIXTURE' }), query, now().toISOString());
  assert.equal(JSON.stringify(result).includes('PRIVATE_FIXTURE'), false);
  assert.deepEqual(Object.keys(result.data).sort(), ['active', 'grossOutboundQuantity', 'grossOutboundRowCount',
    'movementRowCount', 'noSalesInWindow', 'salesCodeRowCount', 'sourceId', 'state',
    'unclassifiedOutboundRowCount', 'undatedMovementRowCount'].sort());
});

test('SQL scope uses exact parameterized identity and dates without ranking, truncation or dirty-read hints', () => {
  assert.match(PRODUCT_SALES_EVIDENCE_SQL, /WHERE product\.IND = @sourceId/);
  assert.match(PRODUCT_SALES_EVIDENCE_SQL, /movement\.STOKNO = product\.IND/);
  assert.match(PRODUCT_SALES_EVIDENCE_SQL, /movement\.TARIH >= @dateFrom AND movement\.TARIH < DATEADD\(day, 1, @dateTo\)/);
  assert.match(PRODUCT_SALES_EVIDENCE_SQL, /OUTER APPLY/);
  assert.match(PRODUCT_SALES_EVIDENCE_SQL, /OR movement\.TARIH IS NULL/);
  assert.doesNotMatch(PRODUCT_SALES_EVIDENCE_SQL, /\b(TOP|OFFSET|NOLOCK|INSERT|UPDATE|DELETE|MERGE|EXEC|TUTAR|FIRMANO|EVRAKNO)\b/i);
});
