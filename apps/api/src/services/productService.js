import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { buildListMeta, maskValue, parseListQuery } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

function toProductDto(row) {
  return {
    id: row.id,
    stockCode: row.stock_code,
    barcodeMasked: maskValue(row.barcode_raw, 3, 2),
    productName: row.product_name,
    brand: row.brand,
    category: row.category,
    currency: row.currency_code,
    salePrice: Number(row.sale_price || 0),
    purchasePrice: Number(row.purchase_price || 0),
    stockQuantity: Number(row.stock_quantity || 0),
    isPassive: !row.is_active,
  };
}

function toProductDetailDto(row) {
  return {
    id: row.id,
    stockCode: row.stock_code,
    barcodeMasked: maskValue(row.barcode_raw, 3, 2),
    productName: row.product_name,
    brand: row.brand,
    category: row.category,
    currency: row.currency_code,
    salePrice: Number(row.sale_price || 0),
    purchasePrice: Number(row.purchase_price || 0),
    stockQuantity: Number(row.stock_quantity || 0),
    supplierName: row.supplier_name || null,
    isPassive: !row.is_active,
    averageCostTry: Number(row.average_cost_try || 0),
    lastPurchaseDate: row.last_purchase_date || null,
    lastSaleDate: row.last_sale_date || null,
  };
}

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseMoney(value, fieldName) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw makeServiceError('PRODUCT_VALIDATION_FAILED', `${fieldName} must be a non-negative number`);
  }

  return number;
}

function normalizeCurrency(value) {
  return trimText(value).toUpperCase();
}

function validateProductPayload(payload, { requireBarcode }) {
  const product = {
    stockCode: trimText(payload?.stockCode),
    productName: trimText(payload?.productName),
    barcode: trimText(payload?.barcode),
    brand: trimText(payload?.brand),
    category: trimText(payload?.category),
    currency: normalizeCurrency(payload?.currency),
    salePrice: parseMoney(payload?.salePrice, 'salePrice'),
    purchasePrice: parseMoney(payload?.purchasePrice, 'purchasePrice'),
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
        p.currency_code AS currency,
        p.sales_price AS salePrice,
        p.purchase_price AS purchasePrice,
        p.current_stock_qty AS stockQuantity,
        p.average_cost_try AS averageCostTry,
        p.is_active AS isActive,
        p.updated_at AS updatedAt
      FROM dbo.products p
      OUTER APPLY (
        SELECT TOP (1) b.barcode
        FROM dbo.product_barcodes b
        WHERE b.product_id = p.id
          AND b.is_active = 1
        ORDER BY b.is_primary DESC, b.id ASC
      ) pb
      WHERE p.id = @snapshotProductId;
    `);

  return result.recordset?.[0] || null;
}

async function assertProductDuplicates(request, product, currentProductId = null) {
  const stockDuplicate = await request
    .input('duplicateStockCode', sql.NVarChar(80), product.stockCode)
    .input('duplicateProductId', sql.BigInt, currentProductId || 0)
    .query(`
      SELECT TOP (1) id
      FROM dbo.products
      WHERE stock_code = @duplicateStockCode
        AND (@duplicateProductId = 0 OR id <> @duplicateProductId);
    `);

  if (stockDuplicate.recordset?.[0]) {
    throw makeServiceError('PRODUCT_STOCK_CODE_DUPLICATE', 'Product stockCode already exists', 409);
  }

  if (!product.barcode) {
    return;
  }

  const barcodeDuplicate = await request
    .input('duplicateBarcode', sql.NVarChar(120), product.barcode)
    .input('duplicateBarcodeProductId', sql.BigInt, currentProductId || 0)
    .query(`
      SELECT TOP (1) product_id
      FROM dbo.product_barcodes
      WHERE barcode = @duplicateBarcode
        AND is_active = 1
        AND (@duplicateBarcodeProductId = 0 OR product_id <> @duplicateBarcodeProductId);
    `);

  if (barcodeDuplicate.recordset?.[0]) {
    throw makeServiceError('PRODUCT_BARCODE_DUPLICATE', 'Product main barcode already exists', 409);
  }
}

export async function getProductsList(query) {
  const options = parseListQuery(query);
  const pool = await getSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(120), options.search ? `%${options.search}%` : null)
    .input('activeOnly', sql.Bit, options.activeOnly)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_products AS (
      SELECT
        p.id,
        p.stock_code,
        pb.barcode AS barcode_raw,
        p.name AS product_name,
        p.brand,
        p.category,
        p.currency_code,
        p.sales_price AS sale_price,
        p.purchase_price,
        p.current_stock_qty AS stock_quantity,
        p.is_active,
        p.created_at
      FROM dbo.products p
      OUTER APPLY (
        SELECT TOP (1) b.barcode
        FROM dbo.product_barcodes b
        WHERE b.product_id = p.id
          AND b.is_active = 1
        ORDER BY b.is_primary DESC, b.id ASC
      ) pb
      WHERE
        (@activeOnly = 0 OR p.is_active = 1)
        AND (
          @search IS NULL
          OR p.stock_code COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR p.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR p.brand COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR p.category COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR pb.barcode COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
        )
    ),
    numbered_products AS (
      SELECT
        fp.id,
        fp.stock_code,
        fp.barcode_raw,
        fp.product_name,
        fp.brand,
        fp.category,
        fp.currency_code,
        fp.sale_price,
        fp.purchase_price,
        fp.stock_quantity,
        fp.is_active,
        fp.created_at,
        ROW_NUMBER() OVER (ORDER BY fp.id DESC) AS row_number,
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
        activeOnly: options.activeOnly,
      },
    }),
  };
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
      p.current_stock_qty AS stock_quantity,
      CAST(NULL AS NVARCHAR(250)) AS supplier_name,
      p.is_active,
      p.average_cost_try,
      lp.last_purchase_date,
      ls.last_sale_date
    FROM dbo.products p
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
      SELECT MAX(si.document_date) AS last_sale_date
      FROM dbo.sales_invoice_items sii
      INNER JOIN dbo.sales_invoices si ON si.id = sii.sales_invoice_id
      WHERE sii.product_id = p.id
        AND si.status = N'finalized'
    ) ls
    WHERE p.id = @id;
  `);

  const row = result.recordset?.[0];

  if (!row) {
    const error = new Error('Product not found');
    error.code = 'PRODUCT_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  return toProductDetailDto(row);
}

export async function createProduct(payload) {
  assertMelisaWriteEnabled();

  const product = validateProductPayload(payload, { requireBarcode: true });
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    await assertProductDuplicates(new sqlDriver.Request(transaction), product);

    const insertProductResult = await new sqlDriver.Request(transaction)
      .input('stockCode', sql.NVarChar(80), product.stockCode)
      .input('productName', sql.NVarChar(250), product.productName)
      .input('brand', sql.NVarChar(120), product.brand || null)
      .input('category', sql.NVarChar(120), product.category || null)
      .input('currency', sql.NVarChar(3), product.currency)
      .input('salePrice', sql.Decimal(18, 4), product.salePrice)
      .input('purchasePrice', sql.Decimal(18, 4), product.purchasePrice)
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
          @purchasePrice,
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
    });

    await transaction.commit();

    return getProductDetail(productId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateProduct(productId, payload) {
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

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('stockCode', sql.NVarChar(80), product.stockCode)
      .input('productName', sql.NVarChar(250), product.productName)
      .input('brand', sql.NVarChar(120), product.brand || null)
      .input('category', sql.NVarChar(120), product.category || null)
      .input('currency', sql.NVarChar(3), product.currency)
      .input('salePrice', sql.Decimal(18, 4), product.salePrice)
      .input('purchasePrice', sql.Decimal(18, 4), product.purchasePrice)
      .query(`
        UPDATE dbo.products
        SET
          stock_code = @stockCode,
          name = @productName,
          category = @category,
          brand = @brand,
          currency_code = @currency,
          sales_price = @salePrice,
          purchase_price = @purchasePrice,
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
    });

    await transaction.commit();

    return getProductDetail(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function changeProductPassive(productId, payload = {}) {
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
