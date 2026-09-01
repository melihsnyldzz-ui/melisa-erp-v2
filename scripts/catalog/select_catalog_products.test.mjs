import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertApiWorkingDirectory,
  assertBaselineSelection,
  assertBrandComposition,
  assertCompleteCandidate,
  assertPerformanceSource,
  assertProductSourceMeta,
  buildDataQualitySummary,
  buildBrandCounts,
  buildSalesQuantityBySourceId,
  buildSalesPerformanceCoverage,
  compareSelections,
  isCatalogEligible,
  parseCatalogSelectionArgs,
  reviewBrandComposition,
  selectCatalogProducts,
  toCandidateProduct,
} from './select_catalog_products_core.mjs';

function product(overrides = {}) {
  return {
    sourceId: 1,
    stockCode: 'A-1',
    productName: 'Bebek Takımı',
    brand: 'MARKA A',
    category: 'TAKIM',
    unitName: 'ADET',
    currency: 'TRY',
    salePrice: 100,
    purchasePrice: 50,
    averageCostTry: 45,
    stockQuantity: 10,
    salesQuantity2026: 4,
    salesPerformanceStatus: 'partial-report',
    matchedBarcode: '8690000000001',
    supplierName: 'Özel tedarikçi',
    imagePath: '/uploads/vega-products/a-1.jpg',
    lastSaleDate: '2026-08-01',
    ...overrides,
  };
}

test('catalog selection defaults to preview and requires an explicit candidate-write flag', () => {
  assert.deepEqual(parseCatalogSelectionArgs([]), {
    help: false,
    writeCandidate: false,
    mode: 'preview',
  });
  assert.equal(parseCatalogSelectionArgs(['--write-candidate']).writeCandidate, true);
  assert.throws(
    () => parseCatalogSelectionArgs(['--write']),
    { code: 'CATALOG_SELECTION_ARGUMENT_INVALID' },
  );
});

test('catalog selection rejects a working directory that could load another environment file', () => {
  assert.equal(
    assertApiWorkingDirectory('C:\\repo\\apps\\api', 'C:\\repo\\apps\\api'),
    'C:\\repo\\apps\\api',
  );
  assert.throws(
    () => assertApiWorkingDirectory('C:\\repo', 'C:\\repo\\apps\\api'),
    { code: 'CATALOG_SELECTION_WORKING_DIRECTORY_INVALID' },
  );
});

test('catalog eligibility fails closed on stock, price, image, or barcode gaps', () => {
  assert.equal(isCatalogEligible(product()), true);
  assert.equal(isCatalogEligible(product({ stockQuantity: 0 })), false);
  assert.equal(isCatalogEligible(product({ salePrice: 0 })), false);
  assert.equal(isCatalogEligible(product({ imagePath: null })), false);
  assert.equal(isCatalogEligible(product({ matchedBarcode: null })), false);
});

test('selection honors brand quotas and ranks by stock without trusting partial sales totals', () => {
  const products = [
    product({ sourceId: 1, stockCode: 'A-1', salesQuantity2026: 5, stockQuantity: 100 }),
    product({ sourceId: 2, stockCode: 'A-2', salesQuantity2026: 8, stockQuantity: 20 }),
    product({ sourceId: 3, stockCode: 'A-3', salesQuantity2026: 2, stockQuantity: 200 }),
    product({ sourceId: 4, stockCode: 'B-1', brand: 'MARKA B', salesQuantity2026: 7 }),
    product({ sourceId: 5, stockCode: 'B-2', brand: 'MARKA B', salesQuantity2026: 6 }),
  ];
  const result = selectCatalogProducts(products, {
    targetCount: 3,
    maxBrands: 2,
    preferredCounts: { 'MARKA A': 2, 'MARKA B': 1 },
  });

  assert.deepEqual(result.selected.map((row) => row.stockCode), ['A-3', 'A-1', 'B-2']);
  assertCompleteCandidate(result.selected, 3);
});

test('selection preserves the approved baseline brand cohort', () => {
  const baseline = [
    product({ sourceId: 11, brand: 'MARKA A' }),
    product({ sourceId: 12, brand: 'MARKA A' }),
    product({ sourceId: 13, brand: 'MARKA B' }),
  ];
  const baselineCounts = assertBaselineSelection(baseline, 3);
  assert.deepEqual(baselineCounts, { 'MARKA A': 2, 'MARKA B': 1 });

  const available = [
    product({ sourceId: 21, brand: 'MARKA A', stockCode: 'A-21' }),
    product({ sourceId: 22, brand: 'MARKA A', stockCode: 'A-22' }),
    product({ sourceId: 23, brand: 'MARKA B', stockCode: 'B-23' }),
    product({ sourceId: 24, brand: 'YENİ MARKA', stockCode: 'NEW-24', salesQuantity2026: 999 }),
  ];
  const selection = selectCatalogProducts(available, {
    targetCount: 3,
    maxBrands: 2,
    preferredCounts: baselineCounts,
    allowedBrands: Object.keys(baselineCounts),
  });

  assert.deepEqual(buildBrandCounts(selection.selected), baselineCounts);
  assert.deepEqual(selection.selected.map((row) => row.stockCode), ['A-22', 'A-21', 'B-23']);
  assert.deepEqual(assertBrandComposition(selection.selected, baselineCounts), baselineCounts);
  assert.throws(
    () => assertBrandComposition([...selection.selected.slice(0, 2), available[3]], baselineCounts),
    { code: 'CATALOG_SELECTION_BRAND_COMPOSITION_CHANGED' },
  );

  const rebalanced = [
    product({ sourceId: 31, brand: 'MARKA A' }),
    product({ sourceId: 32, brand: 'MARKA A' }),
    product({ sourceId: 33, brand: 'MARKA A' }),
    product({ sourceId: 34, brand: 'MARKA B' }),
  ];
  assert.deepEqual(reviewBrandComposition(rebalanced, { 'MARKA A': 2, 'MARKA B': 2 }), {
    expected: { 'MARKA A': 2, 'MARKA B': 2 },
    actual: { 'MARKA A': 3, 'MARKA B': 1 },
    changed: true,
    requiresHumanReview: true,
    deltas: [
      { brand: 'MARKA A', expected: 2, actual: 3, difference: 1 },
      { brand: 'MARKA B', expected: 2, actual: 1, difference: -1 },
    ],
  });
  assert.throws(
    () => reviewBrandComposition(
      [product({ sourceId: 41, brand: 'YENİ MARKA' })],
      { 'MARKA A': 1 },
    ),
    { code: 'CATALOG_SELECTION_BRAND_COHORT_CHANGED' },
  );
  assert.throws(
    () => assertBaselineSelection([
      product({ sourceId: 71 }),
      product({ sourceId: 71 }),
    ], 2),
    { code: 'CATALOG_SELECTION_BASELINE_INVALID' },
  );
});

test('selection retains an eligible baseline product before a higher-ranked new product', () => {
  const products = [
    product({ sourceId: 51, stockCode: 'BASELINE', salesQuantity2026: 1, stockQuantity: 1 }),
    product({ sourceId: 52, stockCode: 'NEW-HIGH', salesQuantity2026: 999, stockQuantity: 999 }),
  ];
  const result = selectCatalogProducts(products, {
    targetCount: 1,
    maxBrands: 1,
    preferredCounts: { 'MARKA A': 1 },
    allowedBrands: ['MARKA A'],
    retainSourceIds: [51],
  });
  assert.deepEqual(result.selected.map((row) => row.stockCode), ['BASELINE']);
});

test('2026 sales quantities are summed across multiple currency rows for one product', () => {
  const quantities = buildSalesQuantityBySourceId([
    { id: 61, currency: 'TRY', years: [{ year: 2026, fullQuantity: 4 }] },
    { id: 61, currency: 'USD', years: [{ year: 2026, fullQuantity: 3 }] },
    { id: 62, currency: 'EUR', years: [{ year: 2026, fullQuantity: 2 }] },
  ]);
  assert.equal(quantities.get(61), 7);
  assert.equal(quantities.get(62), 2);
});

test('partial sales coverage does not outrank stronger current stock', () => {
  const products = [
    product({
      sourceId: 81,
      stockCode: 'UNKNOWN-HIGH-STOCK',
      salesPerformanceStatus: 'not-covered',
      stockQuantity: 999,
    }),
    product({
      sourceId: 82,
      stockCode: 'PARTIAL-REPORT',
      salesPerformanceStatus: 'partial-report',
      salesQuantity2026: 1,
      stockQuantity: 1,
    }),
  ];
  const result = selectCatalogProducts(products, {
    targetCount: 1,
    maxBrands: 1,
    preferredCounts: { 'MARKA A': 1 },
    allowedBrands: ['MARKA A'],
  });
  assert.deepEqual(result.selected.map((row) => row.stockCode), ['UNKNOWN-HIGH-STOCK']);
});

test('sales coverage separates report-not-covered replacements from retained products', () => {
  const coverage = buildSalesPerformanceCoverage([
    product({ sourceId: 91, salesPerformanceStatus: 'not-covered' }),
    product({ sourceId: 92, salesPerformanceStatus: 'not-covered' }),
    product({ sourceId: 93, salesPerformanceStatus: 'partial-report' }),
  ], [91]);
  assert.equal(coverage.completeCount, 0);
  assert.equal(coverage.partialReportCount, 1);
  assert.equal(coverage.notCoveredCount, 2);
  assert.equal(coverage.replacementNotCoveredCount, 1);
  assert.equal(coverage.requiresHumanReview, true);
  assert.deepEqual(coverage.replacementNotCovered.map((row) => row.sourceId), [92]);
});

test('generic names remain candidates but are isolated for content review', () => {
  const generic = product({ productName: 'TAKIM' });
  assert.equal(isCatalogEligible(generic), true);
  const summary = buildDataQualitySummary([generic]);
  assert.equal(summary.blockingIssueCount, 0);
  assert.equal(summary.contentReviewCount, 1);
  assert.equal(summary.performanceReviewCount, 1);
  assert.deepEqual(summary.reviewRequired[0].flags, [
    'GENERIC_PRODUCT_NAME',
    'SALES_PERFORMANCE_PARTIAL',
  ]);
});

test('candidate DTO omits barcode, cost, and supplier values', () => {
  const candidate = toCandidateProduct(product());
  assert.equal(Object.hasOwn(candidate, 'matchedBarcode'), false);
  assert.equal(Object.hasOwn(candidate, 'barcodeMasked'), false);
  assert.equal(Object.hasOwn(candidate, 'purchasePrice'), false);
  assert.equal(Object.hasOwn(candidate, 'averageCostTry'), false);
  assert.equal(Object.hasOwn(candidate, 'supplierName'), false);
  assert.equal(Object.hasOwn(candidate, 'salesQuantity2026'), false);
  assert.deepEqual(candidate.salesPerformance, {
    status: 'partial-report',
    reportedQuantity2026: 4,
    complete: false,
  });
  const notCovered = toCandidateProduct(product({ salesPerformanceStatus: 'not-covered' }));
  assert.equal(notCovered.salesPerformance.reportedQuantity2026, null);
});

test('comparison shows additions and removals without commercial values', () => {
  const comparison = compareSelections(
    [product({ sourceId: 1, stockCode: 'OLD-1' }), product({ sourceId: 2, stockCode: 'SAME' })],
    [product({ sourceId: 2, stockCode: 'SAME' }), product({ sourceId: 3, stockCode: 'NEW-3' })],
  );
  assert.equal(comparison.unchangedCount, 1);
  assert.deepEqual(comparison.added, [{ sourceId: 3, stockCode: 'NEW-3', brand: 'MARKA A' }]);
  assert.deepEqual(comparison.removed, [{ sourceId: 1, stockCode: 'OLD-1', brand: 'MARKA A' }]);
  assert.equal(JSON.stringify(comparison).includes('salePrice'), false);
});

test('pilot source checks reject an unexpected company, period, or missing sales year', () => {
  assert.deepEqual(assertProductSourceMeta({
    source: 'vega-live-read-only',
    filters: { companyCode: 'F0102', periodCode: 'D0007', year: 2026 },
  }), {
    source: 'vega-live-read-only',
    companyCode: 'F0102',
    periodCode: 'D0007',
    year: 2026,
  });
  assert.throws(
    () => assertProductSourceMeta({
      source: 'vega-live-read-only',
      filters: { companyCode: 'F9999', periodCode: 'D0007', year: 2026 },
    }),
    { code: 'CATALOG_SELECTION_SOURCE_MISMATCH' },
  );
  assert.throws(
    () => assertPerformanceSource({
      source: 'vega-live-read-only',
      companyCode: 'F0102',
      years: [2023, 2024, 2025],
      products: [{ id: 1 }],
    }),
    { code: 'CATALOG_SELECTION_PERFORMANCE_SOURCE_MISMATCH' },
  );
  assert.throws(
    () => assertPerformanceSource({
      source: 'vega-live-read-only',
      companyCode: 'F0102',
      years: [2026],
      products: [],
    }),
    { code: 'CATALOG_SELECTION_PERFORMANCE_SOURCE_MISMATCH' },
  );
});
