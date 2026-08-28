import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeSqlPool } from '../../apps/api/src/config/database.js';
import {
  getActiveVegaProductImageSourceIds,
  getVegaProductImageMap,
} from '../../apps/api/src/services/vegaProductImageService.js';
import { getVegaProductsListFromWorker } from '../../apps/api/src/services/vegaProductClientService.js';
import { getVegaSalesPerformanceFromWorker } from '../../apps/api/src/services/vegaSalesPerformanceClientService.js';

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

function normalizeBrand(value) {
  return String(value || '').trim() || 'MARKASIZ';
}

function year2026Quantity(performance) {
  return Number(performance?.years?.find((row) => row.year === 2026)?.fullQuantity || 0);
}

async function main() {
  const imageSourceIds = await getActiveVegaProductImageSourceIds();
  const products = [];
  const imageMap = new Map();

  for (const group of chunks(imageSourceIds, 500)) {
    const result = await getVegaProductsListFromWorker({
      includeSourceIds: group,
      imageStatus: 'with-image',
      activeOnly: true,
      page: 1,
      limit: 500,
    });
    products.push(...(result.data || []));
    const groupImages = await getVegaProductImageMap(group);
    for (const [sourceId, filePath] of groupImages) imageMap.set(sourceId, filePath);
  }

  let performanceProducts = [];
  try {
    const performance = await getVegaSalesPerformanceFromWorker();
    performanceProducts = performance?.products || [];
  } catch (error) {
    console.warn(`Sales performance unavailable; continuing with stock recency: ${error.code || error.message}`);
  }

  const performanceBySourceId = new Map(
    performanceProducts.map((row) => [Number(row.id), row]),
  );
  const resolvedProducts = [...new Map(products.map((product) => [product.sourceId, product])).values()]
    .map((product) => ({
      ...product,
      brand: normalizeBrand(product.brand),
      imagePath: imageMap.get(product.sourceId) || null,
      salesQuantity2026: year2026Quantity(performanceBySourceId.get(product.sourceId)),
    }))
    .filter((product) => product.imagePath && !excludedSourceIds.has(product.sourceId));

  const brandRows = new Map();
  for (const product of resolvedProducts) {
    const row = brandRows.get(product.brand) || {
      brand: product.brand,
      imageProducts: 0,
      eligibleProducts: [],
    };
    row.imageProducts += 1;
    if (Number(product.stockQuantity || 0) > 0 && Number(product.salePrice || 0) > 0) {
      row.eligibleProducts.push(product);
    }
    brandRows.set(product.brand, row);
  }

  const topBrands = [...brandRows.values()]
    .filter((row) => row.eligibleProducts.length > 0)
    .sort((a, b) => b.imageProducts - a.imageProducts || a.brand.localeCompare(b.brand, 'tr'))
    .slice(0, 5);

  const preferredCounts = new Map([
    ['MURAT BABY', 9],
    ['NAYINOM', 7],
    ['HİPPIL', 5],
    ['MİNİZEYN', 5],
    ['CONCEPT', 4],
  ]);
  const selected = [];
  for (const brandRow of topBrands) {
    const limit = Math.min(
      preferredCounts.get(brandRow.brand) || 6,
      brandRow.eligibleProducts.length,
    );
    const ranked = brandRow.eligibleProducts.sort((a, b) =>
      b.salesQuantity2026 - a.salesQuantity2026
      || Number(b.stockQuantity || 0) - Number(a.stockQuantity || 0)
      || String(b.lastSaleDate || '').localeCompare(String(a.lastSaleDate || ''))
      || Number(b.sourceId) - Number(a.sourceId));
    selected.push(...ranked.slice(0, limit));
  }

  if (selected.length < 30) {
    const selectedIds = new Set(selected.map((product) => product.sourceId));
    const extras = topBrands
      .flatMap((row) => row.eligibleProducts)
      .filter((product) => !selectedIds.has(product.sourceId))
      .sort((a, b) => b.salesQuantity2026 - a.salesQuantity2026
        || Number(b.stockQuantity || 0) - Number(a.stockQuantity || 0));
    selected.push(...extras.slice(0, 30 - selected.length));
  }

  const safeProduct = (product) => ({
    sourceId: product.sourceId,
    stockCode: product.stockCode,
    productName: product.productName,
    brand: product.brand,
    category: product.category,
    unitName: product.unitName,
    currency: product.currency,
    salePrice: product.salePrice,
    stockQuantity: product.stockQuantity,
    salesQuantity2026: product.salesQuantity2026,
    imagePath: product.imagePath,
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'Vega live read-only + Melisa ERP product images',
    imageProductCount: resolvedProducts.length,
    topBrands: topBrands.map((row) => ({
      brand: row.brand,
      imageProducts: row.imageProducts,
      catalogEligible: row.eligibleProducts.length,
    })),
    products: selected.slice(0, 30).map(safeProduct),
  };

  await mkdir(outputDir, { recursive: true });
  const target = path.join(outputDir, 'catalog-selection.json');
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ target, selected: payload.products.length, topBrands: payload.topBrands }, null, 2));
}

try {
  await main();
} finally {
  await closeSqlPool();
}
