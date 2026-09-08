import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getSqlPool, closeSqlPool } from '../src/config/database.js';
import { getVegaProductImageMap, saveVegaProductImage } from '../src/services/vegaProductImageService.js';
import { getVegaProductMatchIndexFromWorker } from '../src/services/vegaProductMatchClientService.js';
import {
  findRecentWaitingCards,
  normalizeImageStockCode,
  rankReviewCandidates,
  RECENT_WAITING_CARD_DEFAULT_HOURS,
} from '../src/services/vegaProductImageMatchPolicy.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);
const genericBrandWords = new Set(['BABY', 'BEBE', 'KIDS', 'TEKSTIL', 'TEXTILE', 'FASHION']);
const matchRuleVersion = 2;

function argumentValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || fallback) : fallback;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function normalizeCode(value) {
  return normalizeImageStockCode(normalizeText(value));
}

function brandTokens(value) {
  return normalizeText(value).split(/\s+/).filter((token) => token && !genericBrandWords.has(token));
}

function supplierMatches(supplier, product) {
  const supplierParts = brandTokens(supplier);
  if (!supplierParts.length) return false;
  const productText = normalizeText(`${product.brand} ${product.stockCode}`);
  return supplierParts.every((token) => productText.includes(token));
}

function productCode(product) {
  return normalizeCode(normalizeText(product.stockCode).split(/\s+/)[0]);
}

function editDistance(left, right) {
  const a = normalizeText(left).replace(/\s+/g, '');
  const b = normalizeText(right).replace(/\s+/g, '');
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function brandSimilarity(supplier, product) {
  const left = normalizeText(supplier).replace(/\s+/g, '');
  const right = normalizeText(product.brand).replace(/\s+/g, '');
  if (!left || !right) return 0;
  return 1 - editDistance(left, right) / Math.max(left.length, right.length);
}

function parseImageIdentity(filePath, sourceRoot) {
  const relative = path.relative(sourceRoot, filePath);
  const parts = relative.split(path.sep);
  const stem = path.basename(filePath, path.extname(filePath)).replace(/\s+\(\d+\)$/i, '');
  const separatorIndex = stem.lastIndexOf(' - ');
  const rawSupplier = parts.length > 1 ? parts[0] : (separatorIndex > 0 ? stem.slice(0, separatorIndex) : '');
  const supplierKey = normalizeText(rawSupplier).replace(/\s+/g, '');
  const supplier = ['KODDANERP', 'BULUNAMAYAN', 'UNKNOWN'].includes(supplierKey) ? '' : rawSupplier;
  const rawCode = separatorIndex > 0 ? stem.slice(separatorIndex + 3) : stem;
  const codeMatch = rawCode.match(/\b[0-9A-Z][0-9A-Z._/-]*\b/i);
  return { supplier, code: normalizeCode(codeMatch?.[0] || '') };
}

async function listImages(root) {
  const output = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) output.push(fullPath);
    }
  }
  await walk(root);
  return output.sort((a, b) => a.localeCompare(b, 'tr'));
}

async function getExistingImageMap(sourceIds) {
  const result = new Map();
  for (let index = 0; index < sourceIds.length; index += 500) {
    const partial = await getVegaProductImageMap(sourceIds.slice(index, index + 500));
    partial.forEach((value, key) => result.set(key, value));
  }
  return result;
}

async function prepareImagePayload(filePath) {
  const watermarkPath = path.resolve(appRoot, '../web-admin/public/melisa-baby-watermark.png');
  const image = sharp(filePath).rotate();
  const metadata = await image.metadata();
  const width = Math.max(1, Number(metadata.width || 1200));
  const logoWidth = Math.min(Math.max(Math.round(width * 0.58), 220), Math.round(width * 0.72), 920);
  const logoRaw = await sharp(watermarkPath)
    .resize({ width: logoWidth, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 3; index < logoRaw.data.length; index += 4) {
    logoRaw.data[index] = Math.round(logoRaw.data[index] * 0.18);
  }
  const logo = await sharp(logoRaw.data, { raw: logoRaw.info }).png().toBuffer();
  const buffer = await image
    .composite([{ input: logo, gravity: 'centre', blend: 'over' }])
    .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return {
    fileName: `${path.basename(filePath, path.extname(filePath))}.jpg`,
    mimeType: 'image/jpeg',
    fileBase64: buffer.toString('base64'),
  };
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const sourceRoot = path.resolve(argumentValue('--source'));
const reportRoot = path.resolve(argumentValue('--reports', path.join(sourceRoot, '_ERP_RAPORLARI')));
const apply = process.argv.includes('--apply');
const requestedWaitingHours = Number(argumentValue('--recent-card-hours', RECENT_WAITING_CARD_DEFAULT_HOURS));
const recentCardHours = Number.isFinite(requestedWaitingHours) && requestedWaitingHours > 0
  ? requestedWaitingHours
  : RECENT_WAITING_CARD_DEFAULT_HOURS;
if (!argumentValue('--source')) throw new Error('--source klasörü zorunludur');

const products = await getVegaProductMatchIndexFromWorker();
const brandDictionary = new Map();
for (const product of products) {
  const name = String(product.brand || '').trim();
  const key = normalizeText(name);
  if (!key) continue;
  const current = brandDictionary.get(key) || { name, activeStockCount: 0, sampleCodes: [] };
  current.activeStockCount += 1;
  const code = productCode(product);
  if (code && current.sampleCodes.length < 8 && !current.sampleCodes.includes(code)) current.sampleCodes.push(code);
  brandDictionary.set(key, current);
}
const byCode = new Map();
for (const product of products) {
  const code = productCode(product);
  if (!code) continue;
  if (!byCode.has(code)) byCode.set(code, []);
  byCode.get(code).push(product);
}

const files = await listImages(sourceRoot);
const existingImages = await getExistingImageMap(products.map((product) => product.sourceId));
const rows = [];
for (const filePath of files) {
  const identity = parseImageIdentity(filePath, sourceRoot);
  const imageReceivedAt = (await stat(filePath)).mtime;
  const codeCandidates = byCode.get(identity.code) || [];
  let manualSourceId = null;
  try {
    const sidecar = JSON.parse(await readFile(`${filePath}.json`, 'utf8'));
    manualSourceId = Number(sidecar.manual_source_id || 0) || null;
  } catch {}
  const manualCandidate = manualSourceId
    ? codeCandidates.find((product) => Number(product.sourceId) === manualSourceId)
    : null;
  const brandCandidates = codeCandidates.filter((product) => supplierMatches(identity.supplier, product));
  const waitingPool = identity.supplier
    ? brandCandidates
    : codeCandidates;
  const recentWaitingCandidates = findRecentWaitingCards(waitingPool, {
    existingImages,
    receivedAt: imageReceivedAt,
    windowHours: recentCardHours,
  });
  const fuzzyCandidates = codeCandidates
    .map((product) => ({ product, score: brandSimilarity(identity.supplier, product) }))
    .sort((left, right) => right.score - left.score);
  const fuzzyWinner = fuzzyCandidates[0]?.score >= 0.78
    && fuzzyCandidates[0].score - (fuzzyCandidates[1]?.score || 0) >= 0.12
    ? fuzzyCandidates[0]
    : null;
  let exact = null;
  let confidence = 0;
  let matchSource = 'unresolved';
  if (manualCandidate) {
    exact = manualCandidate;
    confidence = 100;
    matchSource = 'manual_approval';
  } else if (brandCandidates.length === 1) {
    exact = brandCandidates[0];
    confidence = 100;
    matchSource = 'code_and_brand';
  } else if (codeCandidates.length === 1) {
    exact = codeCandidates[0];
    confidence = 95;
    matchSource = 'unique_active_code';
  } else if (recentWaitingCandidates.length === 1) {
    exact = recentWaitingCandidates[0].product;
    confidence = 92;
    matchSource = 'recent_waiting_card';
  } else if (fuzzyWinner) {
    exact = fuzzyWinner.product;
    confidence = Math.max(90, Math.round(fuzzyWinner.score * 100));
    matchSource = 'fuzzy_brand';
  }
  let status = 'review_required';
  let reason = 'Kod ve marka birlikte tek stok kartına bağlanamadı';
  if (!identity.code) reason = 'Fotoğraftan/model adından stok kodu çıkarılamadı';
  else if (!codeCandidates.length) reason = 'Vega aktif stoklarında model kodu bulunamadı';
  else if (!exact && brandCandidates.length > 1) reason = 'Aynı model kodu ve markada birden fazla stok kartı var';
  else if (!exact && codeCandidates.length > 1) reason = 'Model kodu birden fazla aktif karta çıkıyor; marka onayı gerekli';
  else if (exact && existingImages.has(exact.sourceId)) {
    status = 'already_has_image';
    reason = 'Stok kartında zaten görsel var';
  } else if (exact) {
    status = 'ready';
    reason = matchSource === 'manual_approval'
      ? 'Kullanıcı panelden ERP stok kartını onayladı'
      : matchSource === 'unique_active_code'
      ? 'Model kodu tek aktif Vega stok kartına çıktı; tekil kod otomatik aktarımı açık'
      : matchSource === 'recent_waiting_card'
        ? `Model kodu son ${recentCardHours} saatte açılmış tek görselsiz Vega kartına çıktı`
      : matchSource === 'fuzzy_brand'
        ? 'Model kodu ve benzer marka yazımı güçlü eşleşti'
        : 'Model kodu ve marka tek aktif Vega stok kartıyla eşleşti';
  }

  const row = {
    filePath,
    fileHash: createHash('sha256').update(await readFile(filePath)).digest('hex'),
    supplier: identity.supplier,
    detectedCode: identity.code,
    status,
    reason,
    candidateCount: codeCandidates.length,
    waitingCandidateCount: recentWaitingCandidates.length,
    confidence,
    matchSource,
    ruleVersion: matchRuleVersion,
    imageReceivedAt: imageReceivedAt.toISOString(),
    candidates: rankReviewCandidates(codeCandidates, recentWaitingCandidates)
      .map(({ product, waiting }) => ({
      sourceId: product.sourceId,
      stockCode: product.stockCode,
      brand: product.brand,
      productName: product.productName,
      cardOpenedAt: product.cardOpenedAt || null,
      hasImage: existingImages.has(product.sourceId),
      recentWaiting: Boolean(waiting),
      waitingAgeHours: waiting?.waitingAgeHours ?? null,
      similarity: Math.round(brandSimilarity(identity.supplier, product) * 100),
    })),
    sourceId: exact?.sourceId || null,
    stockCode: exact?.stockCode || '',
    productName: exact?.productName || '',
    brand: exact?.brand || '',
    imageUrl: exact ? existingImages.get(exact.sourceId) || '' : '',
    applied: false,
  };

  if (apply && status === 'ready') {
    const payload = await prepareImagePayload(filePath);
    const saved = await saveVegaProductImage(exact.sourceId, payload, { username: 'daily-photo-import' }, exact);
    row.applied = true;
    row.status = 'applied';
    row.imageUrl = saved.imageUrl;
    existingImages.set(exact.sourceId, saved.imageUrl);
  }
  rows.push(row);
  process.stdout.write(`IMPORT_ITEM|${rows.length}|${files.length}|${path.basename(filePath)}|${row.status}|${row.stockCode || '-'}\n`);
}

await mkdir(reportRoot, { recursive: true });
await writeFile(
  path.join(reportRoot, 'erp-marka-sozlugu.json'),
  JSON.stringify({
    createdAt: new Date().toISOString(),
    source: 'Vega aktif stok kartları',
    brandCount: brandDictionary.size,
    brands: [...brandDictionary.values()].sort((left, right) => left.name.localeCompare(right.name, 'tr')),
  }, null, 2),
  'utf8',
);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const summary = {
  createdAt: new Date().toISOString(),
  mode: apply ? 'apply' : 'preview',
  sourceRoot,
  vegaReadOnly: true,
  scanned: rows.length,
  ready: rows.filter((row) => row.status === 'ready').length,
  applied: rows.filter((row) => row.status === 'applied').length,
  alreadyHasImage: rows.filter((row) => row.status === 'already_has_image').length,
  reviewRequired: rows.filter((row) => row.status === 'review_required').length,
  rows,
};
const jsonPath = path.join(reportRoot, `erp-gorsel-${apply ? 'aktarim' : 'onizleme'}-${timestamp}.json`);
const csvPath = jsonPath.replace(/\.json$/i, '.csv');
await writeFile(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
const headers = ['status', 'reason', 'supplier', 'detectedCode', 'stockCode', 'brand', 'productName', 'sourceId', 'confidence', 'matchSource', 'candidateCount', 'filePath', 'imageUrl'];
await writeFile(csvPath, `${headers.map(csvCell).join(',')}\n${rows.map((row) => headers.map((key) => csvCell(row[key])).join(',')).join('\n')}\n`, 'utf8');
process.stdout.write(`IMPORT_SUMMARY|${JSON.stringify({ ...summary, rows: undefined, jsonPath, csvPath })}\n`);

await closeSqlPool().catch(() => {});
process.exit(0);
