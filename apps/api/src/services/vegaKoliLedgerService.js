import sql from 'mssql/tedious.js';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';

function normalizeDate(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const error = new Error(`${fieldName} must use YYYY-MM-DD format`);
    error.code = 'VEGA_CUSTOMER_LEDGER_DATE_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toLocaleUpperCase('tr-TR');
  if (['$', 'US$', 'USD'].includes(currency)) return 'USD';
  if (['€', 'EUR'].includes(currency)) return 'EUR';
  if (['₺', 'TL', 'TRY'].includes(currency)) return 'TRY';
  return currency || 'TRY';
}

function movementInfo(code) {
  const movementCode = String(code || '').trim();
  const definitions = {
    11: { movementType: 'customer_exit', movementLabel: 'CarÇık' },
    13: { movementType: 'customer_entry', movementLabel: 'CariGir' },
    33: { movementType: 'stock_exit', movementLabel: 'StkÇık' },
    104: { movementType: 'opening_transfer', movementLabel: 'Devir' },
  };
  return definitions[movementCode] || {
    movementType: 'other',
    movementLabel: movementCode ? `İşlem ${movementCode}` : 'Diğer',
  };
}

function toDto(row) {
  const movement = movementInfo(row.movement_code);
  return {
    id: `vega-customer-ledger-${row.source_id}`,
    source: 'vega',
    sourceId: Number(row.source_id),
    customerSourceId: Number(row.customer_source_id),
    customerCode: String(row.customer_code || '').trim(),
    customerName: String(row.customer_name || '').trim(),
    legalTitle: String(row.legal_title || '').trim(),
    documentDate: row.document_date || null,
    documentNo: String(row.document_no || '').trim(),
    movementCode: String(row.movement_code || '').trim(),
    ...movement,
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    balanceEffect: Number(row.balance_effect || 0),
    runningBalance: Number(row.running_balance || 0),
    currency: normalizeCurrency(row.currency_code),
    exchangeRate: Number(row.exchange_rate || 0),
  };
}

function normalizeMovementSourceId(value) {
  const sourceId = Number(value);
  if (!Number.isSafeInteger(sourceId) || sourceId <= 0) {
    const error = new Error('movementSourceId must be a positive integer');
    error.code = 'VEGA_CUSTOMER_STOCK_EXIT_SOURCE_ID_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return sourceId;
}

function normalizeCustomerSourceId(value) {
  const sourceId = Number(value);
  if (!Number.isSafeInteger(sourceId) || sourceId <= 0) {
    const error = new Error('customerSourceId must be a positive integer');
    error.code = 'VEGA_CUSTOMER_LEDGER_SOURCE_ID_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return sourceId;
}

function toStockExitLineDto(row) {
  return {
    id: `vega-customer-stock-exit-line-${row.source_id}`,
    sourceId: Number(row.source_id),
    lineNumber: Number(row.line_number || 0),
    stockSourceId: Number(row.stock_source_id),
    stockCode: String(row.stock_code || '').trim(),
    productName: String(row.product_name || '').trim(),
    brand: String(row.brand || '').trim(),
    category: String(row.special_code_4 || '').trim(),
    specialCode4: String(row.special_code_4 || '').trim(),
    barcode: String(row.barcode || '').trim() || null,
    unitName: String(row.unit_name || '').trim(),
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unit_price || 0),
    lineTotal: Number(row.line_total || 0),
    currency: normalizeCurrency(row.currency_code),
    exchangeRate: Number(row.exchange_rate || 0),
  };
}

function normalizeOptionalAmount(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : value;
  if (text === '' || text === null || text === undefined) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    const error = new Error(`${fieldName} must be a non-negative number`);
    error.code = 'VEGA_SALES_STOCK_EXIT_AMOUNT_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return amount;
}

function normalizeSalesCurrency(value) {
  const currency = normalizeCurrency(value);
  return ['TRY', 'USD', 'EUR'].includes(currency) ? currency : null;
}

function toSalesStockExitDto(row) {
  return {
    id: `vega-sales-stock-exit-${row.source_id}`,
    source: 'vega-live-read-only',
    sourceId: Number(row.source_id),
    customerSourceId: Number(row.customer_source_id),
    customerCode: String(row.customer_code || '').trim(),
    customerName: String(row.customer_name || '').trim(),
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

export async function getVegaSalesStockExitList(query = {}) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 500 });
  const dateFrom = normalizeDate(query.dateFrom, 'dateFrom');
  const dateTo = normalizeDate(query.dateTo, 'dateTo');
  const currency = query.currency && String(query.currency).toUpperCase() !== 'ALL'
    ? normalizeSalesCurrency(query.currency)
    : null;
  const amountMin = normalizeOptionalAmount(query.amountMin, 'amountMin');
  const amountMax = normalizeOptionalAmount(query.amountMax, 'amountMax');
  const customerCode = typeof query.customerCode === 'string' ? query.customerCode.trim() : '';

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error('dateFrom cannot be after dateTo');
    error.code = 'VEGA_SALES_STOCK_EXIT_DATE_RANGE_INVALID';
    error.statusCode = 400;
    throw error;
  }
  if (query.currency && String(query.currency).toUpperCase() !== 'ALL' && !currency) {
    const error = new Error('currency must be TRY, USD or EUR');
    error.code = 'VEGA_SALES_STOCK_EXIT_CURRENCY_INVALID';
    error.statusCode = 400;
    throw error;
  }
  if (amountMin !== null && amountMax !== null && amountMin > amountMax) {
    const error = new Error('amountMin cannot be greater than amountMax');
    error.code = 'VEGA_SALES_STOCK_EXIT_AMOUNT_RANGE_INVALID';
    error.statusCode = 400;
    throw error;
  }

  const pool = await getVegaSqlPool();
  const result = await new sql.Request(pool)
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .input('currency', sql.NVarChar(8), currency)
    .input('amountMin', sql.Decimal(19, 4), amountMin)
    .input('amountMax', sql.Decimal(19, 4), amountMax)
    .input('customerCode', sql.NVarChar(80), customerCode || null)
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH sales_base AS (
        SELECT
          h.IND AS source_id,
          c.IND AS customer_source_id,
          c.FIRMAKODU AS customer_code,
          c.FIRMAADI AS customer_name,
          h.TARIH AS document_date,
          h.EVRAKNO AS document_no,
          h.PARABIRIMI AS currency_code,
          ISNULL(h.KUR, 0) AS exchange_rate,
          ISNULL(h.BORC, 0) / NULLIF(h.KUR, 0) AS total_amount
        FROM dbo.F0102D0007TBLCARIHAREKETLERI h
        INNER JOIN dbo.F0102TBLCARI c ON c.IND = h.FIRMANO
        WHERE
          ISNULL(c.DELETED, 0) = 0
          AND ISNULL(c.STATUS, 0) = 1
          AND LTRIM(RTRIM(ISNULL(c.PARABIRIMI, N''))) <> N'LL'
          AND h.IZAHAT = N'33'
          AND ISNULL(h.KUR, 0) > 0
          AND ISNULL(h.BORC, 0) > 0
          AND (
            (c.PARABIRIMI IN (N'$', N'USD') AND h.PARABIRIMI IN (N'$', N'USD'))
            OR (c.PARABIRIMI IN (N'€', N'EUR') AND h.PARABIRIMI IN (N'€', N'EUR'))
            OR (c.PARABIRIMI IN (N'TL', N'TRY', N'₺') AND h.PARABIRIMI IN (N'TL', N'TRY', N'₺'))
          )
          AND (@dateFrom IS NULL OR h.TARIH >= @dateFrom)
          AND (@dateTo IS NULL OR h.TARIH < DATEADD(day, 1, @dateTo))
          AND (@customerCode IS NULL OR LTRIM(RTRIM(c.FIRMAKODU)) = @customerCode)
          AND (
            @currency IS NULL
            OR (@currency = N'USD' AND h.PARABIRIMI IN (N'$', N'USD'))
            OR (@currency = N'EUR' AND h.PARABIRIMI IN (N'€', N'EUR'))
            OR (@currency = N'TRY' AND h.PARABIRIMI IN (N'TL', N'TRY', N'₺'))
          )
          AND (@amountMin IS NULL OR ISNULL(h.BORC, 0) / NULLIF(h.KUR, 0) >= @amountMin)
          AND (@amountMax IS NULL OR ISNULL(h.BORC, 0) / NULLIF(h.KUR, 0) <= @amountMax)
          AND (
            @search IS NULL
            OR ${sqlNormalizedLike('h.EVRAKNO')}
            OR ${sqlNormalizedLike('c.FIRMAKODU')}
            OR ${sqlNormalizedLike('c.FIRMAADI')}
            OR EXISTS (
              SELECT 1
              FROM dbo.F0102D0007TBLSTOKHAREKETLERI search_line
              INNER JOIN dbo.F0102TBLSTOKLAR search_stock ON search_stock.IND = search_line.STOKNO
              LEFT JOIN dbo.F0102TBLBIRIMLEREX search_unit ON search_unit.STOKNO = search_line.STOKNO
              WHERE
                search_line.FIRMANO = h.FIRMANO
                AND LTRIM(RTRIM(search_line.EVRAKNO)) = LTRIM(RTRIM(h.EVRAKNO))
                AND search_line.TARIH >= CONVERT(date, h.TARIH)
                AND search_line.TARIH < DATEADD(day, 1, CONVERT(date, h.TARIH))
                AND LTRIM(RTRIM(ISNULL(search_line.IZAHAT, N''))) = N'33'
                AND (
                  ${sqlNormalizedLike('search_stock.STOKKODU')}
                  OR ${sqlNormalizedLike('search_stock.MALINCINSI')}
                  OR ${sqlNormalizedLike('search_unit.BARCODE')}
                )
            )
          )
      ),
      numbered_sales AS (
        SELECT
          b.*,
          ROW_NUMBER() OVER (ORDER BY b.document_date DESC, b.source_id DESC) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM sales_base b
      ),
      paged_sales AS (
        SELECT TOP (${options.limit}) *
        FROM numbered_sales
        WHERE row_number > @offset
        ORDER BY row_number ASC
      ),
      line_summaries AS (
        SELECT
          sh.FIRMANO AS customer_source_id,
          sh.EVRAKNO AS document_no,
          CONVERT(date, sh.TARIH) AS document_date,
          COUNT_BIG(1) AS item_count,
          SUM(CASE WHEN ISNULL(sh.CIKAN, 0) > 0 THEN sh.CIKAN ELSE ISNULL(sh.GIREN, 0) END) AS total_quantity
        FROM dbo.F0102D0007TBLSTOKHAREKETLERI sh
        WHERE
          sh.IZAHAT = N'33'
          AND (@dateFrom IS NULL OR sh.TARIH >= @dateFrom)
          AND (@dateTo IS NULL OR sh.TARIH < DATEADD(day, 1, @dateTo))
        GROUP BY sh.FIRMANO, sh.EVRAKNO, CONVERT(date, sh.TARIH)
      )
      SELECT
        p.*,
        ISNULL(ls.item_count, 0) AS item_count,
        ISNULL(ls.total_quantity, 0) AS total_quantity
      FROM paged_sales p
      LEFT JOIN line_summaries ls
        ON ls.customer_source_id = p.customer_source_id
        AND ls.document_no = p.document_no
        AND ls.document_date = CONVERT(date, p.document_date)
      ORDER BY p.row_number ASC
      OPTION (RECOMPILE);
    `);

  const rows = result.recordset || [];
  const total = rows.length ? Number(rows[0].total_count || 0) : 0;
  return {
    data: rows.map(toSalesStockExitDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'vega-live-read-only',
      filters: {
        companyCode: env.vega.companyCode,
        periodCode: env.vega.periodCode,
        year: env.vega.year,
        dateFrom,
        dateTo,
        currency,
        amountMin,
        amountMax,
        customerCode: customerCode || null,
        search: options.search || null,
        movementCode: 33,
      },
    }),
  };
}

export async function getVegaCustomerLedgerList(customerSourceIdValue, query = {}) {
  const customerSourceId = normalizeCustomerSourceId(customerSourceIdValue);
  const options = parseListQuery(query, { defaultLimit: 150, maxLimit: 500 });
  const dateFrom = normalizeDate(query.dateFrom, 'dateFrom');
  const dateTo = normalizeDate(query.dateTo, 'dateTo');

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error('dateFrom cannot be after dateTo');
    error.code = 'VEGA_CUSTOMER_LEDGER_DATE_RANGE_INVALID';
    error.statusCode = 400;
    throw error;
  }

  const pool = await getVegaSqlPool();
  const result = await new sql.Request(pool)
    .input('customerSourceId', sql.Int, customerSourceId)
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH target_customer AS (
        SELECT TOP (1)
          c.IND AS customer_source_id,
          c.FIRMAKODU AS customer_code,
          c.FIRMAADI AS customer_name,
          c.UNVAN AS legal_title,
          c.PARABIRIMI AS currency_code
        FROM dbo.F0102TBLCARI c
        WHERE
          ISNULL(c.DELETED, 0) = 0
          AND ISNULL(c.STATUS, 0) = 1
          AND LTRIM(RTRIM(ISNULL(c.PARABIRIMI, N''))) <> N'LL'
          AND c.IND = @customerSourceId
        ORDER BY c.IND ASC
      ),
      ledger_base AS (
        SELECT
          h.IND AS source_id,
          c.customer_source_id,
          c.customer_code,
          c.customer_name,
          c.legal_title,
          h.TARIH AS document_date,
          h.IZAHAT AS movement_code,
          h.EVRAKNO AS document_no,
          h.PARABIRIMI AS currency_code,
          ISNULL(h.KUR, 0) AS exchange_rate,
          ISNULL(h.BORC, 0) / NULLIF(h.KUR, 0) AS debit,
          ISNULL(h.ALACAK, 0) / NULLIF(h.KUR, 0) AS credit,
          (ISNULL(h.BORC, 0) - ISNULL(h.ALACAK, 0)) / NULLIF(h.KUR, 0) AS balance_effect
        FROM dbo.F0102D0007TBLCARIHAREKETLERI h
        INNER JOIN target_customer c ON c.customer_source_id = h.FIRMANO
        WHERE
          ISNULL(h.IZAHAT, N'') NOT IN (N'30', N'31')
          AND (
            (c.currency_code IN (N'$', N'USD') AND h.PARABIRIMI IN (N'$', N'USD'))
            OR (c.currency_code IN (N'€', N'EUR') AND h.PARABIRIMI IN (N'€', N'EUR'))
            OR (c.currency_code IN (N'TL', N'TRY', N'₺') AND h.PARABIRIMI IN (N'TL', N'TRY', N'₺'))
          )
      ),
      ledger_with_balance AS (
        SELECT
          b.*,
          SUM(b.balance_effect) OVER (
            ORDER BY b.document_date ASC, b.source_id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS running_balance
        FROM ledger_base b
      ),
      filtered_ledger AS (
        SELECT *
        FROM ledger_with_balance l
        WHERE
          (@dateFrom IS NULL OR l.document_date >= @dateFrom)
          AND (@dateTo IS NULL OR l.document_date < DATEADD(day, 1, @dateTo))
          AND (
            @search IS NULL
            OR ${sqlNormalizedLike('l.document_no')}
            OR ${sqlNormalizedLike('l.customer_code')}
            OR ${sqlNormalizedLike('l.customer_name')}
          )
      ),
      numbered_ledger AS (
        SELECT
          l.*,
          ROW_NUMBER() OVER (ORDER BY l.document_date ASC, l.source_id ASC) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM filtered_ledger l
      )
      SELECT TOP (${options.limit}) *
      FROM numbered_ledger
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'vega-live-read-only',
      filters: {
        companyCode: env.vega.companyCode,
        periodCode: env.vega.periodCode,
        year: env.vega.year,
        customerSourceId,
        customerCode: rows[0] ? String(rows[0].customer_code || '').trim() : null,
        customerName: rows[0] ? String(rows[0].customer_name || '').trim() : null,
        dateFrom,
        dateTo,
        search: options.search || null,
      },
    }),
  };
}

export async function getVegaCustomerStockExitDocument(customerSourceIdValue, movementSourceIdValue) {
  const customerSourceId = normalizeCustomerSourceId(customerSourceIdValue);
  const movementSourceId = normalizeMovementSourceId(movementSourceIdValue);
  const pool = await getVegaSqlPool();
  const result = await new sql.Request(pool)
    .input('customerSourceId', sql.Int, customerSourceId)
    .input('movementSourceId', sql.Int, movementSourceId)
    .query(`
      WITH target_customer AS (
        SELECT TOP (1) c.IND AS customer_source_id
        FROM dbo.F0102TBLCARI c
        WHERE
          ISNULL(c.DELETED, 0) = 0
          AND ISNULL(c.STATUS, 0) = 1
          AND LTRIM(RTRIM(ISNULL(c.PARABIRIMI, N''))) <> N'LL'
          AND c.IND = @customerSourceId
        ORDER BY c.IND ASC
      ),
      target_document AS (
        SELECT TOP (1)
          h.IND AS movement_source_id,
          h.FIRMANO AS customer_source_id,
          h.EVRAKNO AS document_no,
          h.TARIH AS document_date,
          ISNULL(h.KUR, 0) AS document_exchange_rate,
          h.PARABIRIMI AS document_currency_code,
          ISNULL(h.BORC, 0) / NULLIF(h.KUR, 0) AS document_amount
        FROM dbo.F0102D0007TBLCARIHAREKETLERI h
        INNER JOIN target_customer c ON c.customer_source_id = h.FIRMANO
        WHERE h.IND = @movementSourceId AND LTRIM(RTRIM(h.IZAHAT)) = N'33'
      )
      SELECT
        d.movement_source_id,
        d.document_no,
        d.document_date,
        sh.IND AS source_id,
        sh.LN AS line_number,
        sh.STOKNO AS stock_source_id,
        s.STOKKODU AS stock_code,
        s.MALINCINSI AS product_name,
        s.KOD1 AS brand,
        s.KOD4 AS special_code_4,
        u.BARCODE AS barcode,
        COALESCE(NULLIF(LTRIM(RTRIM(u.BIRIMADI)), N''), N'ADET') AS unit_name,
        CASE WHEN ISNULL(sh.CIKAN, 0) > 0 THEN sh.CIKAN ELSE ISNULL(sh.GIREN, 0) END AS quantity,
        ISNULL(sh.BIRIMFIYAT, 0) / NULLIF(d.document_exchange_rate, 0) AS unit_price,
        ISNULL(sh.TUTAR, 0) / NULLIF(d.document_exchange_rate, 0) AS line_total,
        d.document_currency_code AS currency_code,
        d.document_exchange_rate AS exchange_rate,
        d.document_amount
      FROM target_document d
      INNER JOIN dbo.F0102D0007TBLSTOKHAREKETLERI sh
        ON sh.FIRMANO = d.customer_source_id
        AND LTRIM(RTRIM(sh.EVRAKNO)) = LTRIM(RTRIM(d.document_no))
        AND sh.TARIH >= CONVERT(date, d.document_date)
        AND sh.TARIH < DATEADD(day, 1, CONVERT(date, d.document_date))
        AND LTRIM(RTRIM(sh.IZAHAT)) = N'33'
      INNER JOIN dbo.F0102TBLSTOKLAR s ON s.IND = sh.STOKNO
      OUTER APPLY (
        SELECT TOP (1) b.BARCODE, b.BIRIMADI
        FROM dbo.F0102TBLBIRIMLEREX b
        WHERE b.STOKNO = sh.STOKNO
        ORDER BY
          CASE WHEN b.IND = sh.BIRIMEX THEN 0 ELSE 1 END,
          CASE WHEN ISNULL(b.VARSAYILAN, 0) = 1 THEN 0 ELSE 1 END,
          b.IND ASC
      ) u
      ORDER BY ISNULL(sh.LN, 0) ASC, sh.IND ASC;
    `);

  const lines = (result.recordset || []).map(toStockExitLineDto);
  if (lines.length === 0) {
    const error = new Error('Vega customer stock exit document was not found');
    error.code = 'VEGA_CUSTOMER_STOCK_EXIT_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  // Load the local ERP SQL adapter only after the Vega request is complete.
  // The local adapter uses the msnodesqlv8 driver, while Vega uses mssql's
  // network driver; eagerly loading both can cross-wire the active request.
  const { getVegaProductCustomsMap } = await import('./vegaProductCustomsService.js');
  const { classifyProductCustomsDraft } = await import('./productCustomsClassifier.js');
  const customsMap = await getVegaProductCustomsMap(lines.map((line) => line.stockSourceId));
  const enrichedLines = lines.map((line) => {
    const storedCustoms = customsMap.get(line.stockSourceId) || null;
    const customs = storedCustoms?.code
      ? { ...storedCustoms, source: 'local-customs', requiresReview: storedCustoms.status !== 'verified' }
      : classifyProductCustomsDraft(line);
    return {
      ...line,
      gtipCode: customs?.code || '',
      gtipStatus: customs?.status || '',
      gtipConfidence: customs?.confidence || '',
      gtipMaterialBasis: customs?.materialBasis || '',
      gtipNote: customs?.note || '',
      gtipSource: customs?.source || '',
      gtipRuleId: customs?.ruleId || '',
      gtipRequiresReview: customs?.requiresReview !== false,
    };
  });

  const first = result.recordset[0];
  const lineSubtotal = enrichedLines.reduce((total, line) => total + line.lineTotal, 0);
  const documentAmount = Number(first.document_amount || 0);
  return {
    source: 'vega-live-read-only',
    customerSourceId,
    movementSourceId,
    documentNo: String(first.document_no || '').trim(),
    documentDate: first.document_date || null,
    currency: enrichedLines[0]?.currency || 'USD',
    lineCount: enrichedLines.length,
    totalQuantity: enrichedLines.reduce((total, line) => total + line.quantity, 0),
    totalAmount: documentAmount,
    lineSubtotal,
    adjustmentAmount: documentAmount - lineSubtotal,
    lines: enrichedLines,
  };
}
