import { getSqlDriver, getSqlPool } from '../config/database.js';

async function hasCustomsSchema(pool) {
  const driver = getSqlDriver();
  const result = await new driver.Request(pool).query(`
    SELECT CASE WHEN OBJECT_ID(N'dbo.vega_product_customs', N'U') IS NULL THEN 0 ELSE 1 END AS is_ready;
  `);
  return Boolean(result.recordset?.[0]?.is_ready);
}

export async function getVegaProductCustomsMap(sourceIds = []) {
  const ids = [...new Set(sourceIds
    .map(Number)
    .filter((sourceId) => Number.isInteger(sourceId) && sourceId > 0))]
    .slice(0, 500);
  if (!ids.length) return new Map();

  const pool = await getSqlPool();
  if (!(await hasCustomsSchema(pool))) return new Map();

  const driver = getSqlDriver();
  const request = new driver.Request(pool);
  const parameters = ids.map((sourceId, index) => {
    request.input(`sourceId${index}`, driver.BigInt, sourceId);
    return `@sourceId${index}`;
  });
  const result = await request.query(`
    SELECT
      vega_source_id,
      gtip_code,
      classification_status,
      confidence,
      material_basis,
      classification_note,
      source_document_no,
      source_header_id,
      updated_at
    FROM dbo.vega_product_customs
    WHERE vega_source_id IN (${parameters.join(', ')});
  `);

  return new Map((result.recordset || []).map((row) => [Number(row.vega_source_id), {
    code: row.gtip_code || '',
    status: row.classification_status || 'draft',
    confidence: row.confidence || 'low',
    materialBasis: row.material_basis || '',
    note: row.classification_note || '',
    sourceDocumentNo: row.source_document_no || '',
    sourceHeaderId: row.source_header_id ? Number(row.source_header_id) : null,
    updatedAt: row.updated_at || null,
  }]));
}
