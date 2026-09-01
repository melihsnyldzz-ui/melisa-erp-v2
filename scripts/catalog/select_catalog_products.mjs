import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeSqlPool } from '../../apps/api/src/config/database.js';
import {
  getActiveVegaProductImageSourceIds,
  getVegaProductImageMap,
} from '../../apps/api/src/services/vegaProductImageService.js';
import { getVegaProductsListFromWorker } from '../../apps/api/src/services/vegaProductClientService.js';
import { getVegaSalesPerformanceFromWorker } from '../../apps/api/src/services/vegaSalesPerformanceClientService.js';
import {
  assertApiWorkingDirectory,
  assertBaselineSelection,
  assertCompleteCandidate,
  assertPerformanceSource,
  assertProductSourceMeta,
  buildSalesQuantityBySourceId,
  buildDataQualitySummary,
  buildSalesPerformanceCoverage,
  compareSelections,
  normalizeBrand,
  parseCatalogSelectionArgs,
  reviewBrandComposition,
  selectCatalogProducts,
  toCandidateProduct,
} from './select_catalog_products_core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(rootDir, 'output', 'pdf', 'catalog_work');
const excludedSourceIds = new Set([
  119682, // Source image contains customer-facing blue X annotations.
  138512, // Source image contains a customer-facing red X annotation.
]);

function chunks(values, size) {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
}

async function readBaseline(target) {
  try {
    const source = await readFile(target, 'utf8');
    const payload = JSON.parse(source);
    if (!Array.isArray(payload.products)) {
      throw new Error('Baseline catalog selection does not contain a products array');
    }
    return {
      payload,
      sha256: createHash('sha256').update(source).digest('hex'),
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { payload: { products: [] }, sha256: null };
    throw error;
  }
}

function candidateFileName(generatedAt) {
  const stamp = generatedAt.replace(/[-:.]/g, '');
  return `catalog-selection-candidate-${stamp}.json`;
}

function printHelp() {
  console.log([
    'Usage: node select_catalog_products.mjs [--write-candidate]',
    '',
    'No argument: read-only preview; writes no file.',
    '--write-candidate: writes a new timestamped candidate file; never overwrites catalog-selection.json.',
  ].join('\n'));
}

async function main() {
  const cli = parseCatalogSelectionArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }
  assertApiWorkingDirectory(process.cwd(), path.join(rootDir, 'apps', 'api'));

  const baselineTarget = path.join(outputDir, 'catalog-selection.json');
  const baseline = await readBaseline(baselineTarget);
  const baselineBrandCounts = assertBaselineSelection(baseline.payload.products, 30);

  const imageSourceIds = await getActiveVegaProductImageSourceIds();
  const products = [];
  const imageMap = new Map();
  let sourceIdentity = null;

  for (const group of chunks(imageSourceIds, 500)) {
    const result = await getVegaProductsListFromWorker({
      includeSourceIds: group,
      imageStatus: 'with-image',
      activeOnly: true,
      page: 1,
      limit: 500,
    });
    const currentSourceIdentity = assertProductSourceMeta(result.meta);
    sourceIdentity ||= currentSourceIdentity;
    products.push(...(result.data || []));
    const groupImages = await getVegaProductImageMap(group);
    for (const [sourceId, filePath] of groupImages) imageMap.set(sourceId, filePath);
  }

  const performance = await getVegaSalesPerformanceFromWorker();
  const performanceIdentity = assertPerformanceSource(performance);
  const performanceProducts = performance.products || [];

  const salesQuantityBySourceId = buildSalesQuantityBySourceId(performanceProducts);
  const performanceSourceIds = new Set(salesQuantityBySourceId.keys());
  const resolvedProducts = [...new Map(products.map((product) => [product.sourceId, product])).values()]
    .map((product) => ({
      ...product,
      brand: normalizeBrand(product.brand),
      imagePath: imageMap.get(product.sourceId) || null,
      salesQuantity2026: Number(salesQuantityBySourceId.get(product.sourceId) || 0),
      salesPerformanceStatus: performanceSourceIds.has(product.sourceId) ? 'partial-report' : 'not-covered',
    }))
    .filter((product) => product.imagePath && !excludedSourceIds.has(product.sourceId));

  const selection = selectCatalogProducts(resolvedProducts, {
    preferredCounts: baselineBrandCounts,
    allowedBrands: Object.keys(baselineBrandCounts),
    retainSourceIds: baseline.payload.products.map((product) => product.sourceId),
    maxBrands: Object.keys(baselineBrandCounts).length,
    targetCount: 30,
  });
  assertCompleteCandidate(selection.selected, 30);
  const brandCompositionReview = reviewBrandComposition(selection.selected, baselineBrandCounts);
  const candidateBrandCounts = brandCompositionReview.actual;
  const candidateProducts = selection.selected.map(toCandidateProduct);
  const salesPerformanceCoverage = buildSalesPerformanceCoverage(
    selection.selected,
    baseline.payload.products.map((product) => product.sourceId),
  );
  const generatedAt = new Date().toISOString();

  const payload = {
    generatedAt,
    source: 'Vega live read-only + Melisa ERP product images',
    sourceIdentity,
    performanceIdentity,
    publicationStatus: 'not-published-local-candidate',
    brandPolicy: 'retain-valid-baseline-products-and-review-cohort-rebalancing',
    rankingPolicy: 'retain-valid-baseline-then-stock-and-last-sale; partial sales report is not used for ranking',
    baselineBrandCounts,
    candidateBrandCounts,
    brandCompositionReview,
    imageProductCount: resolvedProducts.length,
    topBrands: selection.topBrands,
    dataQuality: buildDataQualitySummary(selection.selected),
    salesPerformanceCoverage,
    products: candidateProducts,
  };

  const comparison = compareSelections(baseline.payload.products, candidateProducts);
  const candidateTarget = path.join(outputDir, candidateFileName(generatedAt));

  if (cli.writeCandidate) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(candidateTarget, `${JSON.stringify({
      ...payload,
      baseline: {
        fileName: path.basename(baselineTarget),
        sha256: baseline.sha256,
      },
      comparison,
    }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  }

  console.log(JSON.stringify({
    mode: cli.mode,
    writePerformed: cli.writeCandidate,
    canonicalBaseline: {
      target: baselineTarget,
      sha256: baseline.sha256,
      overwritten: false,
    },
    candidateTarget: cli.writeCandidate ? candidateTarget : null,
    selected: payload.products.length,
    sourceIdentity,
    performanceIdentity,
    brandPolicy: payload.brandPolicy,
    rankingPolicy: payload.rankingPolicy,
    baselineBrandCounts,
    candidateBrandCounts,
    brandCompositionReview,
    topBrands: payload.topBrands,
    dataQuality: payload.dataQuality,
    salesPerformanceCoverage,
    comparison,
  }, null, 2));
}

try {
  await main();
} finally {
  await closeSqlPool();
}
