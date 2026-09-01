import {
  assertBrandComposition,
  buildBrandCounts,
  compareSelections,
  isCatalogEligible,
  normalizeBrand,
  productReviewFlags,
  toCandidateProduct,
} from './select_catalog_products_core.mjs';
import {
  BLOCKED_SOURCE_ID,
  CANONICAL_SELECTION_SHA256,
  CURRENT_CANDIDATE_SHA256,
  TARGET_BRAND,
  assertPinnedSelectionDocuments,
} from './find_safe_concept_replacement_core.mjs';

export const SELECTED_REPLACEMENT = Object.freeze({
  sourceId: 161167,
  stockCode: '8023 CONCEPT',
  brand: 'CONCEPT',
  imagePath: '/uploads/vega-products/vega-161167-1788175214418-CONCEPT---8023.jpg',
  imageSha256: 'e3958384a78f3d39ea929dffc2274ce2210dcc5e29c659335d452700d8be9067',
});

export const SALES_EVIDENCE_FILE_NAME = 'catalog-concept-replacement-sales-20260831T184345216Z.json';
export const SALES_EVIDENCE_SHA256 = '45515ec8a29ac9e5a12d3d661e6e37694228ec7efa3537ebc755b12f7d33452e';
export const VISUAL_EVIDENCE_FILE_NAME = 'catalog-concept-replacement-visual-review-20260831T184413767Z.json';
export const VISUAL_EVIDENCE_SHA256 = '798c75c3bc0b5f2802938bb77727e6b75cd64406d591272cac1ef56d5e98e60d';

function creationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value) {
  return String(value || '').trim();
}

function sha(value) {
  return text(value).toLowerCase();
}

function json(value) {
  return JSON.stringify(value);
}

function assertExactIdentity(actual, expected, code) {
  if (
    Number(actual?.sourceId) !== expected.sourceId
    || text(actual?.stockCode) !== expected.stockCode
    || normalizeBrand(actual?.brand) !== expected.brand
  ) {
    throw creationError(code, `Unexpected product identity for source ${expected.sourceId}`);
  }
}

export function parseCreateReplacementArgs(args = []) {
  const allowed = new Set(['--help', '--write-candidate']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0) {
    throw creationError(
      'CONCEPT_REPLACEMENT_CREATE_ARGUMENT_INVALID',
      `Unsupported candidate creation argument: ${unknown.join(', ')}`,
    );
  }
  return {
    help: args.includes('--help'),
    writeCandidate: args.includes('--write-candidate'),
    mode: args.includes('--write-candidate') ? 'unpublished-candidate-write' : 'preview',
  };
}

export function assertReplacementEvidence({
  candidatePayload,
  candidateSha256,
  canonicalPayload,
  canonicalSha256,
  salesPayload,
  salesSha256,
  visualPayload,
  visualSha256,
}) {
  const pinnedDocuments = assertPinnedSelectionDocuments({
    candidatePayload,
    candidateSha256,
    canonicalPayload,
    canonicalSha256,
  });
  if (sha(salesSha256) !== SALES_EVIDENCE_SHA256) {
    throw creationError('CONCEPT_REPLACEMENT_SALES_HASH_MISMATCH', 'Replacement sales evidence hash changed');
  }
  if (sha(visualSha256) !== VISUAL_EVIDENCE_SHA256) {
    throw creationError('CONCEPT_REPLACEMENT_VISUAL_HASH_MISMATCH', 'Replacement visual evidence hash changed');
  }

  const salesRow = salesPayload?.products?.find(
    (product) => Number(product?.sourceId) === SELECTED_REPLACEMENT.sourceId,
  );
  assertExactIdentity(salesRow, SELECTED_REPLACEMENT, 'CONCEPT_REPLACEMENT_SALES_IDENTITY_MISMATCH');
  if (!salesRow?.hasRecordedSales || Number(salesRow?.totals?.grossOutboundQuantity || 0) <= 0) {
    throw creationError(
      'CONCEPT_REPLACEMENT_SALES_EVIDENCE_MISSING',
      'Selected replacement has no recorded sales evidence',
    );
  }

  const visualRow = visualPayload?.reviews?.find(
    (product) => Number(product?.sourceId) === SELECTED_REPLACEMENT.sourceId,
  );
  assertExactIdentity(visualRow, SELECTED_REPLACEMENT, 'CONCEPT_REPLACEMENT_VISUAL_IDENTITY_MISMATCH');
  if (
    text(visualRow?.imagePath) !== SELECTED_REPLACEMENT.imagePath
    || sha(visualRow?.imageSha256) !== SELECTED_REPLACEMENT.imageSha256
    || visualRow?.brandMatches !== true
    || visualRow?.productCodeMatches !== true
    || visualRow?.visualIdentityStatus !== 'PASS'
    || Number(visualPayload?.selection?.sourceId) !== SELECTED_REPLACEMENT.sourceId
  ) {
    throw creationError(
      'CONCEPT_REPLACEMENT_VISUAL_EVIDENCE_MISSING',
      'Selected replacement does not have complete visual identity evidence',
    );
  }

  return {
    pinnedDocuments,
    salesRow,
    visualRow,
  };
}

export function buildSafeReplacementCandidate({
  candidatePayload,
  canonicalPayload,
  liveProduct,
  imagePath,
  imageSha256,
  salesRow,
  generatedAt,
  evidence,
}) {
  assertExactIdentity(liveProduct, SELECTED_REPLACEMENT, 'CONCEPT_REPLACEMENT_LIVE_IDENTITY_MISMATCH');
  const resolvedProduct = {
    ...liveProduct,
    imagePath,
    salesPerformanceStatus: 'partial-report',
    salesQuantity2026: Number(
      salesRow?.years?.find((row) => Number(row?.year) === 2026)?.grossOutboundQuantity || 0,
    ),
  };
  if (
    normalizeBrand(resolvedProduct.brand) !== TARGET_BRAND
    || text(imagePath) !== SELECTED_REPLACEMENT.imagePath
    || sha(imageSha256) !== SELECTED_REPLACEMENT.imageSha256
    || !isCatalogEligible(resolvedProduct)
  ) {
    throw creationError(
      'CONCEPT_REPLACEMENT_LIVE_ELIGIBILITY_FAILED',
      'The selected replacement no longer matches the approved live eligibility evidence',
    );
  }

  const blockedIndex = candidatePayload.products.findIndex(
    (product) => Number(product?.sourceId) === BLOCKED_SOURCE_ID,
  );
  if (blockedIndex < 0) {
    throw creationError('CONCEPT_REPLACEMENT_BLOCKED_PRODUCT_MISSING', 'Blocked product is missing');
  }
  const replacementProduct = {
    ...toCandidateProduct(resolvedProduct),
    salesPerformance: {
      status: 'targeted-gross-sales-history',
      reportedQuantity2026: resolvedProduct.salesQuantity2026,
      complete: true,
    },
    reviewFlags: productReviewFlags(resolvedProduct)
      .filter((flag) => flag === 'GENERIC_PRODUCT_NAME'),
  };
  const products = candidatePayload.products.map((product, index) =>
    index === blockedIndex ? replacementProduct : product);

  const productIds = products.map((product) => Number(product?.sourceId || 0));
  if (
    products.length !== 30
    || productIds.some((sourceId) => sourceId <= 0)
    || new Set(productIds).size !== 30
  ) {
    throw creationError(
      'CONCEPT_REPLACEMENT_PRODUCT_SET_INVALID',
      'Replacement candidate must contain 30 unique product identities',
    );
  }
  const originalCounts = buildBrandCounts(candidatePayload.products);
  assertBrandComposition(products, originalCounts);
  const ids = products.map((product) => Number(product.sourceId));
  if (ids.includes(BLOCKED_SOURCE_ID) || !ids.includes(SELECTED_REPLACEMENT.sourceId)) {
    throw creationError(
      'CONCEPT_REPLACEMENT_CHANGESET_INVALID',
      'The replacement changeset does not remove 7770 and add 8023',
    );
  }
  const unchanged = products.filter((product) => {
    const previous = candidatePayload.products.find(
      (candidateProduct) => Number(candidateProduct.sourceId) === Number(product.sourceId),
    );
    return previous && json(previous) === json(product);
  });
  if (unchanged.length !== 29) {
    throw creationError(
      'CONCEPT_REPLACEMENT_UNCHANGED_SET_INVALID',
      `Expected 29 unchanged products; found ${unchanged.length}`,
    );
  }

  const reviewRequired = (candidatePayload?.dataQuality?.reviewRequired || [])
    .filter((row) => Number(row?.sourceId) !== BLOCKED_SOURCE_ID);
  reviewRequired.splice(blockedIndex, 0, {
    sourceId: replacementProduct.sourceId,
    stockCode: replacementProduct.stockCode,
    brand: replacementProduct.brand,
    flags: replacementProduct.reviewFlags,
  });
  const previousNotCovered = (candidatePayload?.salesPerformanceCoverage?.notCovered || [])
    .filter((row) => Number(row?.sourceId) !== BLOCKED_SOURCE_ID);

  return {
    ...candidatePayload,
    generatedAt,
    publicationStatus: 'not-published-local-candidate',
    selectionStatus: 'safe-replacement-prepared-not-approved-for-publication',
    candidateBrandCounts: buildBrandCounts(products),
    dataQuality: {
      ...candidatePayload.dataQuality,
      selectedCount: products.length,
      blockingIssueCount: 0,
      contentReviewCount: reviewRequired.filter((row) => row.flags.includes('GENERIC_PRODUCT_NAME')).length,
      performanceReviewCount: reviewRequired.filter((row) =>
        row.flags.includes('SALES_PERFORMANCE_NOT_COVERED')
        || row.flags.includes('SALES_PERFORMANCE_PARTIAL')).length,
      reviewRequired,
    },
    salesPerformanceCoverage: {
      ...candidatePayload.salesPerformanceCoverage,
      selectedCount: products.length,
      completeCount: 1,
      targetedVerifiedCount: 1,
      notCoveredCount: previousNotCovered.length,
      notCovered: previousNotCovered,
    },
    replacement: {
      removed: {
        sourceId: BLOCKED_SOURCE_ID,
        stockCode: '7770 CONCEPT',
        brand: TARGET_BRAND,
        reason: 'Visual brand conflict: ERP says CONCEPT while the image shows Murat Baby',
      },
      added: {
        sourceId: replacementProduct.sourceId,
        stockCode: replacementProduct.stockCode,
        brand: replacementProduct.brand,
        imagePath: replacementProduct.imagePath,
        customerFacingNameStatus: 'generic-name-requires-later-content-review',
      },
      evidence,
    },
    previousCandidateComparison: compareSelections(candidatePayload.products, products),
    canonicalComparison: compareSelections(canonicalPayload.products, products),
    products,
  };
}

export function assertReplacementResult(payload, sourceCandidate) {
  if (
    payload?.publicationStatus !== 'not-published-local-candidate'
    || payload?.selectionStatus !== 'safe-replacement-prepared-not-approved-for-publication'
    || !Array.isArray(payload?.products)
    || payload.products.length !== 30
  ) {
    throw creationError('CONCEPT_REPLACEMENT_RESULT_INVALID', 'Replacement candidate result is invalid');
  }
  const comparison = compareSelections(sourceCandidate.products, payload.products);
  if (
    comparison.unchangedCount !== 29
    || comparison.added.length !== 1
    || comparison.removed.length !== 1
    || comparison.added[0].sourceId !== SELECTED_REPLACEMENT.sourceId
    || comparison.removed[0].sourceId !== BLOCKED_SOURCE_ID
  ) {
    throw creationError('CONCEPT_REPLACEMENT_RESULT_CHANGESET_INVALID', 'Replacement result is not exactly 29 + 1');
  }
  return {
    productCount: payload.products.length,
    brandCounts: buildBrandCounts(payload.products),
    comparison,
  };
}

export const PINNED_INPUT_HASHES = Object.freeze({
  candidate: CURRENT_CANDIDATE_SHA256,
  canonical: CANONICAL_SELECTION_SHA256,
  sales: SALES_EVIDENCE_SHA256,
  visual: VISUAL_EVIDENCE_SHA256,
});
