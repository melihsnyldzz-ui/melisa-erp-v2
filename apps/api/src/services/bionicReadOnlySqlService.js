import { getSafeSqlInfo, getSqlPool } from '../config/database.js';
import { env } from '../config/env.js';

const DENIED_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|MERGE|EXEC|EXECUTE|GRANT|REVOKE|DENY|DBCC|BACKUP|RESTORE|BULK|OPENROWSET|OPENDATASOURCE|INTO)\b/i;
const COMMENT_SQL = /(--|\/\*)/;

function normalizeIdentifier(value) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9_]+$/.test(text)) return null;
  return text;
}

function normalizeStockCode(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 120) return null;
  return text;
}

export function validateReadOnlySql(sqlText) {
  const sql = String(sqlText || '').trim();
  if (!sql) return { ok: false, reason: 'SQL_REQUIRED' };
  if (sql.length > env.bionicReadOnly.maxQueryChars) return { ok: false, reason: 'SQL_TOO_LONG' };
  if (COMMENT_SQL.test(sql)) return { ok: false, reason: 'SQL_COMMENTS_NOT_ALLOWED' };

  const withoutTrailingSemicolon = sql.endsWith(';') ? sql.slice(0, -1).trim() : sql;
  if (withoutTrailingSemicolon.includes(';')) return { ok: false, reason: 'MULTI_STATEMENT_SQL_NOT_ALLOWED' };
  if (!/^(SELECT|WITH)\b/i.test(withoutTrailingSemicolon)) return { ok: false, reason: 'ONLY_SELECT_OR_CTE_ALLOWED' };
  if (DENIED_SQL.test(withoutTrailingSemicolon)) return { ok: false, reason: 'WRITE_OR_UNSAFE_SQL_BLOCKED' };

  return { ok: true, sql: withoutTrailingSemicolon };
}

export async function getBionicSqlHealth() {
  const pool = await getSqlPool();
  const result = await pool.request().query('SELECT DB_NAME() AS databaseName');
  return {
    databaseName: result.recordset?.[0]?.databaseName || null,
    readOnly: getSafeSqlInfo().readOnly,
    maxRows: env.bionicReadOnly.maxRows,
    queryTimeoutMs: env.bionicReadOnly.queryTimeoutMs,
  };
}

export async function listBionicTables({ schema, search, limit }) {
  const pool = await getSqlPool();
  const safeLimit = Math.min(env.bionicReadOnly.maxTables, Math.max(1, Number(limit) || 100));
  const request = pool.request();
  request.input('schema', schema ? String(schema) : null);
  request.input('search', search ? `%${String(search)}%` : null);

  const result = await request.query(`
    SELECT TOP (${safeLimit})
      TABLE_SCHEMA AS table_schema,
      TABLE_NAME AS table_name,
      TABLE_TYPE AS table_type
    FROM INFORMATION_SCHEMA.TABLES
    WHERE (@schema IS NULL OR TABLE_SCHEMA = @schema)
      AND (@search IS NULL OR TABLE_NAME LIKE @search)
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);

  return result.recordset;
}

export async function describeBionicTable(schemaName, tableName) {
  const schema = normalizeIdentifier(schemaName);
  const table = normalizeIdentifier(tableName);
  if (!schema || !table) {
    const error = new Error('Invalid schema or table identifier');
    error.code = 'INVALID_IDENTIFIER';
    throw error;
  }

  const pool = await getSqlPool();
  const request = pool.request();
  request.input('schema', schema);
  request.input('table', table);
  const result = await request.query(`
    SELECT
      COLUMN_NAME AS column_name,
      DATA_TYPE AS data_type,
      CHARACTER_MAXIMUM_LENGTH AS max_length,
      NUMERIC_PRECISION AS numeric_precision,
      NUMERIC_SCALE AS numeric_scale,
      IS_NULLABLE AS is_nullable,
      ORDINAL_POSITION AS ordinal_position
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
    ORDER BY ORDINAL_POSITION
  `);

  return { schema, table, columns: result.recordset };
}

export async function getBionicStockCodeCount() {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    SELECT
      COUNT(DISTINCT NULLIF(LTRIM(RTRIM(stock_code)), '')) AS stockCodeCount,
      COUNT_BIG(*) AS productRowCount,
      SUM(CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END) AS nonDeletedProductCount,
      SUM(CASE WHEN is_deleted = 0 AND is_active = 1 THEN 1 ELSE 0 END) AS activeProductCount
    FROM dbo.products
    WHERE is_deleted = 0;
  `);
  const row = result.recordset?.[0] || {};
  return {
    stockCodeCount: Number(row.stockCodeCount || 0),
    productRowCount: Number(row.productRowCount || 0),
    nonDeletedProductCount: Number(row.nonDeletedProductCount || 0),
    activeProductCount: Number(row.activeProductCount || 0),
    source: 'dbo.products',
    readOnly: true,
  };
}

export async function listBionicStockCodes({ search, limit } = {}) {
  const pool = await getSqlPool();
  const safeLimit = Math.min(env.bionicReadOnly.maxRows, Math.max(1, Number(limit) || 100));
  const request = pool.request();
  request.input('search', search ? `%${String(search).trim()}%` : null);
  const result = await request.query(`
    SELECT TOP (${safeLimit})
      p.id,
      p.stock_code AS stockCode,
      p.name AS productName,
      p.brand,
      p.category,
      p.currency_code AS currency,
      p.sale_price AS salePrice,
      p.purchase_price AS purchasePrice,
      p.average_cost_try AS averageCostTry,
      p.stock_quantity AS stockQuantity,
      p.is_active AS isActive,
      p.created_at AS cardOpenedAt,
      p.last_purchase_date AS lastPurchaseDate,
      p.last_sale_date AS lastSaleDate
    FROM dbo.products p
    WHERE p.is_deleted = 0
      AND NULLIF(LTRIM(RTRIM(p.stock_code)), '') IS NOT NULL
      AND (@search IS NULL OR p.stock_code LIKE @search OR p.name LIKE @search)
    ORDER BY p.stock_code ASC;
  `);
  return result.recordset || [];
}

export async function getBionicStockByCode(stockCodeValue) {
  const stockCode = normalizeStockCode(stockCodeValue);
  if (!stockCode) {
    const error = new Error('Invalid stock code');
    error.code = 'INVALID_STOCK_CODE';
    throw error;
  }

  const pool = await getSqlPool();
  const request = pool.request();
  request.input('stockCode', stockCode);
  const productResult = await request.query(`
    SELECT TOP (1)
      p.id,
      p.stock_code AS stockCode,
      p.name AS productName,
      p.brand,
      p.category,
      p.currency_code AS currency,
      p.sale_price AS salePrice,
      p.purchase_price AS purchasePrice,
      p.purchase_discount_rate AS purchaseDiscountRate,
      p.average_cost_try AS averageCostTry,
      p.average_cost_currency AS averageCostCurrency,
      p.stock_quantity AS stockQuantity,
      p.supplier_id AS supplierId,
      s.supplier_code AS supplierCode,
      s.name AS supplierName,
      p.is_active AS isActive,
      p.created_at AS cardOpenedAt,
      p.last_purchase_date AS lastPurchaseDate,
      p.last_sale_date AS lastSaleDate
    FROM dbo.products p
    LEFT JOIN dbo.suppliers s ON s.id = p.supplier_id
    WHERE p.is_deleted = 0
      AND p.stock_code = @stockCode;
  `);

  const product = productResult.recordset?.[0];
  if (!product) return null;

  const barcodeRequest = pool.request();
  barcodeRequest.input('productId', product.id);
  const [barcodeResult, imageResult] = await Promise.all([
    barcodeRequest.query(`
      SELECT id, barcode, barcode_type AS barcodeType, is_primary AS isPrimary, is_active AS isActive
      FROM dbo.product_barcodes
      WHERE product_id = @productId
      ORDER BY is_primary DESC, id ASC;
    `),
    (() => {
      const imageRequest = pool.request();
      imageRequest.input('productId', product.id);
      return imageRequest.query(`
        SELECT id, file_path AS filePath, storage_key AS storageKey, is_primary AS isPrimary, is_active AS isActive, sort_order AS sortOrder
        FROM dbo.product_images
        WHERE product_id = @productId
        ORDER BY is_primary DESC, sort_order ASC, id ASC;
      `);
    })(),
  ]);

  return {
    ...product,
    id: Number(product.id),
    salePrice: Number(product.salePrice || 0),
    purchasePrice: Number(product.purchasePrice || 0),
    purchaseDiscountRate: Number(product.purchaseDiscountRate || 0),
    averageCostTry: Number(product.averageCostTry || 0),
    averageCostCurrency: Number(product.averageCostCurrency || 0),
    stockQuantity: Number(product.stockQuantity || 0),
    supplierId: product.supplierId ? Number(product.supplierId) : null,
    isActive: Boolean(product.isActive),
    barcodes: barcodeResult.recordset || [],
    images: imageResult.recordset || [],
    source: 'dbo.products',
    readOnly: true,
  };
}

export async function executeBionicReadOnlyQuery(sqlText) {
  const validation = validateReadOnlySql(sqlText);
  if (!validation.ok) {
    const error = new Error(validation.reason);
    error.code = validation.reason;
    throw error;
  }

  const pool = await getSqlPool();
  const request = pool.request();
  request.timeout = env.bionicReadOnly.queryTimeoutMs;
  const maxRows = env.bionicReadOnly.maxRows;
  const batch = `
    SET ROWCOUNT ${maxRows};
    BEGIN TRY
      ${validation.sql};
      SET ROWCOUNT 0;
    END TRY
    BEGIN CATCH
      SET ROWCOUNT 0;
      THROW;
    END CATCH;
  `;
  const startedAt = Date.now();
  const result = await request.query(batch);

  return {
    rows: Array.isArray(result.recordset) ? result.recordset.slice(0, maxRows) : [],
    rowCount: Array.isArray(result.recordset) ? Math.min(result.recordset.length, maxRows) : 0,
    maxRows,
    durationMs: Date.now() - startedAt,
    readOnly: true,
  };
}
