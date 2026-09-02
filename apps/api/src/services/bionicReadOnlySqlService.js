import { getSafeSqlInfo, getSqlPool } from '../config/database.js';
import { env } from '../config/env.js';

const DENIED_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|MERGE|EXEC|EXECUTE|GRANT|REVOKE|DENY|DBCC|BACKUP|RESTORE|BULK|OPENROWSET|OPENDATASOURCE|INTO)\b/i;
const COMMENT_SQL = /(--|\/\*)/;

function normalizeIdentifier(value) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9_]+$/.test(text)) return null;
  return text;
}

export function validateReadOnlySql(sqlText) {
  const sql = String(sqlText || '').trim();
  if (!sql) return { ok: false, reason: 'SQL_REQUIRED' };
  if (sql.length > env.bionicReadOnly.maxQueryChars) return { ok: false, reason: 'SQL_TOO_LONG' };
  if (COMMENT_SQL.test(sql)) return { ok: false, reason: 'SQL_COMMENTS_NOT_ALLOWED' };

  const withoutTrailingSemicolon = sql.endsWith(';') ? sql.slice(0, -1).trim() : sql;
  if (withoutTrailingSemicolon.includes(';')) return { ok: false, reason: 'MULTI_STATEMENT_SQL_NOT_ALLOWED' };
  if (!/^(SELECT|WITH)\b/i.test(withoutTrailingSemicolon)) return { ok: false, reason: 'ONLY_SELECT_OR_CTE_ALLOWED' };
  if (DENIED_SQL.test(withoutTrailingSemicolon)) return { ok: false, reason: 'WRITE_OR_UNSAFE_SQL_BLOCKED' };

  return { ok: true, sql: withoutTrailingSemicolon };
}

export async function getBionicSqlHealth() {
  const pool = await getSqlPool();
  const result = await pool.request().query('SELECT DB_NAME() AS databaseName');
  return {
    databaseName: result.recordset?.[0]?.databaseName || null,
    readOnly: getSafeSqlInfo().readOnly,
    maxRows: env.bionicReadOnly.maxRows,
    queryTimeoutMs: env.bionicReadOnly.queryTimeoutMs,
  };
}

export async function listBionicTables({ schema, search, limit }) {
  const pool = await getSqlPool();
  const safeLimit = Math.min(env.bionicReadOnly.maxTables, Math.max(1, Number(limit) || 100));
  const request = pool.request();
  request.input('schema', schema ? String(schema) : null);
  request.input('search', search ? `%${String(search)}%` : null);

  const result = await request.query(`
    SELECT TOP (${safeLimit})
      TABLE_SCHEMA AS table_schema,
      TABLE_NAME AS table_name,
      TABLE_TYPE AS table_type
    FROM INFORMATION_SCHEMA.TABLES
    WHERE (@schema IS NULL OR TABLE_SCHEMA = @schema)
      AND (@search IS NULL OR TABLE_NAME LIKE @search)
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);

  return result.recordset;
}

export async function describeBionicTable(schemaName, tableName) {
  const schema = normalizeIdentifier(schemaName);
  const table = normalizeIdentifier(tableName);
  if (!schema || !table) {
    const error = new Error('Invalid schema or table identifier');
    error.code = 'INVALID_IDENTIFIER';
    throw error;
  }

  const pool = await getSqlPool();
  const request = pool.request();
  request.input('schema', schema);
  request.input('table', table);
  const result = await request.query(`
    SELECT
      COLUMN_NAME AS column_name,
      DATA_TYPE AS data_type,
      CHARACTER_MAXIMUM_LENGTH AS max_length,
      NUMERIC_PRECISION AS numeric_precision,
      NUMERIC_SCALE AS numeric_scale,
      IS_NULLABLE AS is_nullable,
      ORDINAL_POSITION AS ordinal_position
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
    ORDER BY ORDINAL_POSITION
  `);

  return { schema, table, columns: result.recordset };
}

export async function executeBionicReadOnlyQuery(sqlText) {
  const validation = validateReadOnlySql(sqlText);
  if (!validation.ok) {
    const error = new Error(validation.reason);
    error.code = validation.reason;
    throw error;
  }

  const pool = await getSqlPool();
  const request = pool.request();
  request.timeout = env.bionicReadOnly.queryTimeoutMs;
  const maxRows = env.bionicReadOnly.maxRows;
  const batch = `
    SET ROWCOUNT ${maxRows};
    BEGIN TRY
      ${validation.sql};
      SET ROWCOUNT 0;
    END TRY
    BEGIN CATCH
      SET ROWCOUNT 0;
      THROW;
    END CATCH;
  `;
  const startedAt = Date.now();
  const result = await request.query(batch);

  return {
    rows: Array.isArray(result.recordset) ? result.recordset.slice(0, maxRows) : [],
    rowCount: Array.isArray(result.recordset) ? Math.min(result.recordset.length, maxRows) : 0,
    maxRows,
    durationMs: Date.now() - startedAt,
    readOnly: true,
  };
}
