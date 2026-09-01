import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLOCKED_SOURCE_ID,
  CANONICAL_SELECTION_SHA256,
  CURRENT_CANDIDATE_SHA256,
  assertPinnedSelectionDocuments,
  assertSafeEvidence,
  buildSafeConceptShortlist,
  parseConceptReplacementArgs,
} from './find_safe_concept_replacement_core.mjs';

function currentProducts() {
  return Array.from({ length: 30 }, (_, index) => ({
    sourceId: index === 0 ? BLOCKED_SOURCE_ID : 900000 + index,
    stockCode: index === 0 ? '7770 CONCEPT' : `SAFE-${index}`,
    brand: index === 0 ? 'CONCEPT' : 'SAFE',
  }));
}

function candidate(overrides = {}) {
  return {
    sourceId: 160496,
    stockCode: '8026 CONCEPT',
    productName: 'DESENLİ TAKIM',
    brand: 'CONCEPT',
    category: 'TAKIM',
    unitName: 'ADET',
    stockQuantity: 20,
    salePrice: 5,
    matchedBarcode: '8690000000001',
    lastSaleDate: '2026-08-01',
    isPassive: false,
    ...overrides,
  };
}

test('CLI is preview by default and only permits local evidence writing', () => {
  assert.deepEqual(parseConceptReplacementArgs([]), {
    help: false,
    writeReport: false,
    mode: 'preview',
  });
  assert.equal(parseConceptReplacementArgs(['--write-report']).writeReport, true);
  assert.throws(() => parseConceptReplacementArgs(['--apply']), {
    code: 'CONCEPT_REPLACEMENT_ARGUMENT_INVALID',
  });
});

test('candidate and canonical documents are pinned and the blocked product is required', () => {
  const payload = {
    publicationStatus: 'not-published-local-candidate',
    products: currentProducts(),
  };
  const evidence = assertPinnedSelectionDocuments({
    candidatePayload: payload,
    candidateSha256: CURRENT_CANDIDATE_SHA256,
    canonicalPayload: { products: currentProducts() },
    canonicalSha256: CANONICAL_SELECTION_SHA256,
  });
  assert.equal(evidence.blockedProduct.sourceId, BLOCKED_SOURCE_ID);
  assert.throws(() => assertPinnedSelectionDocuments({
    candidatePayload: payload,
    candidateSha256: '0'.repeat(64),
    canonicalPayload: { products: currentProducts() },
    canonicalSha256: CANONICAL_SELECTION_SHA256,
  }), { code: 'CONCEPT_REPLACEMENT_CANDIDATE_HASH_MISMATCH' });
});

test('shortlist excludes current, blocked, other-brand, and incomplete products', () => {
  const products = [
    candidate(),
    candidate({ sourceId: 160497, stockCode: '8053 CONCEPT', stockQuantity: 50 }),
    candidate({ sourceId: BLOCKED_SOURCE_ID, stockCode: '7770 CONCEPT' }),
    candidate({ sourceId: 900001, stockCode: 'CURRENT', stockQuantity: 999 }),
    candidate({ sourceId: 160498, stockCode: 'NO STOCK', stockQuantity: 0 }),
    candidate({ sourceId: 160499, stockCode: 'NO BARCODE', matchedBarcode: null }),
    candidate({ sourceId: 160500, stockCode: 'OTHER', brand: 'OTHER' }),
  ];
  const imageMap = new Map(products.map((product) => [product.sourceId, `/uploads/${product.sourceId}.jpg`]));
  const rows = buildSafeConceptShortlist({
    products,
    imageMap,
    currentProducts: currentProducts(),
    excludedSourceIds: [BLOCKED_SOURCE_ID],
  });
  assert.deepEqual(rows.map((row) => row.sourceId), [160497, 160496]);
});

test('descriptive product names rank before generic names, then stock and last sale', () => {
  const products = [
    candidate({ sourceId: 1, productName: 'TAKIM', stockQuantity: 999 }),
    candidate({ sourceId: 2, productName: 'AYICIKLI TAKIM', stockQuantity: 10, lastSaleDate: '2026-01-01' }),
    candidate({ sourceId: 3, productName: 'ÇİÇEKLİ TAKIM', stockQuantity: 20, lastSaleDate: '2025-01-01' }),
  ];
  const rows = buildSafeConceptShortlist({
    products,
    imageMap: new Map(products.map((product) => [product.sourceId, `/uploads/${product.sourceId}.jpg`])),
  });
  assert.deepEqual(rows.map((row) => row.sourceId), [3, 2, 1]);
});

test('safe output exposes checks but never barcode or price values', () => {
  const product = candidate();
  const rows = buildSafeConceptShortlist({
    products: [product],
    imageMap: new Map([[product.sourceId, '/uploads/product.jpg']]),
  });
  const serialized = JSON.stringify(rows);
  assert.equal(serialized.includes('matchedBarcode'), false);
  assert.equal(serialized.includes('salePrice"'), false);
  assert.equal(rows[0].dataChecks.salePricePresent, true);
  assert.equal(rows[0].dataChecks.barcodePresent, true);
  assert.doesNotThrow(() => assertSafeEvidence(rows));
});

test('safe evidence guard rejects forbidden commercial fields', () => {
  assert.throws(() => assertSafeEvidence({ salePrice: 10 }), {
    code: 'CONCEPT_REPLACEMENT_FORBIDDEN_OUTPUT_FIELD',
  });
});
