import sql from 'mssql';
import { getVegaSqlPool } from '../config/vegaDatabase.js';

const PERIODS = [
  { year: 2023, period: 'D0004' },
  { year: 2024, period: 'D0005' },
  { year: 2025, period: 'D0006' },
  { year: 2026, period: 'D0007' },
];

function currencySql(column) {
  return `CASE
    WHEN ${column} IN (N'$', N'USD') THEN N'USD'
    WHEN ${column} IN (N'€', N'EUR') THEN N'EUR'
    WHEN ${column} IN (N'TL', N'TRY', N'₺') THEN N'TRY'
    ELSE NULL
  END`;
}

function buildLineSalesUnion() {
  return PERIODS.map(({ year, period }) => `
    SELECT
      ${year} AS sales_year,
      sh.TARIH AS sales_date,
      ${currencySql('doc.PARABIRIMI')} AS currency,
      sh.STOKNO AS product_source_id,
      COALESCE(NULLIF(LTRIM(RTRIM(s.STOKKODU)), N''), CONCAT(N'VEGA-', sh.STOKNO)) AS product_code,
      COALESCE(NULLIF(LTRIM(RTRIM(s.MALINCINSI)), N''), s.STOKKODU, CONCAT(N'VEGA-', sh.STOKNO)) AS product_name,
      COALESCE(NULLIF(LTRIM(RTRIM(s.KOD1)), N''), N'Markasız') AS brand_name,
      sh.FIRMANO AS customer_source_id,
      COALESCE(NULLIF(LTRIM(RTRIM(c.FIRMAKODU)), N''), CONCAT(N'VEGA-', sh.FIRMANO)) AS customer_code,
      COALESCE(NULLIF(LTRIM(RTRIM(c.FIRMAADI)), N''), c.FIRMAKODU, CONCAT(N'VEGA-', sh.FIRMANO)) AS customer_name,
      LTRIM(RTRIM(sh.EVRAKNO)) AS document_no,
      CAST(ISNULL(sh.CIKAN, 0) AS decimal(19, 4)) AS quantity,
      CAST(doc.document_amount * ISNULL(sh.TUTAR, 0) / NULLIF(sh.document_line_weight, 0) AS decimal(19, 4)) AS sales_amount
    FROM (
      SELECT
        line_row.*,
        SUM(ISNULL(line_row.TUTAR, 0)) OVER (
          PARTITION BY line_row.FIRMANO, LTRIM(RTRIM(line_row.EVRAKNO)), CONVERT(date, line_row.TARIH)
        ) AS document_line_weight
      FROM dbo.F0102${period}TBLSTOKHAREKETLERI line_row
      WHERE line_row.TARIH >= '${year}-01-01'
        AND line_row.TARIH < '${year + 1}-01-01'
        AND LTRIM(RTRIM(line_row.IZAHAT)) = N'33'
        AND ISNULL(line_row.CIKAN, 0) > 0
        AND ISNULL(line_row.TUTAR, 0) > 0
    ) sh
    INNER JOIN dbo.F0102TBLSTOKLAR s ON s.IND = sh.STOKNO
    LEFT JOIN dbo.F0102TBLCARI c ON c.IND = sh.FIRMANO
    INNER JOIN (
      SELECT customer_row.*
      FROM (
        SELECT
          header_row.FIRMANO,
          LTRIM(RTRIM(header_row.EVRAKNO)) AS document_no,
          CONVERT(date, header_row.TARIH) AS document_date,
          header_row.PARABIRIMI,
          ISNULL(header_row.BORC, 0) / NULLIF(header_row.KUR, 0) AS document_amount,
          ROW_NUMBER() OVER (
            PARTITION BY header_row.FIRMANO, LTRIM(RTRIM(header_row.EVRAKNO)), CONVERT(date, header_row.TARIH)
            ORDER BY header_row.IND ASC
          ) AS document_rank
        FROM dbo.F0102${period}TBLCARIHAREKETLERI header_row
        WHERE header_row.TARIH >= '${year}-01-01'
          AND header_row.TARIH < '${year + 1}-01-01'
          AND LTRIM(RTRIM(header_row.IZAHAT)) = N'33'
          AND ISNULL(header_row.BORC, 0) > 0
          AND ISNULL(header_row.KUR, 0) > 0
      ) customer_row
      WHERE customer_row.document_rank = 1
    ) doc ON doc.FIRMANO = sh.FIRMANO
      AND doc.document_no = LTRIM(RTRIM(sh.EVRAKNO))
      AND doc.document_date = CONVERT(date, sh.TARIH)
    WHERE sh.document_line_weight > 0
      AND ${currencySql('doc.PARABIRIMI')} IS NOT NULL
  `).join('\nUNION ALL\n');
}

function number(value) {
  return Number(value || 0);
}

function groupRows(rows, type) {
  const groups = new Map();
  for (const row of rows) {
    const id = type === 'brand' ? String(row.entity_name || '') : String(row.entity_id || '');
    const currency = String(row.currency || '');
    const key = `${currency}:${id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id,
        code: String(row.entity_code || ''),
        name: String(row.entity_name || ''),
        brand: String(row.brand_name || ''),
        currency,
        rank: number(row.performance_rank),
        years: [],
      });
    }
    groups.get(key).years.push({
      year: number(row.sales_year),
      fullSalesAmount: number(row.full_sales_amount),
      comparableSalesAmount: number(row.comparable_sales_amount),
      fullQuantity: number(row.full_quantity),
      comparableQuantity: number(row.comparable_quantity),
      fullDocumentCount: number(row.full_document_count),
      comparableDocumentCount: number(row.comparable_document_count),
    });
  }
  return [...groups.values()].map((item) => ({
    ...item,
    years: PERIODS.map(({ year }) => item.years.find((row) => row.year === year) || {
      year,
      fullSalesAmount: 0,
      comparableSalesAmount: 0,
      fullQuantity: 0,
      comparableQuantity: 0,
      fullDocumentCount: 0,
      comparableDocumentCount: 0,
    }),
  })).sort((a, b) => a.currency.localeCompare(b.currency) || a.rank - b.rank);
}

function performanceQuery(lineSalesUnion, entity) {
  const isProduct = entity === 'product';
  const isBrand = entity === 'brand';
  const id = isProduct ? 'product_source_id' : isBrand ? 'brand_name' : 'customer_source_id';
  const code = isProduct ? 'product_code' : isBrand ? 'brand_name' : 'customer_code';
  const name = isProduct ? 'product_name' : isBrand ? 'brand_name' : 'customer_name';
  const brand = isProduct ? 'brand_name' : isBrand ? 'brand_name' : "N''";
  const rankLimit = isBrand ? 250 : 150;

  return `
    WITH line_sales AS (${lineSalesUnion}),
    annual AS (
      SELECT
        ${id} AS entity_id,
        MAX(${code}) AS entity_code,
        MAX(${name}) AS entity_name,
        MAX(${brand}) AS brand_name,
        sales_year,
        currency,
        COUNT(DISTINCT CONCAT(CONVERT(varchar(10), sales_date, 23), N'|', customer_source_id, N'|', document_no)) AS full_document_count,
        COUNT(DISTINCT CASE WHEN MONTH(sales_date) < @cutoffMonth OR (MONTH(sales_date) = @cutoffMonth AND DAY(sales_date) <= @cutoffDay)
          THEN CONCAT(CONVERT(varchar(10), sales_date, 23), N'|', customer_source_id, N'|', document_no) END) AS comparable_document_count,
        SUM(quantity) AS full_quantity,
        SUM(CASE WHEN MONTH(sales_date) < @cutoffMonth OR (MONTH(sales_date) = @cutoffMonth AND DAY(sales_date) <= @cutoffDay) THEN quantity ELSE 0 END) AS comparable_quantity,
        SUM(sales_amount) AS full_sales_amount,
        SUM(CASE WHEN MONTH(sales_date) < @cutoffMonth OR (MONTH(sales_date) = @cutoffMonth AND DAY(sales_date) <= @cutoffDay) THEN sales_amount ELSE 0 END) AS comparable_sales_amount
      FROM line_sales
      GROUP BY ${id}, sales_year, currency
    ),
    totals AS (
      SELECT entity_id, currency, SUM(comparable_sales_amount) AS comparison_total
      FROM annual
      GROUP BY entity_id, currency
    ),
    ranked AS (
      SELECT entity_id, currency,
        ROW_NUMBER() OVER (PARTITION BY currency ORDER BY comparison_total DESC, entity_id ASC) AS performance_rank
      FROM totals
    )
    SELECT a.*, r.performance_rank
    FROM annual a
    INNER JOIN ranked r ON r.entity_id = a.entity_id AND r.currency = a.currency
    WHERE r.performance_rank <= ${rankLimit}
    ORDER BY a.currency, r.performance_rank, a.sales_year;
  `;
}

export async function getVegaSalesPerformance() {
  const pool = await getVegaSqlPool();
  const cutoffResult = await pool.request().query(`
    SELECT MAX(CONVERT(date, h.TARIH)) AS cutoff_date
    FROM dbo.F0102D0007TBLCARIHAREKETLERI h
    WHERE h.TARIH >= '2026-01-01' AND h.TARIH < '2027-01-01'
      AND LTRIM(RTRIM(h.IZAHAT)) = N'33' AND ISNULL(h.BORC, 0) > 0;
  `);
  const cutoffDate = cutoffResult.recordset?.[0]?.cutoff_date || new Date('2026-01-01T00:00:00.000Z');
  const cutoffMonth = new Date(cutoffDate).getUTCMonth() + 1;
  const cutoffDay = new Date(cutoffDate).getUTCDate();
  const lineSalesUnion = buildLineSalesUnion();

  async function execute(entity) {
    const request = pool.request();
    request.timeout = 60000;
    return request
      .input('cutoffMonth', sql.Int, cutoffMonth)
      .input('cutoffDay', sql.Int, cutoffDay)
      .query(performanceQuery(lineSalesUnion, entity));
  }

  const [brandResult, productResult, customerResult] = await Promise.all([
    execute('brand'),
    execute('product'),
    execute('customer'),
  ]);

  return {
    source: 'vega-live-read-only',
    generatedAt: new Date().toISOString(),
    cutoffDate,
    companyCode: 'F0102',
    currencies: ['USD', 'EUR', 'TRY'],
    years: PERIODS.map(({ year }) => year),
    brands: groupRows(brandResult.recordset || [], 'brand'),
    products: groupRows(productResult.recordset || [], 'product'),
    customers: groupRows(customerResult.recordset || [], 'customer'),
  };
}
