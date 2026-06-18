import sharp from 'sharp';
import { closeSqlPool, getSqlPool } from '../src/config/database.js';
import { copyFile, mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const watermarkStyleVersion = 'large-center-v1';
const watermarkOpacity = 0.18;

function hasArg(name) {
  return process.argv.includes(name);
}

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function normalizePublicUploadPath(value) {
  const text = String(value || '').trim().replace(/\\/g, '/');
  if (!text || /^https?:\/\//i.test(text) || text.startsWith('data:')) return '';
  if (!text.startsWith('/uploads/products/')) return '';
  if (text.includes('..')) return '';
  return text;
}

function resolveUploadFile(publicPath) {
  const relativePath = publicPath.replace(/^\/uploads\//, '').replace(/\//g, path.sep);
  const uploadRoot = path.resolve(process.cwd(), 'uploads');
  const diskPath = path.resolve(uploadRoot, relativePath);
  if (!diskPath.startsWith(`${uploadRoot}${path.sep}`)) return '';
  return diskPath;
}

function getOutputOptions(extension) {
  if (extension === '.jpg' || extension === '.jpeg') {
    return { type: 'jpeg', options: { quality: 92, mozjpeg: true } };
  }
  if (extension === '.webp') {
    return { type: 'webp', options: { quality: 92 } };
  }
  return { type: 'png', options: { compressionLevel: 9 } };
}

async function readMarker(markerPath) {
  if (!existsSync(markerPath)) return null;
  try {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(markerPath, 'utf8'));
  } catch {
    return {};
  }
}

async function buildWatermarkBuffer(watermarkPath, width, height) {
  const watermarkMaxWidth = Math.min(
    Math.max(Math.round(width * 0.58), 220),
    Math.round(width * 0.72),
    920,
  );
  const watermarkMaxHeight = Math.max(90, Math.round(height * 0.36));
  const resized = await sharp(watermarkPath, { failOn: 'none' })
    .resize({
      width: watermarkMaxWidth,
      height: watermarkMaxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 3; index < resized.data.length; index += 4) {
    resized.data[index] = Math.round(resized.data[index] * watermarkOpacity);
  }

  return sharp(resized.data, { raw: resized.info }).png().toBuffer();
}

async function getProductImages() {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    SELECT
      image.id,
      image.product_id,
      image.file_path,
      image.storage_key,
      image.is_primary,
      product.stock_code,
      product.name AS product_name
    FROM dbo.product_images image
    INNER JOIN dbo.products product ON product.id = image.product_id
    WHERE image.is_active = 1
      AND image.file_path IS NOT NULL
    ORDER BY image.id ASC;
  `);
  return result.recordset || [];
}

async function applyWatermark({ image, diskPath, watermarkPath, apply }) {
  const extension = path.extname(diskPath).toLowerCase();
  const backupDir = path.join(path.dirname(diskPath), '.melisa-originals');
  const backupPath = path.join(backupDir, `${image.id}-${path.basename(diskPath)}`);
  const markerPath = `${backupPath}.done.json`;
  const marker = await readMarker(markerPath);

  if (marker?.styleVersion === watermarkStyleVersion) {
    return { status: 'skipped', reason: 'already-watermarked', image, diskPath };
  }

  const sourcePath = existsSync(backupPath) ? backupPath : diskPath;

  const baseImage = sharp(sourcePath, { failOn: 'none' }).rotate();
  const metadata = await baseImage.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!width || !height) {
    return { status: 'skipped', reason: 'unreadable-dimensions', image, diskPath };
  }

  const watermarkBuffer = await buildWatermarkBuffer(watermarkPath, width, height);
  const watermarkMeta = await sharp(watermarkBuffer).metadata();
  const left = Math.round((width - Number(watermarkMeta.width || 0)) / 2);
  const top = Math.round((height - Number(watermarkMeta.height || 0)) / 2);

  if (!apply) {
    return { status: 'planned', image, diskPath };
  }

  await mkdir(backupDir, { recursive: true });
  if (!existsSync(backupPath)) {
    await copyFile(diskPath, backupPath);
  }

  const tmpPath = `${diskPath}.melisa-watermark.tmp${extension}`;
  const outputOptions = getOutputOptions(extension);
  let output = sharp(sourcePath, { failOn: 'none' })
    .rotate()
    .composite([{
      input: watermarkBuffer,
      left,
      top,
      blend: 'over',
    }]);

  if (outputOptions.type === 'jpeg') output = output.jpeg(outputOptions.options);
  if (outputOptions.type === 'png') output = output.png(outputOptions.options);
  if (outputOptions.type === 'webp') output = output.webp(outputOptions.options);

  await output.toFile(tmpPath);
  await rename(tmpPath, diskPath);
  await writeFile(markerPath, JSON.stringify({
    imageId: image.id,
    productId: image.product_id,
    filePath: image.file_path,
    backupPath,
    styleVersion: watermarkStyleVersion,
    opacity: watermarkOpacity,
    watermarkedAt: new Date().toISOString(),
  }, null, 2));

  return { status: 'watermarked', image, diskPath, backupPath };
}

function printSummary(results, apply) {
  const counts = results.reduce((acc, item) => {
    const key = item.status === 'skipped' ? `skipped:${item.reason}` : item.status;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    total: results.length,
    counts,
    samples: results.slice(0, 10).map((item) => ({
      status: item.status,
      reason: item.reason || null,
      imageId: item.image?.id || null,
      productId: item.image?.product_id || null,
      stockCode: item.image?.stock_code || null,
      filePath: item.image?.file_path || null,
    })),
  }, null, 2));
}

async function main() {
  const apply = hasArg('--apply');
  const limit = Number(getArgValue('--limit', '0')) || 0;
  const watermarkPath = path.resolve(
    process.cwd(),
    '..',
    'web-admin',
    'public',
    'melisa-baby-watermark.png',
  );

  if (!existsSync(watermarkPath)) {
    throw new Error(`Watermark file was not found: ${watermarkPath}`);
  }

  const images = await getProductImages();
  const selected = [];
  const results = [];

  for (const image of images) {
    const publicPath = normalizePublicUploadPath(image.file_path);
    if (!publicPath) {
      results.push({ status: 'skipped', reason: 'not-local-upload', image });
      continue;
    }

    const diskPath = resolveUploadFile(publicPath);
    const extension = path.extname(diskPath).toLowerCase();
    if (!supportedExtensions.has(extension)) {
      results.push({ status: 'skipped', reason: 'unsupported-extension', image, diskPath });
      continue;
    }

    try {
      await stat(diskPath);
    } catch {
      results.push({ status: 'skipped', reason: 'missing-file', image, diskPath });
      continue;
    }

    selected.push({ image, diskPath });
  }

  const limited = limit > 0 ? selected.slice(0, limit) : selected;
  for (const item of limited) {
    results.push(await applyWatermark({
      image: item.image,
      diskPath: item.diskPath,
      watermarkPath,
      apply,
    }));
  }

  printSummary(results, apply);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSqlPool().catch(() => {});
  });
