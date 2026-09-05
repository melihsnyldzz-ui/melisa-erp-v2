import { getVegaSqlPool } from '../config/vegaDatabase.js';

const STOCK_TABLE = 'F0102TBLSTOKLAR';
const STOCK_SCHEMA = 'dbo';
const MAX_LIST_ROWS = 250;

function normalizeStockCode(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 120) return null;
  return text;
}

function quoteIdentifier(value) {
  return `[${String(value).replace(/]/g, ']]')}]`;
}

async function getStockColumns(pool) {
  const request = pool.request();
  request.input('schema', STOCK_SCHEMA);
  request.input('table', STOCK_TABLE);
  const result = await request.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
    ORDER BY ORDINAL_POSITION;
  `);
  return new Set((result.recordset || []).map((row) => String(row.COLUMN_NAME || row.column_name || '').toUpperCase()));
}

function firstExisting(columns, candidates) {
  return candidates.find((candidate) => columns.has(candidate.toUpperCase())) || null;
}

function aliased(column, alias) {
  return column ? `${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}` : `NULL AS ${quoteIdentifier(alias)}`;
}

async function buildProjection(pool) {
  const columns = await getStockColumns(pool);
  if (!columns.has('STOKKODU')) {
    const error = new Error('Vega stock table does not expose STOKKODU');
    error.code = 'VEGA_STOCK_CODE_COLUMN_MISSING';
    error.statusCode = 503;
    throw error;
  }

  const mapping = {
    sourceId: firstExisting(columns, ['IND', 'ID']),
    stockCode: 'STOKKODU',
    productName: firstExisting(columns, ['STOKADI', 'STOKAD', 'ADI', 'ACIKLAMA', 'STOKACIKLAMA']),
    barcode: firstExisting(columns, ['BARKOD', 'BARKODU', 'BARCODE']),
    unit: firstExisting(columns, ['BIRIM', 'BIRIMI']),
    currency: firstExisting(columns, ['DOVIZ', 'DOVIZCINSI', 'PARABIRIMI']),
    salePrice: firstExisting(columns, ['SATISFIYATI', 'SATISFIYAT1', 'FIYAT1', 'SATIS1']),
    purchasePrice: firstExisting(columns, ['ALISFIYATI', 'ALISFIYAT1', 'ALIS1']),
    groupCode: firstExisting(columns, ['GRUPKODU', 'GRUPKOD', 'KOD1']),
    brand: firstExisting(columns, ['MARKA', 'MARKASI']),
  };

  const select = Object.entries(mapping)
    .map(([alias, column]) => aliased(column, alias))
    .join(',\n      ');

  return { mapping, select, columns: [...columns].sort() };
}

export async function getVegaReadOnlyHealth() {
  const pool = await getVegaSqlPool();
  const databaseResult = await pool.request().query('SELECT DB_NAME() AS databaseName');
  const projection = await buildProjection(pool);
  return {
    databaseName: databaseResult.recordset?.[0]?.databaseName || null,
    source: `${STOCK_SCHEMA}.${STOCK_TABLE}`,
    readOnly: true,
    stockCodeColumn: 'STOKKODU',
    discoveredColumnCount: projection.columns.length,
  };
}

export async function countVegaStockCodes() {
  const pool = await getVegaSqlPool();
  const projection = await buildProjection(pool);
  const result = await pool.request().query(`
    SELECT
      COUNT_BIG(*) AS rowCount,
      COUNT(DISTINCT NULLIF(LTRIM(RTRIM(${quoteIdentifier(projection.mapping.stockCode)})), '')) AS stockCodeCount
    FROM ${quoteIdentifier(STOCK_SCHEMA)}.${quoteIdentifier(STOCK_TABLE)};
  `);
  const row = result.recordset?.[0] || {};
  return {
    stockCodeCount: Number(row.stockCodeCount || 0),
    rowCount: Number(row.rowCount || 0),
    source: `${STOCK_SCHEMA}.${STOCK_TABLE}`,
    readOnly: true,
  };
}

export async function listVegaStockCodes({ search, limit } = {}) {
  const pool = await getVegaSqlPool();
  const projection = await buildProjection(pool);
  const safeLimit = Math.min(MAX_LIST_ROWS, Math.max(1, Number(limit) || 50));
  const request = pool.request();
  request.input('search', search ? `%${String(search).trim()}%` : null);
  const nameColumn = projection.mapping.productName ? quoteIdentifier(projection.mapping.productName) : null;
  const searchClause = nameColumn
    ? `(@search IS NULL OR ${quoteIdentifier(projection.mapping.stockCode)} LIKE @search OR ${nameColumn} LIKE @search)`
    : `(@search IS NULL OR ${quoteIdentifier(projection.mapping.stockCode)} LIKE @search)`;

  const result = await request.query(`
    SELECT TOP (${safeLimit})
      ${projection.select}
    FROM ${quoteIdentifier(STOCK_SCHEMA)}.${quoteIdentifier(STOCK_TABLE)}
    WHERE NULLIF(LTRIM(RTRIM(${quoteIdentifier(projection.mapping.stockCode)})), '') IS NOT NULL
      AND ${searchClause}
    ORDER BY ${quoteIdentifier(projection.mapping.stockCode)} ASC;
  `);

  return (result.recordset || []).map((row) => ({ ...row, source: `${STOCK_SCHEMA}.${STOCK_TABLE}`, readOnly: true }));
}

export async function getVegaStockByCode(stockCodeValue) {
  const stockCode = normalizeStockCode(stockCodeValue);
  if (!stockCode) {
    const error = new Error('Invalid stock code');
    error.code = 'INVALID_STOCK_CODE';
    error.statusCode = 400;
    throw error;
  }

  const pool = await getVegaSqlPool();
  const projection = await buildProjection(pool);
  const request = pool.request();
  request.input('stockCode', stockCode);
  const result = await request.query(`
    SELECT TOP (1)
      ${projection.select}
    FROM ${quoteIdentifier(STOCK_SCHEMA)}.${quoteIdentifier(STOCK_TABLE)}
    WHERE LTRIM(RTRIM(${quoteIdentifier(projection.mapping.stockCode)})) = @stockCode;
  `);
  const row = result.recordset?.[0];
  if (!row) return null;

  return {
    ...row,
    source: `${STOCK_SCHEMA}.${STOCK_TABLE}`,
    readOnly: true,
    availableFields: Object.entries(projection.mapping)
      .filter(([, column]) => Boolean(column))
      .map(([field]) => field),
  };
}
