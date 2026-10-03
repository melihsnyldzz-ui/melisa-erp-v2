import sql from 'mssql/tedious.js';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';

export const SALES_EVIDENCE_CONTRACT = 'vega-product-sales-evidence/v1';
const MOVEMENT_SOURCE = 'F0102D0007TBLSTOKHAREKETLERI';
const error = (code, statusCode = 400) => Object.assign(new Error(code), { code, statusCode });

export function normalizeSalesEvidenceQuery(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query) ||
      Object.keys(query).some(key => !['sourceId', 'dateFrom', 'dateTo'].includes(key))) {
    throw error('VEGA_SALES_EVIDENCE_INPUT_INVALID');
  }
  const { sourceId, dateFrom, dateTo } = query;
  if (typeof sourceId !== 'string' || !/^[1-9][0-9]{0,9}$/.test(sourceId) || Number(sourceId) > 2147483647) {
    throw error('VEGA_SALES_EVIDENCE_SOURCE_ID_INVALID');
  }
  for (const date of [dateFrom, dateTo]) {
    if (typeof date !== 'string' || !/^2026-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      throw error('VEGA_SALES_EVIDENCE_DATE_INVALID');
    }
  }
  if (dateFrom > dateTo) throw error('VEGA_SALES_EVIDENCE_DATE_RANGE_INVALID');
  return { sourceId, dateFrom, dateTo };
}

// One exact stock and one inclusive date window. Undated rows are also examined:
// their presence must never become false proof of no sales in the dated window.
// No TOP, pagination, price, customer join, document ID or business write.
export const PRODUCT_SALES_EVIDENCE_SQL = `
  SELECT DB_NAME() AS source_database, product.IND AS source_id,
    CAST(CASE WHEN ISNULL(product.STATUS, 0) = 1 THEN 1 ELSE 0 END AS bit) AS active,
    evidence.*
  FROM dbo.F0102TBLSTOKLAR product
  OUTER APPLY (
    SELECT COUNT_BIG(*) AS movementRowCount,
      COALESCE(SUM(CONVERT(bigint, CASE WHEN movement.TARIH IS NOT NULL AND
        LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33' THEN 1 ELSE 0 END)), 0) AS salesCodeRowCount,
      COALESCE(SUM(CONVERT(bigint, CASE WHEN movement.TARIH IS NOT NULL AND
        LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33' AND movement.CIKAN > 0 THEN 1 ELSE 0 END)), 0) AS grossOutboundRowCount,
      COALESCE(SUM(CASE WHEN movement.TARIH IS NOT NULL AND
        LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33' AND movement.CIKAN > 0
        THEN CONVERT(decimal(28, 6), movement.CIKAN) ELSE CONVERT(decimal(28, 6), 0) END), 0) AS grossOutboundQuantity,
      COALESCE(SUM(CONVERT(bigint, CASE WHEN movement.TARIH IS NULL THEN 1 ELSE 0 END)), 0) AS undatedMovementRowCount,
      COALESCE(SUM(CONVERT(bigint, CASE WHEN movement.TARIH IS NOT NULL AND movement.CIKAN > 0 AND
        LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) <> N'33' THEN 1 ELSE 0 END)), 0) AS unclassifiedOutboundRowCount,
      MIN(CASE WHEN movement.TARIH IS NOT NULL AND LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33'
        AND movement.CIKAN > 0 THEN CONVERT(date, movement.TARIH) END) AS firstSoldAt,
      MAX(CASE WHEN movement.TARIH IS NOT NULL AND LTRIM(RTRIM(ISNULL(movement.IZAHAT, N''))) = N'33'
        AND movement.CIKAN > 0 THEN CONVERT(date, movement.TARIH) END) AS lastSoldAt
    FROM dbo.F0102D0007TBLSTOKHAREKETLERI movement
    WHERE movement.STOKNO = product.IND
      AND ((movement.TARIH >= @dateFrom AND movement.TARIH < DATEADD(day, 1, @dateTo)) OR movement.TARIH IS NULL)
  ) evidence
  WHERE product.IND = @sourceId;
`;

const metricKeys = ['movementRowCount', 'salesCodeRowCount', 'grossOutboundRowCount',
  'grossOutboundQuantity', 'undatedMovementRowCount', 'unclassifiedOutboundRowCount'];

function datedEvidence(value, scope) {
  if (value == null) return null;
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (!/^2026-\d{2}-\d{2}$/.test(date) || date < scope.dateFrom || date > scope.dateTo ||
      !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw error('VEGA_SALES_EVIDENCE_RESULT_INVALID', 502);
  }
  return date;
}

// Dependencies are replaceable for isolated unit tests; production always uses
// the existing Vega read-only pool and fixed company/period configuration.
// pool.request() follows node-mssql's mutable global driver. The ERP also loads
// msnodesqlv8 for its local database, so always pin requests to the Vega driver.
export const createSalesEvidenceRequest = pool => new sql.Request(pool);
export function createProductSalesEvidenceService({ getPool = getVegaSqlPool, requestFactory = createSalesEvidenceRequest, config = env.vega, now = () => new Date() } = {}) {
  return async function getEvidence(query) {
    const input = normalizeSalesEvidenceQuery(query);
    if (!config.enabled || config.database !== 'VEGA2026' || config.companyCode !== 'F0102' ||
        config.periodCode !== 'D0007' || config.year !== 2026) throw error('VEGA_SALES_EVIDENCE_UNAVAILABLE', 404);
    let result;
    try {
      const pool = await getPool();
      result = await requestFactory(pool).input('sourceId', sql.Int, Number(input.sourceId))
        .input('dateFrom', sql.Date, new Date(`${input.dateFrom}T00:00:00Z`))
        .input('dateTo', sql.Date, new Date(`${input.dateTo}T00:00:00Z`))
        .query(PRODUCT_SALES_EVIDENCE_SQL);
    } catch {
      // Connection, permissions and missing table failures are unavailable,
      // never an empty sales result. Do not leak driver/connection messages.
      throw error('VEGA_SALES_EVIDENCE_UNAVAILABLE', 404);
    }
    if (!Array.isArray(result?.recordset)) throw error('VEGA_SALES_EVIDENCE_RESULT_INVALID', 502);
    if (result.recordset.length === 0) throw error('VEGA_SALES_EVIDENCE_SOURCE_NOT_FOUND', 404);
    const [row] = result.recordset;
    if (result.recordset.length !== 1 || row.source_database !== 'VEGA2026' || String(row.source_id) !== input.sourceId ||
        ![true, false, 0, 1].includes(row.active)) throw error('VEGA_SALES_EVIDENCE_RESULT_INVALID', 502);
    const metrics = {};
    for (const key of metricKeys) {
      const raw = row[key];
      // Tedious returns SQL bigint as decimal strings; never coerce null/empty
      // to zero or silently round an unsafe count.
      const value = typeof raw === 'string' && /^[0-9]+(?:\.[0-9]+)?$/.test(raw) ? Number(raw) : raw;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
          (key !== 'grossOutboundQuantity' && !Number.isSafeInteger(value))) throw error('VEGA_SALES_EVIDENCE_RESULT_INVALID', 502);
      metrics[key] = value;
    }
    const { movementRowCount, salesCodeRowCount, grossOutboundRowCount, grossOutboundQuantity, undatedMovementRowCount, unclassifiedOutboundRowCount } = metrics;
    if (salesCodeRowCount + undatedMovementRowCount + unclassifiedOutboundRowCount > movementRowCount ||
        grossOutboundRowCount > salesCodeRowCount || (grossOutboundRowCount === 0) !== (grossOutboundQuantity === 0)) {
      throw error('VEGA_SALES_EVIDENCE_RESULT_INVALID', 502);
    }
    const firstSoldAt = datedEvidence(row.firstSoldAt, input), lastSoldAt = datedEvidence(row.lastSoldAt, input);
    if (grossOutboundRowCount > 0 ? (!firstSoldAt || !lastSoldAt || firstSoldAt > lastSoldAt) : (firstSoldAt !== null || lastSoldAt !== null)) {
      throw error('VEGA_SALES_EVIDENCE_RESULT_INVALID', 502);
    }
    // A zero positive-sale count is insufficient if codes/undated movements
    // leave uncertainty. Keep this explicitly blocked for discovery consumers.
    const noSalesInWindow = metricKeys.filter(k => k !== 'movementRowCount').every(k => metrics[k] === 0);
    const state = grossOutboundRowCount > 0 ? 'SALES_FOUND' : noSalesInWindow ? 'NO_SALES_IN_WINDOW' : 'INDETERMINATE';
    const scope = { ...input, companyCode: 'F0102', periodCode: 'D0007', year: 2026,
      movementSource: MOVEMENT_SOURCE, dateBoundary: 'DATE_FROM_INCLUSIVE_DATE_TO_INCLUSIVE',
      aggregationComplete: true, coverage: 'ALL_MATCHING_ROWS_IN_SOURCE_QUERY', rowLimit: null,
      pagination: false, undatedRowsExamined: true, movementDefinition: 'IZAHAT_33_POSITIVE_CIKAN' };
    return {
      data: { sourceId: input.sourceId, active: Boolean(row.active), state, noSalesInWindow,
        salesCount: grossOutboundRowCount, ...metrics, firstSoldAt, lastSoldAt,
        ...(state === 'INDETERMINATE' ? { reason: 'SALES_MOVEMENT_CLASSIFICATION_INCOMPLETE' } : {}) },
      meta: { source: 'vega-live-read-only', contractVersion: SALES_EVIDENCE_CONTRACT,
        companyCode: 'F0102', periodCode: 'D0007', year: 2026, database: 'VEGA2026',
        retrievedAt: now().toISOString(), readOnly: true, writePerformed: false, scope },
    };
  };
}

export const getVegaProductSalesEvidence = createProductSalesEvidenceService();
