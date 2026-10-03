import sql from 'mssql/tedious.js';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';

// Only used while explicitly downloading the offline catalogue. Sending a sale
// never calls this adapter. Read cards without guessing omitted accounting fields.
export async function readOfflineCatalogCards(kind, ids) {
  if (env.vega.database !== 'VEGA2026' || env.vega.companyCode !== 'F0102' || env.vega.periodCode !== 'D0007'
    || !['product', 'customer'].includes(kind) || !Array.isArray(ids) || ids.length > 500
    || ids.some((id) => !Number.isSafeInteger(id) || id < 1 || id > 2147483647)) {
    throw new Error('TERMINAL_OFFLINE_CATALOG_SCOPE_INVALID');
  }
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const request = (await getVegaSqlPool()).request();
  const parameters = unique.map((id, index) => { request.input(`card${index}`, sql.Int, id); return `@card${index}`; }).join(',');
  const query = kind === 'customer'
    ? `SELECT IND AS id,FIRMAKODU AS code,FIRMAADI AS customerName,PARABIRIMI AS currency,
        STATUS AS status,DELETED AS deleted,SATISYAPILMASIN AS saleProhibited
       FROM dbo.F0102TBLCARI WHERE IND IN (${parameters})`
    : `SELECT s.IND AS stockId,u.STOKNO AS unitStockId,u.IND AS unitId,u.BARCODE AS barcode,u.BIRIMADI AS unit,
        CONVERT(varchar(64),u.CARPAN) AS factor,CONVERT(varchar(64),u.KDV) AS taxRate,
        CONVERT(varchar(64),u.SATISFIYATI1) AS price,u.PB1 AS currency,
        s.STATUS AS status,s.IPTAL AS cancelled,s.DELETED AS deleted,s.SIPARISALINMASIN AS saleProhibited,
        s.STOKKODU AS stockCode,s.MALINCINSI AS productName,CONVERT(varchar(64),s.REZERV) AS cardReserved
       FROM dbo.F0102TBLBIRIMLEREX u JOIN dbo.F0102TBLSTOKLAR s ON s.IND=u.STOKNO
       WHERE u.IND IN (${parameters})`;
  return (await request.query(query)).recordset;
}
