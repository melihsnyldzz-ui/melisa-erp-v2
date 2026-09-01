import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PINNED_INPUT_HASHES,
  SELECTED_REPLACEMENT,
  assertReplacementEvidence,
  assertReplacementResult,
  buildSafeReplacementCandidate,
  parseCreateReplacementArgs,
} from './create_safe_concept_replacement_core.mjs';
import { BLOCKED_SOURCE_ID } from './find_safe_concept_replacement_core.mjs';

function candidateProducts() {
  return Array.from({ length: 30 }, (_, index) => ({
    sourceId: index === 5 ? BLOCKED_SOURCE_ID : 900000 + index,
    stockCode: index === 5 ? '7770 CONCEPT' : `SAFE-${index}`,
    productName: index === 5 ? 'TAKIM' : `PRODUCT-${index}`,
    brand: index === 5 ? 'CONCEPT' : 'SAFE',
    category: 'TAKIM',
    unitName: 'ADET',
    currency: 'USD',
    salePrice: 1,
    stockQuantity: 1,
    salesPerformance: { status: 'not-covered', reportedQuantity2026: null, complete: false },
    imagePath: `/uploads/${index}.jpg`,
    reviewFlags: ['SALES_PERFORMANCE_NOT_COVERED'],
  }));
}

function candidatePayload() {
  return {
    publicationStatus: 'not-published-local-candidate',
    products: candidateProducts(),
    dataQuality: {
      selectedCount: 30,
      blockingIssueCount: 0,
      contentReviewCount: 1,
      performanceReviewCount: 30,
      reviewRequired: candidateProducts().map((product) => ({
        sourceId: product.sourceId,
        stockCode: product.stockCode,
        brand: product.brand,
        flags: product.reviewFlags,
      })),
    },
    salesPerformanceCoverage: {
      selectedCount: 30,
      completeCount: 0,
      partialReportCount: 0,
      notCoveredCount: 30,
      notCovered: candidateProducts().map((product) => ({
        sourceId: product.sourceId,
        stockCode: product.stockCode,
        brand: product.brand,
      })),
    },
  };
}

function liveProduct(overrides = {}) {
  return {
    ...SELECTED_REPLACEMENT,
    productName: 'TAKIM',
    category: 'TAKIM',
    unitName: 'ADET',
    currency: 'USD',
    salePrice: 5,
    stockQuantity: 116,
    matchedBarcode: '8690000000001',
    isPassive: false,
    ...overrides,
  };
}

function evidencePayloads() {
  return {
    salesPayload: {
      products: [{
        sourceId: SELECTED_REPLACEMENT.sourceId,
        stockCode: SELECTED_REPLACEMENT.stockCode,
        brand: SELECTED_REPLACEMENT.brand,
        hasRecordedSales: true,
        totals: { grossOutboundQuantity: 4 },
        years: [{ year: 2026, grossOutboundQuantity: 4 }],
      }],
    },
    visualPayload: {
      reviews: [{
        ...SELECTED_REPLACEMENT,
        brandMatches: true,
        productCodeMatches: true,
        visualIdentityStatus: 'PASS',
      }],
      selection: { sourceId: SELECTED_REPLACEMENT.sourceId },
    },
  };
}

test('CLI previews by default and only accepts an explicit unpublished write', () => {
  assert.deepEqual(parseCreateReplacementArgs([]), {
    help: false,
    writeCandidate: false,
    mode: 'preview',
  });
  assert.equal(parseCreateReplacementArgs(['--write-candidate']).writeCandidate, true);
  assert.throws(() => parseCreateReplacementArgs(['--publish']), {
    code: 'CONCEPT_REPLACEMENT_CREATE_ARGUMENT_INVALID',
  });
});

test('sales and visual evidence must be pinned and complete', () => {
  const payloads = evidencePayloads();
  const candidate = candidatePayload();
  const result = assertReplacementEvidence({
    candidatePayload: candidate,
    candidateSha256: PINNED_INPUT_HASHES.candidate,
    canonicalPayload: { products: candidateProducts() },
    canonicalSha256: PINNED_INPUT_HASHES.canonical,
    ...payloads,
    salesSha256: PINNED_INPUT_HASHES.sales,
    visualSha256: PINNED_INPUT_HASHES.visual,
  });
  assert.equal(result.salesRow.hasRecordedSales, true);
  assert.equal(result.visualRow.visualIdentityStatus, 'PASS');
});

test('replacement preserves 29 products, count, order, and brand composition', () => {
  const source = candidatePayload();
  const payloads = evidencePayloads();
  const result = buildSafeReplacementCandidate({
    candidatePayload: source,
    canonicalPayload: { products: candidateProducts() },
    liveProduct: liveProduct(),
    imagePath: SELECTED_REPLACEMENT.imagePath,
    imageSha256: SELECTED_REPLACEMENT.imageSha256,
    salesRow: payloads.salesPayload.products[0],
    generatedAt: '2026-08-31T18:45:00.000Z',
    evidence: {},
  });
  const verification = assertReplacementResult(result, source);
  assert.equal(verification.productCount, 30);
  assert.equal(verification.comparison.unchangedCount, 29);
  assert.deepEqual(result.products.slice(0, 5), source.products.slice(0, 5));
  assert.equal(result.products[5].sourceId, SELECTED_REPLACEMENT.sourceId);
  assert.deepEqual(result.products.slice(6), source.products.slice(6));
  assert.equal(result.products.some((product) => product.sourceId === BLOCKED_SOURCE_ID), false);
  assert.equal(verification.brandCounts.CONCEPT, 1);
});

test('replacement fails closed on missing stock, barcode, image, or image hash drift', () => {
  const source = candidatePayload();
  const payloads = evidencePayloads();
  const common = {
    candidatePayload: source,
    canonicalPayload: { products: candidateProducts() },
    imagePath: SELECTED_REPLACEMENT.imagePath,
    imageSha256: SELECTED_REPLACEMENT.imageSha256,
    salesRow: payloads.salesPayload.products[0],
    generatedAt: '2026-08-31T18:45:00.000Z',
    evidence: {},
  };
  assert.throws(() => buildSafeReplacementCandidate({
    ...common,
    liveProduct: liveProduct({ stockQuantity: 0 }),
  }), { code: 'CONCEPT_REPLACEMENT_LIVE_ELIGIBILITY_FAILED' });
  assert.throws(() => buildSafeReplacementCandidate({
    ...common,
    liveProduct: liveProduct({ matchedBarcode: null }),
  }), { code: 'CONCEPT_REPLACEMENT_LIVE_ELIGIBILITY_FAILED' });
  assert.throws(() => buildSafeReplacementCandidate({
    ...common,
    liveProduct: liveProduct(),
    imageSha256: '0'.repeat(64),
  }), { code: 'CONCEPT_REPLACEMENT_LIVE_ELIGIBILITY_FAILED' });
});
