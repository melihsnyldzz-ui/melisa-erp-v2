import {
  isCatalogEligible,
  normalizeBrand,
  productReviewFlags,
} from './select_catalog_products_core.mjs';

export const CURRENT_CANDIDATE_FILE_NAME = 'catalog-selection-candidate-20260830T222401113Z.json';
export const CURRENT_CANDIDATE_SHA256 = 'd1078566833e478ea0273bf368e1d58177dd5401c01a176b0e9a6bff91a0cfa1';
export const CANONICAL_SELECTION_FILE_NAME = 'catalog-selection.json';
export const CANONICAL_SELECTION_SHA256 = '765656a0bb73ed9d744774e0196457b5525ce49dc4f200ac9cb103b0183717d3';
export const BLOCKED_SOURCE_ID = 158798;
export const TARGET_BRAND = 'CONCEPT';

const FORBIDDEN_OUTPUT_KEYS = new Set([
  'barcode',
  'barcodeMasked',
  'matchedBarcode',
  'salePrice',
  'purchasePrice',
  'purchasePriceLocal',
  'purchasePriceForeign',
  'averageCostTry',
  'customer',
  'customerName',
  'documentNo',
]);

function replacementError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value) {
  return String(value || '').trim();
}

function number(value) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

function sha(value) {
  return text(value).toLowerCase();
}

function isGenericName(product) {
  return productReviewFlags(product).includes('GENERIC_PRODUCT_NAME');
}

function dateRank(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseConceptReplacementArgs(args = []) {
  const allowed = new Set(['--help', '--write-report']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0) {
    throw replacementError(
      'CONCEPT_REPLACEMENT_ARGUMENT_INVALID',
      `Unsupported CONCEPT replacement argument: ${unknown.join(', ')}`,
    );
  }
  return {
    help: args.includes('--help'),
    writeReport: args.includes('--write-report'),
    mode: args.includes('--write-report') ? 'local-evidence-write' : 'preview',
  };
}

export function assertPinnedSelectionDocuments({
  candidatePayload,
  candidateSha256,
  canonicalPayload,
  canonicalSha256,
}) {
  if (sha(candidateSha256) !== CURRENT_CANDIDATE_SHA256) {
    throw replacementError(
      'CONCEPT_REPLACEMENT_CANDIDATE_HASH_MISMATCH',
      'The unpublished candidate hash changed',
    );
  }
  if (sha(canonicalSha256) !== CANONICAL_SELECTION_SHA256) {
    throw replacementError(
      'CONCEPT_REPLACEMENT_CANONICAL_HASH_MISMATCH',
      'The canonical catalog selection hash changed',
    );
  }
  if (
    candidatePayload?.publicationStatus !== 'not-published-local-candidate'
    || !Array.isArray(candidatePayload?.products)
    || candidatePayload.products.length !== 30
  ) {
    throw replacementError(
      'CONCEPT_REPLACEMENT_CANDIDATE_INVALID',
      'The source candidate must be an unpublished 30-product selection',
    );
  }
  if (!Array.isArray(canonicalPayload?.products) || canonicalPayload.products.length !== 30) {
    throw replacementError(
      'CONCEPT_REPLACEMENT_CANONICAL_INVALID',
      'The canonical catalog selection must contain 30 products',
    );
  }
  const blocked = candidatePayload.products.find(
    (product) => Number(product?.sourceId) === BLOCKED_SOURCE_ID,
  );
  if (!blocked || normalizeBrand(blocked.brand) !== TARGET_BRAND) {
    throw replacementError(
      'CONCEPT_REPLACEMENT_BLOCKED_PRODUCT_MISSING',
      'The blocked 7770 CONCEPT product is not present in the pinned candidate',
    );
  }

  return {
    candidateProductCount: candidatePayload.products.length,
    canonicalProductCount: canonicalPayload.products.length,
    blockedProduct: {
      sourceId: Number(blocked.sourceId),
      stockCode: text(blocked.stockCode),
      brand: normalizeBrand(blocked.brand),
    },
  };
}

export function assertSafeEvidence(value) {
  if (Array.isArray(value)) {
    value.forEach(assertSafeEvidence);
    return value;
  }
  if (!value || typeof value !== 'object') return value;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_OUTPUT_KEYS.has(key)) {
      throw replacementError(
        'CONCEPT_REPLACEMENT_FORBIDDEN_OUTPUT_FIELD',
        `Forbidden replacement evidence field: ${key}`,
      );
    }
    assertSafeEvidence(child);
  }
  return value;
}

export function buildSafeConceptShortlist({
  products = [],
  imageMap = new Map(),
  currentProducts = [],
  excludedSourceIds = [],
  limit = 10,
} = {}) {
  const currentIds = new Set(currentProducts.map((product) => Number(product?.sourceId)));
  const excludedIds = new Set(excludedSourceIds.map(Number));
  const uniqueProducts = [...new Map(products
    .filter((product) => Number(product?.sourceId) > 0)
    .map((product) => [Number(product.sourceId), product])).values()];

  const eligible = uniqueProducts
    .map((product) => ({
      ...product,
      sourceId: Number(product.sourceId),
      brand: normalizeBrand(product.brand),
      imagePath: imageMap.get(Number(product.sourceId)) || null,
    }))
    .filter((product) => product.brand === TARGET_BRAND)
    .filter((product) => !currentIds.has(product.sourceId))
    .filter((product) => !excludedIds.has(product.sourceId))
    .filter((product) => isCatalogEligible(product))
    .sort((a, b) =>
      Number(isGenericName(a)) - Number(isGenericName(b))
      || number(b.stockQuantity) - number(a.stockQuantity)
      || dateRank(b.lastSaleDate) - dateRank(a.lastSaleDate)
      || b.sourceId - a.sourceId);

  const rows = eligible.slice(0, Math.max(1, Number(limit) || 10)).map((product, index) => ({
    rank: index + 1,
    sourceId: product.sourceId,
    stockCode: text(product.stockCode),
    productName: text(product.productName),
    brand: product.brand,
    category: text(product.category),
    unitName: text(product.unitName),
    stockQuantity: number(product.stockQuantity),
    lastSaleDate: product.lastSaleDate || null,
    imagePath: text(product.imagePath),
    dataChecks: {
      active: !product.isPassive,
      imagePresent: Boolean(text(product.imagePath)),
      stockPresent: number(product.stockQuantity) > 0,
      salePricePresent: number(product.salePrice) > 0,
      barcodePresent: Boolean(text(product.matchedBarcode)),
    },
    reviewFlags: productReviewFlags(product)
      .filter((flag) => !['SALES_PERFORMANCE_NOT_COVERED', 'SALES_PERFORMANCE_PARTIAL'].includes(flag)),
  }));

  if (rows.length === 0) {
    throw replacementError(
      'CONCEPT_REPLACEMENT_NO_SAFE_CANDIDATE',
      'No eligible CONCEPT replacement candidate was found',
    );
  }
  assertSafeEvidence(rows);
  return rows;
}

