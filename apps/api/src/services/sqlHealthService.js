import { getSafeSqlInfo, getSqlPool } from '../config/database.js';

function sanitizeSqlError(error) {
  return {
    code: error.code || 'SQL_CONNECTION_FAILED',
    message: error.code === 'SQL_NOT_CONFIGURED'
      ? 'SQL connection is not configured'
      : 'SQL connection failed',
  };
}

function compactVersion(sqlVersion) {
  if (!sqlVersion) {
    return '';
  }

  return String(sqlVersion).split('\n')[0].trim();
}

export async function checkSqlHealth() {
  const startedAt = Date.now();

  try {
    const pool = await getSqlPool();
    const result = await pool.request().query(`
      SELECT
        DB_NAME() AS databaseName,
        @@VERSION AS sqlVersion
    `);
    const row = result.recordset[0] || {};

    return {
      connected: true,
      data: {
        connectionStatus: 'connected',
        databaseName: row.databaseName || null,
        sqlVersion: compactVersion(row.sqlVersion),
        durationMs: Date.now() - startedAt,
      },
      meta: {
        readOnly: getSafeSqlInfo().readOnly,
        source: 'sql-select-only',
      },
    };
  } catch (error) {
    return {
      connected: false,
      data: {
        connectionStatus: 'failed',
        databaseName: null,
        sqlVersion: null,
        durationMs: Date.now() - startedAt,
        config: getSafeSqlInfo(),
      },
      error: sanitizeSqlError(error),
      meta: {
        readOnly: getSafeSqlInfo().readOnly,
        source: 'sql-select-only',
      },
    };
  }
}

export async function getTablesPreview() {
  const startedAt = Date.now();

  try {
    const pool = await getSqlPool();
    const result = await pool.request().query(`
      SELECT TOP (20)
        TABLE_SCHEMA AS table_schema,
        TABLE_NAME AS table_name,
        TABLE_TYPE AS table_type
      FROM INFORMATION_SCHEMA.TABLES
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    return {
      connected: true,
      data: result.recordset,
      meta: {
        durationMs: Date.now() - startedAt,
        limit: 20,
        readOnly: getSafeSqlInfo().readOnly,
        source: 'information_schema.tables',
      },
    };
  } catch (error) {
    return {
      connected: false,
      data: [],
      error: sanitizeSqlError(error),
      meta: {
        durationMs: Date.now() - startedAt,
        limit: 20,
        readOnly: getSafeSqlInfo().readOnly,
        source: 'information_schema.tables',
      },
    };
  }
}
