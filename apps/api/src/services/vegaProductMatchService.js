import { getVegaSqlPool } from '../config/vegaDatabase.js';

export async function getVegaProductMatchIndex() {
  const pool = await getVegaSqlPool();
  const result = await pool.request().query(`
    SELECT
      s.IND AS source_id,
      LTRIM(RTRIM(s.STOKKODU)) AS stock_code,
      LTRIM(RTRIM(s.MALINCINSI)) AS product_name,
      LTRIM(RTRIM(ISNULL(s.KOD1, ''))) AS brand
    FROM dbo.F0102TBLSTOKLAR s
    WHERE ISNULL(s.DELETED, 0) = 0
      AND ISNULL(s.IPTAL, 0) = 0
      AND ISNULL(s.STATUS, 0) = 1
    ORDER BY s.IND ASC;
  `);

  return (result.recordset || []).map((row) => ({
    sourceId: Number(row.source_id),
    stockCode: String(row.stock_code || '').trim(),
    productName: String(row.product_name || '').trim(),
    brand: String(row.brand || '').trim(),
  }));
}
