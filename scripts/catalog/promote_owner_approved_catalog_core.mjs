import { buildBrandCounts } from './select_catalog_products_core.mjs';

export const APPROVED_CANDIDATE_FILE_NAME = 'catalog-selection-candidate-20260831T185102223Z.json';
export const APPROVED_CANDIDATE_SHA256 = '5dd86191abc92c65bf500a56680f82dcd0c432a6eddd4ca3b2bbee2b180e1033';
export const CANONICAL_SELECTION_FILE_NAME = 'catalog-selection.json';
export const CURRENT_CANONICAL_SHA256 = '765656a0bb73ed9d744774e0196457b5525ce49dc4f200ac9cb103b0183717d3';
export const INTERIM_CANONICAL_SHA256 = '2bf481a0e0bc05db524a2da79fbe8f9b33e747bc37c9ec19c240a5624f3bfb33';

export const APPROVED_BRAND_COUNTS = Object.freeze({
  'MURAT BABY': 9,
  NAYINOM: 9,
  CONCEPT: 4,
  'HİPPIL': 5,
  'MİNİZEYN': 3,
});

export const APPROVED_CUSTOMER_NAMES = Object.freeze([
  {
    sourceId: 141666,
    stockCode: '9149 MURAT BABY',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Kalp Desenli Fiyonklu Body-Pantolon Takımı',
  },
  {
    sourceId: 160992,
    stockCode: '3872 CONCEPT',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Papyonlu Ceket ve Şort Takımı',
  },
  {
    sourceId: 161167,
    stockCode: '8023 CONCEPT',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Örgü Kollu Fermuarlı Ceketli Pantolon Takımı',
  },
  {
    sourceId: 158637,
    stockCode: '3800 CONCEPT',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Yaka Detaylı Ceketli Pantolon Takımı',
  },
  {
    sourceId: 161032,
    stockCode: '8038 CONCEPT',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Ekose Ceketli Kot Pantolon Takımı',
  },
  {
    sourceId: 147527,
    stockCode: '2040 HİPPIL',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Çiçek Motifli Yelekli Bereli Takım',
  },
  {
    sourceId: 148195,
    stockCode: '5213 HİPPIL',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Kalp Motifli Desenli Yelekli Pantolon Takımı',
  },
  {
    sourceId: 142599,
    stockCode: '5178 HİPPIL',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Güneş ve Dağ Motifli Yelekli Pantolon Takımı',
  },
  {
    sourceId: 145181,
    stockCode: '5192 HİPPIL',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Kare Desenli Üstlü Çıtçıtlı Yelek ve Pantolon Takımı',
  },
  {
    sourceId: 144974,
    stockCode: '5189 HİPPIL',
    sourceProductName: 'TAKIM',
    approvedProductName: 'Çiçek Motifli Kapüşonlu Yelek ve Pantolon Takımı',
  },
]);

function promotionError(code, message) {
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

function sameCounts(actual, expected) {
  const actualEntries = Object.entries(actual).sort(([a], [b]) => a.localeCompare(b, 'tr'));
  const expectedEntries = Object.entries(expected).sort(([a], [b]) => a.localeCompare(b, 'tr'));
  return json(actualEntries) === json(expectedEntries);
}

export function parseCatalogPromotionArgs(args = []) {
  const allowed = new Set(['--help', '--apply-owner-approval']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0) {
    throw promotionError(
      'CATALOG_PROMOTION_ARGUMENT_INVALID',
      `Unsupported catalog promotion argument: ${unknown.join(', ')}`,
    );
  }
  return {
    help: args.includes('--help'),
    applyOwnerApproval: args.includes('--apply-owner-approval'),
    mode: args.includes('--apply-owner-approval') ? 'owner-approved-local-promotion' : 'preview',
  };
}

export function assertPinnedPromotionInputs({
  candidatePayload,
  candidateSha256,
  canonicalPayload,
  canonicalSha256,
}) {
  if (sha(candidateSha256) !== APPROVED_CANDIDATE_SHA256) {
    throw promotionError('CATALOG_PROMOTION_CANDIDATE_HASH_MISMATCH', 'Approved candidate hash changed');
  }
  const canonicalHash = sha(canonicalSha256);
  if (![CURRENT_CANONICAL_SHA256, INTERIM_CANONICAL_SHA256].includes(canonicalHash)) {
    throw promotionError('CATALOG_PROMOTION_CANONICAL_HASH_MISMATCH', 'Canonical catalog hash changed');
  }
  if (
    candidatePayload?.publicationStatus !== 'not-published-local-candidate'
    || candidatePayload?.selectionStatus !== 'safe-replacement-prepared-not-approved-for-publication'
    || !Array.isArray(candidatePayload?.products)
    || candidatePayload.products.length !== 30
  ) {
    throw promotionError('CATALOG_PROMOTION_CANDIDATE_INVALID', 'Approved candidate state is invalid');
  }
  if (!Array.isArray(canonicalPayload?.products) || canonicalPayload.products.length !== 30) {
    throw promotionError('CATALOG_PROMOTION_CANONICAL_INVALID', 'Canonical selection must contain 30 products');
  }
  const ids = candidatePayload.products.map((product) => Number(product?.sourceId || 0));
  if (new Set(ids).size !== 30 || ids.some((sourceId) => sourceId <= 0 || sourceId === 158798)) {
    throw promotionError('CATALOG_PROMOTION_PRODUCT_SET_INVALID', 'Approved candidate product identities are invalid');
  }
  if (!ids.includes(161167) || !sameCounts(buildBrandCounts(candidatePayload.products), APPROVED_BRAND_COUNTS)) {
    throw promotionError('CATALOG_PROMOTION_COMPOSITION_INVALID', 'Approved candidate brand composition is invalid');
  }

  const productsById = new Map(candidatePayload.products.map((product) => [Number(product.sourceId), product]));
  for (const approved of APPROVED_CUSTOMER_NAMES) {
    const product = productsById.get(approved.sourceId);
    if (
      !product
      || text(product.stockCode) !== approved.stockCode
      || text(product.productName) !== approved.sourceProductName
    ) {
      throw promotionError(
        'CATALOG_PROMOTION_NAME_SOURCE_MISMATCH',
        `Approved name source does not match ${approved.sourceId}`,
      );
    }
  }

  return {
    candidateProductCount: candidatePayload.products.length,
    canonicalProductCount: canonicalPayload.products.length,
    canonicalInputState: canonicalHash === CURRENT_CANONICAL_SHA256
      ? 'historical-main-selection'
      : 'interim-owner-approved-name-overlay',
    approvedNameCount: APPROVED_CUSTOMER_NAMES.length,
    brandCounts: buildBrandCounts(candidatePayload.products),
  };
}

function updateReviewFlags(flags = []) {
  const retained = flags.filter((flag) => flag !== 'GENERIC_PRODUCT_NAME');
  if (!retained.includes('PACKAGE_CONTENT_VERIFICATION_PENDING')) {
    retained.unshift('PACKAGE_CONTENT_VERIFICATION_PENDING');
  }
  return retained;
}

export function buildOwnerApprovedMainSelection(
  candidatePayload,
  approvedAt,
  operationAt = approvedAt,
  previousCanonicalSha256 = CURRENT_CANONICAL_SHA256,
) {
  const approvedById = new Map(APPROVED_CUSTOMER_NAMES.map((row) => [row.sourceId, row]));
  const products = candidatePayload.products.map((product) => {
    const approved = approvedById.get(Number(product.sourceId));
    if (!approved) return product;
    return {
      ...product,
      customerFacingName: approved.approvedProductName,
      nameApproval: {
        status: 'owner-approved-for-internal-catalog',
        approvedAt,
        approvalSource: 'current-codex-thread-user-message-onayliyorum',
        packageContentVerification: 'pending-physical-or-supplier-verification',
      },
      reviewFlags: updateReviewFlags(product.reviewFlags),
    };
  });
  const reviewRequired = (candidatePayload?.dataQuality?.reviewRequired || []).map((row) =>
    approvedById.has(Number(row.sourceId)) ? { ...row, flags: updateReviewFlags(row.flags) } : row);

  return {
    ...candidatePayload,
    generatedAt: candidatePayload.generatedAt,
    approvedAt,
    publicationStatus: 'approved-internal-main-selection-not-published',
    selectionStatus: 'owner-approved-main-selection-external-publication-blocked',
    brandCompositionReview: {
      ...candidatePayload.brandCompositionReview,
      requiresHumanReview: false,
      ownerApproved: true,
      ownerApprovedAt: approvedAt,
    },
    dataQuality: {
      ...candidatePayload.dataQuality,
      selectedCount: products.length,
      blockingIssueCount: 0,
      contentReviewCount: APPROVED_CUSTOMER_NAMES.length,
      sourceGenericNameCount: APPROVED_CUSTOMER_NAMES.length,
      customerFacingGenericNameCount: 0,
      ownerApprovedNameCount: APPROVED_CUSTOMER_NAMES.length,
      packageContentPendingCount: APPROVED_CUSTOMER_NAMES.length,
      reviewRequired,
    },
    approval: {
      status: 'OWNER_APPROVED',
      approvedAt,
      approvalSource: 'current-codex-thread-user-message-onayliyorum',
      approvedCandidate: {
        fileName: APPROVED_CANDIDATE_FILE_NAME,
        sha256: APPROVED_CANDIDATE_SHA256,
      },
      approvedScope: [
        'promote-30-products-to-internal-main-selection',
        'apply-10-approved-customer-facing-names',
        'accept-brand-composition-9-9-4-5-3',
      ],
      externalPublicationApproved: false,
      erpOrVegaWriteApproved: false,
    },
    externalPublicationBlockers: [
      'physical-or-supplier-package-content-verification-for-10-approved-names',
      'fresh-price-and-stock-check-at-publication-time',
      'separate-explicit-publication-approval',
    ],
    replacement: candidatePayload.replacement ? {
      ...candidatePayload.replacement,
      added: {
        ...candidatePayload.replacement.added,
        customerFacingNameStatus: 'owner-approved-name-package-content-pending',
      },
    } : candidatePayload.replacement,
    promotion: {
      sourceCandidateFileName: APPROVED_CANDIDATE_FILE_NAME,
      sourceCandidateSha256: APPROVED_CANDIDATE_SHA256,
      previousCanonicalSha256,
      promotedAt: operationAt,
      sourceGeneratedAt: candidatePayload.generatedAt,
      externalPublicationPerformed: false,
      erpOrVegaWritePerformed: false,
      localModelUsed: false,
    },
    products,
  };
}

export function assertOwnerApprovedMainSelection(payload, sourceCandidate) {
  if (
    payload?.publicationStatus !== 'approved-internal-main-selection-not-published'
    || payload?.selectionStatus !== 'owner-approved-main-selection-external-publication-blocked'
    || payload?.approval?.status !== 'OWNER_APPROVED'
    || payload?.approval?.externalPublicationApproved !== false
    || !Array.isArray(payload?.products)
    || payload.products.length !== 30
  ) {
    throw promotionError('CATALOG_PROMOTION_RESULT_STATE_INVALID', 'Promoted main selection state is invalid');
  }
  const ids = payload.products.map((product) => Number(product?.sourceId || 0));
  if (new Set(ids).size !== 30 || ids.includes(158798) || !ids.includes(161167)) {
    throw promotionError('CATALOG_PROMOTION_RESULT_PRODUCTS_INVALID', 'Promoted product identities are invalid');
  }
  const actualCounts = buildBrandCounts(payload.products);
  if (!sameCounts(actualCounts, APPROVED_BRAND_COUNTS)) {
    throw promotionError('CATALOG_PROMOTION_RESULT_COMPOSITION_INVALID', 'Promoted brand composition changed');
  }

  const sourceById = new Map(sourceCandidate.products.map((product) => [Number(product.sourceId), product]));
  const approvedIds = new Set(APPROVED_CUSTOMER_NAMES.map((row) => row.sourceId));
  const unchanged = payload.products.filter((product) => {
    if (approvedIds.has(Number(product.sourceId))) return false;
    return json(product) === json(sourceById.get(Number(product.sourceId)));
  });
  if (unchanged.length !== 20) {
    throw promotionError(
      'CATALOG_PROMOTION_UNAPPROVED_PRODUCTS_CHANGED',
      `Expected 20 untouched products; found ${unchanged.length}`,
    );
  }
  const productsById = new Map(payload.products.map((product) => [Number(product.sourceId), product]));
  for (const approved of APPROVED_CUSTOMER_NAMES) {
    const product = productsById.get(approved.sourceId);
    if (
      text(product?.stockCode) !== approved.stockCode
      || text(product?.productName) !== approved.sourceProductName
      || text(product?.customerFacingName) !== approved.approvedProductName
      || product?.nameApproval?.status !== 'owner-approved-for-internal-catalog'
      || product?.nameApproval?.packageContentVerification !== 'pending-physical-or-supplier-verification'
      || !product?.reviewFlags?.includes('PACKAGE_CONTENT_VERIFICATION_PENDING')
      || product?.reviewFlags?.includes('GENERIC_PRODUCT_NAME')
    ) {
      throw promotionError(
        'CATALOG_PROMOTION_APPROVED_NAME_INVALID',
        `Approved customer name was not applied safely for ${approved.sourceId}`,
      );
    }
  }

  return {
    productCount: payload.products.length,
    uniqueProductCount: new Set(ids).size,
    untouchedProductCount: unchanged.length,
    approvedNameCount: APPROVED_CUSTOMER_NAMES.length,
    packageContentPendingCount: payload.dataQuality.packageContentPendingCount,
    brandCounts: actualCounts,
    externalPublicationApproved: false,
  };
}
