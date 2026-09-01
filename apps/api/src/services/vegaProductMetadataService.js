import sql from 'mssql/tedious.js';
import { createHash } from 'node:crypto';
import { getVegaSqlPool } from '../config/vegaDatabase.js';

const GROUPS = Object.freeze({
  identity: ['stock_code'],
  catalog: ['product_name', 'brand', 'special_code_2', 'special_code_3', 'category', 'special_code_5', 'special_code_6', 'special_code_7', 'special_code_8', 'special_code_9', 'special_code_10', 'special_code_11', 'special_code_12', 'special_code_13', 'special_code_14', 'special_code_15', 'special_code_16', 'special_code_17', 'special_code_18', 'special_code_19', 'special_code_20', 'special_code_21'],
  stock: ['stock_quantity', 'reserved_quantity', 'critical_level'],
  pricing: ['purchase_price_local', 'purchase_price_foreign', 'purchase_discount_rate'],
  status: ['status_code', 'cancelled', 'deleted'],
});

export async function getVegaProductMetadata(query = {}) {
  const offset = normalizeOffset(query.offset);
  const limit = normalizeLimit(query.limit);
  const stockCode = typeof query.stockCode === 'string' && query.stockCode.trim() ? query.stockCode.trim().slice(0, 120) : null;
  const pool = await getVegaSqlPool();
  const result = await pool.request()
    .input('vegaMetadataOffset', sql.Int, offset)
    .input('vegaMetadataLimit', sql.Int, limit)
    .input('vegaMetadataStockCode', sql.NVarChar(120), stockCode)
    .query(`
      SELECT s.IND AS source_id, s.STOKKODU AS stock_code, s.MALINCINSI AS product_name, s.KOD1 AS brand,
        s.KOD2 AS special_code_2, s.KOD3 AS special_code_3, s.KOD4 AS category, s.KOD5 AS special_code_5,
        s.KOD6 AS special_code_6, s.KOD7 AS special_code_7, s.KOD8 AS special_code_8, s.KOD9 AS special_code_9,
        s.KOD10 AS special_code_10, s.KOD11 AS special_code_11, s.KOD12 AS special_code_12, s.KOD13 AS special_code_13,
        s.KOD14 AS special_code_14, s.KOD15 AS special_code_15, s.KOD16 AS special_code_16, s.KOD17 AS special_code_17,
        s.KOD18 AS special_code_18, s.KOD19 AS special_code_19, s.KOD20 AS special_code_20, s.KOD21 AS special_code_21,
        s.KALAN AS stock_quantity, s.REZERV AS reserved_quantity, s.KRITIKSEVIYE AS critical_level,
        s.ALISFIYATI AS purchase_price_local, s.DALISFIYATI AS purchase_price_foreign, s.ALISISKORANI AS purchase_discount_rate,
        s.STATUS AS status_code, s.IPTAL AS cancelled, s.DELETED AS deleted
      FROM dbo.F0102TBLSTOKLAR s
      WHERE ISNULL(s.DELETED, 0) = 0
        AND (@vegaMetadataStockCode IS NULL OR s.STOKKODU = @vegaMetadataStockCode)
      ORDER BY s.IND ASC
      OFFSET @vegaMetadataOffset ROWS FETCH NEXT @vegaMetadataLimit ROWS ONLY;
    `);
  const data = (result.recordset || []).map(toVegaProductMetadataEvent).filter(Boolean);
  return { data, meta: { source: 'vega-stock-card-state-fingerprints', readOnly: true, valuesOmitted: true, offset, nextOffset: offset + data.length, hasMore: data.length === limit, limit } };
}

export function toVegaProductMetadataEvent(row = {}) {
  const entityId = Number(row.source_id);
  if (!Number.isSafeInteger(entityId) || entityId < 1) return null;
  const groupFingerprints = Object.fromEntries(Object.entries(GROUPS).map(([group, fields]) => [group, fingerprint(group, fields.map((field) => row[field]))]));
  const entityRef = `VEGA_PRODUCT-${createHash('sha256').update(`MELISA_ERP_V2|VEGA_PRODUCT|${entityId}`).digest('hex').slice(0, 16).toUpperCase()}`;
  return { entityRef, groupFingerprints, stateFingerprint: fingerprint('state', Object.values(groupFingerprints)) };
}

function fingerprint(group, values) { return createHash('sha256').update(`MELISA_ERP_V2|VEGA_PRODUCT|${group}|${JSON.stringify(values.map((value) => value ?? null))}`).digest('hex').slice(0, 32).toUpperCase(); }
function normalizeOffset(value) { const offset = Number(value); return Number.isSafeInteger(offset) && offset >= 0 ? Math.min(offset, 1000000) : 0; }
function normalizeLimit(value) { const limit = Number(value); return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 200) : 100; }
