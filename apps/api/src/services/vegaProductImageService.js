import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import { notifyProductBrain } from './productBrainNotifier.mjs';

const allowedImageMimeTypes = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const maxProductImageBytes = 3 * 1024 * 1024;

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSourceId(value) {
  const sourceId = Number(value);
  if (!Number.isInteger(sourceId) || sourceId < 1) {
    throw makeServiceError('VEGA_PRODUCT_ID_INVALID', 'Vega stok kimliği geçersiz');
  }
  return sourceId;
}

function normalizeImageBase64(value) {
  const text = trimText(value);
  const match = text.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
  return match ? match[1] : text;
}

function safeFilePart(value) {
  return trimText(value)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
}

async function hasImageSchema(pool) {
  const result = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID(N'dbo.vega_product_images', N'U') IS NULL THEN 0 ELSE 1 END AS is_ready;
  `);
  return Boolean(result.recordset?.[0]?.is_ready);
}

async function requireImageSchema(pool) {
  if (!(await hasImageSchema(pool))) {
    throw makeServiceError(
      'VEGA_PRODUCT_IMAGE_SCHEMA_MISSING',
      'Vega stok görsel altyapısı kurulmamış. 0015_vega_product_images migrationı uygulanmalı.',
      503,
    );
  }
}

async function saveUploadedFile(sourceId, payload = {}) {
  const fileBase64 = normalizeImageBase64(payload.fileBase64 || payload.base64 || payload.dataUrl);
  if (!fileBase64) return null;

  const mimeType = trimText(payload.mimeType).toLowerCase();
  const extension = allowedImageMimeTypes[mimeType];
  if (!extension) {
    throw makeServiceError('VEGA_PRODUCT_IMAGE_TYPE_INVALID', 'Sadece JPG, PNG veya WEBP görsel yüklenebilir');
  }

  const buffer = Buffer.from(fileBase64, 'base64');
  if (!buffer.length || buffer.length > maxProductImageBytes) {
    throw makeServiceError('VEGA_PRODUCT_IMAGE_SIZE_INVALID', 'Ürün görseli 3 MB altında olmalı');
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'vega-products');
  await mkdir(uploadDir, { recursive: true });
  const originalName = safeFilePart(payload.fileName || `vega-product-${sourceId}`);
  const fileName = `vega-${sourceId}-${Date.now()}-${originalName}.${extension}`;
  await writeFile(path.join(uploadDir, fileName), buffer);

  return {
    filePath: `/uploads/vega-products/${fileName}`,
    storageKey: `vega-products/${fileName}`,
  };
}

export async function getVegaProductImageMap(sourceIds = []) {
  const ids = [...new Set(sourceIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 500);
  if (!ids.length) return new Map();

  const pool = await getSqlPool();
  if (!(await hasImageSchema(pool))) return new Map();

  const driver = getSqlDriver();
  const request = pool.request();
  const parameters = ids.map((id, index) => {
    request.input(`sourceId${index}`, driver.BigInt, id);
    return `@sourceId${index}`;
  });
  const result = await request.query(`
    SELECT vega_source_id, file_path
    FROM dbo.vega_product_images
    WHERE vega_source_id IN (${parameters.join(', ')})
      AND is_active = 1
      AND is_primary = 1;
  `);

  return new Map((result.recordset || []).map((row) => [Number(row.vega_source_id), row.file_path]));
}

export async function getActiveVegaProductImageSourceIds() {
  const pool = await getSqlPool();
  if (!(await hasImageSchema(pool))) return [];

  const result = await pool.request().query(`
    SELECT DISTINCT vega_source_id
    FROM dbo.vega_product_images
    WHERE is_active = 1
      AND is_primary = 1
    ORDER BY vega_source_id ASC;
  `);

  return (result.recordset || [])
    .map((row) => Number(row.vega_source_id))
    .filter((sourceId) => Number.isInteger(sourceId) && sourceId > 0);
}

export async function saveVegaProductImage(sourceIdValue, payload, actor = null, verifiedProduct = null) {
  assertMelisaWriteEnabled();
  const sourceId = normalizeSourceId(sourceIdValue);
  const product = {
    sourceId,
    stockCode: trimText(verifiedProduct?.stockCode),
    productName: trimText(verifiedProduct?.productName),
  };
  if (!product.stockCode) {
    throw makeServiceError('VEGA_PRODUCT_NOT_FOUND', 'Vega stok kartı bulunamadı', 404);
  }
  const pool = await getSqlPool();
  await requireImageSchema(pool);
  const uploaded = await saveUploadedFile(sourceId, payload);
  const filePath = uploaded?.filePath || trimText(payload?.filePath || payload?.imageUrl || payload?.url);
  const storageKey = uploaded?.storageKey || trimText(payload?.storageKey || filePath);
  if (!filePath) {
    throw makeServiceError('VEGA_PRODUCT_IMAGE_PATH_REQUIRED', 'Görsel dosyası veya bağlantısı gerekli');
  }

  const driver = getSqlDriver();
  const transaction = new driver.Transaction(pool);
  await transaction.begin();

  try {
    await new driver.Request(transaction)
      .input('sourceId', driver.BigInt, sourceId)
      .input('actorId', driver.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.vega_product_images
        SET is_primary = 0, is_active = 0, updated_at = SYSUTCDATETIME(), updated_by = @actorId
        WHERE vega_source_id = @sourceId AND is_active = 1;
      `);

    const result = await new driver.Request(transaction)
      .input('sourceId', driver.BigInt, sourceId)
      .input('stockCode', driver.NVarChar(120), product.stockCode)
      .input('filePath', driver.NVarChar(500), filePath)
      .input('storageKey', driver.NVarChar(200), storageKey.slice(0, 200))
      .input('actorId', driver.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.vega_product_images (
          vega_source_id, stock_code, file_path, storage_key,
          is_primary, is_active, created_by, updated_by
        )
        OUTPUT inserted.id
        VALUES (@sourceId, @stockCode, @filePath, @storageKey, 1, 1, @actorId, @actorId);
      `);

    const imageId = Number(result.recordset?.[0]?.id);
    await writeAuditLog(new driver.Request(transaction), {
      action: 'vega_product_image_saved',
      entityType: 'vega_product_image',
      entityId: imageId,
      afterSnapshot: { sourceId, stockCode: product.stockCode, filePath },
      actor,
    });
    await transaction.commit();
    notifyProductBrain(sourceId);
    return { id: imageId, ...product, filePath, imageUrl: filePath };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function removeVegaProductImage(sourceIdValue, actor = null) {
  assertMelisaWriteEnabled();
  const sourceId = normalizeSourceId(sourceIdValue);
  const pool = await getSqlPool();
  await requireImageSchema(pool);
  const driver = getSqlDriver();
  const transaction = new driver.Transaction(pool);
  await transaction.begin();

  try {
    const result = await new driver.Request(transaction)
      .input('sourceId', driver.BigInt, sourceId)
      .input('actorId', driver.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.vega_product_images
        SET is_primary = 0, is_active = 0, updated_at = SYSUTCDATETIME(), updated_by = @actorId
        OUTPUT inserted.id, deleted.file_path
        WHERE vega_source_id = @sourceId AND is_active = 1;
      `);

    await writeAuditLog(new driver.Request(transaction), {
      action: 'vega_product_image_removed',
      entityType: 'vega_product',
      entityId: sourceId,
      beforeSnapshot: { imageIds: (result.recordset || []).map((row) => Number(row.id)), filePaths: (result.recordset || []).map((row) => row.file_path) },
      afterSnapshot: { sourceId, activeImage: null },
      actor,
    });
    await transaction.commit();
    notifyProductBrain(sourceId);
    return { sourceId, removed: result.rowsAffected?.[0] || 0 };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
