import sql from 'mssql/tedious.js';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';
import { getVegaProductImageMap } from './vegaProductImageService.js';
import { sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';

const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_WINDOW_DAYS = 366;

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function normalizeDate(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw makeServiceError('VEGA_PRODUCT_INTELLIGENCE_DATE_INVALID', `${fieldName} must use YYYY-MM-DD format`);
  }
  return text;
}

function subtractUtcDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

export function normalizeProductIntelligenceQuery(query = {}, now = new Date()) {
  const requestedDateTo = normalizeDate(query.dateTo, 'dateTo');
  const dateTo = requestedDateTo || toIsoDate(now);
  const requestedDateFrom = normalizeDate(query.dateFrom, 'dateFrom');
  const dateFrom = requestedDateFrom || toIsoDate(subtractUtcDays(new Date(`${dateTo}T00:00:00Z`), DEFAULT_WINDOW_DAYS - 1));
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  const windowDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  if (dateFrom > dateTo) {
    throw makeServiceError('VEGA_PRODUCT_INTELLIGENCE_DATE_RANGE_INVALID', 'dateFrom cannot be after dateTo');
  }
  if (windowDays > MAX_WINDOW_DAYS) {
    throw makeServiceError('VEGA_PRODUCT_INTELLIGENCE_WINDOW_TOO_LARGE', `date range cannot exceed ${MAX_WINDOW_DAYS} days`);
  }

  const requestedLimit = Number(query.limit || DEFAULT_LIMIT);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw makeServiceError('VEGA_PRODUCT_INTELLIGENCE_LIMIT_INVALID', 'limit must be a positive integer');
  }

  return {
    dateFrom,
    dateTo,
    windowDays,
    limit: Math.min(requestedLimit, MAX_LIMIT),
    search: typeof query.search === 'string' ? query.search.trim().slice(0, 120) : '',
    category: typeof query.category === 'string' ? query.category.trim().slice(0, 80) : '',
    withImagesOnly: ['1', 'true', 'yes'].includes(String(query.withImagesOnly || '').toLowerCase()),
  };
}

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toLocaleUpperCase('tr-TR');
  if (['$', 'US$', 'USD'].includes(currency)) return 'USD';
  if (['€', 'EUR'].includes(currency)) return 'EUR';
  if (['₺', 'TL', 'TRY'].includes(currency)) return 'TRY';
  return currency || 'TRY';
}

export function toProductIntelligenceDto(row, imageUrl = null) {
  const stockQuantity = Number(row.stock_quantity || 0);
  const reservedQuantity = Number(row.reserved_quantity || 0);
  return {
    sourceId: Number(row.source_id),
    stockCode: String(row.stock_code || '').trim(),
    productName: String(row.product_name || '').trim(),
    brand: String(row.brand || '').trim() || null,
    category: String(row.category || '').trim() || null,
    unitName: String(row.unit_name || '').trim() || null,
    grossOutboundQuantity: Number(row.gross_outbound_quantity || 0),
    salesDocumentCount: Number(row.sales_document_count || 0),
    lastSoldAt: row.last_sold_at || null,
    stockQuantity,
    reservedQuantity,
    availableQuantity: Math.max(0, stockQuantity - reservedQuantity),
    salePrice: Number(row.sale_price || 0),
    currency: normalizeCurrency(row.sale_currency),
    imageAvailable: Boolean(imageUrl),
    imageUrl,
  };
}

export function summarizeCategories(products) {
  const categories = new Map();
  for (const product of products) {
    const category = product.category || 'UNCATEGORIZED';
    const current = categories.get(category) || {
      category,
      productCount: 0,
      grossOutboundQuantity: 0,
      productsWithImages: 0,
    };
    current.productCount += 1;
    current.grossOutboundQuantity += product.grossOutboundQuantity;
    current.productsWithImages += product.imageAvailable ? 1 : 0;
    categories.set(category, current);
  }
  return [...categories.values()].sort((a, b) => b.grossOutboundQuantity - a.grossOutboundQuantity);
}

export async function getVegaProductIntelligence(query = {}) {
  const options = normalizeProductIntelligenceQuery(query);
  const pool = await getVegaSqlPool();
  const result = await new sql.Request(pool)
    .input('dateFrom', sql.Date, options.dateFrom)
    .input('dateTo', sql.Date, options.dateTo)
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('category', sql.NVarChar(80), options.category || null)
    .query(`
      WITH period_stock AS (
        SELECT
          movement.STOKNO AS source_id,
          SUM(ISNULL(movement.GIREN, 0) - ISNULL(movement.CIKAN, 0)) AS stock_quantity
        FROM dbo.F0102D0007TBLSTOKHAREKETLERI movement
        GROUP BY movement.STOKNO
      ),
      sales_by_product AS (
        SELECT
          movement.STOKNO AS source_id,
          SUM(ISNULL(movement.CIKAN, 0)) AS gross_outbound_quantity,
          COUNT(DISTINCT CONCAT(
            CONVERT(nvarchar(30), movement.FIRMANO), N'|',
            LTRIM(RTRIM(ISNULL(movement.EVRAKNO, N''))), N'|',
            CONVERT(nvarchar(10), CONVERT(date, movement.TARIH), 23)
          )) AS sales_document_count,
          MAX(movement.TARIH) AS last_sold_at
        FROM dbo.F0102D0007TBLSTOKHAREKETLERI movement
        WHERE
          LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33'
          AND ISNULL(movement.CIKAN, 0) > 0
          AND movement.TARIH >= @dateFrom
          AND movement.TARIH < DATEADD(day, 1, @dateTo)
        GROUP BY movement.STOKNO
      )
      SELECT TOP (${options.limit})
        product.IND AS source_id,
        product.STOKKODU AS stock_code,
        product.MALINCINSI AS product_name,
        product.KOD1 AS brand,
        product.KOD4 AS category,
        unit.BIRIMADI AS unit_name,
        unit.SATISFIYATI1 AS sale_price,
        unit.PB1 AS sale_currency,
        ISNULL(period_stock.stock_quantity, ISNULL(product.KALAN, 0)) AS stock_quantity,
        ISNULL(product.REZERV, 0) AS reserved_quantity,
        sales.gross_outbound_quantity,
        sales.sales_document_count,
        sales.last_sold_at
      FROM sales_by_product sales
      INNER JOIN dbo.F0102TBLSTOKLAR product ON product.IND = sales.source_id
      LEFT JOIN period_stock ON period_stock.source_id = product.IND
      OUTER APPLY (
        SELECT TOP (1)
          unit_row.BIRIMADI,
          unit_row.SATISFIYATI1,
          unit_row.PB1
        FROM dbo.F0102TBLBIRIMLEREX unit_row
        WHERE unit_row.STOKNO = product.IND
        ORDER BY
          CASE WHEN ISNULL(unit_row.VARSAYILAN, 0) = 1 THEN 0 ELSE 1 END,
          CASE WHEN ISNULL(unit_row.ANABIRIM, 0) = 1 THEN 0 ELSE 1 END,
          unit_row.IND ASC
      ) unit
      WHERE
        ISNULL(product.DELETED, 0) = 0
        AND ISNULL(product.IPTAL, 0) = 0
        AND ISNULL(product.STATUS, 0) = 1
        AND (@category IS NULL OR LTRIM(RTRIM(product.KOD4)) = @category)
        AND (
          @search IS NULL
          OR ${sqlNormalizedLike('product.STOKKODU')}
          OR ${sqlNormalizedLike('product.MALINCINSI')}
          OR ${sqlNormalizedLike('product.KOD1')}
          OR ${sqlNormalizedLike('product.KOD4')}
        )
      ORDER BY sales.gross_outbound_quantity DESC, sales.sales_document_count DESC, sales.last_sold_at DESC;
    `);

  const rows = result.recordset || [];
  const imageMap = await getVegaProductImageMap(rows.map((row) => Number(row.source_id)));
  let products = rows.map((row) => toProductIntelligenceDto(row, imageMap.get(Number(row.source_id)) || null));
  if (options.withImagesOnly) products = products.filter((product) => product.imageAvailable);

  return {
    data: {
      rankingBasis: 'GROSS_OUTBOUND_QUANTITY',
      products,
      categories: summarizeCategories(products),
      limitations: [
        'Gross stock exits are not a net-sales or profitability calculation.',
        'Product images include only approved primary images registered in Melisa ERP.',
      ],
    },
    meta: {
      source: 'vega-live-read-only',
      retrievedAt: new Date().toISOString(),
      companyCode: env.vega.companyCode,
      periodCode: env.vega.periodCode,
      year: env.vega.year,
      filters: options,
      writePerformed: false,
    },
  };
}
