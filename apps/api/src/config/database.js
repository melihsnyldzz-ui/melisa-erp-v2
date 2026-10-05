import sqlDefault from 'mssql';
import sqlTrusted from 'mssql/msnodesqlv8.js';
import { env } from './env.js';

let poolPromise;

// The isolated canonical TEST uses the same ODBC family as the LIVE baseline.
// Only the verified TEST runtime can select these two isolated SQL identities.
export function isCanonicalTest() {
  return process.env.MELISA_CANONICAL_TEST === 'true'
    && env.sql.database === 'MELISA_ERP_SIRKET_TEST_20260929_01'
    && ((env.sql.user === 'melisa_sirket_test_20260929_01' && env.sql.readOnly === true)
      || (env.sql.user === 'melisa_sirket_sales_test_20260929_01' && env.sql.readOnly === false
        && process.env.MELISA_TEST_SCOPED_SALES === 'true'));
}

export function getSqlDriver() {
  if (env.sql.database === 'MELISA_ERP_PROD_CANDIDATE_20260917_01' || isCanonicalTest()) return sqlTrusted;
  return env.sql.trustedConnection ? sqlTrusted : sqlDefault;
}

export function getSqlConfig() {
  if ((env.sql.database === 'MELISA_ERP_PROD_CANDIDATE_20260917_01' || isCanonicalTest()) && !env.sql.trustedConnection) {
    const driver = env.sql.odbcDriver.replace(/[{}]/g, '');
    const server = env.sql.port ? `${env.sql.server},${env.sql.port}` : env.sql.server;
    return {
      connectionString: [
        `Driver={${driver}}`, `Server=${server}`, `Database=${env.sql.database}`,
        `UID=${env.sql.user}`, `PWD=${env.sql.password}`, 'Trusted_Connection=No',
        env.sql.trustServerCertificate ? 'TrustServerCertificate=Yes' : 'TrustServerCertificate=No',
        env.sql.encrypt ? 'Encrypt=Yes' : 'Encrypt=No',
      ].join(';'),
      connectionTimeout: 10000, requestTimeout: 10000,
      ...(isCanonicalTest() && env.port === 4144 && env.sql.readOnly === false
        ? {pool: {max: 10, min: 1, idleTimeoutMillis: 30000}} : {}),
    };
  }
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

  if (!env.sql.readOnly && env.sql.database !== 'MELISA_ERP_PROD_CANDIDATE_20260917_01' && !isCanonicalTest()) {
    const error = new Error('SQL write mode is only allowed for the LIVE-3 production candidate');
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
