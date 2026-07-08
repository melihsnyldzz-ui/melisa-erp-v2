import { closeSqlPool, getSqlPool } from '../src/config/database.js';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactToken(value) {
  return normalizeToken(value).replace(/\s+/g, '');
}

function productSearchTokens(product) {
  return [
    product.stockCode,
    product.barcode,
    product.productName,
  ].map((value) => compactToken(value)).filter(Boolean);
}

function classifyMatch(product, image) {
  const fileToken = compactToken(image.baseName);
  const exactTokens = [product.stockCode, product.barcode]
    .map((value) => compactToken(value))
    .filter(Boolean);

  if (exactTokens.some((token) => token === fileToken)) {
    return { confidence: 'high', reason: 'exact-stock-code-or-barcode' };
  }

  if (exactTokens.some((token) => token.length >= 4 && fileToken.includes(token))) {
    return { confidence: 'high', reason: 'filename-contains-stock-code-or-barcode' };
  }

  const nameToken = compactToken(product.productName);
  if (nameToken && nameToken.length >= 8 && fileToken.includes(nameToken.slice(0, Math.min(nameToken.length, 18)))) {
    return { confidence: 'low', reason: 'filename-partially-matches-product-name' };
  }

  return null;
}

function buildImageIndex(images) {
  return images.map((image) => ({
    ...image,
    normalizedBaseName: compactToken(image.baseName),
  }));
}

async function walkImageFiles(rootDir) {
  if (!rootDir) return [];

  const resolvedRoot = path.resolve(rootDir);
  const files = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!supportedExtensions.has(extension)) continue;

      files.push({
        filePath: fullPath,
        relativePath: path.relative(resolvedRoot, fullPath).replace(/\\/g, '/'),
        fileName: entry.name,
        baseName: path.basename(entry.name, extension),
        extension,
      });
    }
  }

  await walk(resolvedRoot);
  return files;
}

async function readFixtureProducts(fixturePath) {
  const text = (await readFile(path.resolve(fixturePath), 'utf8')).replace(/^\uFEFF/, '');
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : parsed.products || [];
}

async function readSqlProducts() {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    SELECT
      p.id,
      p.stock_code AS stockCode,
      p.name AS productName,
      p.brand,
      p.category,
      s.name AS supplierName,
      pb.barcode,
      pi.file_path AS imagePath
    FROM dbo.products p
    LEFT JOIN dbo.suppliers s ON s.id = p.supplier_id
    OUTER APPLY (
      SELECT TOP (1) b.barcode
      FROM dbo.product_barcodes b
      WHERE b.product_id = p.id
        AND b.is_active = 1
      ORDER BY b.is_primary DESC, b.id ASC
    ) pb
    OUTER APPLY (
      SELECT TOP (1) image.file_path
      FROM dbo.product_images image
      WHERE image.product_id = p.id
        AND image.is_active = 1
      ORDER BY image.is_primary DESC, image.sort_order ASC, image.id ASC
    ) pi
    WHERE p.is_deleted = 0
      AND p.is_active = 1
    ORDER BY p.id ASC;
  `);

  return result.recordset || [];
}

function summarizeGroup(products, fieldName) {
  const groups = new Map();
  for (const product of products) {
    const key = String(product[fieldName] || 'Unspecified').trim() || 'Unspecified';
    const group = groups.get(key) || { name: key, total: 0, withImage: 0, missingImage: 0 };
    group.total += 1;
    if (product.imagePath) group.withImage += 1;
    else group.missingImage += 1;
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      coverageRate: group.total ? Number((group.withImage / group.total).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.missingImage - a.missingImage || a.name.localeCompare(b.name));
}

function buildMatches(products, images) {
  const indexedImages = buildImageIndex(images);
  const matches = [];
  const ambiguous = [];
  const unmatchedImages = [];

  for (const image of indexedImages) {
    const candidates = [];
    for (const product of products) {
      const match = classifyMatch(product, image);
      if (match) {
        candidates.push({ product, ...match });
      }
    }

    if (candidates.length === 1) {
      const candidate = candidates[0];
      matches.push({
        confidence: candidate.confidence,
        reason: candidate.reason,
        productId: candidate.product.id,
        stockCode: candidate.product.stockCode || '',
        barcode: candidate.product.barcode || '',
        productName: candidate.product.productName || '',
        brand: candidate.product.brand || '',
        supplierName: candidate.product.supplierName || '',
        currentImagePath: candidate.product.imagePath || '',
        sourceImage: image.relativePath,
      });
      continue;
    }

    if (candidates.length > 1) {
      ambiguous.push({
        sourceImage: image.relativePath,
        candidates: candidates.slice(0, 10).map((candidate) => ({
          confidence: candidate.confidence,
          reason: candidate.reason,
          productId: candidate.product.id,
          stockCode: candidate.product.stockCode || '',
          productName: candidate.product.productName || '',
        })),
      });
      continue;
    }

    unmatchedImages.push(image.relativePath);
  }

  return { matches, ambiguous, unmatchedImages };
}

function buildReport({ products, images, matches, ambiguous, unmatchedImages, sourceDir }) {
  const productsMissingImages = products
    .filter((product) => !product.imagePath)
    .map((product) => ({
      productId: product.id,
      stockCode: product.stockCode || '',
      barcode: product.barcode || '',
      productName: product.productName || '',
      brand: product.brand || '',
      supplierName: product.supplierName || '',
    }));

  const highConfidence = matches.filter((match) => match.confidence === 'high');
  const lowConfidence = matches.filter((match) => match.confidence === 'low');

  return {
    generatedAt: new Date().toISOString(),
    mode: 'dry-run',
    source: sourceDir ? path.resolve(sourceDir) : 'coverage-only',
    summary: {
      productsTotal: products.length,
      productsWithImage: products.length - productsMissingImages.length,
      productsMissingImage: productsMissingImages.length,
      scannedImages: images.length,
      highConfidenceMatches: highConfidence.length,
      lowConfidenceMatches: lowConfidence.length,
      ambiguousImages: ambiguous.length,
      unmatchedImages: unmatchedImages.length,
    },
    coverage: {
      byBrand: summarizeGroup(products, 'brand').slice(0, 50),
      bySupplier: summarizeGroup(products, 'supplierName').slice(0, 50),
    },
    matches: {
      highConfidence,
      lowConfidence,
      ambiguous,
      unmatchedImages: unmatchedImages.slice(0, 100),
    },
    productsMissingImages: productsMissingImages.slice(0, 500),
    applyPolicy: {
      supportedByThisScript: false,
      rule: 'This script never writes product_images or copies uploads. Use the report for human review before any approved apply step.',
      highConfidence: 'Can be proposed for a small approved apply batch after reviewer confirmation.',
      lowConfidence: 'Must be reviewed manually; never bulk apply.',
    },
  };
}

function toMarkdown(report) {
  const lines = [
    '# Product Media Workflow Dry-Run Report',
    '',
    `Generated at: ${report.generatedAt}`,
    `Source: ${report.source}`,
    '',
    '## Summary',
    '',
    `- Products total: ${report.summary.productsTotal}`,
    `- Products with image: ${report.summary.productsWithImage}`,
    `- Products missing image: ${report.summary.productsMissingImage}`,
    `- Scanned source images: ${report.summary.scannedImages}`,
    `- High-confidence matches: ${report.summary.highConfidenceMatches}`,
    `- Low-confidence matches: ${report.summary.lowConfidenceMatches}`,
    `- Ambiguous images: ${report.summary.ambiguousImages}`,
    `- Unmatched images: ${report.summary.unmatchedImages}`,
    '',
    '## Apply Policy',
    '',
    '- This report is dry-run only.',
    '- Low-confidence and ambiguous matches require manual review.',
    '- No upload files should be committed to Git.',
    '- No DB apply step should run without explicit Melih approval.',
    '',
    '## High-Confidence Match Samples',
    '',
    '| Stock Code | Product | Image | Reason |',
    '|---|---|---|---|',
    ...report.matches.highConfidence.slice(0, 25).map((match) => (
      `| ${match.stockCode || '-'} | ${String(match.productName || '-').replace(/\|/g, '/')} | ${match.sourceImage} | ${match.reason} |`
    )),
    '',
    '## Missing Image Samples',
    '',
    '| Stock Code | Product | Brand | Supplier |',
    '|---|---|---|---|',
    ...report.productsMissingImages.slice(0, 25).map((product) => (
      `| ${product.stockCode || '-'} | ${String(product.productName || '-').replace(/\|/g, '/')} | ${product.brand || '-'} | ${product.supplierName || '-'} |`
    )),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

async function writeOutput(filePath, content) {
  const resolved = path.resolve(filePath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, content);
}

async function main() {
  const sourceDir = getArgValue('--source-dir');
  const fixtureProducts = getArgValue('--fixture-products');
  const reportPath = getArgValue('--write-report');
  const manifestPath = getArgValue('--write-review-manifest');
  const markdown = hasArg('--markdown');

  if (hasArg('--apply')) {
    throw new Error('Apply is intentionally not implemented. Generate a dry-run report and request explicit approval for any write step.');
  }

  if (sourceDir && !existsSync(path.resolve(sourceDir))) {
    throw new Error(`Source directory was not found: ${sourceDir}`);
  }

  const products = fixtureProducts ? await readFixtureProducts(fixtureProducts) : await readSqlProducts();
  const images = await walkImageFiles(sourceDir);
  const { matches, ambiguous, unmatchedImages } = buildMatches(products, images);
  const report = buildReport({ products, images, matches, ambiguous, unmatchedImages, sourceDir });
  const output = markdown ? toMarkdown(report) : JSON.stringify(report, null, 2);

  if (reportPath) {
    await writeOutput(reportPath, output);
  } else {
    console.log(output);
  }

  if (manifestPath) {
    const reviewManifest = {
      generatedAt: report.generatedAt,
      mode: 'review-only',
      note: 'This manifest is not an apply command. Review each row before any approved write step.',
      highConfidenceMatches: report.matches.highConfidence,
      lowConfidenceMatches: report.matches.lowConfidence,
      ambiguous: report.matches.ambiguous,
    };
    await writeOutput(manifestPath, JSON.stringify(reviewManifest, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqlPool().catch(() => {});
  });
