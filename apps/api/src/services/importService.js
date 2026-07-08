import { createHash } from 'node:crypto';
import { parse as parseCsv } from 'csv-parse/sync';
import sql from 'mssql';
import XLSX from 'xlsx';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

const ALLOWED_CURRENCIES = new Set(['TRY', 'USD', 'EUR']);
const ALLOWED_CUSTOMER_TYPES = new Set(['customer', 'wholesale', 'retail', 'mixed']);
const IMPORT_DUPLICATE_CHECK_BATCH_SIZE = 900;
const PREVIEW_TOKEN_VERSION = 'import-preview-v1';

const productFieldAliases = {
  stockcode: 'stockCode',
  stokkodu: 'stockCode',
  stok_kodu: 'stockCode',
  barcode: 'barcode',
  barkod: 'barcode',
  productname: 'productName',
  urunadi: 'productName',
  urun_adi: 'productName',
  name: 'productName',
  brand: 'brand',
  marka: 'brand',
  category: 'category',
  kategori: 'category',
  currency: 'currency',
  parabirimi: 'currency',
  para_birimi: 'currency',
  urunparabirimi: 'currency',
  urun_para_birimi: 'currency',
  saleprice: 'salePrice',
  satisfiyati: 'salePrice',
  satis_fiyati: 'salePrice',
  purchaseprice: 'purchasePrice',
  alisfiyati: 'purchasePrice',
  alis_fiyati: 'purchasePrice',
  stockquantity: 'stockQuantity',
  stokmiktari: 'stockQuantity',
  stok_adedi: 'stockQuantity',
  stokadedi: 'stockQuantity',
  miktar: 'stockQuantity',
  quantity: 'stockQuantity',
  mevcutstok: 'stockQuantity',
};

const customerFieldAliases = {
  customercode: 'customerCode',
  carikodu: 'customerCode',
  cari_kodu: 'customerCode',
  customername: 'customerName',
  cariadi: 'customerName',
  cari_adi: 'customerName',
  unvan: 'customerName',
  phone: 'phone',
  telefon: 'phone',
  city: 'city',
  sehir: 'city',
  country: 'country',
  ulke: 'country',
  currency: 'currency',
  parabirimi: 'currency',
  para_birimi: 'currency',
  customertype: 'customerType',
  caritipi: 'customerType',
  cari_tipi: 'customerType',
  balance: 'balance',
  bakiye: 'balance',
};

const supplierFieldAliases = {
  suppliercode: 'supplierCode',
  tedarikcikodu: 'supplierCode',
  tedarikci_kodu: 'supplierCode',
  carikodu: 'supplierCode',
  cari_kodu: 'supplierCode',
  suppliername: 'supplierName',
  tedarikciadi: 'supplierName',
  tedarikci_adi: 'supplierName',
  unvan: 'supplierName',
  phone: 'phone',
  telefon: 'phone',
  city: 'city',
  sehir: 'city',
  country: 'country',
  ulke: 'country',
  currency: 'currency',
  parabirimi: 'currency',
  para_birimi: 'currency',
  purchasediscountrate: 'purchaseDiscountRate',
  alisiskontosu: 'purchaseDiscountRate',
  alis_iskontosu: 'purchaseDiscountRate',
  iskonto: 'purchaseDiscountRate',
  balance: 'balance',
  bakiye: 'balance',
};

function makeImportError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replaceAll('\u0131', 'i')
    .replaceAll('\u011f', 'g')
    .replaceAll('\u00fc', 'u')
    .replaceAll('\u015f', 's')
    .replaceAll('\u00f6', 'o')
    .replaceAll('\u00e7', 'c')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9_]/g, '');
}

function trimText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function chunkRows(rows, size = IMPORT_DUPLICATE_CHECK_BATCH_SIZE) {
  const chunks = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

function parseNumber(value, fieldName, errors, { allowNegative = false } = {}) {
  const raw = trimText(value);

  if (!raw) {
    return 0;
  }

  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    errors.push(`${fieldName} numeric format invalid`);
    return 0;
  }

  if (!allowNegative && number < 0) {
    errors.push(`${fieldName} negative value not allowed`);
    return number;
  }

  return number;
}

function decodeFile(filePayload) {
  const fileName = trimText(filePayload?.fileName);
  const contentBase64 = trimText(filePayload?.contentBase64);

  if (!fileName || !contentBase64) {
    throw makeImportError('IMPORT_FILE_REQUIRED', 'fileName and contentBase64 are required');
  }

  let buffer;
  try {
    buffer = Buffer.from(contentBase64, 'base64');
  } catch (error) {
    throw makeImportError('IMPORT_FILE_INVALID', 'Import file payload could not be decoded');
  }

  if (!buffer.length) {
    throw makeImportError('IMPORT_FILE_EMPTY', 'Import file is empty');
  }

  return { fileName, buffer, contentHash: createHash('sha256').update(buffer).digest('hex') };
}

function parseRows(filePayload) {
  const { fileName, buffer, contentHash } = decodeFile(filePayload);
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith('.csv')) {
    const rows = parseCsv(buffer.toString('utf8'), {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return { fileName, rows, contentHash };
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw makeImportError('IMPORT_FILE_EMPTY', 'Excel workbook has no sheets');
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      defval: '',
      raw: false,
    });
    return { fileName, rows, contentHash };
  }

  throw makeImportError('IMPORT_FILE_TYPE_UNSUPPORTED', 'Only CSV, XLS and XLSX files are supported');
}

function normalizeRecord(row, aliases) {
  return Object.entries(row || {}).reduce((record, [key, value]) => {
    const canonicalKey = aliases[normalizeHeader(key)];

    if (canonicalKey) {
      record[canonicalKey] = trimText(value);
    }

    return record;
  }, {});
}

function buildProductRow(row, rowNumber) {
  const data = normalizeRecord(row, productFieldAliases);
  const errors = [];
  const warnings = [];
  const requiredFields = ['stockCode', 'barcode', 'productName', 'currency', 'salePrice', 'purchasePrice'];

  requiredFields.forEach((field) => {
    if (!trimText(data[field])) {
      errors.push(`${field} required`);
    }
  });

  data.currency = trimText(data.currency).toUpperCase();
  if (data.currency && !ALLOWED_CURRENCIES.has(data.currency)) {
    errors.push('currency invalid');
  }

  data.salePrice = parseNumber(data.salePrice, 'salePrice', errors);
  data.purchasePrice = parseNumber(data.purchasePrice, 'purchasePrice', errors);
  data.stockQuantity = parseNumber(data.stockQuantity, 'stockQuantity', errors);

  if (data.currency && data.currency !== 'TRY') {
    warnings.push('average cost TRY will stay 0 until purchase finalize');
  }

  return {
    rowNumber,
    data: {
      stockCode: trimText(data.stockCode),
      barcode: trimText(data.barcode),
      productName: trimText(data.productName),
      brand: trimText(data.brand),
      category: trimText(data.category),
      currency: data.currency,
      salePrice: data.salePrice,
      purchasePrice: data.purchasePrice,
      stockQuantity: data.stockQuantity,
    },
    errors,
    warnings,
  };
}

function normalizeCustomerType(value) {
  const normalized = trimText(value).toLowerCase();
  const map = {
    musteri: 'customer',
    müşteri: 'customer',
    toptan: 'wholesale',
    perakende: 'retail',
    karma: 'mixed',
  };
  return map[normalized] || normalized;
}

function buildCustomerRow(row, rowNumber) {
  const data = normalizeRecord(row, customerFieldAliases);
  const errors = [];
  const requiredFields = ['customerCode', 'customerName', 'phone', 'currency', 'customerType'];

  requiredFields.forEach((field) => {
    if (!trimText(data[field])) {
      errors.push(`${field} required`);
    }
  });

  data.currency = trimText(data.currency).toUpperCase();
  data.customerType = normalizeCustomerType(data.customerType);

  if (data.currency && !ALLOWED_CURRENCIES.has(data.currency)) {
    errors.push('currency invalid');
  }

  if (data.customerType && !ALLOWED_CUSTOMER_TYPES.has(data.customerType)) {
    errors.push('customerType invalid');
  }

  data.balance = parseNumber(data.balance, 'balance', errors, { allowNegative: true });

  return {
    rowNumber,
    data: {
      customerCode: trimText(data.customerCode),
      customerName: trimText(data.customerName),
      phone: trimText(data.phone),
      city: trimText(data.city),
      country: trimText(data.country),
      currency: data.currency,
      customerType: data.customerType,
      balance: data.balance,
    },
    errors,
    warnings: [],
  };
}

function buildSupplierRow(row, rowNumber) {
  const data = normalizeRecord(row, supplierFieldAliases);
  const errors = [];
  const requiredFields = ['supplierCode', 'supplierName', 'currency'];

  requiredFields.forEach((field) => {
    if (!trimText(data[field])) {
      errors.push(`${field} required`);
    }
  });

  data.currency = trimText(data.currency || 'TRY').toUpperCase();
  if (data.currency && !ALLOWED_CURRENCIES.has(data.currency)) {
    errors.push('currency invalid');
  }

  data.purchaseDiscountRate = parseNumber(data.purchaseDiscountRate, 'purchaseDiscountRate', errors);
  if (data.purchaseDiscountRate < 0 || data.purchaseDiscountRate > 100) {
    errors.push('purchaseDiscountRate must be between 0 and 100');
  }
  data.balance = parseNumber(data.balance, 'balance', errors, { allowNegative: true });

  return {
    rowNumber,
    data: {
      supplierCode: trimText(data.supplierCode),
      supplierName: trimText(data.supplierName),
      phone: trimText(data.phone),
      city: trimText(data.city),
      country: trimText(data.country),
      currency: data.currency,
      purchaseDiscountRate: data.purchaseDiscountRate,
      balance: data.balance,
    },
    errors,
    warnings: [],
  };
}

function markFileDuplicates(rows, keyName, label) {
  const counts = new Map();

  rows.forEach((row) => {
    const value = trimText(row.data[keyName]).toUpperCase();
    if (value) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  });

  rows.forEach((row) => {
    const value = trimText(row.data[keyName]).toUpperCase();
    if (value && counts.get(value) > 1) {
      row.errors.push(`${label} duplicate in file`);
    }
  });
}

async function markDbProductDuplicates(rows) {
  const candidates = rows.filter((row) => row.errors.length === 0);

  if (!candidates.length) {
    return;
  }

  const pool = await getSqlPool();
  const duplicates = new Map();

  for (const batch of chunkRows(candidates)) {
    const request = pool.request();
    const stockParams = [];
    const barcodeParams = [];

    batch.forEach((row, index) => {
      const stockParam = `stockCode${index}`;
      const barcodeParam = `barcode${index}`;
      stockParams.push(`@${stockParam}`);
      barcodeParams.push(`@${barcodeParam}`);
      request.input(stockParam, sql.NVarChar(80), row.data.stockCode);
      request.input(barcodeParam, sql.NVarChar(120), row.data.barcode);
    });

    const result = await request.query(`
      SELECT
        p.stock_code AS value,
        N'stockCode' AS field,
        p.id AS product_id,
        p.stock_code,
        p.name AS product_name,
        pb.barcode
      FROM dbo.products p
      OUTER APPLY (
        SELECT TOP (1) barcode
        FROM dbo.product_barcodes
        WHERE product_id = p.id
          AND is_active = 1
        ORDER BY is_primary DESC, id ASC
      ) pb
      WHERE p.stock_code IN (${stockParams.join(', ')})
        AND p.is_deleted = 0
      UNION ALL
      SELECT
        b.barcode AS value,
        N'barcode' AS field,
        p.id AS product_id,
        p.stock_code,
        p.name AS product_name,
        b.barcode
      FROM dbo.product_barcodes b
      INNER JOIN dbo.products p ON p.id = b.product_id
      WHERE b.is_active = 1
        AND p.is_deleted = 0
        AND b.barcode IN (${barcodeParams.join(', ')});
    `);

    (result.recordset || []).forEach((row) => {
      duplicates.set(`${row.field}:${String(row.value).toUpperCase()}`, {
        productId: Number(row.product_id),
        stockCode: row.stock_code,
        productName: row.product_name,
        barcode: row.barcode,
      });
    });
  }

  candidates.forEach((row) => {
    const stockDuplicate = duplicates.get(`stockCode:${row.data.stockCode.toUpperCase()}`);
    const barcodeDuplicate = duplicates.get(`barcode:${row.data.barcode.toUpperCase()}`);

    if (stockDuplicate) {
      row.errors.push('stockCode duplicate in database');
      row.duplicateProduct = stockDuplicate;
    }

    if (barcodeDuplicate) {
      row.errors.push('barcode duplicate in database');
      row.duplicateProduct = row.duplicateProduct || barcodeDuplicate;
    }
  });
}

async function markDbCustomerDuplicates(rows) {
  const candidates = rows.filter((row) => row.errors.length === 0);

  if (!candidates.length) {
    return;
  }

  const pool = await getSqlPool();
  const duplicates = new Set();

  for (const batch of chunkRows(candidates)) {
    const request = pool.request();
    const params = [];

    batch.forEach((row, index) => {
      const param = `customerCode${index}`;
      params.push(`@${param}`);
      request.input(param, sql.NVarChar(80), row.data.customerCode);
    });

    const result = await request.query(`
      SELECT customer_code
      FROM dbo.customers
      WHERE customer_code IN (${params.join(', ')});
    `);

    (result.recordset || []).forEach((row) => duplicates.add(String(row.customer_code).toUpperCase()));
  }

  candidates.forEach((row) => {
    if (duplicates.has(row.data.customerCode.toUpperCase())) {
      row.errors.push('customerCode duplicate in database');
    }
  });
}

async function markDbSupplierDuplicates(rows) {
  const candidates = rows.filter((row) => row.errors.length === 0);

  if (!candidates.length) {
    return;
  }

  const pool = await getSqlPool();
  const duplicates = new Set();

  for (const batch of chunkRows(candidates)) {
    const request = pool.request();
    const params = [];

    batch.forEach((row, index) => {
      const param = `supplierCode${index}`;
      params.push(`@${param}`);
      request.input(param, sql.NVarChar(80), row.data.supplierCode);
    });

    const result = await request.query(`
      SELECT supplier_code
      FROM dbo.suppliers
      WHERE supplier_code IN (${params.join(', ')})
        AND is_deleted = 0;
    `);

    (result.recordset || []).forEach((row) => duplicates.add(String(row.supplier_code).toUpperCase()));
  }

  candidates.forEach((row) => {
    if (duplicates.has(row.data.supplierCode.toUpperCase())) {
      row.errors.push('supplierCode duplicate in database');
    }
  });
}

function summarizePreview(entityType, fileName, rows) {
  const normalizedRows = rows.map((row) => {
    const hasDuplicate = row.errors.some((error) => error.includes('duplicate'));
    const status = row.errors.length > 0 ? (hasDuplicate ? 'duplicate' : 'invalid') : 'valid';
    return { ...row, status };
  });

  const warnings = normalizedRows.flatMap((row) => row.warnings.map((warning) => ({
    rowNumber: row.rowNumber,
    message: warning,
  })));

  return {
    entityType,
    fileName,
    totalRows: normalizedRows.length,
    validRowCount: normalizedRows.filter((row) => row.status === 'valid').length,
    invalidRowCount: normalizedRows.filter((row) => row.status === 'invalid').length,
    duplicateRowCount: normalizedRows.filter((row) => row.status === 'duplicate').length,
    warnings,
    rows: normalizedRows,
  };
}

function makePreviewToken({ entityType, fileName, contentHash, totalRows, validRowCount, invalidRowCount, duplicateRowCount }) {
  return createHash('sha256')
    .update([
      PREVIEW_TOKEN_VERSION,
      entityType,
      fileName,
      contentHash,
      totalRows,
      validRowCount,
      invalidRowCount,
      duplicateRowCount,
    ].join('|'))
    .digest('hex');
}

function attachPreviewControl(preview, contentHash) {
  return {
    ...preview,
    previewRequiredForApply: true,
    previewToken: makePreviewToken({ ...preview, contentHash }),
  };
}

function assertPreviewToken(preview, filePayload) {
  const suppliedToken = trimText(filePayload?.previewToken);

  if (!suppliedToken) {
    throw makeImportError('IMPORT_PREVIEW_REQUIRED', 'Preview token is required before import apply', 409);
  }

  if (suppliedToken !== preview.previewToken) {
    throw makeImportError('IMPORT_PREVIEW_STALE', 'Preview token does not match the import file; run preview again', 409);
  }
}

function addProductWarnings(row) {
  if (row.errors.length > 0) return row;

  if (row.data.salePrice === 0) row.warnings.push('salePrice is zero');
  if (row.data.purchasePrice === 0) row.warnings.push('purchasePrice is zero');
  if (row.data.stockQuantity === 0) row.warnings.push('stockQuantity is zero');
  if (!row.data.brand) row.warnings.push('brand is empty');
  if (!row.data.category) row.warnings.push('category is empty');

  return row;
}

function addCustomerWarnings(row) {
  if (row.errors.length > 0) return row;

  if (row.data.phone === '000' || row.data.phone === '0000') row.warnings.push('phone looks temporary');
  if (!row.data.city) row.warnings.push('city is empty');
  if (!row.data.country) row.warnings.push('country is empty');
  if (row.data.balance !== 0) row.warnings.push('opening balance will be imported');

  return row;
}

function addSupplierWarnings(row) {
  if (row.errors.length > 0) return row;

  if (!row.data.phone) row.warnings.push('phone is empty');
  if (!row.data.city) row.warnings.push('city is empty');
  if (!row.data.country) row.warnings.push('country is empty');
  if (row.data.balance !== 0) row.warnings.push('opening balance will be imported');

  return row;
}

async function readEntityCount(request, entityType) {
  const tableByEntity = {
    products: 'dbo.products',
    customers: 'dbo.customers',
    suppliers: 'dbo.suppliers',
  };
  const tableName = tableByEntity[entityType];

  if (!tableName) {
    throw makeImportError('IMPORT_ENTITY_INVALID', 'Import entity type is invalid');
  }

  const result = await request.query(`
    SELECT COUNT_BIG(1) AS total
    FROM ${tableName}
    WHERE is_deleted = 0;
  `);

  return Number(result.recordset?.[0]?.total || 0);
}

export async function previewProductImport(filePayload) {
  const { fileName, rows: rawRows, contentHash } = parseRows(filePayload);
  const rows = rawRows.map((row, index) => addProductWarnings(buildProductRow(row, index + 2)));

  markFileDuplicates(rows, 'stockCode', 'stockCode');
  markFileDuplicates(rows, 'barcode', 'barcode');
  await markDbProductDuplicates(rows);

  return attachPreviewControl(summarizePreview('products', fileName, rows), contentHash);
}

export async function previewCustomerImport(filePayload) {
  const { fileName, rows: rawRows, contentHash } = parseRows(filePayload);
  const rows = rawRows.map((row, index) => addCustomerWarnings(buildCustomerRow(row, index + 2)));

  markFileDuplicates(rows, 'customerCode', 'customerCode');
  await markDbCustomerDuplicates(rows);

  return attachPreviewControl(summarizePreview('customers', fileName, rows), contentHash);
}

export async function previewSupplierImport(filePayload) {
  const { fileName, rows: rawRows, contentHash } = parseRows(filePayload);
  const rows = rawRows.map((row, index) => addSupplierWarnings(buildSupplierRow(row, index + 2)));

  markFileDuplicates(rows, 'supplierCode', 'supplierCode');
  await markDbSupplierDuplicates(rows);

  return attachPreviewControl(summarizePreview('suppliers', fileName, rows), contentHash);
}

function getCommitRows(preview, { validOnly = false } = {}) {
  if (validOnly) {
    return preview.rows.filter((row) => row.status === 'valid');
  }

  return preview.rows;
}

function assertPreviewClean(preview, { validOnly = false } = {}) {
  if (preview.totalRows < 1) {
    throw makeImportError('IMPORT_NO_ROWS', 'Import file has no data rows');
  }

  if (validOnly) {
    if (preview.validRowCount < 1) {
      throw makeImportError('IMPORT_NO_VALID_ROWS', 'Import file has no valid rows to commit', 422);
    }

    return;
  }

  if (preview.invalidRowCount > 0 || preview.duplicateRowCount > 0) {
    throw makeImportError('IMPORT_VALIDATION_FAILED', 'Import validation failed; database was not changed', 422);
  }
}

export async function commitProductImport(filePayload, actor = null) {
  assertMelisaWriteEnabled();

  const preview = await previewProductImport(filePayload);
  assertPreviewToken(preview, filePayload);
  const validOnly = Boolean(filePayload?.validOnly);
  assertPreviewClean(preview, { validOnly });
  const commitRows = getCommitRows(preview, { validOnly });

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeCount = await readEntityCount(new sqlDriver.Request(transaction), 'products');
    const insertedIds = [];

    for (const row of commitRows) {
      const product = row.data;
      const insertResult = await new sqlDriver.Request(transaction)
        .input('stockCode', sql.NVarChar(80), product.stockCode)
        .input('productName', sql.NVarChar(250), product.productName)
        .input('brand', sql.NVarChar(120), product.brand || null)
        .input('category', sql.NVarChar(120), product.category || null)
        .input('currency', sql.NVarChar(3), product.currency)
        .input('salePrice', sql.Decimal(18, 4), product.salePrice)
        .input('purchasePrice', sql.Decimal(18, 4), product.purchasePrice)
        .input('stockQuantity', sql.Decimal(18, 3), product.stockQuantity)
        .input('averageCostTry', sql.Decimal(18, 4), product.currency === 'TRY' ? product.purchasePrice : 0)
        .input('actorId', sql.BigInt, actor?.id || null)
        .query(`
          INSERT INTO dbo.products (
            stock_code,
            name,
            category,
            brand,
            unit,
            currency_code,
            sales_price,
            purchase_price,
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
            N'ADET',
            @currency,
            @salePrice,
            @purchasePrice,
            @averageCostTry,
            @stockQuantity,
            1,
            0,
            @actorId,
            @actorId
          );
        `);

      const productId = Number(insertResult.recordset?.[0]?.productId);
      insertedIds.push(productId);

      await new sqlDriver.Request(transaction)
        .input('productId', sql.BigInt, productId)
        .input('barcode', sql.NVarChar(120), product.barcode)
        .input('actorId', sql.BigInt, actor?.id || null)
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
            @productId,
            @barcode,
            N'primary',
            1,
            1,
            @actorId,
            @actorId
          );
        `);
    }

    const afterCount = await readEntityCount(new sqlDriver.Request(transaction), 'products');

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'import_products',
      entityType: 'import',
      entityId: null,
      afterSnapshot: {
        fileName: preview.fileName,
        insertedCount: insertedIds.length,
        insertedIds,
        skippedInvalidCount: validOnly ? preview.invalidRowCount : 0,
        skippedDuplicateCount: validOnly ? preview.duplicateRowCount : 0,
        warningCount: preview.warnings.length,
        beforeCount,
        afterCount,
      },
      actor,
    });

    await transaction.commit();

    return {
      entityType: 'products',
      insertedCount: insertedIds.length,
      insertedIds,
      beforeCount,
      afterCount,
      skippedInvalidCount: validOnly ? preview.invalidRowCount : 0,
      skippedDuplicateCount: validOnly ? preview.duplicateRowCount : 0,
      preview,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function commitCustomerImport(filePayload, actor = null) {
  assertMelisaWriteEnabled();

  const preview = await previewCustomerImport(filePayload);
  assertPreviewToken(preview, filePayload);
  const validOnly = Boolean(filePayload?.validOnly);
  assertPreviewClean(preview, { validOnly });
  const commitRows = getCommitRows(preview, { validOnly });

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeCount = await readEntityCount(new sqlDriver.Request(transaction), 'customers');
    const insertedIds = [];

    for (const row of commitRows) {
      const customer = row.data;
      const insertResult = await new sqlDriver.Request(transaction)
        .input('customerCode', sql.NVarChar(80), customer.customerCode)
        .input('customerName', sql.NVarChar(250), customer.customerName)
        .input('phone', sql.NVarChar(50), customer.phone)
        .input('city', sql.NVarChar(120), customer.city || null)
        .input('country', sql.NVarChar(120), customer.country || null)
        .input('currency', sql.NVarChar(3), customer.currency)
        .input('customerType', sql.NVarChar(40), customer.customerType)
        .input('balance', sql.Decimal(18, 4), customer.balance)
        .input('actorId', sql.BigInt, actor?.id || null)
        .query(`
          INSERT INTO dbo.customers (
            customer_code,
            name,
            phone,
            city,
            country,
            currency_code,
            customer_type,
            balance,
            risk_limit,
            is_active,
            is_deleted,
            created_by,
            updated_by
          )
          OUTPUT INSERTED.id AS customerId
          VALUES (
            @customerCode,
            @customerName,
            @phone,
            @city,
            @country,
            @currency,
            @customerType,
            @balance,
            0,
            1,
            0,
            @actorId,
            @actorId
          );
        `);

      insertedIds.push(Number(insertResult.recordset?.[0]?.customerId));
    }

    const afterCount = await readEntityCount(new sqlDriver.Request(transaction), 'customers');

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'import_customers',
      entityType: 'import',
      entityId: null,
      afterSnapshot: {
        fileName: preview.fileName,
        insertedCount: insertedIds.length,
        insertedIds,
        skippedInvalidCount: validOnly ? preview.invalidRowCount : 0,
        skippedDuplicateCount: validOnly ? preview.duplicateRowCount : 0,
        warningCount: preview.warnings.length,
        beforeCount,
        afterCount,
      },
      actor,
    });

    await transaction.commit();

    return {
      entityType: 'customers',
      insertedCount: insertedIds.length,
      insertedIds,
      beforeCount,
      afterCount,
      skippedInvalidCount: validOnly ? preview.invalidRowCount : 0,
      skippedDuplicateCount: validOnly ? preview.duplicateRowCount : 0,
      preview,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function commitSupplierImport(filePayload, actor = null) {
  assertMelisaWriteEnabled();

  const preview = await previewSupplierImport(filePayload);
  assertPreviewToken(preview, filePayload);
  const validOnly = Boolean(filePayload?.validOnly);
  assertPreviewClean(preview, { validOnly });
  const commitRows = getCommitRows(preview, { validOnly });

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const beforeCount = await readEntityCount(new sqlDriver.Request(transaction), 'suppliers');
    const insertedIds = [];

    for (const row of commitRows) {
      const supplier = row.data;
      const insertResult = await new sqlDriver.Request(transaction)
        .input('supplierCode', sql.NVarChar(80), supplier.supplierCode)
        .input('supplierName', sql.NVarChar(250), supplier.supplierName)
        .input('phone', sql.NVarChar(40), supplier.phone || null)
        .input('city', sql.NVarChar(120), supplier.city || null)
        .input('country', sql.NVarChar(120), supplier.country || null)
        .input('currency', sql.NVarChar(3), supplier.currency)
        .input('purchaseDiscountRate', sql.Decimal(9, 4), supplier.purchaseDiscountRate)
        .input('balance', sql.Decimal(18, 4), supplier.balance)
        .query(`
          INSERT INTO dbo.suppliers (
            supplier_code,
            name,
            phone,
            city,
            country,
            currency_code,
            purchase_discount_rate,
            balance,
            is_active,
            is_deleted
          )
          OUTPUT INSERTED.id AS supplierId
          VALUES (
            @supplierCode,
            @supplierName,
            @phone,
            @city,
            @country,
            @currency,
            @purchaseDiscountRate,
            @balance,
            1,
            0
          );
        `);

      insertedIds.push(Number(insertResult.recordset?.[0]?.supplierId));
    }

    const afterCount = await readEntityCount(new sqlDriver.Request(transaction), 'suppliers');

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'import_suppliers',
      entityType: 'import',
      entityId: null,
      afterSnapshot: {
        fileName: preview.fileName,
        insertedCount: insertedIds.length,
        insertedIds,
        skippedInvalidCount: validOnly ? preview.invalidRowCount : 0,
        skippedDuplicateCount: validOnly ? preview.duplicateRowCount : 0,
        warningCount: preview.warnings.length,
        beforeCount,
        afterCount,
      },
      actor,
    });

    await transaction.commit();

    return {
      entityType: 'suppliers',
      insertedCount: insertedIds.length,
      insertedIds,
      beforeCount,
      afterCount,
      skippedInvalidCount: validOnly ? preview.invalidRowCount : 0,
      skippedDuplicateCount: validOnly ? preview.duplicateRowCount : 0,
      preview,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
