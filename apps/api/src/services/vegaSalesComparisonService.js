import sql from 'mssql';
import { getVegaSqlPool } from '../config/vegaDatabase.js';

const SALES_PERIODS = [
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

function buildSalesUnion() {
  return SALES_PERIODS.map(({ year, period }) => `
    SELECT
      ${year} AS sales_year,
      h.TARIH AS sales_date,
      MONTH(h.TARIH) AS sales_month,
      ${currencySql('h.PARABIRIMI')} AS currency,
      CAST(ISNULL(h.BORC, 0) / NULLIF(h.KUR, 0) AS decimal(19, 4)) AS sales_amount,
      h.FIRMANO AS customer_source_id
    FROM dbo.F0102${period}TBLCARIHAREKETLERI h
    WHERE
      h.TARIH >= '${year}-01-01'
      AND h.TARIH < '${year + 1}-01-01'
      AND LTRIM(RTRIM(h.IZAHAT)) = N'33'
      AND ISNULL(h.BORC, 0) > 0
      AND ISNULL(h.KUR, 0) > 0
      AND ${currencySql('h.PARABIRIMI')} IS NOT NULL
  `).join('\nUNION ALL\n');
}

function buildStockUnion() {
  return SALES_PERIODS.map(({ year, period }) => `
    SELECT
      ${year} AS sales_year,
      h.TARIH AS sales_date,
      h.STOKNO AS stock_source_id,
      CAST(ISNULL(h.CIKAN, 0) AS decimal(19, 4)) AS quantity
    FROM dbo.F0102${period}TBLSTOKHAREKETLERI h
    WHERE
      h.TARIH >= '${year}-01-01'
      AND h.TARIH < '${year + 1}-01-01'
      AND LTRIM(RTRIM(h.IZAHAT)) = N'33'
      AND ISNULL(h.CIKAN, 0) > 0
  `).join('\nUNION ALL\n');
}

function number(value) {
  return Number(value || 0);
}

export async function getVegaSalesComparison() {
  const pool = await getVegaSqlPool();
  const cutoffResult = await pool.request().query(`
    SELECT MAX(CONVERT(date, h.TARIH)) AS cutoff_date
    FROM dbo.F0102D0007TBLCARIHAREKETLERI h
    WHERE
      h.TARIH >= '2026-01-01'
      AND h.TARIH < '2027-01-01'
      AND LTRIM(RTRIM(h.IZAHAT)) = N'33';
  `);
  const cutoffDate = cutoffResult.recordset?.[0]?.cutoff_date || new Date('2026-01-01T00:00:00.000Z');
  const cutoffMonth = new Date(cutoffDate).getUTCMonth() + 1;
  const cutoffDay = new Date(cutoffDate).getUTCDate();
  const comparablePredicate = '(MONTH(s.sales_date) < @cutoffMonth OR (MONTH(s.sales_date) = @cutoffMonth AND DAY(s.sales_date) <= @cutoffDay))';
  const salesUnion = buildSalesUnion();

  const monthlyResult = await pool.request()
    .input('cutoffMonth', sql.Int, cutoffMonth)
    .input('cutoffDay', sql.Int, cutoffDay)
    .query(`
      WITH sales AS (${salesUnion})
      SELECT
        s.sales_year,
        s.sales_month,
        s.currency,
        COUNT_BIG(1) AS document_count,
        SUM(CASE WHEN ${comparablePredicate} THEN 1 ELSE 0 END) AS comparable_document_count,
        COUNT(DISTINCT s.customer_source_id) AS customer_count,
        COUNT(DISTINCT CASE WHEN ${comparablePredicate} THEN s.customer_source_id END) AS comparable_customer_count,
        SUM(s.sales_amount) AS sales_amount,
        SUM(CASE WHEN ${comparablePredicate} THEN s.sales_amount ELSE 0 END) AS comparable_sales_amount
      FROM sales s
      GROUP BY s.sales_year, s.sales_month, s.currency
      ORDER BY s.sales_year, s.sales_month, s.currency;
    `);

  const annualResult = await pool.request()
    .input('cutoffMonth', sql.Int, cutoffMonth)
    .input('cutoffDay', sql.Int, cutoffDay)
    .query(`
      WITH sales AS (${salesUnion})
      SELECT
        s.sales_year,
        s.currency,
        COUNT_BIG(1) AS full_document_count,
        SUM(CASE WHEN ${comparablePredicate} THEN 1 ELSE 0 END) AS comparable_document_count,
        COUNT(DISTINCT s.customer_source_id) AS full_customer_count,
        COUNT(DISTINCT CASE WHEN ${comparablePredicate} THEN s.customer_source_id END) AS comparable_customer_count,
        SUM(s.sales_amount) AS full_sales_amount,
        SUM(CASE WHEN ${comparablePredicate} THEN s.sales_amount ELSE 0 END) AS comparable_sales_amount
      FROM sales s
      GROUP BY s.sales_year, s.currency
      ORDER BY s.sales_year, s.currency;
    `);

  const stockUnion = buildStockUnion();
  const inventoryResult = await pool.request()
    .input('cutoffMonth', sql.Int, cutoffMonth)
    .input('cutoffDay', sql.Int, cutoffDay)
    .query(`
      WITH stock_sales AS (${stockUnion})
      SELECT
        s.sales_year,
        COUNT_BIG(1) AS full_line_count,
        SUM(CASE WHEN ${comparablePredicate} THEN 1 ELSE 0 END) AS comparable_line_count,
        COUNT(DISTINCT s.stock_source_id) AS full_product_count,
        COUNT(DISTINCT CASE WHEN ${comparablePredicate} THEN s.stock_source_id END) AS comparable_product_count,
        SUM(s.quantity) AS full_quantity,
        SUM(CASE WHEN ${comparablePredicate} THEN s.quantity ELSE 0 END) AS comparable_quantity
      FROM stock_sales s
      GROUP BY s.sales_year
      ORDER BY s.sales_year;
    `);

  const inventoryByYear = new Map((inventoryResult.recordset || []).map((row) => [Number(row.sales_year), {
    fullLineCount: number(row.full_line_count),
    comparableLineCount: number(row.comparable_line_count),
    fullProductCount: number(row.full_product_count),
    comparableProductCount: number(row.comparable_product_count),
    fullQuantity: number(row.full_quantity),
    comparableQuantity: number(row.comparable_quantity),
  }]));

  const annual = SALES_PERIODS.map(({ year, period }) => ({
    year,
    period,
    isCurrentYear: year === 2026,
    inventory: inventoryByYear.get(year) || {},
    salesByCurrency: (annualResult.recordset || [])
      .filter((row) => Number(row.sales_year) === year)
      .map((row) => ({
        currency: row.currency,
        fullDocumentCount: number(row.full_document_count),
        comparableDocumentCount: number(row.comparable_document_count),
        fullCustomerCount: number(row.full_customer_count),
        comparableCustomerCount: number(row.comparable_customer_count),
        fullSalesAmount: number(row.full_sales_amount),
        comparableSalesAmount: number(row.comparable_sales_amount),
      })),
  }));

  return {
    source: 'vega-live-read-only',
    generatedAt: new Date().toISOString(),
    cutoffDate,
    companyCode: 'F0102',
    currencies: ['USD', 'EUR', 'TRY'],
    annual,
    monthly: (monthlyResult.recordset || []).map((row) => ({
      year: Number(row.sales_year),
      month: Number(row.sales_month),
      currency: row.currency,
      documentCount: number(row.document_count),
      comparableDocumentCount: number(row.comparable_document_count),
      customerCount: number(row.customer_count),
      comparableCustomerCount: number(row.comparable_customer_count),
      salesAmount: number(row.sales_amount),
      comparableSalesAmount: number(row.comparable_sales_amount),
    })),
  };
}
