import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeAuditLog } from './auditService.js';
import { assertAccountingPeriodOpen } from './periodLockService.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import { nullableCost } from './productCostValue.js';

function toProductDto(row) {
  return {
    id: row.id,
    stockCode: row.stock_code,
    barcodeMasked: row.barcode_raw || null,
    matchedBarcode: row.matched_barcode || null,
    productName: row.product_name,
    brand: row.brand,
    category: row.category,
    supplierId: row.supplier_id ? Number(row.supplier_id) : null,
    supplierCode: row.supplier_code || null,
    supplierName: row.supplier_name || null,
    currency: row.currency_code,
    salePrice: Number(row.sale_price || 0),
    purchasePrice: Number(row.purchase_price || 0),
    purchaseDiscountRate: Number(row.purchase_discount_rate || 0),
    averageCostTry: nullableCost(row.average_cost_try),
    stockQuantity: Number(row.stock_quantity || 0),
    imageUrl: row.image_file_path || null,
    isPassive: !row.is_active,
    cardOpenedAt: row.created_at || null,
  };
}

function toProductDetailDto(row) {
  return {
    id: row.id,
    stockCode: row.stock_code,
    barcodeMasked: row.barcode_raw || null,
    productName: row.product_name,
    brand: row.brand,
    category: row.category,
    supplierId: row.supplier_id ? Number(row.supplier_id) : null,
    supplierCode: row.supplier_code || null,
    currency: row.currency_code,
    salePrice: Number(row.sale_price || 0),
    purchasePrice: Number(row.purchase_price || 0),
    purchaseDiscountRate: Number(row.purchase_discount_rate || 0),
    stockQuantity: Number(row.stock_quantity || 0),
    supplierName: row.supplier_name || null,
    isPassive: !row.is_active,
    averageCostTry: nullableCost(row.average_cost_try),
    averageCostCurrency: row.average_cost_try == null ? null : nullableCost(row.average_cost_currency),
    cardOpenedAt: row.card_opened_at || null,
    lastPurchaseDate: row.last_purchase_date || null,
    lastSaleDate: row.last_sale_date || null,
    barcodes: [],
    images: [],
  };
}

function toBarcodeDto(row) {
  return {
    id: Number(row.id),
    barcode: row.barcode,
    type: row.barcode_type,
    isPrimary: Boolean(row.is_primary),
    isActive: Boolean(row.is_active),
    status: row.is_active ? 'Aktif' : 'Pasif',
    createdAt: row.created_at,
  };
}

function toImageDto(row) {
  return {
    id: Number(row.id),
    filePath: row.file_path || '',
    storageKey: row.storage_key || '',
    isPrimary: Boolean(row.is_primary),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
  };
}

function makeServiceError(code, message, statusCode = 400, meta = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.meta = meta;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProductListDate(value, fieldName) {
  const text = trimText(value);

  if (!text) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw makeServiceError('PRODUCT_LIST_DATE_INVALID', `${fieldName} must use YYYY-MM-DD format`);
  }

  return text;
}

const maxBulkProductCount = 500;
const maxBulkProductCreateCount = 100;
const bulkNameModes = new Set(['find_replace', 'prefix', 'suffix']);

function normalizeBulkProductIds(value) {
  const ids = [...new Set((Array.isArray(value) ? value : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))];

  if (ids.length === 0) {
    throw makeServiceError('PRODUCT_BULK_SELECTION_REQUIRED', 'Select at least one product');
  }

  if (ids.length > maxBulkProductCount) {
    throw makeServiceError('PRODUCT_BULK_LIMIT_EXCEEDED', `At most ${maxBulkProductCount} products can be updated at once`);
  }

  return ids;
}

function normalizeBulkProductChanges(value = {}) {
  const changes = {};

  if (value.brand?.enabled === true) {
    const brand = trimText(value.brand.value);
    if (!brand) throw makeServiceError('PRODUCT_BULK_BRAND_REQUIRED', 'Brand cannot be empty');
    changes.brand = brand.slice(0, 120);
  }

  if (value.category?.enabled === true) {
    const category = trimText(value.category.value);
    if (!category) throw makeServiceError('PRODUCT_BULK_CATEGORY_REQUIRED', 'Category cannot be empty');
    changes.category = category.slice(0, 120);
  }

  if (value.supplier?.enabled === true) {
    const supplierId = Number(value.supplier.id);
    if (!Number.isInteger(supplierId) || supplierId < 1) {
      throw makeServiceError('PRODUCT_BULK_SUPPLIER_REQUIRED', 'Select a valid main supplier');
    }
    changes.supplierId = supplierId;
  }

  if (value.productName?.enabled === true) {
    const mode = trimText(value.productName.mode);
    const text = trimText(value.productName.value);
    const find = trimText(value.productName.find);

    if (!bulkNameModes.has(mode)) {
      throw makeServiceError('PRODUCT_BULK_NAME_MODE_INVALID', 'Product name operation is invalid');
    }
    if (!text) {
      throw makeServiceError('PRODUCT_BULK_NAME_VALUE_REQUIRED', 'Product name text cannot be empty');
    }
    if (mode === 'find_replace' && !find) {
      throw makeServiceError('PRODUCT_BULK_NAME_FIND_REQUIRED', 'Text to find is required');
    }

    changes.productName = {
      mode,
      find: find.slice(0, 250),
      value: text.slice(0, 250),
    };
  }

  if (Object.keys(changes).length === 0) {
    throw makeServiceError('PRODUCT_BULK_CHANGE_REQUIRED', 'Select at least one field to update');
  }

  return changes;
}

function applyNameChange(currentName, change) {
  const name = trimText(currentName);
  if (!change) return name;

  if (change.mode === 'prefix') return `${change.value} ${name}`.trim().slice(0, 250);
  if (change.mode === 'suffix') return `${name} ${change.value}`.trim().slice(0, 250);

  const normalizedFind = change.find.toLocaleLowerCase('tr-TR');
  const index = name.toLocaleLowerCase('tr-TR').indexOf(normalizedFind);
  if (index < 0) return name;
  return `${name.slice(0, index)}${change.value}${name.slice(index + change.find.length)}`.trim().slice(0, 250);
}

function buildBulkConfirmationCode(count) {
  return `TOPLU-GUNCELLE-${count}`;
}

async function loadBulkProductSnapshots(request, ids, { lock = false } = {}) {
  const placeholders = ids.map((id, index) => {
    request.input(`bulkProductId${index}`, sql.BigInt, id);
    return `@bulkProductId${index}`;
  });

  const result = await request.query(`
    SELECT
      p.id,
      p.stock_code AS stockCode,
      p.name AS productName,
      p.brand,
      p.category,
      p.supplier_id AS supplierId,
      s.supplier_code AS supplierCode,
      s.name AS supplierName,
      p.updated_at AS updatedAt
    FROM dbo.products p ${lock ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
    LEFT JOIN dbo.suppliers s ON s.id = p.supplier_id
    WHERE p.id IN (${placeholders.join(', ')})
      AND p.is_deleted = 0
    ORDER BY p.stock_code ASC;
  `);

  return result.recordset || [];
}

async function resolveBulkSupplier(request, supplierId) {
  if (!supplierId) return null;

  const result = await request
    .input('bulkSupplierId', sql.BigInt, supplierId)
    .query(`
      SELECT TOP (1) id, supplier_code AS supplierCode, name AS supplierName
      FROM dbo.suppliers
      WHERE id = @bulkSupplierId
        AND is_deleted = 0
        AND is_active = 1;
    `);

  const supplier = result.recordset?.[0];
  if (!supplier) {
    throw makeServiceError('PRODUCT_BULK_SUPPLIER_NOT_FOUND', 'Main supplier was not found or is passive', 404);
  }
  return supplier;
}

function buildBulkPreviewRows(rows, changes, supplier) {
  return rows.map((row) => {
    const after = {
      productName: applyNameChange(row.productName, changes.productName),
      brand: changes.brand ?? row.brand ?? '',
      category: changes.category ?? row.category ?? '',
      supplierId: changes.supplierId ?? (row.supplierId ? Number(row.supplierId) : null),
      supplierCode: supplier?.supplierCode ?? row.supplierCode ?? '',
      supplierName: supplier?.supplierName ?? row.supplierName ?? '',
    };
    const changedFields = ['productName', 'brand', 'category', 'supplierId']
      .filter((field) => String(after[field] ?? '') !== String(row[field] ?? ''));

    return {
      id: Number(row.id),
      stockCode: row.stockCode,
      before: {
        productName: row.productName,
        brand: row.brand || '',
        category: row.category || '',
        supplierId: row.supplierId ? Number(row.supplierId) : null,
        supplierCode: row.supplierCode || '',
        supplierName: row.supplierName || '',
      },
      after,
      changedFields,
      willChange: changedFields.length > 0,
    };
  });
}

async function prepareBulkProductUpdate(request, payload, options = {}) {
  const productIds = normalizeBulkProductIds(payload?.productIds);
  const changes = normalizeBulkProductChanges(payload?.changes);
  const rows = await loadBulkProductSnapshots(request, productIds, options);

  if (rows.length !== productIds.length) {
    const foundIds = new Set(rows.map((row) => Number(row.id)));
    throw makeServiceError('PRODUCT_BULK_PRODUCT_NOT_FOUND', 'One or more selected products could not be found', 404, {
      missingProductIds: productIds.filter((id) => !foundIds.has(id)),
    });
  }

  const supplier = await resolveBulkSupplier(request, changes.supplierId);
  const previewRows = buildBulkPreviewRows(rows, changes, supplier);

  return {
    productIds,
    changes,
    previewRows,
    confirmationCode: buildBulkConfirmationCode(productIds.length),
  };
}

const allowedImageMimeTypes = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const maxProductImageBytes = 3 * 1024 * 1024;

function normalizeImageBase64(value) {
  const text = trimText(value);
  if (!text) return '';

  const dataUrlMatch = text.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
  return dataUrlMatch ? dataUrlMatch[1] : text;
}

function safeFilePart(value) {
  return trimText(value)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
}

async function saveUploadedProductImageFile(productId, payload = {}) {
  const fileBase64 = normalizeImageBase64(payload.fileBase64 || payload.base64 || payload.dataUrl);
  if (!fileBase64) {
    return null;
  }

  const mimeType = trimText(payload.mimeType || '').toLowerCase();
  const extension = allowedImageMimeTypes[mimeType];
  if (!extension) {
    throw makeServiceError('PRODUCT_IMAGE_TYPE_INVALID', 'Only JPG, PNG and WEBP product images are allowed');
  }

  let buffer;
  try {
    buffer = Buffer.from(fileBase64, 'base64');
  } catch {
    throw makeServiceError('PRODUCT_IMAGE_BASE64_INVALID', 'Image payload could not be decoded');
  }

  if (!buffer.length || buffer.length > maxProductImageBytes) {
    throw makeServiceError('PRODUCT_IMAGE_SIZE_INVALID', 'Product image must be smaller than 3 MB');
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'products');
  await mkdir(uploadDir, { recursive: true });

  const originalName = safeFilePart(payload.fileName || payload.name || `product-${productId}`);
  const fileName = `product-${productId}-${Date.now()}-${originalName}.${extension}`;
  const diskPath = path.join(uploadDir, fileName);
  await writeFile(diskPath, buffer);

  return {
    filePath: `/uploads/products/${fileName}`,
    storageKey: `products/${fileName}`,
  };
}

function parseMoney(value, fieldName) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw makeServiceError('PRODUCT_VALIDATION_FAILED', `${fieldName} must be a non-negative number`);
  }

  return number;
}

function parseDiscountRate(value, fieldName) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw makeServiceError('PRODUCT_VALIDATION_FAILED', `${fieldName} must be between 0 and 100`);
  }

  return number;
}

function applyDiscount(amount, discountRate) {
  const rate = Math.min(100, Math.max(0, Number(discountRate || 0)));
  return Number(amount || 0) * (1 - (rate / 100));
}

function normalizeCurrency(value) {
  return trimText(value).toUpperCase();
}

function validateProductPayload(payload, { requireBarcode }) {
  const supplierId = Number(payload?.supplierId || 0);
  const product = {
    stockCode: trimText(payload?.stockCode),
    productName: trimText(payload?.productName),
    barcode: trimText(payload?.barcode),
    brand: trimText(payload?.brand),
    category: trimText(payload?.category),
    supplierId: Number.isInteger(supplierId) && supplierId > 0 ? supplierId : null,
    supplierName: trimText(payload?.supplierName),
    currency: normalizeCurrency(payload?.currency),
    salePrice: parseMoney(payload?.salePrice, 'salePrice'),
    purchasePrice: parseMoney(payload?.purchasePrice, 'purchasePrice'),
    purchaseDiscountRate: parseDiscountRate(payload?.purchaseDiscountRate ?? 0, 'purchaseDiscountRate'),
  };

  const missingFields = [];

  if (!product.stockCode) missingFields.push('stockCode');
  if (!product.productName) missingFields.push('productName');
  if (requireBarcode && !product.barcode) missingFields.push('barcode');
  if (!product.currency) missingFields.push('currency');

  if (missingFields.length > 0) {
    throw makeServiceError(
      'PRODUCT_VALIDATION_FAILED',
      `Required product fields are missing: ${missingFields.join(', ')}`,
    );
  }

  return product;
}

async function resolveSupplierId(request, product) {
  if (product.supplierId) {
    const result = await request
      .input('resolveSupplierId', sql.BigInt, product.supplierId)
      .query(`
        SELECT TOP (1) id
        FROM dbo.suppliers
        WHERE id = @resolveSupplierId
          AND is_deleted = 0
          AND is_active = 1;
      `);

    if (!result.recordset?.[0]) {
      throw makeServiceError('PRODUCT_SUPPLIER_NOT_FOUND', 'Supplier not found or passive', 404);
    }

    return product.supplierId;
  }

  if (!product.supplierName) {
    return null;
  }

  const parts = product.supplierName.split('/').map((part) => part.trim()).filter(Boolean);
  const supplierCode = parts.length > 1 ? parts[0] : product.supplierName;
  const supplierName = parts.length > 1 ? parts.slice(1).join(' / ') : product.supplierName;
  const result = await request
    .input('resolveSupplierCode', sql.NVarChar(80), supplierCode || null)
    .input('resolveSupplierName', sql.NVarChar(250), supplierName)
    .query(`
      SELECT TOP (1) id
      FROM dbo.suppliers
      WHERE is_deleted = 0
        AND is_active = 1
        AND (
          (@resolveSupplierCode IS NOT NULL AND supplier_code = @resolveSupplierCode)
          OR name = @resolveSupplierName
        )
      ORDER BY CASE WHEN @resolveSupplierCode IS NOT NULL AND supplier_code = @resolveSupplierCode THEN 0 ELSE 1 END, id DESC;
    `);

  return result.recordset?.[0]?.id ? Number(result.recordset[0].id) : null;
}

async function assertBulkCreateDefinitions(request, product) {
  const result = await request
    .input('bulkDefinitionBrand', sql.NVarChar(120), product.brand)
    .input('bulkDefinitionCategory', sql.NVarChar(120), product.category)
    .query(`
      SELECT
        CASE WHEN EXISTS (
          SELECT 1
          FROM dbo.products
          WHERE is_deleted = 0
            AND is_active = 1
            AND brand = @bulkDefinitionBrand
        ) THEN 1 ELSE 0 END AS brand_exists,
        CASE WHEN EXISTS (
          SELECT 1
          FROM dbo.products
          WHERE is_deleted = 0
            AND is_active = 1
            AND category = @bulkDefinitionCategory
        ) THEN 1 ELSE 0 END AS category_exists;
    `);
  const definitions = result.recordset?.[0] || {};
  if (!definitions.brand_exists) {
    throw makeServiceError('PRODUCT_BULK_CREATE_BRAND_NOT_FOUND', 'Markayı mevcut seçeneklerden seçin', 400);
  }
  if (!definitions.category_exists) {
    throw makeServiceError('PRODUCT_BULK_CREATE_CATEGORY_NOT_FOUND', 'Kategoriyi mevcut seçeneklerden seçin', 400);
  }
}

function normalizeBulkCreateDate(value) {
  const text = trimText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : new Date().toISOString().slice(0, 10);
}

function parseOpeningStock(value) {
  const quantity = Number(value ?? 0);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw makeServiceError('PRODUCT_BULK_CREATE_OPENING_STOCK_INVALID', 'openingStock must be a non-negative number');
  }
  return Math.round(quantity * 1000) / 1000;
}

function getBulkCreateRows(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (rows.length === 0) {
    throw makeServiceError('PRODUCT_BULK_CREATE_ROWS_REQUIRED', 'Add at least one product row');
  }
  if (rows.length > maxBulkProductCreateCount) {
    throw makeServiceError(
      'PRODUCT_BULK_CREATE_LIMIT_EXCEEDED',
      `At most ${maxBulkProductCreateCount} product cards can be created at once`,
    );
  }
  return rows;
}

function normalizeBulkCreateRow(row, index) {
  const rowId = trimText(row?.rowId) || `row-${index + 1}`;

  try {
    const product = validateProductPayload({
      ...row,
      supplierName: row?.supplierName || row?.supplier,
      purchaseDiscountRate: row?.purchaseDiscountRate ?? 0,
    }, { requireBarcode: true });
    const missingFields = [];

    if (!product.brand) missingFields.push('brand');
    if (!product.category) missingFields.push('category');
    if (!product.supplierId && !product.supplierName) missingFields.push('supplier');
    if (!['TRY', 'USD', 'EUR'].includes(product.currency)) missingFields.push('currency');

    if (missingFields.length > 0) {
      throw makeServiceError(
        'PRODUCT_BULK_CREATE_REQUIRED_FIELDS',
        `Required fields are missing or invalid: ${missingFields.join(', ')}`,
      );
    }

    if (product.stockCode.length > 50 || product.barcode.length > 80) {
      throw makeServiceError(
        'PRODUCT_BULK_CREATE_IDENTITY_TOO_LONG',
        'stockCode must be at most 50 and barcode at most 80 characters',
      );
    }

    return {
      ...product,
      rowId,
      rowNumber: index + 1,
      openingStock: parseOpeningStock(row?.openingStock),
    };
  } catch (error) {
    error.meta = {
      ...(error.meta || {}),
      rowId,
      rowNumber: index + 1,
    };
    throw error;
  }
}

function findBulkCreateInternalDuplicates(rows) {
  const stockCodes = new Map();
  const barcodes = new Map();

  rows.forEach((row, index) => {
    const stockCode = trimText(row?.stockCode).toLocaleUpperCase('tr-TR');
    const barcode = trimText(row?.barcode).toLocaleUpperCase('tr-TR');
    if (stockCode) stockCodes.set(stockCode, [...(stockCodes.get(stockCode) || []), index]);
    if (barcode) barcodes.set(barcode, [...(barcodes.get(barcode) || []), index]);
  });

  return {
    stockCodes: new Set([...stockCodes.entries()].filter(([, indexes]) => indexes.length > 1).map(([value]) => value)),
    barcodes: new Set([...barcodes.entries()].filter(([, indexes]) => indexes.length > 1).map(([value]) => value)),
  };
}

function buildBulkCreateConfirmationCode(count) {
  return `TOPLU-STOK-KARTI-${count}`;
}

function toBulkCreatePreviewError(row, index, error) {
  return {
    rowId: trimText(row?.rowId) || `row-${index + 1}`,
    rowNumber: index + 1,
    stockCode: trimText(row?.stockCode),
    barcode: trimText(row?.barcode),
    productName: trimText(row?.productName),
    status: 'error',
    code: error.code || 'PRODUCT_BULK_CREATE_ROW_INVALID',
    message: error.message || 'Product row is invalid',
    duplicateProduct: error.meta?.duplicateProduct || null,
  };
}

export async function previewProductBulkCreate(payload = {}) {
  const rows = getBulkCreateRows(payload);
  const internalDuplicates = findBulkCreateInternalDuplicates(rows);
  const pool = await getSqlPool();
  const previewRows = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const product = normalizeBulkCreateRow(row, index);
      const normalizedStockCode = product.stockCode.toLocaleUpperCase('tr-TR');
      const normalizedBarcode = product.barcode.toLocaleUpperCase('tr-TR');

      if (internalDuplicates.stockCodes.has(normalizedStockCode)) {
        throw makeServiceError('PRODUCT_BULK_CREATE_STOCK_CODE_DUPLICATE_IN_BATCH', 'Stock code is repeated in this list');
      }
      if (internalDuplicates.barcodes.has(normalizedBarcode)) {
        throw makeServiceError('PRODUCT_BULK_CREATE_BARCODE_DUPLICATE_IN_BATCH', 'Barcode is repeated in this list');
      }

      const identity = await getProductIdentityAvailability({
        stockCode: product.stockCode,
        barcode: product.barcode,
      });
      if (!identity.stockCode.available) {
        throw makeServiceError('PRODUCT_STOCK_CODE_DUPLICATE', 'Product stockCode already exists', 409, {
          duplicateProduct: identity.stockCode.duplicateProduct,
        });
      }
      if (!identity.barcode.available) {
        throw makeServiceError('PRODUCT_BARCODE_DUPLICATE', 'Product barcode already exists', 409, {
          duplicateProduct: identity.barcode.duplicateProduct,
        });
      }

      await assertBulkCreateDefinitions(pool.request(), product);
      const supplierId = await resolveSupplierId(pool.request(), product);
      if (!supplierId) {
        throw makeServiceError('PRODUCT_SUPPLIER_NOT_FOUND', 'Ana tedarikçi bulunamadı veya pasif', 404);
      }

      previewRows.push({
        rowId: product.rowId,
        rowNumber: product.rowNumber,
        stockCode: product.stockCode,
        barcode: product.barcode,
        productName: product.productName,
        supplierId,
        openingStock: product.openingStock,
        status: 'ready',
        code: null,
        message: 'Product card is ready to create',
        duplicateProduct: null,
      });
    } catch (error) {
      if (!String(error.code || '').startsWith('PRODUCT_')) throw error;
      previewRows.push(toBulkCreatePreviewError(row, index, error));
    }
  }

  const readyCount = previewRows.filter((row) => row.status === 'ready').length;
  const errorCount = previewRows.length - readyCount;

  return {
    rows: previewRows,
    totalCount: previewRows.length,
    readyCount,
    errorCount,
    canApply: readyCount > 0 && errorCount === 0,
    confirmationCode: buildBulkCreateConfirmationCode(previewRows.length),
    documentDate: normalizeBulkCreateDate(payload.documentDate),
  };
}

export async function applyProductBulkCreate(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const sourceRows = getBulkCreateRows(payload);
  const rows = sourceRows.map(normalizeBulkCreateRow);
  const internalDuplicates = findBulkCreateInternalDuplicates(rows);
  const confirmationCode = buildBulkCreateConfirmationCode(rows.length);
  const documentDate = normalizeBulkCreateDate(payload.documentDate);

  if (payload.confirmationCode !== confirmationCode) {
    throw makeServiceError('PRODUCT_BULK_CREATE_CONFIRMATION_INVALID', 'Run preview again before creating product cards', 409, {
      expectedConfirmationCode: confirmationCode,
    });
  }
  if (internalDuplicates.stockCodes.size > 0 || internalDuplicates.barcodes.size > 0) {
    throw makeServiceError('PRODUCT_BULK_CREATE_DUPLICATE_IN_BATCH', 'Stock code or barcode is repeated in this list');
  }

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    if (rows.some((row) => row.openingStock > 0)) {
      await assertAccountingPeriodOpen(new sqlDriver.Request(transaction), documentDate, 'Toplu stok kartı açılışı');
    }

    const createdRows = [];
    for (const product of rows) {
      try {
        await assertProductDuplicates(new sqlDriver.Request(transaction), product);
        await assertBulkCreateDefinitions(new sqlDriver.Request(transaction), product);
        const supplierId = await resolveSupplierId(new sqlDriver.Request(transaction), product);
        if (!supplierId) {
          throw makeServiceError('PRODUCT_SUPPLIER_NOT_FOUND', 'Ana tedarikçi bulunamadı veya pasif', 404);
        }

        const averageCostTry = product.currency === 'TRY'
          ? applyDiscount(product.purchasePrice, product.purchaseDiscountRate)
          : 0;
        const insertResult = await new sqlDriver.Request(transaction)
          .input('bulkCreateStockCode', sql.NVarChar(50), product.stockCode)
          .input('bulkCreateProductName', sql.NVarChar(250), product.productName)
          .input('bulkCreateBrand', sql.NVarChar(120), product.brand)
          .input('bulkCreateCategory', sql.NVarChar(120), product.category)
          .input('bulkCreateSupplierId', sql.BigInt, supplierId)
          .input('bulkCreateCurrency', sql.NVarChar(3), product.currency)
          .input('bulkCreateSalePrice', sql.Decimal(18, 4), product.salePrice)
          .input('bulkCreatePurchasePrice', sql.Decimal(18, 4), product.purchasePrice)
          .input('bulkCreateDiscountRate', sql.Decimal(9, 4), product.purchaseDiscountRate)
          .input('bulkCreateAverageCostTry', sql.Decimal(18, 4), averageCostTry)
          .input('bulkCreateOpeningStock', sql.Decimal(18, 3), product.openingStock)
          .input('bulkCreateActorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
          .query(`
            INSERT INTO dbo.products (
              stock_code, name, category, brand, supplier_id, unit, currency_code,
              sales_price, purchase_price, purchase_discount_rate, average_cost_try,
              current_stock_qty, is_active, is_deleted, created_by, updated_by
            )
            OUTPUT INSERTED.id AS productId
            VALUES (
              @bulkCreateStockCode, @bulkCreateProductName, @bulkCreateCategory, @bulkCreateBrand,
              @bulkCreateSupplierId, N'ADET', @bulkCreateCurrency, @bulkCreateSalePrice,
              @bulkCreatePurchasePrice, @bulkCreateDiscountRate, @bulkCreateAverageCostTry,
              @bulkCreateOpeningStock, 1, 0, @bulkCreateActorId, @bulkCreateActorId
            );
          `);
        const productId = Number(insertResult.recordset?.[0]?.productId);
        if (!Number.isInteger(productId) || productId < 1) {
          throw makeServiceError('PRODUCT_BULK_CREATE_INSERT_FAILED', 'Created product id could not be read', 503);
        }

        await new sqlDriver.Request(transaction)
          .input('bulkCreateBarcodeProductId', sql.BigInt, productId)
          .input('bulkCreateBarcode', sql.NVarChar(80), product.barcode)
          .input('bulkCreateBarcodeActorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
          .query(`
            INSERT INTO dbo.product_barcodes (
              product_id, barcode, barcode_type, is_primary, is_active, created_by, updated_by
            )
            VALUES (
              @bulkCreateBarcodeProductId, @bulkCreateBarcode, N'primary', 1, 1,
              @bulkCreateBarcodeActorId, @bulkCreateBarcodeActorId
            );
          `);

        let movementId = null;
        if (product.openingStock > 0) {
          const movementResult = await new sqlDriver.Request(transaction)
            .input('bulkOpeningProductId', sql.BigInt, productId)
            .input('bulkOpeningQuantity', sql.Decimal(18, 3), product.openingStock)
            .input('bulkOpeningCostTry', sql.Decimal(18, 4), averageCostTry)
            .input('bulkOpeningDocumentDate', sql.Date, documentDate)
            .input('bulkOpeningActorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
            .input('bulkOpeningUnitPrice', sql.Decimal(18, 4), product.purchasePrice)
            .input('bulkOpeningCurrency', sql.NVarChar(3), product.currency)
            .input('bulkOpeningAmountTry', sql.Decimal(18, 4), product.openingStock * averageCostTry)
            .query(`
              INSERT INTO dbo.stock_movements (
                product_id, movement_type, source_type, source_id, quantity_in, quantity_out,
                quantity_net, unit_cost_try, average_cost_try_after, document_date, created_at,
                created_by, unit_price, currency_code, amount_try
              )
              OUTPUT INSERTED.id
              VALUES (
                @bulkOpeningProductId, N'in', N'stock_adjustment', NULL, @bulkOpeningQuantity, 0,
                @bulkOpeningQuantity, @bulkOpeningCostTry, @bulkOpeningCostTry,
                @bulkOpeningDocumentDate, SYSUTCDATETIME(), @bulkOpeningActorId,
                @bulkOpeningUnitPrice, @bulkOpeningCurrency, @bulkOpeningAmountTry
              );
            `);
          movementId = Number(movementResult.recordset?.[0]?.id || 0) || null;
        }

        const afterSnapshot = await getProductSnapshot(new sqlDriver.Request(transaction), productId);
        await writeAuditLog(new sqlDriver.Request(transaction), {
          action: 'product_created',
          entityType: 'product',
          entityId: productId,
          afterSnapshot: {
            ...afterSnapshot,
            bulkCreate: true,
            openingStock: product.openingStock,
            openingMovementId: movementId,
          },
          actor,
        });

        createdRows.push({
          rowId: product.rowId,
          productId,
          stockCode: product.stockCode,
          barcode: product.barcode,
          productName: product.productName,
          openingStock: product.openingStock,
          movementId,
        });
      } catch (error) {
        error.meta = {
          ...(error.meta || {}),
          rowId: product.rowId,
          rowNumber: product.rowNumber,
          stockCode: product.stockCode,
        };
        throw error;
      }
    }

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'products_bulk_created',
      entityType: 'product_batch',
      entityId: null,
      afterSnapshot: {
        createdCount: createdRows.length,
        productIds: createdRows.map((row) => row.productId),
        stockCodes: createdRows.map((row) => row.stockCode),
        documentDate,
      },
      actor,
    });

    await transaction.commit();
    return {
      createdCount: createdRows.length,
      rows: createdRows,
      documentDate,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getProductSnapshot(request, id) {
  const result = await request
    .input('snapshotProductId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        p.id,
        p.stock_code AS stockCode,
        pb.barcode AS barcode,
        p.name AS productName,
        p.brand,
        p.category,
        p.supplier_id AS supplierId,
        s.supplier_code AS supplierCode,
        s.name AS supplierName,
        p.currency_code AS currency,
        p.sales_price AS salePrice,
        p.purchase_price AS purchasePrice,
        p.current_stock_qty AS stockQuantity,
        p.average_cost_try AS averageCostTry,
        p.is_active AS isActive,
        p.updated_at AS updatedAt
      FROM dbo.products p
      LEFT JOIN dbo.suppliers s ON s.id = p.supplier_id
      OUTER APPLY (
        SELECT TOP (1) b.barcode
        FROM dbo.product_barcodes b
        WHERE b.product_id = p.id
          AND b.is_active = 1
        ORDER BY b.is_primary DESC, b.id ASC
      ) pb
      WHERE p.id = @snapshotProductId
        AND p.is_deleted = 0;
    `);

  return result.recordset?.[0] || null;
}

export async function getProductIdentityAvailability(query = {}) {
  const stockCode = trimText(query.stockCode);
  const barcode = trimText(query.barcode);
  const excludeProductId = Number(query.excludeProductId || 0);
  const currentProductId = Number.isInteger(excludeProductId) && excludeProductId > 0
    ? excludeProductId
    : 0;
  const pool = await getSqlPool();

  const [stockResult, barcodeResult] = await Promise.all([
    stockCode
      ? pool.request()
        .input('identityStockCode', sql.NVarChar(80), stockCode)
        .input('identityStockExcludeId', sql.BigInt, currentProductId)
        .query(`
          SELECT TOP (1) id
          FROM dbo.products
          WHERE stock_code = @identityStockCode
            AND is_deleted = 0
            AND (@identityStockExcludeId = 0 OR id <> @identityStockExcludeId);
        `)
      : Promise.resolve({ recordset: [] }),
    barcode
      ? pool.request()
        .input('identityBarcode', sql.NVarChar(120), barcode)
        .input('identityBarcodeExcludeId', sql.BigInt, currentProductId)
        .query(`
          SELECT TOP (1)
            b.product_id,
            b.barcode,
            p.stock_code,
            p.name AS product_name
          FROM dbo.product_barcodes b
          INNER JOIN dbo.products p ON p.id = b.product_id
          WHERE b.barcode = @identityBarcode
            AND b.is_active = 1
            AND p.is_deleted = 0
            AND (@identityBarcodeExcludeId = 0 OR b.product_id <> @identityBarcodeExcludeId);
        `)
      : Promise.resolve({ recordset: [] }),
  ]);

  const stockDuplicateId = stockResult.recordset?.[0]?.id;
  const stockSnapshot = stockDuplicateId
    ? await getProductSnapshot(pool.request(), stockDuplicateId)
    : null;
  const barcodeDuplicate = barcodeResult.recordset?.[0] || null;

  return {
    stockCode: {
      value: stockCode,
      available: !stockSnapshot,
      duplicateProduct: stockSnapshot ? {
        productId: Number(stockSnapshot.id),
        stockCode: stockSnapshot.stockCode,
        productName: stockSnapshot.productName,
        barcode: stockSnapshot.barcode,
      } : null,
    },
    barcode: {
      value: barcode,
      available: !barcodeDuplicate,
      duplicateProduct: barcodeDuplicate ? {
        productId: Number(barcodeDuplicate.product_id),
        stockCode: barcodeDuplicate.stock_code,
        productName: barcodeDuplicate.product_name,
        barcode: barcodeDuplicate.barcode,
      } : null,
    },
  };
}

async function assertProductDuplicates(request, product, currentProductId = null) {
  const stockDuplicate = await request
    .input('duplicateStockCode', sql.NVarChar(80), product.stockCode)
    .input('duplicateProductId', sql.BigInt, currentProductId || 0)
    .query(`
      SELECT TOP (1) id
      FROM dbo.products
      WHERE stock_code = @duplicateStockCode
        AND is_deleted = 0
        AND (@duplicateProductId = 0 OR id <> @duplicateProductId);
    `);

  const duplicateStockProduct = stockDuplicate.recordset?.[0];
  if (duplicateStockProduct) {
    const snapshot = await getProductSnapshot(request, duplicateStockProduct.id);
    throw makeServiceError('PRODUCT_STOCK_CODE_DUPLICATE', 'Product stockCode already exists', 409, {
      duplicateProduct: snapshot ? {
        productId: Number(snapshot.id),
        stockCode: snapshot.stockCode,
        productName: snapshot.productName,
        barcode: snapshot.barcode,
      } : {
        productId: Number(duplicateStockProduct.id),
        stockCode: product.stockCode,
        productName: '',
        barcode: '',
      },
    });
  }

  if (!product.barcode) {
    return;
  }

  const barcodeDuplicate = await request
    .input('duplicateBarcode', sql.NVarChar(120), product.barcode)
    .input('duplicateBarcodeProductId', sql.BigInt, currentProductId || 0)
    .query(`
      SELECT TOP (1)
        b.product_id,
        b.barcode,
        p.stock_code,
        p.name AS product_name
      FROM dbo.product_barcodes b
      INNER JOIN dbo.products p ON p.id = b.product_id
      WHERE b.barcode = @duplicateBarcode
        AND b.is_active = 1
        AND p.is_deleted = 0
        AND (@duplicateBarcodeProductId = 0 OR b.product_id <> @duplicateBarcodeProductId);
    `);

  const duplicateProduct = barcodeDuplicate.recordset?.[0];
  if (duplicateProduct) {
    throw makeServiceError('PRODUCT_BARCODE_DUPLICATE', 'Product main barcode already exists', 409, {
      duplicateProduct: {
        productId: Number(duplicateProduct.product_id),
        stockCode: duplicateProduct.stock_code,
        productName: duplicateProduct.product_name,
        barcode: duplicateProduct.barcode,
      },
    });
  }
}

async function assertProductExists(request, id) {
  const result = await request
    .input('existsProductId', sql.BigInt, id)
    .query(`
      SELECT TOP (1) id
      FROM dbo.products
      WHERE id = @existsProductId
        AND is_deleted = 0;
    `);

  if (!result.recordset?.[0]) {
    throw makeServiceError('PRODUCT_NOT_FOUND', 'Product not found', 404);
  }
}

async function assertBarcodeAvailable(request, barcode, currentBarcodeId = null) {
  const result = await request
    .input('availableBarcode', sql.NVarChar(120), barcode)
    .input('availableBarcodeId', sql.BigInt, currentBarcodeId || 0)
    .query(`
      SELECT TOP (1)
        b.id,
        b.product_id,
        b.barcode,
        p.stock_code,
        p.name AS product_name
      FROM dbo.product_barcodes b
      INNER JOIN dbo.products p ON p.id = b.product_id
      WHERE b.barcode = @availableBarcode
        AND b.is_active = 1
        AND p.is_deleted = 0
        AND (@availableBarcodeId = 0 OR b.id <> @availableBarcodeId);
    `);

  const duplicateProduct = result.recordset?.[0];
  if (duplicateProduct) {
    throw makeServiceError('PRODUCT_BARCODE_DUPLICATE', 'Barcode already exists on another active product', 409, {
      duplicateProduct: {
        productId: Number(duplicateProduct.product_id),
        stockCode: duplicateProduct.stock_code,
        productName: duplicateProduct.product_name,
        barcode: duplicateProduct.barcode,
      },
    });
  }
}

async function readProductRelations(pool, id) {
  const [barcodeResult, imageResult] = await Promise.all([
    pool.request()
      .input('relationBarcodeProductId', sql.BigInt, id)
      .query(`
        SELECT
          id,
          barcode,
          barcode_type,
          is_primary,
          is_active,
          created_at
        FROM dbo.product_barcodes
        WHERE product_id = @relationBarcodeProductId
        ORDER BY is_primary DESC, is_active DESC, id ASC;
      `),
    pool.request()
      .input('relationImageProductId', sql.BigInt, id)
      .query(`
        SELECT
          id,
          file_path,
          storage_key,
          is_primary,
          sort_order,
          is_active,
          created_at
        FROM dbo.product_images
        WHERE product_id = @relationImageProductId
        ORDER BY is_primary DESC, sort_order ASC, id ASC;
      `),
  ]);

  return {
    barcodes: (barcodeResult.recordset || []).map(toBarcodeDto),
    images: (imageResult.recordset || []).map(toImageDto),
  };
}

export async function getProductsList(query) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 500 });
  const barcode = trimText(query?.barcode);
  const barcodeLike = barcode ? `%${barcode}%` : null;
  const supplierId = Number(query?.supplierId || 0);
  const cardOpenedFrom = normalizeProductListDate(query?.cardOpenedFrom, 'cardOpenedFrom');
  const cardOpenedTo = normalizeProductListDate(query?.cardOpenedTo, 'cardOpenedTo');

  if (cardOpenedFrom && cardOpenedTo && cardOpenedFrom > cardOpenedTo) {
    throw makeServiceError('PRODUCT_LIST_DATE_RANGE_INVALID', 'cardOpenedFrom cannot be after cardOpenedTo');
  }
  const productSearchPredicates = [
    'p.stock_code',
    'p.name',
    'p.brand',
    'p.category',
    's.supplier_code',
    's.name',
  ].map((column) => sqlNormalizedLike(column)).join('\n          OR ');
  const pool = await getSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('barcode', sql.NVarChar(120), barcode || null)
    .input('barcodeLike', sql.NVarChar(120), barcodeLike)
    .input('supplierId', sql.BigInt, Number.isInteger(supplierId) && supplierId > 0 ? supplierId : null)
    .input('cardOpenedFrom', sql.Date, cardOpenedFrom)
    .input('cardOpenedTo', sql.Date, cardOpenedTo)
    .input('activeOnly', sql.Bit, options.activeOnly)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_products AS (
      SELECT
        p.id,
        p.stock_code,
        pb.barcode AS barcode_raw,
        mb.barcode AS matched_barcode,
        p.name AS product_name,
        p.brand,
        p.category,
        p.supplier_id,
        s.supplier_code,
        s.name AS supplier_name,
        p.currency_code,
        p.sales_price AS sale_price,
        p.purchase_price,
        p.purchase_discount_rate,
        p.average_cost_try,
        p.current_stock_qty AS stock_quantity,
        pi.file_path AS image_file_path,
        p.is_active,
        p.created_at
      FROM dbo.products p
      LEFT JOIN dbo.suppliers s ON s.id = p.supplier_id
      OUTER APPLY (
        SELECT TOP (1) image.file_path
        FROM dbo.product_images image
        WHERE image.product_id = p.id
          AND image.is_active = 1
        ORDER BY image.is_primary DESC, image.sort_order ASC, image.id ASC
      ) pi
      OUTER APPLY (
        SELECT TOP (1) b.barcode
        FROM dbo.product_barcodes b
        WHERE b.product_id = p.id
          AND b.is_active = 1
        ORDER BY b.is_primary DESC, b.id ASC
      ) pb
      OUTER APPLY (
        SELECT TOP (1) b.barcode
        FROM dbo.product_barcodes b
        WHERE b.product_id = p.id
          AND b.is_active = 1
          AND (
            (@barcodeLike IS NOT NULL AND b.barcode COLLATE Latin1_General_CI_AI LIKE @barcodeLike COLLATE Latin1_General_CI_AI)
            OR (@search IS NOT NULL AND ${sqlNormalizedLike('b.barcode')})
          )
        ORDER BY
          CASE WHEN @barcode IS NOT NULL AND b.barcode = @barcode THEN 0 ELSE 1 END,
          b.is_primary DESC,
          b.id ASC
      ) mb
      WHERE
        p.is_deleted = 0
        AND (@activeOnly = 0 OR p.is_active = 1)
        AND (@supplierId IS NULL OR p.supplier_id = @supplierId)
        AND (@cardOpenedFrom IS NULL OR p.created_at >= @cardOpenedFrom)
        AND (@cardOpenedTo IS NULL OR p.created_at < DATEADD(day, 1, @cardOpenedTo))
        AND (
          @barcodeLike IS NULL
          OR EXISTS (
            SELECT 1
            FROM dbo.product_barcodes barcode_filter
            WHERE barcode_filter.product_id = p.id
              AND barcode_filter.is_active = 1
              AND barcode_filter.barcode COLLATE Latin1_General_CI_AI LIKE @barcodeLike COLLATE Latin1_General_CI_AI
          )
        )
        AND (
          @search IS NULL
          OR ${productSearchPredicates}
          OR EXISTS (
            SELECT 1
            FROM dbo.product_barcodes search_barcode
            WHERE search_barcode.product_id = p.id
              AND search_barcode.is_active = 1
              AND ${sqlNormalizedLike('search_barcode.barcode')}
          )
        )
    ),
    numbered_products AS (
      SELECT
        fp.id,
        fp.stock_code,
        fp.barcode_raw,
        fp.matched_barcode,
        fp.product_name,
        fp.brand,
        fp.category,
        fp.supplier_id,
        fp.supplier_code,
        fp.supplier_name,
        fp.currency_code,
        fp.sale_price,
        fp.purchase_price,
        fp.purchase_discount_rate,
        fp.average_cost_try,
        fp.stock_quantity,
        fp.image_file_path,
        fp.is_active,
        fp.created_at,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE
              WHEN @barcode IS NOT NULL AND fp.matched_barcode = @barcode THEN 0
              WHEN @barcodeLike IS NOT NULL AND fp.matched_barcode IS NOT NULL THEN 1
              WHEN @search IS NOT NULL AND ${sqlNormalizedLike('fp.stock_code')} THEN 2
              WHEN @search IS NOT NULL AND fp.matched_barcode IS NOT NULL THEN 3
              ELSE 9
            END,
            CASE WHEN fp.created_at IS NULL THEN 1 ELSE 0 END,
            fp.created_at DESC,
            fp.id DESC
        ) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_products fp
    )
    SELECT
      TOP (${options.limit}) np.*
    FROM numbered_products np
    WHERE np.row_number > @offset
    ORDER BY np.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toProductDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-select-only',
      filters: {
        search: options.search || null,
        barcode: barcode || null,
        supplierId: Number.isInteger(supplierId) && supplierId > 0 ? supplierId : null,
        activeOnly: options.activeOnly,
      },
    }),
  };
}

function mapOptionRows(rows) {
  return (rows || [])
    .map((row) => String(row.value || '').trim())
    .filter(Boolean);
}

export async function getProductFilterOptions() {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    WITH brand_currency_counts AS (
      SELECT
        brand,
        currency_code,
        COUNT_BIG(1) AS usage_count
      FROM dbo.products
      WHERE is_deleted = 0
        AND is_active = 1
        AND ISNULL(brand, N'') <> N''
        AND currency_code IN (N'TRY', N'USD', N'EUR')
      GROUP BY brand, currency_code
    ),
    ranked_brand_currencies AS (
      SELECT
        brand,
        currency_code,
        usage_count,
        SUM(usage_count) OVER (PARTITION BY brand) AS brand_usage_count,
        ROW_NUMBER() OVER (
          PARTITION BY brand
          ORDER BY usage_count DESC, currency_code ASC
        ) AS currency_rank
      FROM brand_currency_counts
    )
    SELECT TOP (500)
      brand AS value,
      currency_code AS preferred_currency
    FROM ranked_brand_currencies
    WHERE currency_rank = 1
    ORDER BY brand_usage_count DESC, brand ASC;

    SELECT TOP (500) category AS value
    FROM dbo.products
    WHERE is_deleted = 0
      AND is_active = 1
      AND ISNULL(category, N'') <> N''
    GROUP BY category
    ORDER BY COUNT_BIG(1) DESC, category ASC;

    SELECT TOP (500)
      id,
      supplier_code,
      name,
      currency_code,
      CASE
        WHEN ISNULL(supplier_code, N'') <> N'' THEN CONCAT(supplier_code, N' / ', name)
        ELSE name
      END AS value
    FROM dbo.suppliers
    WHERE is_deleted = 0
      AND is_active = 1
      AND ISNULL(name, N'') <> N''
    ORDER BY name ASC;

    SELECT TOP (500)
      brands.brand AS value,
      preferred_category.category AS preferred_category,
      CASE
        WHEN ISNULL(preferred_supplier.supplier_code, N'') <> N''
          THEN CONCAT(preferred_supplier.supplier_code, N' / ', preferred_supplier.supplier_name)
        ELSE preferred_supplier.supplier_name
      END AS preferred_supplier
    FROM (
      SELECT brand, COUNT_BIG(1) AS usage_count
      FROM dbo.products
      WHERE is_deleted = 0
        AND is_active = 1
        AND ISNULL(brand, N'') <> N''
      GROUP BY brand
    ) brands
    OUTER APPLY (
      SELECT TOP (1) p.category
      FROM dbo.products p
      WHERE p.is_deleted = 0
        AND p.is_active = 1
        AND p.brand = brands.brand
        AND ISNULL(p.category, N'') <> N''
      GROUP BY p.category
      ORDER BY COUNT_BIG(1) DESC, p.category ASC
    ) preferred_category
    OUTER APPLY (
      SELECT TOP (1)
        s.supplier_code,
        s.name AS supplier_name
      FROM dbo.products p
      INNER JOIN dbo.suppliers s
        ON s.id = p.supplier_id
       AND s.is_deleted = 0
       AND s.is_active = 1
      WHERE p.is_deleted = 0
        AND p.is_active = 1
        AND p.brand = brands.brand
      GROUP BY s.supplier_code, s.name
      ORDER BY COUNT_BIG(1) DESC, s.name ASC
    ) preferred_supplier
    ORDER BY brands.usage_count DESC, brands.brand ASC;
  `);

  const brandRows = result.recordsets?.[0] || [];
  const supplierRows = result.recordsets?.[2] || [];
  const brandDefaultRows = result.recordsets?.[3] || [];
  const brandCurrencies = Object.fromEntries(brandRows.map((row) => [
    String(row.value || '').trim(),
    String(row.preferred_currency || '').trim(),
  ]).filter(([brand, currency]) => brand && currency));
  const supplierCurrencies = Object.fromEntries(supplierRows.map((row) => [
    String(row.value || row.name || '').trim(),
    String(row.currency_code || '').trim().toUpperCase(),
  ]).filter(([supplier, currency]) => supplier && ['TRY', 'USD', 'EUR'].includes(currency)));

  return {
    brands: mapOptionRows(brandRows),
    brandCurrencies,
    brandDefaults: Object.fromEntries(brandDefaultRows.map((row) => {
      const brand = String(row.value || '').trim();
      return [brand, {
        category: String(row.preferred_category || '').trim(),
        supplier: String(row.preferred_supplier || '').trim(),
        currency: brandCurrencies[brand] || '',
      }];
    }).filter(([brand]) => brand)),
    categories: mapOptionRows(result.recordsets?.[1]),
    suppliers: mapOptionRows(supplierRows),
    supplierCurrencies,
    supplierOptions: supplierRows.map((row) => ({
      id: Number(row.id),
      code: row.supplier_code || '',
      name: row.name || '',
      label: String(row.value || row.name || '').trim(),
      currency: String(row.currency_code || 'TRY').trim().toUpperCase(),
    })),
  };
}

export async function previewProductBulkUpdate(payload = {}) {
  const pool = await getSqlPool();
  const prepared = await prepareBulkProductUpdate(pool.request(), payload);
  const changedCount = prepared.previewRows.filter((row) => row.willChange).length;

  return {
    selectedCount: prepared.productIds.length,
    changedCount,
    unchangedCount: prepared.productIds.length - changedCount,
    confirmationCode: prepared.confirmationCode,
    rows: prepared.previewRows,
    protectedFields: ['stockQuantity', 'salePrice', 'purchasePrice', 'barcode', 'currency'],
  };
}

export async function applyProductBulkUpdate(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const prepared = await prepareBulkProductUpdate(
      new sqlDriver.Request(transaction),
      payload,
      { lock: true },
    );

    if (trimText(payload.confirmationCode) !== prepared.confirmationCode) {
      throw makeServiceError(
        'PRODUCT_BULK_CONFIRMATION_INVALID',
        `Type ${prepared.confirmationCode} to confirm the bulk update`,
      );
    }

    const changedRows = prepared.previewRows.filter((row) => row.willChange);

    for (const row of changedRows) {
      await new sqlDriver.Request(transaction)
        .input('bulkApplyProductId', sql.BigInt, row.id)
        .input('bulkApplyProductName', sql.NVarChar(250), row.after.productName)
        .input('bulkApplyBrand', sql.NVarChar(120), row.after.brand || null)
        .input('bulkApplyCategory', sql.NVarChar(120), row.after.category || null)
        .input('bulkApplySupplierId', sql.BigInt, row.after.supplierId)
        .query(`
          UPDATE dbo.products
          SET
            name = @bulkApplyProductName,
            brand = @bulkApplyBrand,
            category = @bulkApplyCategory,
            supplier_id = @bulkApplySupplierId,
            updated_by = NULL,
            updated_at = SYSUTCDATETIME()
          WHERE id = @bulkApplyProductId
            AND is_deleted = 0;
        `);
    }

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'products_bulk_updated',
      entityType: 'product_bulk_update',
      entityId: null,
      beforeSnapshot: {
        productIds: prepared.productIds,
        rows: changedRows.map((row) => ({ id: row.id, stockCode: row.stockCode, ...row.before })),
      },
      afterSnapshot: {
        productIds: prepared.productIds,
        changedCount: changedRows.length,
        rows: changedRows.map((row) => ({ id: row.id, stockCode: row.stockCode, ...row.after })),
      },
      actor,
    });

    await transaction.commit();

    return {
      selectedCount: prepared.productIds.length,
      changedCount: changedRows.length,
      unchangedCount: prepared.productIds.length - changedRows.length,
      updatedProductIds: changedRows.map((row) => row.id),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function getProductDetail(productId) {
  const id = Number(productId);

  if (!Number.isInteger(id) || id < 1) {
    const error = new Error('Product id is invalid');
    error.code = 'PRODUCT_ID_INVALID';
    error.statusCode = 400;
    throw error;
  }

  const pool = await getSqlPool();
  const request = pool.request()
    .input('id', sql.BigInt, id);

  const result = await request.query(`
    SELECT TOP (1)
      p.id,
      p.stock_code,
      pb.barcode AS barcode_raw,
      p.name AS product_name,
      p.brand,
      p.category,
      p.currency_code,
      p.sales_price AS sale_price,
      p.purchase_price,
      p.purchase_discount_rate,
      p.current_stock_qty AS stock_quantity,
      p.supplier_id,
      s.supplier_code,
      s.name AS supplier_name,
      p.is_active,
      p.created_at AS card_opened_at,
      p.average_cost_try,
      ac.average_cost_currency,
      lp.last_purchase_date,
      ls.last_sale_date
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
      SELECT MAX(pi.document_date) AS last_purchase_date
      FROM dbo.purchase_invoice_items pii
      INNER JOIN dbo.purchase_invoices pi ON pi.id = pii.purchase_invoice_id
      WHERE pii.product_id = p.id
        AND pi.status = N'finalized'
    ) lp
    OUTER APPLY (
      SELECT
        CASE
          WHEN COALESCE(SUM(sm.quantity_net), 0) > 0 THEN
            SUM(sm.amount_try / NULLIF(COALESCE(pi.exchange_rate_snapshot, 1), 0)) / SUM(sm.quantity_net)
          ELSE 0
        END AS average_cost_currency
      FROM dbo.stock_movements sm
      INNER JOIN dbo.purchase_invoices pi
        ON pi.id = sm.source_id
       AND sm.source_type = N'purchase_invoice'
      WHERE sm.product_id = p.id
        AND sm.source_type = N'purchase_invoice'
    ) ac
    OUTER APPLY (
      SELECT MAX(si.document_date) AS last_sale_date
      FROM dbo.sales_invoice_items sii
      INNER JOIN dbo.sales_invoices si ON si.id = sii.sales_invoice_id
      WHERE sii.product_id = p.id
        AND si.status = N'finalized'
    ) ls
    WHERE p.id = @id
      AND p.is_deleted = 0;
  `);

  const row = result.recordset?.[0];

  if (!row) {
    const error = new Error('Product not found');
    error.code = 'PRODUCT_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const detail = toProductDetailDto(row);
  const relations = await readProductRelations(pool, id);
  return {
    ...detail,
    ...relations,
  };
}

export async function createProduct(payload, actor = null) {
  assertMelisaWriteEnabled();

  const product = validateProductPayload(payload, { requireBarcode: true });
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    await assertProductDuplicates(new sqlDriver.Request(transaction), product);
    const supplierId = await resolveSupplierId(new sqlDriver.Request(transaction), product);

    const insertProductResult = await new sqlDriver.Request(transaction)
      .input('stockCode', sql.NVarChar(80), product.stockCode)
      .input('productName', sql.NVarChar(250), product.productName)
      .input('brand', sql.NVarChar(120), product.brand || null)
      .input('category', sql.NVarChar(120), product.category || null)
      .input('currency', sql.NVarChar(3), product.currency)
      .input('salePrice', sql.Decimal(18, 4), product.salePrice)
      .input('purchasePrice', sql.Decimal(18, 4), product.purchasePrice)
      .input('purchaseDiscountRate', sql.Decimal(9, 4), product.purchaseDiscountRate)
      .input('supplierId', sql.BigInt, supplierId)
      .input('initialAverageCostTry', sql.Decimal(18, 4), product.currency === 'TRY'
        ? applyDiscount(product.purchasePrice, product.purchaseDiscountRate)
        : 0)
      .query(`
        INSERT INTO dbo.products (
          stock_code,
          name,
          category,
          brand,
          supplier_id,
          unit,
          currency_code,
          sales_price,
          purchase_price,
          purchase_discount_rate,
          average_cost_try,
          current_stock_qty,
          is_active,
          is_deleted,
          created_by,
          updated_by
        )
        OUTPUT INSERTED.id AS productId
        VALUES (
          @stockCode,
          @productName,
          @category,
          @brand,
          @supplierId,
          N'ADET',
          @currency,
          @salePrice,
          @purchasePrice,
          @purchaseDiscountRate,
          @initialAverageCostTry,
          0,
          1,
          0,
          NULL,
          NULL
        );
      `);

    const productId = Number(insertProductResult.recordset?.[0]?.productId);

    if (!Number.isInteger(productId) || productId < 1) {
      throw makeServiceError('PRODUCT_CREATE_FAILED', 'Created product id could not be read', 503);
    }

    await new sqlDriver.Request(transaction)
      .input('barcodeProductId', sql.BigInt, productId)
      .input('barcode', sql.NVarChar(120), product.barcode)
      .query(`
        INSERT INTO dbo.product_barcodes (
          product_id,
          barcode,
          barcode_type,
          is_primary,
          is_active,
          created_by,
          updated_by
        )
        VALUES (
          @barcodeProductId,
          @barcode,
          N'primary',
          1,
          1,
          NULL,
          NULL
        );
      `);

    const afterSnapshot = await getProductSnapshot(new sqlDriver.Request(transaction), productId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'product_created',
      entityType: 'product',
      entityId: productId,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getProductDetail(productId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateProduct(productId, payload, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(productId);

  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('PRODUCT_ID_INVALID', 'Product id is invalid');
  }

  const product = validateProductPayload(payload, { requireBarcode: false });
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getProductSnapshot(new sqlDriver.Request(transaction), id);

    if (!beforeSnapshot) {
      throw makeServiceError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    await assertProductDuplicates(new sqlDriver.Request(transaction), product, id);
    const supplierId = await resolveSupplierId(new sqlDriver.Request(transaction), product);

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('stockCode', sql.NVarChar(80), product.stockCode)
      .input('productName', sql.NVarChar(250), product.productName)
      .input('brand', sql.NVarChar(120), product.brand || null)
      .input('category', sql.NVarChar(120), product.category || null)
      .input('currency', sql.NVarChar(3), product.currency)
      .input('salePrice', sql.Decimal(18, 4), product.salePrice)
      .input('purchasePrice', sql.Decimal(18, 4), product.purchasePrice)
      .input('purchaseDiscountRate', sql.Decimal(9, 4), product.purchaseDiscountRate)
      .input('supplierId', sql.BigInt, supplierId)
      .query(`
        UPDATE dbo.products
        SET
          stock_code = @stockCode,
          name = @productName,
          category = @category,
          brand = @brand,
          supplier_id = @supplierId,
          currency_code = @currency,
          sales_price = @salePrice,
          purchase_price = @purchasePrice,
          purchase_discount_rate = @purchaseDiscountRate,
          updated_by = NULL,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `);

    if (product.barcode) {
      const barcodeResult = await new sqlDriver.Request(transaction)
        .input('barcodeLookupProductId', sql.BigInt, id)
        .query(`
          SELECT TOP (1) id
          FROM dbo.product_barcodes
          WHERE product_id = @barcodeLookupProductId
            AND is_primary = 1
            AND is_active = 1
          ORDER BY id ASC;
        `);

      const barcodeId = barcodeResult.recordset?.[0]?.id;

      if (barcodeId) {
        await new sqlDriver.Request(transaction)
          .input('barcodeId', sql.BigInt, barcodeId)
          .input('barcode', sql.NVarChar(120), product.barcode)
          .query(`
            UPDATE dbo.product_barcodes
            SET
              barcode = @barcode,
              updated_by = NULL,
              updated_at = SYSUTCDATETIME()
            WHERE id = @barcodeId;
          `);
      } else {
        await new sqlDriver.Request(transaction)
          .input('barcodeProductId', sql.BigInt, id)
          .input('barcode', sql.NVarChar(120), product.barcode)
          .query(`
            INSERT INTO dbo.product_barcodes (
              product_id,
              barcode,
              barcode_type,
              is_primary,
              is_active,
              created_by,
              updated_by
            )
            VALUES (
              @barcodeProductId,
              @barcode,
              N'primary',
              1,
              1,
              NULL,
              NULL
            );
          `);
      }
    }

    const afterSnapshot = await getProductSnapshot(new sqlDriver.Request(transaction), id);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'product_updated',
      entityType: 'product',
      entityId: id,
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return getProductDetail(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function changeProductPassive(productId, payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(productId);

  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('PRODUCT_ID_INVALID', 'Product id is invalid');
  }

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeSnapshot = await getProductSnapshot(new sqlDriver.Request(transaction), id);

    if (!beforeSnapshot) {
      throw makeServiceError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    const currentIsPassive = !beforeSnapshot.isActive;
    const nextIsPassive = typeof payload.isPassive === 'boolean' ? payload.isPassive : !currentIsPassive;

    if (nextIsPassive === currentIsPassive) {
      await transaction.commit();
      return {
        data: await getProductDetail(id),
        auditWritten: false,
      };
    }

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('isActive', sql.Bit, !nextIsPassive)
      .input('passiveReason', sql.NVarChar(250), nextIsPassive ? 'SYSTEM passive toggle' : null)
      .query(`
        UPDATE dbo.products
        SET
          is_active = @isActive,
          passive_at = CASE WHEN @isActive = 0 THEN SYSUTCDATETIME() ELSE NULL END,
          passive_reason = @passiveReason,
          updated_by = NULL,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `);

    const afterSnapshot = await getProductSnapshot(new sqlDriver.Request(transaction), id);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'product_passive_changed',
      entityType: 'product',
      entityId: id,
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();

    return {
      data: await getProductDetail(id),
      auditWritten: true,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function addProductBarcode(productId, payload, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(productId);
  const barcode = trimText(payload?.barcode);
  const barcodeType = trimText(payload?.type || payload?.barcodeType || 'extra').toLowerCase();
  const isPrimary = Boolean(payload?.isPrimary);

  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('PRODUCT_ID_INVALID', 'Product id is invalid');
  }

  if (!barcode) {
    throw makeServiceError('PRODUCT_BARCODE_REQUIRED', 'Barcode is required');
  }

  if (!['primary', 'extra', 'package'].includes(barcodeType)) {
    throw makeServiceError('PRODUCT_BARCODE_TYPE_INVALID', 'Barcode type is invalid');
  }

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    await assertProductExists(new sqlDriver.Request(transaction), id);
    await assertBarcodeAvailable(new sqlDriver.Request(transaction), barcode);

    if (isPrimary) {
      await new sqlDriver.Request(transaction)
        .input('primaryProductId', sql.BigInt, id)
        .query(`
          UPDATE dbo.product_barcodes
          SET is_primary = 0,
              barcode_type = CASE WHEN barcode_type = N'primary' THEN N'extra' ELSE barcode_type END,
              updated_at = SYSUTCDATETIME()
          WHERE product_id = @primaryProductId
            AND is_active = 1;
        `);
    }

    const result = await new sqlDriver.Request(transaction)
      .input('barcodeProductId', sql.BigInt, id)
      .input('barcode', sql.NVarChar(120), barcode)
      .input('barcodeType', sql.NVarChar(30), isPrimary ? 'primary' : barcodeType)
      .input('isPrimary', sql.Bit, isPrimary)
      .input('createdBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.product_barcodes (
          product_id,
          barcode,
          barcode_type,
          is_primary,
          is_active,
          created_by,
          updated_by
        )
        OUTPUT inserted.id
        VALUES (
          @barcodeProductId,
          @barcode,
          @barcodeType,
          @isPrimary,
          1,
          @createdBy,
          @createdBy
        );
      `);

    const barcodeId = Number(result.recordset?.[0]?.id);
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'product_barcode_added',
      entityType: 'product_barcode',
      entityId: barcodeId,
      afterSnapshot: { productId: id, barcode, barcodeType, isPrimary },
      actor,
    });

    await transaction.commit();
    return getProductDetail(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function changeProductBarcodePassive(productId, barcodeId, payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(productId);
  const targetBarcodeId = Number(barcodeId);
  const isPassive = Boolean(payload?.isPassive);

  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(targetBarcodeId) || targetBarcodeId < 1) {
    throw makeServiceError('PRODUCT_BARCODE_ID_INVALID', 'Product or barcode id is invalid');
  }

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const beforeResult = await new sqlDriver.Request(transaction)
      .input('targetProductId', sql.BigInt, id)
      .input('targetBarcodeId', sql.BigInt, targetBarcodeId)
      .query(`
        SELECT TOP (1) *
        FROM dbo.product_barcodes
        WHERE id = @targetBarcodeId
          AND product_id = @targetProductId;
      `);
    const beforeSnapshot = beforeResult.recordset?.[0];

    if (!beforeSnapshot) {
      throw makeServiceError('PRODUCT_BARCODE_NOT_FOUND', 'Barcode not found', 404);
    }

    await new sqlDriver.Request(transaction)
      .input('targetBarcodeId', sql.BigInt, targetBarcodeId)
      .input('isActive', sql.Bit, !isPassive)
      .input('updatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.product_barcodes
        SET is_active = @isActive,
            is_primary = CASE WHEN @isActive = 0 THEN 0 ELSE is_primary END,
            updated_at = SYSUTCDATETIME(),
            updated_by = @updatedBy
        WHERE id = @targetBarcodeId;
      `);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: isPassive ? 'product_barcode_passivated' : 'product_barcode_activated',
      entityType: 'product_barcode',
      entityId: targetBarcodeId,
      beforeSnapshot,
      afterSnapshot: { isActive: !isPassive },
      actor,
    });

    await transaction.commit();
    return getProductDetail(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function saveProductImage(productId, payload, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(productId);

  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('PRODUCT_ID_INVALID', 'Product id is invalid');
  }

  const uploadedImage = await saveUploadedProductImageFile(id, payload);
  const filePath = uploadedImage?.filePath || trimText(payload?.filePath || payload?.imageUrl || payload?.url);
  const storageKey = uploadedImage?.storageKey || trimText(payload?.storageKey || filePath);

  if (!filePath) {
    throw makeServiceError('PRODUCT_IMAGE_PATH_REQUIRED', 'Image URL or file path is required');
  }

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    await assertProductExists(new sqlDriver.Request(transaction), id);

    await new sqlDriver.Request(transaction)
      .input('imageProductId', sql.BigInt, id)
      .query(`
        UPDATE dbo.product_images
        SET is_primary = 0,
            updated_at = SYSUTCDATETIME()
        WHERE product_id = @imageProductId
          AND is_active = 1;
      `);

    const result = await new sqlDriver.Request(transaction)
      .input('imageProductId', sql.BigInt, id)
      .input('filePath', sql.NVarChar(500), filePath)
      .input('storageKey', sql.NVarChar(200), storageKey.slice(0, 200))
      .input('createdBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.product_images (
          product_id,
          file_path,
          storage_key,
          is_primary,
          sort_order,
          is_active,
          created_by,
          updated_by
        )
        OUTPUT inserted.id
        VALUES (
          @imageProductId,
          @filePath,
          @storageKey,
          1,
          0,
          1,
          @createdBy,
          @createdBy
        );
      `);

    const imageId = Number(result.recordset?.[0]?.id);
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'product_image_saved',
      entityType: 'product_image',
      entityId: imageId,
      afterSnapshot: { productId: id, filePath, storageKey },
      actor,
    });

    await transaction.commit();
    return getProductDetail(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
