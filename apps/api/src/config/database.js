import sqlDefault from 'mssql';
import { env } from './env.js';

const selectedSqlDriver = env.sql.trustedConnection
  ? (await import('./safeTrustedSqlDriver.js')).safeTrustedSqlDriver
  : sqlDefault;

let poolPromise;

export function getSqlDriver() {
  return selectedSqlDriver;
}

export function getSqlConfig() {
  if (env.sql.trustedConnection) {
    const driver = env.sql.odbcDriver.replace(/[{}]/g, '');
    const server = env.sql.port ? `${env.sql.server},${env.sql.port}` : env.sql.server;

    return {
      connectionString: [
        `Driver={${driver}}`,
        `Server=${server}`,
        `Database=${env.sql.database}`,
        'Trusted_Connection=Yes',
        env.sql.trustServerCertificate ? 'TrustServerCertificate=Yes' : 'TrustServerCertificate=No',
        env.sql.encrypt ? 'Encrypt=Yes' : 'Encrypt=No',
      ].join(';'),
      connectionTimeout: 10000,
      requestTimeout: 10000,
    };
  }

  const config = {
    server: env.sql.server,
    database: env.sql.database,
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

  if (env.sql.port) {
    config.port = env.sql.port;
  }

  config.user = env.sql.user;
  config.password = env.sql.password;
  return config;
}

export function getSafeSqlInfo() {
  return {
    enabled: env.sql.enabled,
    serverConfigured: Boolean(env.sql.server),
    portConfigured: Boolean(env.sql.port),
    databaseConfigured: Boolean(env.sql.database),
    odbcDriverConfigured: Boolean(env.sql.odbcDriver),
    encrypt: env.sql.encrypt,
    trustServerCertificate: env.sql.trustServerCertificate,
    trustedConnection: env.sql.trustedConnection,
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

  if (!env.sql.readOnly && env.sql.database !== 'MELISA_ERP_V2') {
    const error = new Error('SQL write mode is only allowed for MELISA_ERP_V2');
    error.code = 'SQL_WRITE_TARGET_INVALID';
    error.statusCode = 403;
    throw error;
  }

  if (!poolPromise) {
    const sql = getSqlDriver();
    const pool = new sql.ConnectionPool(getSqlConfig());
    poolPromise = pool.connect().catch((error) => {
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
