import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANDIDATE_SHA256,
  EXPECTED_CANDIDATES,
  REQUIRED_VEGA_TABLES,
  TARGET_PERIODS,
  assertCandidateSelection,
  assertReadOnlyPermissions,
  buildSalesEvidence,
  buildReadOnlyPermissionQuery,
  buildTargetedSalesQuery,
  parseCandidateSalesArgs,
} from './verify_catalog_candidate_sales_core.mjs';

function candidatePayload() {
  const products = EXPECTED_CANDIDATES.map((product) => ({
    ...product,
    salesPerformance: { status: 'not-covered', reportedQuantity2026: null, complete: false },
  }));
  while (products.length < 30) {
    products.push({ sourceId: 900000 + products.length, stockCode: `SAFE-${products.length}`, brand: 'SAFE' });
  }
  return {
    sourceIdentity: {
      source: 'vega-live-read-only',
      companyCode: 'F0102',
      periodCode: 'D0007',
      year: 2026,
    },
    publicationStatus: 'not-published-local-candidate',
    products,
    comparison: { added: EXPECTED_CANDIDATES.map((product) => ({ ...product })) },
  };
}

function evidenceRows() {
  return EXPECTED_CANDIDATES.flatMap((product, productIndex) => TARGET_PERIODS.map(({ year }) => ({
    source_id: product.sourceId,
    stock_code: product.stockCode,
    brand: product.brand,
    sales_year: year,
    gross_outbound_quantity: productIndex === 0 && year === 2026 ? 12 : 0,
    sales_document_count: productIndex === 0 && year === 2026 ? 2 : 0,
    first_sold_at: productIndex === 0 && year === 2026 ? '2026-02-01' : null,
    last_sold_at: productIndex === 0 && year === 2026 ? '2026-08-20' : null,
  })));
}

test('CLI is preview by default and only permits explicit local evidence writing', () => {
  assert.deepEqual(parseCandidateSalesArgs([]), { help: false, writeReport: false, mode: 'preview' });
  assert.equal(parseCandidateSalesArgs(['--write-report']).writeReport, true);
  assert.throws(() => parseCandidateSalesArgs(['--apply']), { code: 'CATALOG_SALES_ARGUMENT_INVALID' });
});

test('approved candidate identity is pinned by source id, exact stock code, and hash', () => {
  const targets = assertCandidateSelection(candidatePayload(), CANDIDATE_SHA256.toUpperCase());
  assert.deepEqual(targets, EXPECTED_CANDIDATES);
  assert.equal(targets.at(-1).stockCode, '0335 NAYİNOM');
});

test('candidate verification fails closed on hash, source, or replacement drift', () => {
  assert.throws(() => assertCandidateSelection(candidatePayload(), '0'.repeat(64)), {
    code: 'CATALOG_SALES_CANDIDATE_HASH_MISMATCH',
  });
  const wrongSource = candidatePayload();
  wrongSource.sourceIdentity.periodCode = 'D9999';
  assert.throws(() => assertCandidateSelection(wrongSource, CANDIDATE_SHA256), {
    code: 'CATALOG_SALES_SOURCE_MISMATCH',
  });
  const wrongReplacement = candidatePayload();
  wrongReplacement.comparison.added.pop();
  assert.throws(() => assertCandidateSelection(wrongReplacement, CANDIDATE_SHA256), {
    code: 'CATALOG_SALES_REPLACEMENT_SET_MISMATCH',
  });
});

test('targeted query is SELECT-only and excludes commercial detail fields', () => {
  const query = buildTargetedSalesQuery();
  assert.match(query, /F0102D0004TBLSTOKHAREKETLERI/);
  assert.match(query, /F0102D0007TBLSTOKHAREKETLERI/);
  assert.match(query, /@candidateSourceId5/);
  assert.doesNotMatch(query, /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE|EXEC)\b/i);
  assert.doesNotMatch(query, /TBLCARI|FIRMAADI|SATISFIYATI|AFIYATI|GERCEKTOPLAM/i);
});

test('permission preflight proves SELECT and fails if any write capability exists', () => {
  const query = buildReadOnlyPermissionQuery();
  assert.match(query, /HAS_PERMS_BY_NAME/);
  assert.doesNotMatch(query, /\b(INSERT INTO|UPDATE\s+dbo|DELETE FROM|MERGE INTO|DROP TABLE|ALTER TABLE|TRUNCATE TABLE)\b/i);
  const rows = REQUIRED_VEGA_TABLES.map((objectName) => ({
    object_name: objectName,
    can_select: 1,
    can_insert: 0,
    can_update: 0,
    can_delete: 0,
    can_alter: 0,
    can_control: 0,
  }));
  assert.deepEqual(assertReadOnlyPermissions(rows), {
    checkedTableCount: 5,
    selectPermissionConfirmed: true,
    writePermissionAbsent: true,
  });
  rows[0].can_update = 1;
  assert.throws(() => assertReadOnlyPermissions(rows), { code: 'CATALOG_SALES_WRITE_PERMISSION_PRESENT' });
});

test('evidence keeps all six products and separates recorded from absent gross sales', () => {
  const evidence = buildSalesEvidence(evidenceRows());
  assert.equal(evidence.targetCount, 6);
  assert.equal(evidence.productsWithRecordedSales, 1);
  assert.equal(evidence.productsWithoutRecordedSales, 5);
  assert.equal(evidence.products[0].totals.grossOutboundQuantity, 12);
  assert.equal(evidence.products[0].totals.salesDocumentCount, 2);
  assert.equal(evidence.products[0].totals.firstSoldAt, '2026-02-01');
  assert.equal(evidence.products[0].totals.lastSoldAt, '2026-08-20');
  assert.equal(JSON.stringify(evidence).includes('salePrice'), false);
  assert.equal(JSON.stringify(evidence).includes('customerName'), false);
  assert.equal(JSON.stringify(evidence).includes('documentNo'), false);
});

test('missing candidate-year evidence fails closed instead of implying zero sales', () => {
  assert.throws(() => buildSalesEvidence(evidenceRows().slice(1)), {
    code: 'CATALOG_SALES_EVIDENCE_INCOMPLETE',
  });
});
