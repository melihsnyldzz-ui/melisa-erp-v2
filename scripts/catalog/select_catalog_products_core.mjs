const BLOCKING_REVIEW_FLAGS = new Set([
  'MISSING_IMAGE',
  'NO_STOCK',
  'MISSING_SALE_PRICE',
  'MISSING_BARCODE',
]);

const GENERIC_PRODUCT_NAMES = new Set([
  'TAKIM',
]);

export const PILOT_SOURCE_IDENTITY = Object.freeze({
  source: 'vega-live-read-only',
  companyCode: 'F0102',
  periodCode: 'D0007',
  year: 2026,
});

export const DEFAULT_PREFERRED_COUNTS = Object.freeze({
  'MURAT BABY': 9,
  NAYINOM: 7,
  'HİPPIL': 5,
  'MİNİZEYN': 5,
  CONCEPT: 4,
});

function selectionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizedText(value) {
  return String(value || '').trim();
}

function normalizedNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function productIdentity(product) {
  return {
    sourceId: Number(product?.sourceId || 0),
    stockCode: normalizedText(product?.stockCode),
    brand: normalizeBrand(product?.brand),
  };
}

export function parseCatalogSelectionArgs(args = []) {
  const allowed = new Set(['--help', '--write-candidate']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0) {
    throw selectionError(
      'CATALOG_SELECTION_ARGUMENT_INVALID',
      `Unsupported catalog selection argument: ${unknown.join(', ')}`,
    );
  }

  return {
    help: args.includes('--help'),
    writeCandidate: args.includes('--write-candidate'),
    mode: args.includes('--write-candidate') ? 'candidate-write' : 'preview',
  };
}

export function assertApiWorkingDirectory(actualPath, expectedPath) {
  const normalize = (value) => normalizedText(value)
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLocaleLowerCase('en-US');
  if (normalize(actualPath) !== normalize(expectedPath)) {
    throw selectionError(
      'CATALOG_SELECTION_WORKING_DIRECTORY_INVALID',
      `Catalog selection must run from the API working directory: ${expectedPath}`,
    );
  }
  return expectedPath;
}

export function normalizeBrand(value) {
  return normalizedText(value) || 'MARKASIZ';
}

export function year2026Quantity(performance) {
  return normalizedNumber(
    performance?.years?.find((row) => Number(row.year) === PILOT_SOURCE_IDENTITY.year)?.fullQuantity,
  );
}

export function buildSalesQuantityBySourceId(performanceProducts = []) {
  const quantities = new Map();
  for (const performance of performanceProducts) {
    const sourceId = Number(performance?.id || 0);
    if (sourceId <= 0) continue;
    quantities.set(
      sourceId,
      normalizedNumber(quantities.get(sourceId)) + year2026Quantity(performance),
    );
  }
  return quantities;
}

export function productReviewFlags(product) {
  const flags = [];
  const productName = normalizedText(product?.productName).toLocaleUpperCase('tr-TR');

  if (!normalizedText(product?.imagePath)) flags.push('MISSING_IMAGE');
  if (normalizedNumber(product?.stockQuantity) <= 0) flags.push('NO_STOCK');
  if (normalizedNumber(product?.salePrice) <= 0) flags.push('MISSING_SALE_PRICE');
  if (!normalizedText(product?.matchedBarcode)) flags.push('MISSING_BARCODE');
  if (GENERIC_PRODUCT_NAMES.has(productName)) flags.push('GENERIC_PRODUCT_NAME');
  if (normalizedText(product?.salesPerformanceStatus) === 'not-covered') {
    flags.push('SALES_PERFORMANCE_NOT_COVERED');
  }
  if (normalizedText(product?.salesPerformanceStatus) === 'partial-report') {
    flags.push('SALES_PERFORMANCE_PARTIAL');
  }

  return flags;
}

export function isCatalogEligible(product) {
  return !productReviewFlags(product).some((flag) => BLOCKING_REVIEW_FLAGS.has(flag));
}

export function buildBrandCounts(products = []) {
  const counts = {};
  for (const product of products) {
    const brand = normalizeBrand(product?.brand);
    counts[brand] = Number(counts[brand] || 0) + 1;
  }
  return counts;
}

export function assertBaselineSelection(products = [], targetCount = 30) {
  if (products.length !== targetCount) {
    throw selectionError(
      'CATALOG_SELECTION_BASELINE_INVALID',
      `Catalog baseline requires ${targetCount} products; ${products.length} were found`,
    );
  }
  const sourceIds = products.map((product) => Number(product?.sourceId || 0));
  if (new Set(sourceIds).size !== products.length || sourceIds.some((sourceId) => sourceId <= 0)) {
    throw selectionError(
      'CATALOG_SELECTION_BASELINE_INVALID',
      'Catalog baseline contains a missing or duplicate source identity',
    );
  }
  const brandCounts = buildBrandCounts(products);
  if (Object.keys(brandCounts).length === 0) {
    throw selectionError(
      'CATALOG_SELECTION_BASELINE_INVALID',
      'Catalog baseline does not contain a usable brand cohort',
    );
  }
  return brandCounts;
}

export function selectCatalogProducts(products = [], options = {}) {
  const targetCount = Number(options.targetCount || 30);
  const maxBrands = Number(options.maxBrands || 5);
  const preferredCounts = options.preferredCounts || DEFAULT_PREFERRED_COUNTS;
  const retainedSourceIds = new Set((options.retainSourceIds || [])
    .map(Number)
    .filter((sourceId) => sourceId > 0));
  const allowedBrands = Array.isArray(options.allowedBrands)
    ? options.allowedBrands.map(normalizeBrand)
    : null;
  const allowedBrandSet = allowedBrands ? new Set(allowedBrands) : null;
  const uniqueProducts = [...new Map(
    products
      .filter((product) => Number(product?.sourceId) > 0)
      .map((product) => [Number(product.sourceId), {
        ...product,
        sourceId: Number(product.sourceId),
        brand: normalizeBrand(product.brand),
      }]),
  ).values()];

  const brandRows = new Map();
  for (const product of uniqueProducts.filter((item) => normalizedText(item.imagePath))) {
    const row = brandRows.get(product.brand) || {
      brand: product.brand,
      imageProducts: 0,
      eligibleProducts: [],
    };
    row.imageProducts += 1;
    if (isCatalogEligible(product)) row.eligibleProducts.push(product);
    brandRows.set(product.brand, row);
  }

  const rankProducts = (a, b) =>
    Number(retainedSourceIds.has(b.sourceId)) - Number(retainedSourceIds.has(a.sourceId))
    || normalizedNumber(b.stockQuantity) - normalizedNumber(a.stockQuantity)
    || normalizedText(b.lastSaleDate).localeCompare(normalizedText(a.lastSaleDate))
    || Number(b.sourceId) - Number(a.sourceId);

  const availableBrandRows = [...brandRows.values()]
    .filter((row) => row.eligibleProducts.length > 0);
  const topBrands = (allowedBrandSet
    ? allowedBrands
      .map((brand) => brandRows.get(brand))
      .filter((row) => row && row.eligibleProducts.length > 0)
    : availableBrandRows
      .sort((a, b) => b.imageProducts - a.imageProducts || a.brand.localeCompare(b.brand, 'tr')))
    .filter((row) => !allowedBrandSet || allowedBrandSet.has(row.brand))
    .slice(0, maxBrands);

  const selected = [];
  for (const brandRow of topBrands) {
    const preferredCount = preferredCounts instanceof Map
      ? preferredCounts.get(brandRow.brand)
      : preferredCounts[brandRow.brand];
    const limit = Math.min(
      Number(preferredCount || Math.ceil(targetCount / Math.max(maxBrands, 1))),
      brandRow.eligibleProducts.length,
    );
    const ranked = [...brandRow.eligibleProducts].sort(rankProducts);
    selected.push(...ranked.slice(0, limit));
  }

  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((product) => product.sourceId));
    const extras = topBrands
      .flatMap((row) => row.eligibleProducts)
      .filter((product) => !selectedIds.has(product.sourceId))
      .sort(rankProducts);
    selected.push(...extras.slice(0, targetCount - selected.length));
  }

  return {
    selected: selected.slice(0, targetCount),
    topBrands: topBrands.map((row) => ({
      brand: row.brand,
      imageProducts: row.imageProducts,
      catalogEligible: row.eligibleProducts.length,
    })),
  };
}

export function assertCompleteCandidate(products = [], targetCount = 30) {
  if (products.length !== targetCount) {
    throw selectionError(
      'CATALOG_SELECTION_COUNT_INCOMPLETE',
      `Catalog candidate requires ${targetCount} products; ${products.length} were selected`,
    );
  }

  const sourceIds = products.map((product) => Number(product?.sourceId || 0));
  if (new Set(sourceIds).size !== products.length || sourceIds.some((sourceId) => sourceId <= 0)) {
    throw selectionError(
      'CATALOG_SELECTION_IDENTITY_INVALID',
      'Catalog candidate contains a missing or duplicate source identity',
    );
  }

  const blocked = products
    .map((product) => ({
      ...productIdentity(product),
      flags: productReviewFlags(product).filter((flag) => BLOCKING_REVIEW_FLAGS.has(flag)),
    }))
    .filter((row) => row.flags.length > 0);
  if (blocked.length > 0) {
    throw selectionError(
      'CATALOG_SELECTION_BLOCKING_DATA_QUALITY',
      `Catalog candidate contains ${blocked.length} product(s) with blocking data-quality issues`,
    );
  }

  return products;
}

export function assertBrandComposition(products = [], expectedCounts = {}) {
  const actualCounts = buildBrandCounts(products);
  const expectedEntries = Object.entries(expectedCounts)
    .map(([brand, count]) => [normalizeBrand(brand), Number(count || 0)])
    .filter(([, count]) => count > 0);
  const matches = expectedEntries.every(([brand, count]) => actualCounts[brand] === count)
    && Object.keys(actualCounts).length === expectedEntries.length;
  if (!matches) {
    throw selectionError(
      'CATALOG_SELECTION_BRAND_COMPOSITION_CHANGED',
      `Catalog candidate brand composition changed: ${JSON.stringify({ expected: Object.fromEntries(expectedEntries), actual: actualCounts })}`,
    );
  }
  return actualCounts;
}

export function reviewBrandComposition(products = [], expectedCounts = {}) {
  const actualCounts = buildBrandCounts(products);
  const expected = Object.fromEntries(Object.entries(expectedCounts)
    .map(([brand, count]) => [normalizeBrand(brand), Number(count || 0)])
    .filter(([, count]) => count > 0));
  const expectedBrands = Object.keys(expected);
  const actualBrands = Object.keys(actualCounts);
  const outsideBrands = actualBrands.filter((brand) => !expectedBrands.includes(brand));
  const missingBrands = expectedBrands.filter((brand) => !actualBrands.includes(brand));
  if (outsideBrands.length > 0 || missingBrands.length > 0) {
    throw selectionError(
      'CATALOG_SELECTION_BRAND_COHORT_CHANGED',
      `Catalog candidate brand cohort changed: ${JSON.stringify({ outsideBrands, missingBrands })}`,
    );
  }

  const deltas = expectedBrands
    .map((brand) => ({
      brand,
      expected: expected[brand],
      actual: actualCounts[brand],
      difference: actualCounts[brand] - expected[brand],
    }))
    .filter((row) => row.difference !== 0);

  return {
    expected,
    actual: actualCounts,
    changed: deltas.length > 0,
    requiresHumanReview: deltas.length > 0,
    deltas,
  };
}

export function toCandidateProduct(product) {
  return {
    sourceId: Number(product.sourceId),
    stockCode: normalizedText(product.stockCode),
    productName: normalizedText(product.productName),
    brand: normalizeBrand(product.brand),
    category: normalizedText(product.category),
    unitName: normalizedText(product.unitName),
    currency: normalizedText(product.currency),
    salePrice: normalizedNumber(product.salePrice),
    stockQuantity: normalizedNumber(product.stockQuantity),
    salesPerformance: {
      status: product.salesPerformanceStatus === 'partial-report' ? 'partial-report' : 'not-covered',
      reportedQuantity2026: product.salesPerformanceStatus === 'partial-report'
        ? normalizedNumber(product.salesQuantity2026)
        : null,
      complete: false,
    },
    imagePath: normalizedText(product.imagePath),
    reviewFlags: productReviewFlags(product).filter((flag) => !BLOCKING_REVIEW_FLAGS.has(flag)),
  };
}

export function compareSelections(previousProducts = [], currentProducts = []) {
  const previous = new Map(previousProducts.map((product) => [Number(product.sourceId), product]));
  const current = new Map(currentProducts.map((product) => [Number(product.sourceId), product]));
  const added = [...current.entries()]
    .filter(([sourceId]) => !previous.has(sourceId))
    .map(([, product]) => productIdentity(product));
  const removed = [...previous.entries()]
    .filter(([sourceId]) => !current.has(sourceId))
    .map(([, product]) => productIdentity(product));

  return {
    previousCount: previous.size,
    currentCount: current.size,
    unchangedCount: [...current.keys()].filter((sourceId) => previous.has(sourceId)).length,
    added,
    removed,
  };
}

export function buildDataQualitySummary(products = []) {
  const reviewRequired = products
    .map((product) => ({
      ...productIdentity(product),
      flags: productReviewFlags(product),
    }))
    .filter((row) => row.flags.length > 0);

  return {
    selectedCount: products.length,
    blockingIssueCount: reviewRequired.filter((row) =>
      row.flags.some((flag) => BLOCKING_REVIEW_FLAGS.has(flag))).length,
    contentReviewCount: reviewRequired.filter((row) =>
      row.flags.includes('GENERIC_PRODUCT_NAME')).length,
    performanceReviewCount: reviewRequired.filter((row) =>
      row.flags.includes('SALES_PERFORMANCE_NOT_COVERED')
      || row.flags.includes('SALES_PERFORMANCE_PARTIAL')).length,
    reviewRequired,
  };
}

export function buildSalesPerformanceCoverage(products = [], retainedSourceIds = []) {
  const retained = new Set(retainedSourceIds.map(Number));
  const notCovered = products
    .filter((product) => product.salesPerformanceStatus !== 'partial-report')
    .map((product) => ({
      ...productIdentity(product),
      retainedBaselineProduct: retained.has(Number(product.sourceId)),
    }));
  const replacementNotCovered = notCovered.filter((row) => !row.retainedBaselineProduct);

  return {
    selectedCount: products.length,
    completeCount: 0,
    partialReportCount: products.length - notCovered.length,
    notCoveredCount: notCovered.length,
    replacementNotCoveredCount: replacementNotCovered.length,
    requiresHumanReview: products.length > 0,
    notCovered,
    replacementNotCovered,
  };
}

export function assertProductSourceMeta(meta = {}, expected = PILOT_SOURCE_IDENTITY) {
  const actual = {
    source: normalizedText(meta.source),
    companyCode: normalizedText(meta.filters?.companyCode),
    periodCode: normalizedText(meta.filters?.periodCode),
    year: Number(meta.filters?.year || 0),
  };
  const matches = actual.source === expected.source
    && actual.companyCode === expected.companyCode
    && actual.periodCode === expected.periodCode
    && actual.year === expected.year;
  if (!matches) {
    throw selectionError(
      'CATALOG_SELECTION_SOURCE_MISMATCH',
      `Unexpected Vega product source: ${JSON.stringify(actual)}`,
    );
  }
  return actual;
}

export function assertPerformanceSource(performance = {}, expected = PILOT_SOURCE_IDENTITY) {
  const actual = {
    source: normalizedText(performance.source),
    companyCode: normalizedText(performance.companyCode),
    years: Array.isArray(performance.years) ? performance.years.map(Number) : [],
  };
  const matches = actual.source === expected.source
    && actual.companyCode === expected.companyCode
    && actual.years.includes(expected.year)
    && Array.isArray(performance.products)
    && performance.products.length > 0;
  if (!matches) {
    throw selectionError(
      'CATALOG_SELECTION_PERFORMANCE_SOURCE_MISMATCH',
      `Unexpected Vega performance source: ${JSON.stringify(actual)}`,
    );
  }
  return actual;
}
