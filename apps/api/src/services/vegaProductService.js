import sql from 'mssql';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';
import { explicitInventoryQuantity, explicitSaleCurrency } from './explicitSaleCurrency.mjs';

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeDate(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw makeServiceError('VEGA_PRODUCT_LIST_DATE_INVALID', `${fieldName} must use YYYY-MM-DD format`);
  }
  return text;
}

function normalizeCurrency(value, fallback = 'TRY') {
  const currency = String(value || '').trim().toLocaleUpperCase('tr-TR');

  if (['$', 'US$', 'USD'].includes(currency)) return 'USD';
  if (['€', 'EUR'].includes(currency)) return 'EUR';
  if (['₺', 'TL', 'TRY'].includes(currency)) return 'TRY';

  return fallback;
}

function buildSpecialCodes(row) {
  return Object.fromEntries(
    Array.from({ length: 21 }, (_, index) => {
      const number = index + 1;
      return [`KOD${number}`, String(row[`special_code_${number}`] || '').trim()];
    }).filter(([, value]) => value),
  );
}

function normalizeSourceIds(values) {
  if (!Array.isArray(values)) return [];

  return [...new Set(values
    .map(Number)
    .filter((sourceId) => Number.isInteger(sourceId) && sourceId > 0))];
}

function normalizeStockCodes(values) {
  const source = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split('|')
      : [];

  return [...new Set(source
    .map((value) => String(value || '').trim())
    .filter(Boolean))]
    .slice(0, 100);
}

export function toVegaProductDto(row) {
  // Preserve the existing internal cost fallback independently of sale truth.
  const internalCurrency = normalizeCurrency(row.sale_currency, normalizeCurrency(row.purchase_currency));
  const purchaseCurrency = normalizeCurrency(row.purchase_currency, internalCurrency);
  const purchasePriceLocal = Number(row.purchase_price_local || 0);
  const purchasePriceForeign = Number(row.purchase_price_foreign || 0);

  return {
    id: `vega-${row.source_id}`,
    source: 'vega',
    sourceId: Number(row.source_id),
    unitId: Number.isSafeInteger(Number(row.unit_id)) && Number(row.unit_id) > 0 ? Number(row.unit_id) : null,
    sourceContext: { source: 'vega', database: 'VEGA2026', company: 'F0102', period: 'D0007' },
    stockCode: row.stock_code || `VEGA-${row.source_id}`,
    barcodeMasked: row.barcode || null,
    matchedBarcode: row.barcode || null,
    productName: row.product_name || row.stock_code || `Vega stok ${row.source_id}`,
    brand: String(row.brand || '').trim(),
    category: String(row.category || '').trim(),
    specialCode4: String(row.special_code_4 || row.category || '').trim(),
    specialCodes: buildSpecialCodes(row),
    supplierId: null,
    supplierCode: '',
    supplierName: '',
    unitName: row.unit_name || '',
    ...explicitSaleCurrency(row.sale_currency),
    salePrice: Number(row.sale_price || 0),
    purchaseCurrency,
    purchasePrice: purchaseCurrency !== 'TRY' && purchasePriceForeign > 0
      ? purchasePriceForeign
      : purchasePriceLocal,
    purchasePriceLocal,
    purchasePriceForeign,
    purchaseDiscountRate: Number(row.purchase_discount_rate || 0),
    averageCostTry: 0,
    stockQuantity: explicitInventoryQuantity(row.stock_quantity),
    reservedQuantity: explicitInventoryQuantity(row.reserved_quantity),
    imageUrl: null,
    isPassive: !row.is_active,
    cardOpenedAt: row.card_opened_at || null,
    lastPurchaseDate: row.last_purchase_at || null,
    lastSaleDate: row.last_sale_at || null,
  };
}

export async function getVegaProductsList(query) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 500 });
  const barcode = typeof query?.barcode === 'string' ? query.barcode.trim() : '';
  const cardOpenedFrom = normalizeDate(query?.cardOpenedFrom, 'cardOpenedFrom');
  const cardOpenedTo = normalizeDate(query?.cardOpenedTo, 'cardOpenedTo');
  const sourceId = query?.sourceId ? Number(query.sourceId) : null;
  const includeSourceIds = normalizeSourceIds(query?.includeSourceIds);
  const excludeSourceIds = normalizeSourceIds(query?.excludeSourceIds);
  const stockCodes = normalizeStockCodes(query?.stockCodes);
  const imageStatus = ['with-image', 'without-image'].includes(query?.imageStatus)
    ? query.imageStatus
    : 'all';

  if (sourceId !== null && (!Number.isInteger(sourceId) || sourceId < 1)) {
    throw makeServiceError('VEGA_PRODUCT_ID_INVALID', 'Vega stok kimliği geçersiz');
  }

  if (cardOpenedFrom && cardOpenedTo && cardOpenedFrom > cardOpenedTo) {
    throw makeServiceError('VEGA_PRODUCT_LIST_DATE_RANGE_INVALID', 'cardOpenedFrom cannot be after cardOpenedTo');
  }

  const productSearch = [
    's.STOKKODU',
    's.MALINCINSI',
    's.KOD1',
    's.KOD4',
    'u.BARCODE',
    'u.BIRIMADI',
  ].map((column) => sqlNormalizedLike(column)).join('\n          OR ');
  const includeSourcePredicate = imageStatus === 'with-image'
    ? (includeSourceIds.length ? `s.IND IN (${includeSourceIds.join(',')})` : '1 = 0')
    : '1 = 1';
  const excludeSourcePredicate = imageStatus === 'without-image' && excludeSourceIds.length
    ? `s.IND NOT IN (${excludeSourceIds.join(',')})`
    : '1 = 1';
  const pool = await getVegaSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('barcode', sql.NVarChar(120), barcode || null)
    .input('barcodeLike', sql.NVarChar(120), barcode ? `%${barcode}%` : null)
    .input('activeOnly', sql.Bit, options.activeOnly)
    .input('cardOpenedFrom', sql.Date, cardOpenedFrom)
    .input('cardOpenedTo', sql.Date, cardOpenedTo)
    .input('sourceId', sql.BigInt, sourceId)
    .input('offset', sql.Int, options.offset);
  const stockCodeParameters = stockCodes.map((stockCode, index) => {
    request.input(`stockCode${index}`, sql.NVarChar(120), stockCode);
    return `@stockCode${index}`;
  });
  const stockCodePredicate = stockCodeParameters.length
    ? `s.STOKKODU IN (${stockCodeParameters.join(', ')})`
    : '1 = 1';
  const result = await request.query(`
      WITH period_stock AS (
        SELECT
          movement.STOKNO AS source_id,
          SUM(ISNULL(movement.GIREN, 0) - ISNULL(movement.CIKAN, 0)) AS stock_quantity,
          COUNT_BIG(1) AS movement_count
        FROM dbo.F0102D0007TBLSTOKHAREKETLERI movement
        GROUP BY movement.STOKNO
      ),
      filtered_products AS (
        SELECT
          s.IND AS source_id,
          s.STOKKODU AS stock_code,
          s.MALINCINSI AS product_name,
          s.KOD1 AS brand,
          s.KOD4 AS category,
          s.KOD1 AS special_code_1,
          s.KOD2 AS special_code_2,
          s.KOD3 AS special_code_3,
          s.KOD4 AS special_code_4,
          s.KOD5 AS special_code_5,
          s.KOD6 AS special_code_6,
          s.KOD7 AS special_code_7,
          s.KOD8 AS special_code_8,
          s.KOD9 AS special_code_9,
          s.KOD10 AS special_code_10,
          s.KOD11 AS special_code_11,
          s.KOD12 AS special_code_12,
          s.KOD13 AS special_code_13,
          s.KOD14 AS special_code_14,
          s.KOD15 AS special_code_15,
          s.KOD16 AS special_code_16,
          s.KOD17 AS special_code_17,
          s.KOD18 AS special_code_18,
          s.KOD19 AS special_code_19,
          s.KOD20 AS special_code_20,
          s.KOD21 AS special_code_21,
          CASE
            WHEN ISNULL(period_stock.movement_count, 0) > 0
              THEN ISNULL(period_stock.stock_quantity, 0)
            ELSE s.KALAN
          END AS stock_quantity,
          s.REZERV AS reserved_quantity,
          s.ALISFIYATI AS purchase_price_local,
          s.DALISFIYATI AS purchase_price_foreign,
          s.ALISISKORANI AS purchase_discount_rate,
          s.APB AS purchase_currency,
          s.KARTINACILMATARIHI AS card_opened_at,
          s.SONALISTARIHI AS last_purchase_at,
          s.SONSATISTARIHI AS last_sale_at,
          CAST(CASE WHEN ISNULL(s.STATUS, 1) = 1 THEN 1 ELSE 0 END AS bit) AS is_active,
          u.BARCODE AS barcode,
          u.IND AS unit_id,
          u.BIRIMADI AS unit_name,
          u.SATISFIYATI1 AS sale_price,
          u.PB1 AS sale_currency
        FROM dbo.F0102TBLSTOKLAR s
        LEFT JOIN period_stock
          ON period_stock.source_id = s.IND
        OUTER APPLY (
          SELECT TOP (1)
            unit_row.IND,
            unit_row.BARCODE,
            unit_row.BIRIMADI,
            unit_row.SATISFIYATI1,
            unit_row.PB1
          FROM dbo.F0102TBLBIRIMLEREX unit_row
          WHERE unit_row.STOKNO = s.IND
          ORDER BY
            CASE WHEN @barcode IS NOT NULL AND unit_row.BARCODE = @barcode THEN 0 ELSE 1 END,
            CASE WHEN ISNULL(unit_row.VARSAYILAN, 0) = 1 THEN 0 ELSE 1 END,
            CASE WHEN ISNULL(unit_row.ANABIRIM, 0) = 1 THEN 0 ELSE 1 END,
            unit_row.IND ASC
        ) u
        WHERE
          ISNULL(s.DELETED, 0) = 0
          AND ISNULL(s.IPTAL, 0) = 0
          AND ISNULL(s.STATUS, 0) = 1
          AND ${includeSourcePredicate}
          AND ${excludeSourcePredicate}
          AND ${stockCodePredicate}
          AND (@sourceId IS NULL OR s.IND = @sourceId)
          AND (@cardOpenedFrom IS NULL OR s.KARTINACILMATARIHI >= @cardOpenedFrom)
          AND (@cardOpenedTo IS NULL OR s.KARTINACILMATARIHI < DATEADD(day, 1, @cardOpenedTo))
          AND (@barcodeLike IS NULL OR u.BARCODE COLLATE Latin1_General_CI_AI LIKE @barcodeLike COLLATE Latin1_General_CI_AI)
          AND (@search IS NULL OR ${productSearch})
      ),
      numbered_products AS (
        SELECT
          fp.*,
          ROW_NUMBER() OVER (
            ORDER BY
              CASE WHEN @barcode IS NOT NULL AND fp.barcode = @barcode THEN 0 ELSE 1 END,
              CASE WHEN fp.card_opened_at IS NULL THEN 1 ELSE 0 END,
              fp.card_opened_at DESC,
              fp.source_id DESC
          ) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM filtered_products fp
      )
      SELECT TOP (${options.limit}) *
      FROM numbered_products
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toVegaProductDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'vega-live-read-only',
      filters: {
        companyCode: env.vega.companyCode,
        periodCode: env.vega.periodCode,
        year: env.vega.year,
        search: options.search || null,
        barcode: barcode || null,
        activeOnly: options.activeOnly,
        imageStatus,
        stockCodes: stockCodes.length || null,
      },
    }),
  };
}
