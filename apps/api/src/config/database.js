import sql from 'mssql';
import { env } from './env.js';

let poolPromise;

export function getSqlConfig() {
  return {
    server: env.sql.server,
    port: env.sql.port,
    database: env.sql.database,
    user: env.sql.user,
    password: env.sql.password,
    options: {
      encrypt: env.sql.encrypt,
      trustServerCertificate: env.sql.trustServerCertificate,
      readOnlyIntent: env.sql.readOnly,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 10000,
    connectionTimeout: 10000,
  };
}

export function getSafeSqlInfo() {
  return {
    enabled: env.sql.enabled,
    serverConfigured: Boolean(env.sql.server),
    portConfigured: Boolean(env.sql.port),
    databaseConfigured: Boolean(env.sql.database),
    encrypt: env.sql.encrypt,
    trustServerCertificate: env.sql.trustServerCertificate,
    readOnly: env.sql.readOnly,
  };
}

export async function getSqlPool() {
  if (!env.sql.enabled) {
    const error = new Error('SQL connection is not configured');
    error.code = 'SQL_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  if (!env.sql.readOnly) {
    const error = new Error('SQL_READ_ONLY must remain true for this API foundation');
    error.code = 'SQL_READ_ONLY_REQUIRED';
    error.statusCode = 503;
    throw error;
  }

  if (!poolPromise) {
    poolPromise = sql.connect(getSqlConfig()).catch((error) => {
      poolPromise = undefined;
      throw error;
    });
  }

  return poolPromise;
}

export async function closeSqlPool() {
  if (poolPromise) {
    const pool = await poolPromise;
    poolPromise = undefined;
    await pool.close();
  }
}
