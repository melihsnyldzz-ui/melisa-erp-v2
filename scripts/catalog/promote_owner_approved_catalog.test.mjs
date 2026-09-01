import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APPROVED_BRAND_COUNTS,
  APPROVED_CANDIDATE_SHA256,
  APPROVED_CUSTOMER_NAMES,
  CURRENT_CANONICAL_SHA256,
  assertOwnerApprovedMainSelection,
  assertPinnedPromotionInputs,
  buildOwnerApprovedMainSelection,
  parseCatalogPromotionArgs,
} from './promote_owner_approved_catalog_core.mjs';

function candidateProducts() {
  const approvedByIndex = new Map(APPROVED_CUSTOMER_NAMES.map((row, index) => [index, row]));
  const brands = [
    ...Array(9).fill('MURAT BABY'),
    ...Array(9).fill('NAYINOM'),
    ...Array(4).fill('CONCEPT'),
    ...Array(5).fill('HİPPIL'),
    ...Array(3).fill('MİNİZEYN'),
  ];
  const products = brands.map((brand, index) => ({
    sourceId: 900000 + index,
    stockCode: `SAFE-${index}`,
    productName: `SOURCE-${index}`,
    brand,
    reviewFlags: ['SALES_PERFORMANCE_NOT_COVERED'],
  }));
  for (const [index, approved] of approvedByIndex) {
    products[index] = {
      sourceId: approved.sourceId,
      stockCode: approved.stockCode,
      productName: approved.sourceProductName,
      brand: index === 0 ? 'MURAT BABY' : index < 5 ? 'CONCEPT' : 'HİPPIL',
      reviewFlags: ['GENERIC_PRODUCT_NAME', 'SALES_PERFORMANCE_NOT_COVERED'],
    };
  }
  const counts = {};
  for (const product of products) counts[product.brand] = (counts[product.brand] || 0) + 1;
  const targetEntries = Object.entries(APPROVED_BRAND_COUNTS);
  for (const [brand, target] of targetEntries) {
    while ((counts[brand] || 0) < target) {
      const donor = Object.keys(counts).find((key) => counts[key] > APPROVED_BRAND_COUNTS[key]);
      const product = products.find((row) => row.brand === donor && !APPROVED_CUSTOMER_NAMES.some((name) => name.sourceId === row.sourceId));
      counts[product.brand] -= 1;
      product.brand = brand;
      counts[brand] = (counts[brand] || 0) + 1;
    }
  }
  return products;
}

function candidatePayload() {
  const products = candidateProducts();
  return {
    publicationStatus: 'not-published-local-candidate',
    selectionStatus: 'safe-replacement-prepared-not-approved-for-publication',
    candidateBrandCounts: APPROVED_BRAND_COUNTS,
    brandCompositionReview: { changed: true, requiresHumanReview: true },
    dataQuality: {
      selectedCount: 30,
      blockingIssueCount: 0,
      contentReviewCount: 10,
      performanceReviewCount: 30,
      reviewRequired: products.map((product) => ({
        sourceId: product.sourceId,
        stockCode: product.stockCode,
        brand: product.brand,
        flags: product.reviewFlags,
      })),
    },
    products,
  };
}

test('promotion is preview by default and requires the explicit owner-approval flag', () => {
  assert.deepEqual(parseCatalogPromotionArgs([]), {
    help: false,
    applyOwnerApproval: false,
    mode: 'preview',
  });
  assert.equal(parseCatalogPromotionArgs(['--apply-owner-approval']).applyOwnerApproval, true);
  assert.throws(() => parseCatalogPromotionArgs(['--publish']), {
    code: 'CATALOG_PROMOTION_ARGUMENT_INVALID',
  });
});

test('candidate and canonical hashes, identities, and composition are pinned', () => {
  const candidate = candidatePayload();
  const result = assertPinnedPromotionInputs({
    candidatePayload: candidate,
    candidateSha256: APPROVED_CANDIDATE_SHA256,
    canonicalPayload: { products: Array.from({ length: 30 }, (_, index) => ({ sourceId: index + 1 })) },
    canonicalSha256: CURRENT_CANONICAL_SHA256,
  });
  assert.equal(result.approvedNameCount, 10);
  assert.deepEqual(result.brandCounts, APPROVED_BRAND_COUNTS);
  assert.throws(() => assertPinnedPromotionInputs({
    candidatePayload: candidate,
    candidateSha256: '0'.repeat(64),
    canonicalPayload: { products: Array.from({ length: 30 }, (_, index) => ({ sourceId: index + 1 })) },
    canonicalSha256: CURRENT_CANONICAL_SHA256,
  }), { code: 'CATALOG_PROMOTION_CANDIDATE_HASH_MISMATCH' });
});

test('approved names replace only ten display names and preserve source names', () => {
  const candidate = candidatePayload();
  const approvedAt = '2026-08-31T19:00:00.000Z';
  const result = buildOwnerApprovedMainSelection(candidate, approvedAt);
  const verification = assertOwnerApprovedMainSelection(result, candidate);
  assert.equal(verification.productCount, 30);
  assert.equal(verification.untouchedProductCount, 20);
  assert.equal(verification.approvedNameCount, 10);
  assert.equal(verification.externalPublicationApproved, false);
  for (const approved of APPROVED_CUSTOMER_NAMES) {
    const product = result.products.find((row) => row.sourceId === approved.sourceId);
    assert.equal(product.productName, 'TAKIM');
    assert.equal(product.customerFacingName, approved.approvedProductName);
    assert.equal(product.reviewFlags.includes('GENERIC_PRODUCT_NAME'), false);
    assert.equal(product.reviewFlags.includes('PACKAGE_CONTENT_VERIFICATION_PENDING'), true);
  }
});

test('promotion remains internal and records unresolved publication gates', () => {
  const result = buildOwnerApprovedMainSelection(candidatePayload(), '2026-08-31T19:00:00.000Z');
  assert.equal(result.publicationStatus, 'approved-internal-main-selection-not-published');
  assert.equal(result.approval.externalPublicationApproved, false);
  assert.equal(result.approval.erpOrVegaWriteApproved, false);
  assert.equal(result.externalPublicationBlockers.length, 3);
  assert.equal(result.dataQuality.sourceGenericNameCount, 10);
  assert.equal(result.dataQuality.customerFacingGenericNameCount, 0);
  assert.equal(result.dataQuality.packageContentPendingCount, 10);
});
