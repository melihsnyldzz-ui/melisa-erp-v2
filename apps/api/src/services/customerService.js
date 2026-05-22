import sql from 'mssql';
import { getSqlPool } from '../config/database.js';
import { buildListMeta, maskPhone, parseListQuery } from './queryHelpers.js';

function toCustomerDto(row) {
  return {
    id: row.id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    phoneMasked: maskPhone(row.phone_raw),
    city: row.city,
    country: row.country,
    currency: row.currency_code,
    customerType: row.customer_type,
    balance: Number(row.balance || 0),
    isPassive: !row.is_active,
  };
}

export async function getCustomersList(query) {
  const options = parseListQuery(query);
  const pool = await getSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(120), options.search ? `%${options.search}%` : null)
    .input('activeOnly', sql.Bit, options.activeOnly)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_customers AS (
      SELECT
        c.id,
        c.customer_code,
        c.name AS customer_name,
        c.phone AS phone_raw,
        c.city,
        c.country,
        c.currency_code,
        c.customer_type,
        c.balance,
        c.is_active,
        c.created_at
      FROM dbo.customers c
      WHERE
        (@activeOnly = 0 OR c.is_active = 1)
        AND (
          @search IS NULL
          OR c.customer_code COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.phone COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.city COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.country COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR c.customer_type COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
        )
    ),
    numbered_customers AS (
      SELECT
        fc.id,
        fc.customer_code,
        fc.customer_name,
        fc.phone_raw,
        fc.city,
        fc.country,
        fc.currency_code,
        fc.customer_type,
        fc.balance,
        fc.is_active,
        fc.created_at,
        ROW_NUMBER() OVER (ORDER BY fc.id DESC) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_customers fc
    )
    SELECT
      TOP (${options.limit}) nc.*
    FROM numbered_customers nc
    WHERE nc.row_number > @offset
    ORDER BY nc.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toCustomerDto),
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
