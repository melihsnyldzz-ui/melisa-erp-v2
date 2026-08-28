import sql from 'mssql';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';

function serviceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeId(value, fieldName) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw serviceError('VEGA_SUPPLIER_SOURCE_ID_INVALID', `${fieldName} must be a positive integer`);
  return id;
}

function normalizeDate(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw serviceError('VEGA_SUPPLIER_LEDGER_DATE_INVALID', `${fieldName} must use YYYY-MM-DD format`);
  return text;
}

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toLocaleUpperCase('tr-TR');
  if (['$', 'US$', 'USD'].includes(currency)) return 'USD';
  if (['€', 'EUR'].includes(currency)) return 'EUR';
  if (['₺', 'TL', 'TRY'].includes(currency)) return 'TRY';
  return currency || 'TRY';
}

function normalizeOptionalAmount(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : value;
  if (text === '' || text === null || text === undefined) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) throw serviceError('VEGA_PURCHASE_AMOUNT_INVALID', `${fieldName} must be a non-negative number`);
  return amount;
}

function normalizePurchaseCurrency(value) {
  const currency = normalizeCurrency(value);
  return ['TRY', 'USD', 'EUR'].includes(currency) ? currency : null;
}

function movementInfo(code) {
  const value = String(code || '').trim();
  const definitions = {
    11: { movementType: 'supplier_payment', movementLabel: 'Cari Çıkış' },
    13: { movementType: 'supplier_entry', movementLabel: 'Cari Giriş' },
    20: { movementType: 'purchase_invoice', movementLabel: 'Alış Faturası' },
    103: { movementType: 'stock_entry', movementLabel: 'Stok Giriş' },
    104: { movementType: 'opening_transfer', movementLabel: 'Devir' },
  };
  return definitions[value] || { movementType: 'other', movementLabel: value ? `İşlem ${value}` : 'Diğer' };
}

function toMovementDto(row) {
  return {
    id: `vega-supplier-ledger-${row.source_id}`,
    source: 'vega',
    sourceId: Number(row.source_id),
    supplierSourceId: Number(row.supplier_source_id),
    supplierCode: String(row.supplier_code || '').trim(),
    supplierName: String(row.supplier_name || '').trim(),
    documentDate: row.document_date || null,
    documentNo: String(row.document_no || '').trim(),
    movementCode: String(row.movement_code || '').trim(),
    ...movementInfo(row.movement_code),
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    balanceEffect: Number(row.balance_effect || 0),
    runningBalance: Number(row.running_balance || 0),
    currency: normalizeCurrency(row.currency_code),
    exchangeRate: Number(row.exchange_rate || 0),
  };
}

function toPurchaseLineDto(row) {
  return {
    id: `vega-purchase-line-${row.source_id}`,
    sourceId: Number(row.source_id),
    lineNumber: Number(row.line_number || 0),
    stockSourceId: Number(row.stock_source_id || 0),
    stockCode: String(row.stock_code || '').trim(),
    productName: String(row.product_name || '').trim(),
    barcode: String(row.barcode || '').trim() || null,
    quantity: Number(row.quantity || 0),
    unitName: String(row.unit_name || '').trim() || 'ADET',
    unitPrice: Number(row.unit_price || 0),
    lineTotal: Number(row.line_total || 0),
    currency: normalizeCurrency(row.currency_code),
  };
}

function toPurchaseListDto(row) {
  return {
    id: `vega-purchase-${row.source_id}`,
    source: 'vega-live-read-only',
    sourceId: Number(row.source_id),
    supplierSourceId: Number(row.supplier_source_id),
    supplierCode: String(row.supplier_code || '').trim(),
    supplierName: String(row.supplier_name || '').trim(),
    documentNo: String(row.document_no || '').trim(),
    invoiceNo: String(row.document_no || '').trim(),
    documentDate: row.document_date || null,
    documentCurrency: normalizeCurrency(row.currency_code),
    currency: normalizeCurrency(row.currency_code),
    exchangeRate: Number(row.exchange_rate || 0),
    totalAmount: Number(row.total_amount || 0),
    originalTotal: Number(row.total_amount || 0),
    itemCount: Number(row.item_count || 0),
    totalQuantity: Number(row.total_quantity || 0),
    status: 'FINALIZED',
  };
}

export async function getVegaPurchaseInvoiceList(query = {}) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 500 });
  const dateFrom = normalizeDate(query.dateFrom, 'dateFrom');
  const dateTo = normalizeDate(query.dateTo, 'dateTo');
  const currency = query.currency && String(query.currency).toUpperCase() !== 'ALL'
    ? normalizePurchaseCurrency(query.currency)
    : null;
  const amountMin = normalizeOptionalAmount(query.amountMin, 'amountMin');
  const amountMax = normalizeOptionalAmount(query.amountMax, 'amountMax');
  const supplierCode = typeof query.supplierCode === 'string' ? query.supplierCode.trim() : '';

  if (dateFrom && dateTo && dateFrom > dateTo) throw serviceError('VEGA_PURCHASE_DATE_RANGE_INVALID', 'dateFrom cannot be after dateTo');
  if (query.currency && String(query.currency).toUpperCase() !== 'ALL' && !currency) {
    throw serviceError('VEGA_PURCHASE_CURRENCY_INVALID', 'currency must be TRY, USD or EUR');
  }
  if (amountMin !== null && amountMax !== null && amountMin > amountMax) {
    throw serviceError('VEGA_PURCHASE_AMOUNT_RANGE_INVALID', 'amountMin cannot be greater than amountMax');
  }

  const searchFilter = options.search ? `
          AND (
            ${sqlNormalizedLike('h.EVRAKNO')}
            OR ${sqlNormalizedLike('c.FIRMAKODU')}
            OR ${sqlNormalizedLike('c.FIRMAADI')}
          )` : '';

  const pool = await getVegaSqlPool();
  const result = await pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .input('currency', sql.NVarChar(8), currency)
    .input('amountMin', sql.Decimal(19, 4), amountMin)
    .input('amountMax', sql.Decimal(19, 4), amountMax)
    .input('supplierCode', sql.NVarChar(80), supplierCode || null)
    .input('offset', sql.Int, options.offset)
    .query(`
      SELECT
        h.IND AS source_id,
        c.IND AS supplier_source_id,
        c.FIRMAKODU AS supplier_code,
        c.FIRMAADI AS supplier_name,
        h.TARIH AS document_date,
        h.EVRAKNO AS document_no,
        h.PARABIRIMI AS currency_code,
        ISNULL(h.KUR, 0) AS exchange_rate,
        ISNULL(h.ALACAK, 0) / NULLIF(h.KUR, 0) AS total_amount,
        CAST(0 AS bigint) AS item_count,
        CAST(0 AS decimal(19, 4)) AS total_quantity,
        COUNT_BIG(1) OVER () AS total_count
      FROM dbo.F0103D0007TBLCARIHAREKETLERI h
      INNER JOIN dbo.F0103TBLCARI c ON c.IND = h.FIRMANO
      WHERE
        ISNULL(c.DELETED, 0) = 0
        AND ISNULL(c.STATUS, 0) = 1
        AND LTRIM(RTRIM(ISNULL(c.PARABIRIMI, N''))) <> N'LL'
        AND LTRIM(RTRIM(ISNULL(h.IZAHAT, N''))) = N'20'
        AND ISNULL(h.KUR, 0) > 0
        AND ISNULL(h.ALACAK, 0) > 0
        AND (@dateFrom IS NULL OR h.TARIH >= @dateFrom)
        AND (@dateTo IS NULL OR h.TARIH < DATEADD(day, 1, @dateTo))
        AND (@supplierCode IS NULL OR LTRIM(RTRIM(c.FIRMAKODU)) = @supplierCode)
        AND (
          @currency IS NULL
          OR (@currency = N'USD' AND h.PARABIRIMI IN (N'$', N'USD'))
          OR (@currency = N'EUR' AND h.PARABIRIMI IN (N'€', N'EUR'))
          OR (@currency = N'TRY' AND h.PARABIRIMI IN (N'TL', N'TRY', N'₺'))
        )
        AND (@amountMin IS NULL OR ISNULL(h.ALACAK, 0) / NULLIF(h.KUR, 0) >= @amountMin)
        AND (@amountMax IS NULL OR ISNULL(h.ALACAK, 0) / NULLIF(h.KUR, 0) <= @amountMax)
        ${searchFilter}
      ORDER BY h.TARIH DESC, h.IND DESC
      OFFSET @offset ROWS FETCH NEXT ${options.limit} ROWS ONLY
      OPTION (RECOMPILE);
    `);

  const rows = result.recordset || [];
  const total = rows.length ? Number(rows[0].total_count || 0) : 0;
  return {
    data: rows.map(toPurchaseListDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'vega-live-read-only',
      filters: {
        companyCode: 'F0103',
        periodCode: env.vega.periodCode,
        year: env.vega.year,
        dateFrom,
        dateTo,
        currency,
        amountMin,
        amountMax,
        supplierCode: supplierCode || null,
        search: options.search || null,
        movementCode: 20,
      },
    }),
  };
}

export async function getVegaSupplierLedgerList(supplierSourceIdValue, query = {}) {
  const supplierSourceId = normalizeId(supplierSourceIdValue, 'supplierSourceId');
  const options = parseListQuery(query, { defaultLimit: 150, maxLimit: 500 });
  const dateFrom = normalizeDate(query.dateFrom, 'dateFrom');
  const dateTo = normalizeDate(query.dateTo, 'dateTo');
  if (dateFrom && dateTo && dateFrom > dateTo) throw serviceError('VEGA_SUPPLIER_LEDGER_DATE_RANGE_INVALID', 'dateFrom cannot be after dateTo');

  const pool = await getVegaSqlPool();
  const result = await pool.request()
    .input('supplierSourceId', sql.Int, supplierSourceId)
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH target_supplier AS (
        SELECT TOP (1)
          c.IND AS supplier_source_id,
          c.FIRMAKODU AS supplier_code,
          c.FIRMAADI AS supplier_name,
          c.PARABIRIMI AS currency_code
        FROM dbo.F0103TBLCARI c
        WHERE ISNULL(c.DELETED, 0) = 0 AND ISNULL(c.STATUS, 0) = 1
          AND LTRIM(RTRIM(ISNULL(c.PARABIRIMI, N''))) <> N'LL'
          AND c.IND = @supplierSourceId
      ),
      ledger_base AS (
        SELECT
          h.IND AS source_id,
          s.supplier_source_id,
          s.supplier_code,
          s.supplier_name,
          h.TARIH AS document_date,
          h.IZAHAT AS movement_code,
          h.EVRAKNO AS document_no,
          h.PARABIRIMI AS currency_code,
          ISNULL(h.KUR, 0) AS exchange_rate,
          ISNULL(h.BORC, 0) / NULLIF(h.KUR, 0) AS debit,
          ISNULL(h.ALACAK, 0) / NULLIF(h.KUR, 0) AS credit,
          (ISNULL(h.BORC, 0) - ISNULL(h.ALACAK, 0)) / NULLIF(h.KUR, 0) AS balance_effect
        FROM dbo.F0103D0007TBLCARIHAREKETLERI h
        INNER JOIN target_supplier s ON s.supplier_source_id = h.FIRMANO
        WHERE ISNULL(h.IZAHAT, N'') NOT IN (N'30', N'31')
          AND (
            (s.currency_code IN (N'$', N'USD') AND h.PARABIRIMI IN (N'$', N'USD'))
            OR (s.currency_code IN (N'€', N'EUR') AND h.PARABIRIMI IN (N'€', N'EUR'))
            OR (s.currency_code IN (N'TL', N'TRY', N'₺') AND h.PARABIRIMI IN (N'TL', N'TRY', N'₺'))
          )
      ),
      ledger_with_balance AS (
        SELECT b.*, SUM(b.balance_effect) OVER (
          ORDER BY b.document_date ASC, b.source_id ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_balance
        FROM ledger_base b
      ),
      filtered_ledger AS (
        SELECT * FROM ledger_with_balance l
        WHERE (@dateFrom IS NULL OR l.document_date >= @dateFrom)
          AND (@dateTo IS NULL OR l.document_date < DATEADD(day, 1, @dateTo))
          AND (@search IS NULL OR ${sqlNormalizedLike('l.document_no')} OR ${sqlNormalizedLike('l.supplier_code')} OR ${sqlNormalizedLike('l.supplier_name')})
      ),
      numbered_ledger AS (
        SELECT l.*, ROW_NUMBER() OVER (ORDER BY l.document_date ASC, l.source_id ASC) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM filtered_ledger l
      )
      SELECT TOP (${options.limit}) * FROM numbered_ledger
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length ? Number(rows[0].total_count || 0) : 0;
  return {
    data: rows.map(toMovementDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'vega-live-read-only',
      filters: { companyCode: 'F0103', periodCode: env.vega.periodCode, year: env.vega.year, supplierSourceId, dateFrom, dateTo, search: options.search || null },
    }),
  };
}

export async function getVegaSupplierPurchaseDocument(supplierSourceIdValue, movementSourceIdValue) {
  const supplierSourceId = normalizeId(supplierSourceIdValue, 'supplierSourceId');
  const movementSourceId = normalizeId(movementSourceIdValue, 'movementSourceId');
  const pool = await getVegaSqlPool();
  const result = await pool.request()
    .input('supplierSourceId', sql.Int, supplierSourceId)
    .input('movementSourceId', sql.Int, movementSourceId)
    .query(`
      WITH target_movement AS (
        SELECT TOP (1) h.IND, h.FIRMANO, h.EVRAKNO, h.TARIH
        FROM dbo.F0103D0007TBLCARIHAREKETLERI h
        INNER JOIN dbo.F0103TBLCARI c ON c.IND = h.FIRMANO
        WHERE h.IND = @movementSourceId AND h.FIRMANO = @supplierSourceId
          AND LTRIM(RTRIM(h.IZAHAT)) = N'20'
          AND ISNULL(c.DELETED, 0) = 0 AND ISNULL(c.STATUS, 0) = 1
      ),
      target_header AS (
        SELECT TOP (1)
          b.IND AS header_source_id,
          b.BELGENO AS document_no,
          b.TARIH AS document_date,
          b.PARABIRIMI AS currency_code,
          ISNULL(b.KUR, 0) AS exchange_rate,
          ISNULL(b.TUTAR, 0) / NULLIF(b.KUR, 0) AS document_amount
        FROM dbo.F0103D0007TBLALFATBASLIK b
        INNER JOIN target_movement m ON m.FIRMANO = b.FIRMANO
          AND LTRIM(RTRIM(m.EVRAKNO)) = LTRIM(RTRIM(b.BELGENO))
          AND b.TARIH >= CONVERT(date, m.TARIH)
          AND b.TARIH < DATEADD(day, 1, CONVERT(date, m.TARIH))
        WHERE ISNULL(b.IPTAL, 0) = 0
        ORDER BY b.IND DESC
      )
      SELECT
        h.header_source_id,
        h.document_no,
        h.document_date,
        h.document_amount,
        h.currency_code,
        h.exchange_rate,
        l.IND AS source_id,
        l.SATIRNO AS line_number,
        l.STOKNO AS stock_source_id,
        COALESCE(NULLIF(LTRIM(RTRIM(l.STOKKODU)), N''), NULLIF(LTRIM(RTRIM(l.MALINCINSI)), N'')) AS stock_code,
        COALESCE(NULLIF(LTRIM(RTRIM(l.MALINCINSI)), N''), NULLIF(LTRIM(RTRIM(l.STOKKODU)), N'')) AS product_name,
        l.BARKOD AS barcode,
        ISNULL(l.MIKTAR, 0) AS quantity,
        l.BIRIM AS unit_name,
        ISNULL(l.AFIYATI, 0) / NULLIF(h.exchange_rate, 0) AS unit_price,
        ISNULL(l.GERCEKTOPLAM, 0) / NULLIF(h.exchange_rate, 0) AS line_total
      FROM target_header h
      INNER JOIN dbo.F0103D0007TBLALFATHAREKET l ON l.EVRAKNO = h.header_source_id
      ORDER BY ISNULL(l.SATIRNO, 0) ASC, l.IND ASC;
    `);

  const rows = result.recordset || [];
  if (!rows.length) throw serviceError('VEGA_SUPPLIER_PURCHASE_NOT_FOUND', 'Vega supplier purchase document was not found', 404);
  const lines = rows.map(toPurchaseLineDto);
  const first = rows[0];
  const lineSubtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const totalAmount = Number(first.document_amount || 0);
  return {
    source: 'vega-live-read-only',
    supplierSourceId,
    movementSourceId,
    headerSourceId: Number(first.header_source_id),
    documentNo: String(first.document_no || '').trim(),
    documentDate: first.document_date || null,
    currency: normalizeCurrency(first.currency_code),
    exchangeRate: Number(first.exchange_rate || 0),
    lineCount: lines.length,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalAmount,
    lineSubtotal,
    adjustmentAmount: totalAmount - lineSubtotal,
    lines,
  };
}
