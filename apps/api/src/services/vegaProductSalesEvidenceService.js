import sql from 'mssql/tedious.js';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';

const SOURCE = Object.freeze({ companyCode: 'F0102', periodCode: 'D0007', year: 2026 });
const CONTRACT_VERSION = 'vega-product-sales-evidence/v1';

function serviceError(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

export function normalizeProductSalesEvidenceQuery(query = {}, now = new Date()) {
  if (Object.keys(query).some((key) => !['sourceId', 'dateFrom', 'dateTo'].includes(key))) {
    throw serviceError('VEGA_SALES_EVIDENCE_QUERY_INVALID', 'Only sourceId, dateFrom and dateTo are accepted');
  }
  const id = query.sourceId;
  if (typeof id !== 'string' || !/^[1-9][0-9]{0,9}$/.test(id) || Number(id) > 2147483647) {
    throw serviceError('VEGA_SALES_EVIDENCE_ID_INVALID', 'sourceId must be one exact positive Vega integer identity');
  }
  for (const key of ['dateFrom', 'dateTo']) {
    const value = query[key];
    const parsed = typeof value === 'string' && /^2026-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw serviceError('VEGA_SALES_EVIDENCE_DATE_INVALID', 'Explicit valid YYYY-MM-DD dates within the 2026 source period are required');
    }
  }
  if (query.dateFrom > query.dateTo || query.dateTo > now.toISOString().slice(0, 10)) {
    throw serviceError('VEGA_SALES_EVIDENCE_RANGE_INVALID', 'Dates must be ordered and cannot extend beyond the current UTC calendar date');
  }
  return { sourceId: id, dateFrom: query.dateFrom, dateTo: query.dateTo };
}

// One complete aggregate over the exact product, without a ranking or row limit.
// Undated rows are examined as well so they cannot silently become absent sales.
export const PRODUCT_SALES_EVIDENCE_SQL = `
  SELECT
    product.IND AS source_id,
    CASE WHEN ISNULL(product.DELETED, 0) = 0 AND ISNULL(product.IPTAL, 0) = 0
      AND ISNULL(product.STATUS, 0) = 1 THEN 1 ELSE 0 END AS is_active,
    evidence.movement_row_count,
    evidence.sales_code_row_count,
    evidence.gross_outbound_row_count,
    evidence.gross_outbound_quantity,
    evidence.undated_movement_row_count,
    evidence.unclassified_outbound_row_count
  FROM dbo.F0102TBLSTOKLAR product
  OUTER APPLY (
    SELECT
      COUNT_BIG(CASE WHEN movement.TARIH IS NOT NULL THEN 1 END) AS movement_row_count,
      COUNT_BIG(CASE WHEN movement.TARIH IS NOT NULL
        AND LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33' THEN 1 END) AS sales_code_row_count,
      COUNT_BIG(CASE WHEN movement.TARIH IS NOT NULL
        AND LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33'
        AND movement.CIKAN > 0 THEN 1 END) AS gross_outbound_row_count,
      COALESCE(SUM(CASE WHEN movement.TARIH IS NOT NULL
        AND LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33'
        AND movement.CIKAN > 0 THEN CAST(movement.CIKAN AS decimal(28, 6)) ELSE 0 END), 0) AS gross_outbound_quantity,
      COUNT_BIG(CASE WHEN movement.TARIH IS NULL THEN 1 END) AS undated_movement_row_count,
      COUNT_BIG(CASE WHEN movement.TARIH IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(movement.IZAHAT)), N'') IS NULL
        AND (movement.CIKAN > 0 OR movement.CIKAN IS NULL) THEN 1 END) AS unclassified_outbound_row_count
    FROM dbo.F0102D0007TBLSTOKHAREKETLERI movement
    WHERE movement.STOKNO = product.IND
      AND ((movement.TARIH >= @dateFrom AND movement.TARIH < DATEADD(day, 1, @dateTo))
        OR movement.TARIH IS NULL)
  ) evidence
  WHERE product.IND = @sourceId;
`;

function nonnegativeNumber(value, integer = false) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER
    && (!integer || Number.isSafeInteger(number)) ? number : null;
}

export function toProductSalesEvidence(row, options, retrievedAt) {
  if (String(row?.source_id) !== options.sourceId) {
    throw serviceError('VEGA_SALES_EVIDENCE_RESULT_INVALID', 'Exact product evidence could not be verified', 503);
  }
  const counts = {
    movementRowCount: nonnegativeNumber(row.movement_row_count, true),
    salesCodeRowCount: nonnegativeNumber(row.sales_code_row_count, true),
    grossOutboundRowCount: nonnegativeNumber(row.gross_outbound_row_count, true),
    undatedMovementRowCount: nonnegativeNumber(row.undated_movement_row_count, true),
    unclassifiedOutboundRowCount: nonnegativeNumber(row.unclassified_outbound_row_count, true),
  };
  const grossOutboundQuantity = nonnegativeNumber(row.gross_outbound_quantity);
  if (Object.values(counts).some((value) => value === null) || grossOutboundQuantity === null
    || counts.salesCodeRowCount > counts.movementRowCount
    || counts.grossOutboundRowCount > counts.salesCodeRowCount
    || counts.unclassifiedOutboundRowCount > counts.movementRowCount
    || (counts.grossOutboundRowCount === 0 && grossOutboundQuantity !== 0)
    || (counts.grossOutboundRowCount > 0 && grossOutboundQuantity <= 0)
    || ![0, 1, false, true].includes(row.is_active)) {
    throw serviceError('VEGA_SALES_EVIDENCE_RESULT_INVALID', 'Complete movement evidence could not be verified', 503);
  }
  const active = Boolean(row.is_active);
  const hasSales = counts.grossOutboundRowCount > 0;
  const absence = active && counts.salesCodeRowCount === 0
    && counts.undatedMovementRowCount === 0 && counts.unclassifiedOutboundRowCount === 0;
  const state = !active ? 'INACTIVE' : hasSales ? 'HAS_SALES_MOVEMENT' : absence ? 'NO_SALES_IN_WINDOW' : 'INDETERMINATE';
  return {
    data: {
      sourceId: options.sourceId,
      active,
      state,
      noSalesInWindow: absence ? true : hasSales ? false : null,
      grossOutboundQuantity,
      ...counts,
    },
    meta: {
      source: 'vega-live-read-only',
      contractVersion: CONTRACT_VERSION,
      ...SOURCE,
      retrievedAt,
      scope: {
        ...options,
        movementSource: 'F0102D0007TBLSTOKHAREKETLERI',
        productSource: 'F0102TBLSTOKLAR',
        dateColumn: 'TARIH',
        dateBoundary: 'DATE_FROM_INCLUSIVE_DATE_TO_INCLUSIVE',
        dateSemantics: 'SOURCE_CALENDAR_DATE_NO_TIMEZONE_CONVERSION',
        aggregationComplete: true,
        coverage: 'ALL_MATCHING_ROWS_IN_SOURCE_QUERY',
        rowLimit: null,
        pagination: false,
        movementDefinition: 'IZAHAT_33_POSITIVE_CIKAN',
        undatedRowsExamined: true,
      },
      limitations: [
        'Absence applies only to recorded movement code 33 in the explicit company, period and dates; it is not lifetime or net-sales evidence.',
        'Source completeness, posting delays and finalized-document reconciliation are not independently certified by this aggregate.',
        'The current calendar day is observed only as of retrievedAt; an API failure or missing product is never zero sales.',
      ],
      writePerformed: false,
    },
  };
}

async function executeRead(options) {
  const pool = await getVegaSqlPool();
  return new sql.Request(pool)
    .input('sourceId', sql.Int, Number(options.sourceId))
    .input('dateFrom', sql.Date, options.dateFrom)
    .input('dateTo', sql.Date, options.dateTo)
    .query(PRODUCT_SALES_EVIDENCE_SQL);
}

export function createProductSalesEvidenceReader({ configuration = env.vega, execute = executeRead, now = () => new Date() } = {}) {
  return async (query) => {
    const options = normalizeProductSalesEvidenceQuery(query, now());
    if (configuration.companyCode !== SOURCE.companyCode || configuration.periodCode !== SOURCE.periodCode
      || configuration.year !== SOURCE.year || configuration.database !== 'VEGA2026') {
      throw serviceError('VEGA_SALES_EVIDENCE_SCOPE_UNSUPPORTED', 'Configured Vega source does not match the supported company and period', 503);
    }
    const result = await execute(options);
    if (!Array.isArray(result?.recordset)) {
      throw serviceError('VEGA_SALES_EVIDENCE_RESULT_INVALID', 'Complete movement evidence could not be verified', 503);
    }
    if (result.recordset.length === 0) {
      throw serviceError('VEGA_SALES_EVIDENCE_PRODUCT_NOT_FOUND', 'Exact Vega product was not found', 404);
    }
    if (result.recordset.length !== 1) {
      throw serviceError('VEGA_SALES_EVIDENCE_RESULT_INVALID', 'Exact product evidence could not be verified', 503);
    }
    return toProductSalesEvidence(result.recordset[0], options, now().toISOString());
  };
}

export const getVegaProductSalesEvidence = createProductSalesEvidenceReader();
