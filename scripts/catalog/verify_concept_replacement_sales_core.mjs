import { TARGET_PERIODS } from './verify_catalog_candidate_sales_core.mjs';

export const SHORTLIST_FILE_NAME = 'catalog-concept-replacement-shortlist-20260831T183811740Z.json';
export const SHORTLIST_SHA256 = 'b4787520ca04b48535ddf209d55b9baa31810f8b3e7f2af63145f8e6490548c7';
export const REPLACEMENT_SHORTLIST_TARGETS = Object.freeze([
  { sourceId: 161167, stockCode: '8023 CONCEPT', brand: 'CONCEPT' },
  { sourceId: 161166, stockCode: '8034 CONCEPT', brand: 'CONCEPT' },
  { sourceId: 161163, stockCode: '8095 CONCEPT', brand: 'CONCEPT' },
]);

function verificationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value) {
  return String(value || '').trim();
}

export function parseReplacementSalesArgs(args = []) {
  const allowed = new Set(['--help', '--write-report']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0) {
    throw verificationError(
      'CONCEPT_REPLACEMENT_SALES_ARGUMENT_INVALID',
      `Unsupported replacement sales argument: ${unknown.join(', ')}`,
    );
  }
  return {
    help: args.includes('--help'),
    writeReport: args.includes('--write-report'),
    mode: args.includes('--write-report') ? 'local-evidence-write' : 'preview',
  };
}

export function assertPinnedShortlist(payload, sha256) {
  if (text(sha256).toLowerCase() !== SHORTLIST_SHA256) {
    throw verificationError(
      'CONCEPT_REPLACEMENT_SHORTLIST_HASH_MISMATCH',
      'The CONCEPT replacement shortlist hash changed',
    );
  }
  if (
    payload?.publicationStatus !== 'local-review-evidence-only'
    || payload?.sourceIdentity?.source !== 'vega-live-read-only'
    || payload?.sourceIdentity?.companyCode !== 'F0102'
    || payload?.sourceIdentity?.periodCode !== 'D0007'
    || Number(payload?.sourceIdentity?.year) !== 2026
  ) {
    throw verificationError(
      'CONCEPT_REPLACEMENT_SHORTLIST_SOURCE_MISMATCH',
      'The CONCEPT replacement shortlist source is not the approved read-only Vega source',
    );
  }
  if (!Array.isArray(payload?.shortlist) || payload.shortlist.length < REPLACEMENT_SHORTLIST_TARGETS.length) {
    throw verificationError(
      'CONCEPT_REPLACEMENT_SHORTLIST_INCOMPLETE',
      'The CONCEPT replacement shortlist is incomplete',
    );
  }

  return REPLACEMENT_SHORTLIST_TARGETS.map((expected, index) => {
    const row = payload.shortlist[index];
    if (
      Number(row?.sourceId) !== expected.sourceId
      || text(row?.stockCode) !== expected.stockCode
      || text(row?.brand) !== expected.brand
      || !row?.dataChecks
      || Object.values(row.dataChecks).some((value) => value !== true)
    ) {
      throw verificationError(
        'CONCEPT_REPLACEMENT_SHORTLIST_IDENTITY_MISMATCH',
        `Shortlist identity or data checks failed at rank ${index + 1}`,
      );
    }
    return { ...expected };
  });
}

export function buildReplacementSalesQuery(targets = REPLACEMENT_SHORTLIST_TARGETS) {
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > 10) {
    throw verificationError(
      'CONCEPT_REPLACEMENT_SALES_TARGET_COUNT_INVALID',
      'Between one and ten replacement targets are required',
    );
  }
  const candidateValues = targets.map((_, index) => `(@replacementSourceId${index})`).join(', ');
  const yearValues = TARGET_PERIODS.map(({ year }) => `(${year})`).join(', ');
  const periodSales = TARGET_PERIODS.map(({ year, periodCode }) => `
    SELECT
      ${year} AS sales_year,
      movement.STOKNO AS source_id,
      SUM(CAST(ISNULL(movement.CIKAN, 0) AS decimal(19, 4))) AS gross_outbound_quantity,
      COUNT(DISTINCT CONCAT(
        CONVERT(nvarchar(30), movement.FIRMANO), N'|',
        LTRIM(RTRIM(ISNULL(movement.EVRAKNO, N''))), N'|',
        CONVERT(nvarchar(10), CONVERT(date, movement.TARIH), 23)
      )) AS sales_document_count,
      MIN(CONVERT(date, movement.TARIH)) AS first_sold_at,
      MAX(CONVERT(date, movement.TARIH)) AS last_sold_at
    FROM dbo.F0102${periodCode}TBLSTOKHAREKETLERI movement
    INNER JOIN candidates candidate ON candidate.source_id = movement.STOKNO
    WHERE movement.TARIH >= '${year}-01-01'
      AND movement.TARIH < '${year + 1}-01-01'
      AND LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33'
      AND ISNULL(movement.CIKAN, 0) > 0
    GROUP BY movement.STOKNO
  `).join('\nUNION ALL\n');

  return `
    WITH candidates(source_id) AS (
      SELECT source_id FROM (VALUES ${candidateValues}) candidate_values(source_id)
    ),
    target_years(sales_year) AS (
      SELECT sales_year FROM (VALUES ${yearValues}) year_values(sales_year)
    ),
    period_sales AS (${periodSales})
    SELECT
      product.IND AS source_id,
      LTRIM(RTRIM(product.STOKKODU)) AS stock_code,
      LTRIM(RTRIM(ISNULL(product.KOD1, N''))) AS brand,
      target_years.sales_year,
      ISNULL(period_sales.gross_outbound_quantity, CAST(0 AS decimal(19, 4))) AS gross_outbound_quantity,
      ISNULL(period_sales.sales_document_count, 0) AS sales_document_count,
      period_sales.first_sold_at,
      period_sales.last_sold_at
    FROM candidates candidate
    INNER JOIN dbo.F0102TBLSTOKLAR product ON product.IND = candidate.source_id
    CROSS JOIN target_years
    LEFT JOIN period_sales
      ON period_sales.source_id = candidate.source_id
      AND period_sales.sales_year = target_years.sales_year
    ORDER BY candidate.source_id, target_years.sales_year;
  `;
}

