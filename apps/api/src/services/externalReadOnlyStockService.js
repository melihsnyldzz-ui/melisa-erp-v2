import { getVegaProductsList } from './vegaProductService.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';
import { env } from '../config/env.js';
import { getBionicStockCodeCount, listBionicStockCodes, getBionicStockByCode } from './bionicReadOnlySqlService.js';

function problem(code, statusCode) { return Object.assign(new Error(code), { code, statusCode }); }
/** @param {unknown} [value] */
export function externalStockSource(value = 'vega') {
  if (typeof value !== 'string' || !['vega', 'melisa'].includes(value.trim().toLowerCase())) throw problem('STOCK_SOURCE_INVALID', 400);
  return value.trim().toLowerCase();
}
export function createExternalStockReader({ vegaList = getVegaProductsList, vegaPool = getVegaSqlPool,
  melisaCount = getBionicStockCodeCount, melisaList = listBionicStockCodes, melisaByCode = getBionicStockByCode,
  config = { database: env.vega.database, companyCode: env.vega.companyCode, periodCode: env.vega.periodCode } } = {}) {
  const scope = () => {
    if (config.database !== 'VEGA2026' || config.companyCode !== 'F0102' || config.periodCode !== 'D0007') throw problem('STOCK_SOURCE_SCOPE_UNSUPPORTED', 503);
    return { source: 'vega', database: config.database, companyCode: config.companyCode, periodCode: config.periodCode, readOnly: true };
  };
  const read = async query => {
    scope();
    const response = await vegaList(query);
    if (response.meta?.source !== 'vega-live-read-only' || !Array.isArray(response.data)
      || response.data.some(row => row.source !== 'vega' || !Number.isSafeInteger(row.sourceId) || row.sourceId <= 0)) throw problem('STOCK_SOURCE_RESPONSE_INVALID', 502);
    return response.data;
  };
  return {
    async count(source) {
      if (externalStockSource(source) === 'melisa') return melisaCount();
      const context = scope(), pool = await vegaPool();
      const result = await pool.request().query(`SELECT COUNT(DISTINCT NULLIF(LTRIM(RTRIM(STOKKODU)), '')) AS stockCodeCount,
        COUNT_BIG(*) AS nonDeletedProductCount,
        SUM(CASE WHEN ISNULL(IPTAL, 0) = 0 AND ISNULL(STATUS, 0) = 1 THEN CAST(1 AS bigint) ELSE 0 END) AS activeProductCount
        FROM dbo.F0102TBLSTOKLAR WHERE ISNULL(DELETED, 0) = 0`);
      const row = result.recordset?.[0];
      if (!row) throw problem('STOCK_SOURCE_RESPONSE_INVALID', 502);
      const count = key => { if (row[key] == null && key !== 'activeProductCount') throw problem('STOCK_SOURCE_RESPONSE_INVALID', 502);
        const value = row[key] === null && key === 'activeProductCount' ? 0 : Number(row[key]);
        if (!Number.isSafeInteger(value) || value < 0) throw problem('STOCK_SOURCE_RESPONSE_INVALID', 502); return value; };
      return { ...context, stockCodeCount: count('stockCodeCount'), nonDeletedProductCount: count('nonDeletedProductCount'),
        activeProductCount: count('activeProductCount'), productRowCount: count('nonDeletedProductCount') };
    },
    async list(source, { search = '', limit = 50 } = {}) {
      const bounded = Math.min(250, Math.max(1, Math.floor(Number(limit) || 50)));
      if (externalStockSource(source) === 'melisa') return melisaList({ search, limit: bounded });
      return read({ search, page: 1, limit: bounded, activeOnly: true });
    },
    async byCode(source, value) {
      if (externalStockSource(source) === 'melisa') return melisaByCode(value);
      const code = String(value || '').trim();
      if (!code || code.length > 120) throw problem('INVALID_STOCK_CODE', 400);
      const rows = await read({ stockCodes: [code], page: 1, limit: 2, activeOnly: true });
      if (rows.some(row => String(row.stockCode).trim() !== code)) throw problem('STOCK_SOURCE_RESPONSE_INVALID', 502);
      if (rows.length > 1) throw problem('STOCK_CODE_AMBIGUOUS', 409);
      return rows[0] || null;
    },
  };
}
export const externalStockReader = createExternalStockReader();
