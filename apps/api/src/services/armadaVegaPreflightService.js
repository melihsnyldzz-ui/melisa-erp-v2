import sql from 'mssql/tedious.js';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';

export async function readArmadaVegaPreflight(documentNumber) {
  if (env.vega.companyCode !== 'F0102' || env.vega.periodCode !== 'D0007'
    || !/^(?:[A-Z]{2,8}\d{1,12}|MELISA-[A-Z]{18}-0001)$/.test(documentNumber || '')) throw new Error('ARMADA_PREFLIGHT_SCOPE_INVALID');
  const pool = await getVegaSqlPool();
  const result = await pool.request().input('documentNumber', sql.NVarChar(30), documentNumber).query(`
    SELECT IND AS id, FIRMAKODU AS code, PARABIRIMI AS currency,
      STATUS AS status, DELETED AS deleted, SATISYAPILMASIN AS saleProhibited
    FROM dbo.F0102TBLCARI WHERE IND=102;
    SELECT s.IND AS stockId, s.STOKKODU AS stockCode, s.STATUS AS status,
      s.IPTAL AS cancelled, s.DELETED AS deleted, s.SIPARISALINMASIN AS saleProhibited,
      CONVERT(varchar(64), s.REZERV) AS cardReserved,
      u.IND AS unitId, u.STOKNO AS unitStockId, u.BARCODE AS barcode, u.BIRIMADI AS unit,
      CONVERT(varchar(64),u.CARPAN) AS factor, CONVERT(varchar(64),u.SATISFIYATI1) AS price,
      u.PB1 AS currency, CONVERT(varchar(64),u.KDV) AS taxRate
    FROM dbo.F0102TBLSTOKLAR s INNER JOIN dbo.F0102TBLBIRIMLEREX u ON u.STOKNO=s.IND
    WHERE s.IND=161383 AND u.IND=160452;
    SELECT COUNT_BIG(*) AS recordCount, CONVERT(varchar(64),SUM(ENVANTER)) AS quantity
    FROM dbo.F0102D0007TBLDEPOENVANTER WHERE STOKNO=161383 AND DEPO=1;
    SELECT COUNT_BIG(*) AS recordCount, CONVERT(varchar(64),SUM(GIREN-CIKAN)) AS quantity
    FROM dbo.F0102D0007TBLREZERVHAREKETLERI WHERE STOKNO=161383 AND DEPO=1;
    SELECT TOP (2) IND AS id FROM dbo.F0102D0007TBLSTKCIKBASLIK WHERE BELGENO=@documentNumber;
  `);
  return { database: 'VEGA2026', company: 'F0102', period: 'D0007', recordsets: result.recordsets,
    readAt: new Date().toISOString() };
}
