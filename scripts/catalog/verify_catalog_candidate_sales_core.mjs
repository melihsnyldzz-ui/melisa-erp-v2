export const CANDIDATE_FILE_NAME = 'catalog-selection-candidate-20260830T222401113Z.json';
export const CANDIDATE_SHA256 = 'd1078566833e478ea0273bf368e1d58177dd5401c01a176b0e9a6bff91a0cfa1';

export const TARGET_PERIODS = Object.freeze([
  { year: 2023, periodCode: 'D0004' },
  { year: 2024, periodCode: 'D0005' },
  { year: 2025, periodCode: 'D0006' },
  { year: 2026, periodCode: 'D0007' },
]);

export const EXPECTED_CANDIDATES = Object.freeze([
  { sourceId: 161032, stockCode: '8038 CONCEPT', brand: 'CONCEPT' },
  { sourceId: 144974, stockCode: '5189 HİPPIL', brand: 'HİPPIL' },
  { sourceId: 109318, stockCode: '3006 MİNİZEYN', brand: 'MİNİZEYN' },
  { sourceId: 147141, stockCode: '10010 MİNİZEYN', brand: 'MİNİZEYN' },
  { sourceId: 148771, stockCode: '1975 NAYİNOM', brand: 'NAYINOM' },
  { sourceId: 111828, stockCode: '0335 NAYİNOM', brand: 'NAYINOM' },
]);

export const REQUIRED_VEGA_TABLES = Object.freeze([
  'F0102TBLSTOKLAR',
  ...TARGET_PERIODS.map(({ periodCode }) => `F0102${periodCode}TBLSTOKHAREKETLERI`),
]);

const FORBIDDEN_EVIDENCE_KEYS = new Set([
  'customer',
  'customerCode',
  'customerName',
  'documentNo',
  'evrakNo',
  'salePrice',
  'purchasePrice',
  'salesAmount',
  'cost',
  'phone',
]);

function auditError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value) {
  return String(value || '').trim();
}

function number(value) {
  const result = Number(value || 0);
  if (!Number.isFinite(result) || result < 0) {
    throw auditError('CATALOG_SALES_EVIDENCE_NUMBER_INVALID', 'Sales evidence contains an invalid number');
  }
  return result;
}

function dateText(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw auditError('CATALOG_SALES_EVIDENCE_DATE_INVALID', 'Sales evidence contains an invalid date');
  }
  return date.toISOString().slice(0, 10);
}

export function parseCandidateSalesArgs(args = []) {
  const allowed = new Set(['--help', '--write-report']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0) {
    throw auditError(
      'CATALOG_SALES_ARGUMENT_INVALID',
      `Unsupported catalog sales verification argument: ${unknown.join(', ')}`,
    );
  }
  return {
    help: args.includes('--help'),
    writeReport: args.includes('--write-report'),
    mode: args.includes('--write-report') ? 'local-evidence-write' : 'preview',
  };
}

export function assertCandidateSelection(payload, sha256) {
  if (text(sha256).toLowerCase() !== CANDIDATE_SHA256) {
    throw auditError('CATALOG_SALES_CANDIDATE_HASH_MISMATCH', 'Catalog candidate hash does not match the approved evidence source');
  }
  if (
    payload?.sourceIdentity?.source !== 'vega-live-read-only'
    || payload?.sourceIdentity?.companyCode !== 'F0102'
    || payload?.sourceIdentity?.periodCode !== 'D0007'
    || Number(payload?.sourceIdentity?.year) !== 2026
  ) {
    throw auditError('CATALOG_SALES_SOURCE_MISMATCH', 'Catalog candidate does not use the approved F0102 / D0007 / 2026 source');
  }
  if (payload?.publicationStatus !== 'not-published-local-candidate') {
    throw auditError('CATALOG_SALES_PUBLICATION_STATE_INVALID', 'Catalog candidate is not in the expected unpublished state');
  }
  if (!Array.isArray(payload?.products) || payload.products.length !== 30) {
    throw auditError('CATALOG_SALES_CANDIDATE_COUNT_INVALID', 'Catalog candidate must contain exactly 30 products');
  }

  const productsBySourceId = new Map(payload.products.map((product) => [Number(product?.sourceId), product]));
  const targets = EXPECTED_CANDIDATES.map((expected) => {
    const product = productsBySourceId.get(expected.sourceId);
    if (
      !product
      || text(product.stockCode) !== expected.stockCode
      || text(product.brand) !== expected.brand
    ) {
      throw auditError(
        'CATALOG_SALES_CANDIDATE_IDENTITY_MISMATCH',
        `Catalog candidate identity does not match source ${expected.sourceId}`,
      );
    }
    if (product?.salesPerformance?.status !== 'not-covered') {
      throw auditError(
        'CATALOG_SALES_CANDIDATE_ALREADY_COVERED',
        `Catalog candidate source ${expected.sourceId} is no longer marked as not covered`,
      );
    }
    return { ...expected };
  });

  const addedIds = new Set((payload?.comparison?.added || []).map((row) => Number(row?.sourceId)));
  if (addedIds.size !== targets.length || targets.some((target) => !addedIds.has(target.sourceId))) {
    throw auditError('CATALOG_SALES_REPLACEMENT_SET_MISMATCH', 'Catalog replacement set does not match the six approved targets');
  }
  return targets;
}

export function buildTargetedSalesQuery(targets = EXPECTED_CANDIDATES) {
  if (!Array.isArray(targets) || targets.length !== EXPECTED_CANDIDATES.length) {
    throw auditError('CATALOG_SALES_TARGET_COUNT_INVALID', 'Exactly six catalog candidates are required');
  }
  const candidateValues = targets.map((_, index) => `(@candidateSourceId${index})`).join(', ');
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

export function buildReadOnlyPermissionQuery() {
  const tableValues = REQUIRED_VEGA_TABLES.map((tableName) => `(N'${tableName}')`).join(', ');
  return `
    SELECT
      target.object_name,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'SELECT') AS can_select,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'INSERT') AS can_insert,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'UPDATE') AS can_update,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'DELETE') AS can_delete,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'ALTER') AS can_alter,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'CONTROL') AS can_control
    FROM (VALUES ${tableValues}) target(object_name)
    ORDER BY target.object_name;
  `;
}

export function assertReadOnlyPermissions(rows = []) {
  if (!Array.isArray(rows) || rows.length !== REQUIRED_VEGA_TABLES.length) {
    throw auditError('CATALOG_SALES_PERMISSION_EVIDENCE_INCOMPLETE', 'Vega table permission evidence is incomplete');
  }
  const rowsByName = new Map(rows.map((row) => [text(row?.object_name), row]));
  for (const tableName of REQUIRED_VEGA_TABLES) {
    const row = rowsByName.get(tableName);
    if (!row || Number(row.can_select) !== 1) {
      throw auditError('CATALOG_SALES_SELECT_PERMISSION_MISSING', `SELECT permission is missing for ${tableName}`);
    }
    if (['can_insert', 'can_update', 'can_delete', 'can_alter', 'can_control'].some((key) => Number(row[key]) !== 0)) {
      throw auditError('CATALOG_SALES_WRITE_PERMISSION_PRESENT', `Write-capable permission is present for ${tableName}`);
    }
  }
  return {
    checkedTableCount: REQUIRED_VEGA_TABLES.length,
    selectPermissionConfirmed: true,
    writePermissionAbsent: true,
  };
}

export function buildSalesEvidence(rows = [], targets = EXPECTED_CANDIDATES) {
  const expectedRowCount = targets.length * TARGET_PERIODS.length;
  if (!Array.isArray(rows) || rows.length !== expectedRowCount) {
    throw auditError(
      'CATALOG_SALES_EVIDENCE_INCOMPLETE',
      `Expected ${expectedRowCount} candidate-year rows; received ${Array.isArray(rows) ? rows.length : 0}`,
    );
  }

  const rowByKey = new Map();
  for (const row of rows) {
    const key = `${Number(row?.source_id)}:${Number(row?.sales_year)}`;
    if (rowByKey.has(key)) {
      throw auditError('CATALOG_SALES_EVIDENCE_DUPLICATE', `Duplicate sales evidence row: ${key}`);
    }
    rowByKey.set(key, row);
  }

  const products = targets.map((target) => {
    const years = TARGET_PERIODS.map(({ year }) => {
      const row = rowByKey.get(`${target.sourceId}:${year}`);
      if (
        !row
        || text(row.stock_code) !== target.stockCode
        || text(row.brand) !== target.brand
      ) {
        throw auditError(
          'CATALOG_SALES_EVIDENCE_IDENTITY_MISMATCH',
          `Sales evidence identity does not match source ${target.sourceId} for ${year}`,
        );
      }
      return {
        year,
        grossOutboundQuantity: number(row.gross_outbound_quantity),
        salesDocumentCount: number(row.sales_document_count),
        firstSoldAt: dateText(row.first_sold_at),
        lastSoldAt: dateText(row.last_sold_at),
      };
    });
    const soldYears = years.filter((row) => row.grossOutboundQuantity > 0 || row.salesDocumentCount > 0);
    const firstSoldAt = soldYears.map((row) => row.firstSoldAt).filter(Boolean).sort()[0] || null;
    const lastSoldAt = soldYears.map((row) => row.lastSoldAt).filter(Boolean).sort().at(-1) || null;
    return {
      ...target,
      hasRecordedSales: soldYears.length > 0,
      totals: {
        grossOutboundQuantity: years.reduce((total, row) => total + row.grossOutboundQuantity, 0),
        salesDocumentCount: years.reduce((total, row) => total + row.salesDocumentCount, 0),
        firstSoldAt,
        lastSoldAt,
      },
      years,
    };
  });

  const evidence = {
    targetCount: products.length,
    productsWithRecordedSales: products.filter((product) => product.hasRecordedSales).length,
    productsWithoutRecordedSales: products.filter((product) => !product.hasRecordedSales).length,
    products,
  };
  assertEvidenceSafe(evidence);
  return evidence;
}

export function assertEvidenceSafe(value) {
  if (Array.isArray(value)) {
    value.forEach(assertEvidenceSafe);
    return value;
  }
  if (!value || typeof value !== 'object') return value;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_EVIDENCE_KEYS.has(key)) {
      throw auditError('CATALOG_SALES_EVIDENCE_FORBIDDEN_FIELD', `Forbidden evidence field: ${key}`);
    }
    assertEvidenceSafe(child);
  }
  return value;
}
