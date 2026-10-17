import sql from 'mssql/tedious.js';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';

export async function readDailyPreflight(intent, documentNumber) {
  if (env.vega.companyCode !== 'F0102' || env.vega.periodCode !== 'D0007'
    || intent?.company !== 'F0102' || intent.period !== 'D0007' || !/^MELISA-[A-Z]{18}-0001$/.test(documentNumber || '')
    || !Number.isInteger(intent.customerId) || !Array.isArray(intent.items) || !intent.items.length || intent.items.length > 100) throw new Error('ARMADA_PREFLIGHT_SCOPE_INVALID');
  const ids = [...new Set(intent.items.map((i) => i.unitId))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1 || id > 2147483647)) throw new Error('ARMADA_UNIT_ID_INVALID');
  const pool = await getVegaSqlPool(), request = pool.request();
  request.input('customerId', sql.Int, intent.customerId).input('documentNumber', sql.NVarChar(30), documentNumber);
  const params = ids.map((id, index) => { request.input(`unit${index}`, sql.Int, id); return `@unit${index}`; }).join(',');
  const stockScope = `SELECT DISTINCT STOKNO FROM dbo.F0102TBLBIRIMLEREX WHERE IND IN (${params})`;
  const result = await request.query(`
    SELECT IND AS id,FIRMAKODU AS code,FIRMAADI AS customerName,PARABIRIMI AS currency,STATUS AS status,DELETED AS deleted,SATISYAPILMASIN AS saleProhibited
    FROM dbo.F0102TBLCARI WHERE IND=@customerId;
    SELECT s.IND AS stockId,s.STOKKODU AS stockCode,s.MALINCINSI AS productName,s.STATUS AS status,s.IPTAL AS cancelled,s.DELETED AS deleted,s.SIPARISALINMASIN AS saleProhibited,
      CONVERT(varchar(64),s.REZERV) AS cardReserved,u.IND AS unitId,u.STOKNO AS unitStockId,u.BARCODE AS barcode,u.BIRIMADI AS unit,
      CONVERT(varchar(64),u.CARPAN) AS factor,CONVERT(varchar(64),u.SATISFIYATI1) AS price,u.PB1 AS currency,CONVERT(varchar(64),u.KDV) AS taxRate
    FROM dbo.F0102TBLBIRIMLEREX u JOIN dbo.F0102TBLSTOKLAR s ON s.IND=u.STOKNO WHERE u.IND IN (${params});
    SELECT s.IND AS stockId,CONVERT(varchar(64),COALESCE(SUM(d.ENVANTER),0)) AS quantity
    FROM dbo.F0102TBLSTOKLAR s LEFT JOIN dbo.F0102D0007TBLDEPOENVANTER d ON d.STOKNO=s.IND AND d.DEPO=1
    WHERE s.IND IN (${stockScope}) GROUP BY s.IND;
    SELECT s.IND AS stockId,CONVERT(varchar(64),COALESCE(SUM(r.GIREN-r.CIKAN),0)) AS quantity
    FROM dbo.F0102TBLSTOKLAR s LEFT JOIN dbo.F0102D0007TBLREZERVHAREKETLERI r ON r.STOKNO=s.IND AND r.DEPO=1
    WHERE s.IND IN (${stockScope}) GROUP BY s.IND;
    SELECT TOP(2) IND AS id FROM dbo.F0102D0007TBLSTKCIKBASLIK WHERE BELGENO=@documentNumber;
  `);
  return { database: 'VEGA2026', company: 'F0102', period: 'D0007', recordsets: result.recordsets, readAt: new Date().toISOString() };
}
