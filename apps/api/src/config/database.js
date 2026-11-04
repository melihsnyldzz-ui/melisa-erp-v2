import sqlDefault from 'mssql';
import { env } from './env.js';
import {isIsolatedOperationCopyRuntime,getIsolatedOperationCopyConfig,isIsolatedCopyReadonlyRuntime,getIsolatedCopyReadonlyRuntime} from './isolatedOperationCopyRuntime.mjs';
import {getCrmOrderCurrentContext,assertCrmOrderCurrentIdentity} from '../services/crmOrderCurrentContext.mjs';
import {getCleanContext,assertRegisteredCleanContext,assertCleanIdentity,CLEAN_IDENTITY_SQL} from '../services/cleanSyntheticContext.mjs';
// A proven CRM draft process has no ERP operation-copy authority and its
// package intentionally excludes the ERP-only SQL compiler dependency graph.
const isolatedCopyTopology=getCrmOrderCurrentContext()?null:(await import('../services/isolatedOperationCopyContext.mjs')).isolatedCopyTopology;
export {isIsolatedOperationCopyRuntime,getIsolatedOperationCopyConfig};
// mssql's two adapters share a process-wide Request driver. Loading ODBC after
// TDS would give this dedicated TDS pool an ODBC Request and stall its reads.
// The registered draft bootstrap selects TDS; legacy ODBC runtimes stay intact.
const sqlTrusted=getCrmOrderCurrentContext()||getCleanContext()?null:(await import('mssql/msnodesqlv8.js')).default;

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
  if (env.sql.database === 'MELISA_ERP_PROD_CANDIDATE_20260917_01' || isCanonicalTest() || isIsolatedOperationCopyRuntime() || isIsolatedCopyReadonlyRuntime()) return sqlTrusted;
  return env.sql.trustedConnection ? sqlTrusted : sqlDefault;
}

export function getSqlConfig() {
  if ((env.sql.database === 'MELISA_ERP_PROD_CANDIDATE_20260917_01' || isCanonicalTest() || isIsolatedOperationCopyRuntime() || isIsolatedCopyReadonlyRuntime()) && !env.sql.trustedConnection) {
    const driver = env.sql.odbcDriver.replace(/[{}]/g, '');
    const server = env.sql.port ? `${env.sql.server},${env.sql.port}` : env.sql.server;
    return {
      connectionString: [
        `Driver={${driver}}`, `Server=${server}`, `Database=${env.sql.database}`,
        `UID=${env.sql.user}`, `PWD=${env.sql.password}`, 'Trusted_Connection=No',
        env.sql.trustServerCertificate ? 'TrustServerCertificate=Yes' : 'TrustServerCertificate=No',
        env.sql.encrypt ? 'Encrypt=Yes' : 'Encrypt=No',
      ].join(';'),
      // Registered copy guards can outlast the 15s copy lock wait. Keep the
      // ordinary connection budget unchanged; bootstrap identity checks still apply.
      connectionTimeout: 10000,
      requestTimeout: isIsolatedOperationCopyRuntime() || isIsolatedCopyReadonlyRuntime() ? 60000 : 10000,
      ...((isCanonicalTest() && env.port === 4144 && env.sql.readOnly === false || isIsolatedOperationCopyRuntime())
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

  if (isIsolatedOperationCopyRuntime()) {
    const copy = getIsolatedOperationCopyConfig();
    if (env.sql.database !== copy.target.database || env.sql.server !== copy.target.server
      || env.sql.user !== copy.target.login || env.sql.readOnly !== false
      || env.sql.trustedConnection || env.port !== isolatedCopyTopology(copy).apiPort) {
      throw Object.assign(new Error('Isolated operation copy identity changed'), {code:'ISOLATED_COPY_RUNTIME_REJECTED',statusCode:403});
    }
  }
  if(isIsolatedCopyReadonlyRuntime()){
    const {runtime,context}=getIsolatedCopyReadonlyRuntime();
    if(env.sql.database!==runtime.database||env.sql.server!==runtime.server||env.sql.user!==runtime.user
      ||env.sql.readOnly!==true||env.sql.trustedConnection||env.port!==isolatedCopyTopology(context).nativePort)
      throw Object.assign(new Error('Isolated reader identity changed'),{code:'ISOLATED_COPY_READER_REJECTED',statusCode:403});
  }
  const currentCrm=getCrmOrderCurrentContext();
  const clean=getCleanContext();if(clean)assertRegisteredCleanContext();
  const currentCrmAllowed=!!currentCrm&&env.port===currentCrm.nativePort&&env.sql.database===currentCrm.target.database&&env.sql.server==='127.0.0.1'&&env.sql.port===1433&&env.sql.user===currentCrm.target.login&&env.sql.readOnly===false&&env.sql.trustedConnection===false;
  if(currentCrm&&!currentCrmAllowed)throw Object.assign(new Error('Shared draft SQL identity changed'),{code:'CRM_SHARED_SQL_IDENTITY_CHANGED',statusCode:403});
  if (!env.sql.readOnly && env.sql.database !== 'MELISA_ERP_PROD_CANDIDATE_20260917_01' && !isCanonicalTest() && !isIsolatedOperationCopyRuntime() && !currentCrmAllowed && !clean) {
    const error = new Error('SQL write mode is only allowed for the LIVE-3 production candidate');
    error.code = 'SQL_WRITE_TARGET_INVALID';
    error.statusCode = 403;
    throw error;
  }

  if (!poolPromise) {
    const sql = getSqlDriver();
    const pool = new sql.ConnectionPool(getSqlConfig());
    poolPromise = pool.connect().then(async connected=>{
      if(clean){try{assertCleanIdentity((await connected.request().query(CLEAN_IDENTITY_SQL)).recordset[0]);}catch(error){await connected.close();throw error;}}
      if(currentCrmAllowed){
        try{const identity=(await connected.request().query("SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,SUSER_SNAME() loginName,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') databaseControl,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') liveDatabaseAccess,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess")).recordset[0];assertCrmOrderCurrentIdentity(currentCrm,identity);}catch(error){await connected.close();throw error;}
      }
      return connected;
    }).catch((error) => {
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
