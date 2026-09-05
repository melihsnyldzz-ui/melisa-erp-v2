import sql from 'mssql/tedious.js';
import { env } from './env.js';

let poolPromise;
const requiredTables = ['products', 'product_barcodes', 'product_images', 'suppliers'];
const readPermission = /^(SELECT|CONNECT|CONNECT SQL|REFERENCES|SHOWPLAN|VIEW .+)$/;

class BionicConnectionPool extends sql.ConnectionPool {
  request() {
    // mssql/msnodesqlv8 changes mssql's shared request factory when imported.
    // Pin this pool to its SQL-login driver without modifying the ERP pool.
    return new sql.Request(this);
  }
}

function unavailable(code) {
  const error = new Error('Dedicated Bionic read-only SQL connection is unavailable');
  error.code = code;
  error.statusCode = 503;
  return error;
}

export function getBionicSqlConfig() {
  const settings = env.bionicSql;
  if (!settings.server || settings.database !== 'MELISA_ERP_V2' || !settings.user || !settings.password) {
    throw unavailable('BIONIC_SQL_NOT_CONFIGURED');
  }
  if (settings.port !== undefined && (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535)) {
    throw unavailable('BIONIC_SQL_NOT_CONFIGURED');
  }
  return {
    server: settings.server,
    ...(settings.port ? { port: settings.port } : {}),
    database: settings.database,
    user: settings.user,
    password: settings.password,
    options: {
      encrypt: settings.encrypt,
      trustServerCertificate: settings.trustServerCertificate,
      readOnlyIntent: true,
      appName: 'Melisa-Bionic-ReadOnly',
    },
    pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 10000,
    requestTimeout: env.bionicReadOnly.queryTimeoutMs,
  };
}

export async function verifyBionicPermissions(pool) {
  const request = pool.request();
  request.input('expectedLogin', sql.NVarChar(128), env.bionicSql.user);
  request.input('expectedDatabase', sql.NVarChar(128), env.bionicSql.database);
  const identity = (await request.query(`SELECT DB_NAME() AS databaseName,
    CASE WHEN SUSER_SNAME()=@expectedLogin AND ORIGINAL_LOGIN()=@expectedLogin AND DB_NAME()=@expectedDatabase THEN 1 ELSE 0 END AS identityMatches,
    IS_SRVROLEMEMBER('sysadmin') AS sysadmin,
    IS_MEMBER('db_owner') AS dbOwner,
    IS_MEMBER('db_datawriter') AS dbDataWriter,
    IS_MEMBER('db_ddladmin') AS dbDdlAdmin,
    IS_MEMBER('db_securityadmin') AS dbSecurityAdmin,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','INSERT') AS canInsert,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','UPDATE') AS canUpdate,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','DELETE') AS canDelete,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS canCreateTable,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') AS canAlter,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','EXECUTE') AS canExecute`)).recordset[0];
  if (!identity || identity.identityMatches !== 1 || Object.entries(identity).some(([key,value]) => !['databaseName','identityMatches'].includes(key) && value !== 0)) {
    throw unavailable('BIONIC_SQL_NOT_READ_ONLY');
  }
  const server = (await pool.request().query("SELECT permission_name FROM sys.fn_my_permissions(NULL,'SERVER')")).recordset;
  const database = (await pool.request().query("SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE')")).recordset;
  const schemas = (await pool.request().query(`SELECT p.permission_name FROM sys.schemas s CROSS APPLY sys.fn_my_permissions(QUOTENAME(s.name),'SCHEMA') p WHERE s.name NOT IN ('sys','INFORMATION_SCHEMA')`)).recordset;
  const objects = (await pool.request().query(`SELECT s.name AS schemaName,o.name AS objectName,p.permission_name FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id CROSS APPLY sys.fn_my_permissions(QUOTENAME(s.name)+'.'+QUOTENAME(o.name),'OBJECT') p WHERE o.is_ms_shipped=0`)).recordset;
  const writableColumns = (await pool.request().query(`SELECT COUNT_BIG(*) AS writableColumns FROM sys.columns c JOIN sys.objects o ON o.object_id=c.object_id JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE o.is_ms_shipped=0 AND HAS_PERMS_BY_NAME(QUOTENAME(s.name)+'.'+QUOTENAME(o.name),'OBJECT','UPDATE',c.name,'COLUMN')=1`)).recordset[0];
  if ([...server,...database,...schemas,...objects].some(item => !readPermission.test(item.permission_name)) || Number(writableColumns?.writableColumns) !== 0) {
    throw unavailable('BIONIC_SQL_NOT_READ_ONLY');
  }
  const select = {};
  for (const table of requiredTables) {
    if (!objects.some(item => item.schemaName === 'dbo' && item.objectName === table && item.permission_name === 'SELECT')) {
      throw unavailable('BIONIC_SQL_READ_PERMISSION_MISSING');
    }
    // Execute real reads without returning business values in the permission report.
    await pool.request().query(`SELECT TOP (1) 1 AS readable FROM dbo.${table}`);
    select[table] = 'allowed';
  }
  return {
    databaseName: identity.databaseName,
    connectionPool: 'bionic-dedicated',
    readOnly: true,
    readOnlyAccountVerified: true,
    permissions: { select, insert: 'denied', update: 'denied', delete: 'denied', createTable: 'denied', alter: 'denied', execute: 'denied' },
  };
}

export async function getBionicSqlPool() {
  if (!poolPromise) {
    const config = getBionicSqlConfig();
    const pool = new BionicConnectionPool(config);
    poolPromise = (async () => {
      try {
        await pool.connect();
        await verifyBionicPermissions(pool);
        return pool;
      } catch (error) {
        await pool.close().catch(() => {});
        poolPromise = undefined;
        if (String(error?.code || '').startsWith('BIONIC_SQL_')) throw error;
        throw unavailable('BIONIC_SQL_CONNECTION_FAILED');
      }
    })();
  }
  return poolPromise;
}

export async function closeBionicSqlPool() {
  if (poolPromise) {
    const current = poolPromise;
    poolPromise = undefined;
    const pool = await current;
    await pool.close();
  }
}
