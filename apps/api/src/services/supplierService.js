import sql from 'mssql';
import { getSqlPool } from '../config/database.js';
import { buildListMeta, maskPhone, parseListQuery } from './queryHelpers.js';

function toSupplierDto(row) {
  return {
    id: row.id,
    supplierCode: row.supplier_code,
    supplierName: row.supplier_name,
    phoneMasked: maskPhone(row.phone_raw),
    city: row.city,
    country: row.country,
    currency: row.currency_code,
    balance: Number(row.balance || 0),
    isPassive: !row.is_active,
  };
}

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export async function getSuppliersList(query) {
  const options = parseListQuery(query);
  const pool = await getSqlPool();
  const request = pool.request()
    .input('search', sql.NVarChar(120), options.search ? `%${options.search}%` : null)
    .input('activeOnly', sql.Bit, options.activeOnly)
    .input('offset', sql.Int, options.offset);

  const result = await request.query(`
    WITH filtered_suppliers AS (
      SELECT
        s.id,
        s.supplier_code,
        s.name AS supplier_name,
        s.phone AS phone_raw,
        s.city,
        s.country,
        s.currency_code,
        s.balance,
        s.is_active,
        s.created_at
      FROM dbo.suppliers s
      WHERE
        s.is_deleted = 0
        AND (@activeOnly = 0 OR s.is_active = 1)
        AND (
          @search IS NULL
          OR s.supplier_code COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR s.name COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR s.phone COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR s.city COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
          OR s.country COLLATE Latin1_General_CI_AI LIKE @search COLLATE Latin1_General_CI_AI
        )
    ),
    numbered_suppliers AS (
      SELECT
        fs.id,
        fs.supplier_code,
        fs.supplier_name,
        fs.phone_raw,
        fs.city,
        fs.country,
        fs.currency_code,
        fs.balance,
        fs.is_active,
        fs.created_at,
        ROW_NUMBER() OVER (ORDER BY fs.id DESC) AS row_number,
        COUNT_BIG(1) OVER () AS total_count
      FROM filtered_suppliers fs
    )
    SELECT
      TOP (${options.limit}) ns.*
    FROM numbered_suppliers ns
    WHERE ns.row_number > @offset
    ORDER BY ns.row_number ASC;
  `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toSupplierDto),
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

export async function getSupplierDetail(supplierId) {
  const id = Number(supplierId);

  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('SUPPLIER_ID_INVALID', 'Supplier id is invalid');
  }

  const pool = await getSqlPool();
  const request = pool.request()
    .input('id', sql.BigInt, id);

  const result = await request.query(`
    SELECT TOP (1)
      s.id,
      s.supplier_code,
      s.name AS supplier_name,
      s.phone AS phone_raw,
      s.city,
      s.country,
      s.currency_code,
      s.balance,
      s.is_active
    FROM dbo.suppliers s
    WHERE s.id = @id
      AND s.is_deleted = 0;
  `);

  const supplier = result.recordset?.[0];

  if (!supplier) {
    throw makeServiceError('SUPPLIER_NOT_FOUND', 'Supplier not found', 404);
  }

  return toSupplierDto(supplier);
}
