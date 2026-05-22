import sql from 'mssql';
import { getSqlPool } from '../config/database.js';
import { buildListMeta, maskValue, parseListQuery } from './queryHelpers.js';

function toProductDto(row) {
  return {
    id: row.id,
    stockCode: row.stock_code,
    barcodeMasked: maskValue(row.barcode_raw, 3, 2),
    productName: row.product_name,
    brand: row.brand,
    category: row.category,
    currency: row.currency_code,
    salePrice: Number(row.sale_price || 0),
    purchasePrice: Number(row.purchase_price || 0),
    stockQuantity: Number(row.stock_quantity || 0),
    isPassive: !row.is_active,
  };
}

export async function getProductsList(query) {
  const options = parseListQuery(query);
  const pool = await getSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(120), options.search ? `%${options.search}%` : null)
    .input('activeOnly', sql.Bit, options.activeOnly)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_products AS (
      SELECT
        p.id,
        p.stock_code,
        pb.barcode AS barcode_raw,
        p.name AS product_name,
        p.brand,
        p.category,
        p.currency_code,
        p.sales_price AS sale_price,
        p.purchase_price,
        p.current_stock_qty AS stock_quantity,
        p.is_active,
        p.created_at
      FROM dbo.products p
      OUTER APPLY (
        SELECT TOP (1) b.barcode
        FROM dbo.product_barcodes b
        WHERE b.product_id = p.id
          AND b.is_active = 1
        ORDER BY b.is_primary DESC, b.id ASC
      ) pb
      WHERE
        (@activeOnly = 0 OR p.is_active = 1)
        AND (
          @search IS NULL
          OR p.stock_code LIKE @search
          OR p.name LIKE @search
          OR p.brand LIKE @search
          OR p.category LIKE @search
          OR pb.barcode LIKE @search
        )
    ),
    numbered_products AS (
      SELECT
        fp.id,
        fp.stock_code,
        fp.barcode_raw,
        fp.product_name,
        fp.brand,
        fp.category,
        fp.currency_code,
        fp.sale_price,
        fp.purchase_price,
        fp.stock_quantity,
        fp.is_active,
        fp.created_at,
        ROW_NUMBER() OVER (ORDER BY fp.id DESC) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_products fp
    )
    SELECT
      TOP (${options.limit}) np.*
    FROM numbered_products np
    WHERE np.row_number > @offset
    ORDER BY np.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toProductDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'sql-select-only',
      filters: {
        search: options.search || null,
        activeOnly: options.activeOnly,
      },
    }),
  };
}
