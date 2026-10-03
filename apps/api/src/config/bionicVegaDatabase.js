import sql from 'mssql/tedious.js';
import { env } from './env.js';

let poolPromise;
const readPermission = /^(SELECT|CONNECT|CONNECT SQL|REFERENCES|SHOWPLAN|VIEW .+)$/;
class VegaReadOnlyPool extends sql.ConnectionPool {
  request() { return new sql.Request(this); }
}
function failure(code) {
  return Object.assign(new Error('Dedicated Bionic Vega read-only connection is unavailable'), { code, statusCode: 503 });
}
export function getBionicVegaTables() {
  const { companyCode, periodCode } = env.bionicVegaSql;
  if (!/^F\d{4}$/.test(companyCode) || !/^D\d{4}$/.test(periodCode)) throw failure('BIONIC_VEGA_SOURCE_INVALID');
  return { stocks: `${companyCode}TBLSTOKLAR`, units: `${companyCode}TBLBIRIMLEREX`, movements: `${companyCode}${periodCode}TBLSTOKHAREKETLERI` };
}
export async function verifyBionicVegaPermissions(pool) {
  const settings = env.bionicVegaSql;
  const read = async (query) => (await pool.request().query(query)).recordset;
  const identityRequest = pool.request().input('login', sql.NVarChar(128), settings.user).input('database', sql.NVarChar(128), settings.database);
  const identity = (await identityRequest.query(`SELECT DB_NAME() AS databaseName,
    CASE WHEN SUSER_SNAME()=@login AND ORIGINAL_LOGIN()=@login AND DB_NAME()=@database THEN 1 ELSE 0 END AS identityMatches,
    IS_SRVROLEMEMBER('sysadmin') AS sysadmin,IS_MEMBER('db_owner') AS dbOwner,
    IS_MEMBER('db_datawriter') AS dbDataWriter,IS_MEMBER('db_ddladmin') AS dbDdlAdmin,IS_MEMBER('db_securityadmin') AS dbSecurityAdmin,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','INSERT') AS canInsert,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','UPDATE') AS canUpdate,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','DELETE') AS canDelete,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') AS canAlter,
    HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS canCreateTable,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','EXECUTE') AS canExecute`)).recordset[0];
  if (!identity || identity.identityMatches !== 1 || Object.entries(identity).some(([key,value]) => !['databaseName','identityMatches'].includes(key) && value !== 0)) throw failure('BIONIC_VEGA_NOT_READ_ONLY');
  const server = await read("SELECT permission_name FROM sys.fn_my_permissions(NULL,'SERVER')");
  const database = await read("SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE')");
  if ([...server,...database].some(row => !readPermission.test(row.permission_name))) throw failure('BIONIC_VEGA_NOT_READ_ONLY');
  const schemas = await read(`SELECT s.name AS schemaName,p.permission_name,(SELECT COUNT_BIG(*) FROM sys.objects o WHERE o.schema_id=s.schema_id AND o.is_ms_shipped=0) AS objectCount FROM sys.schemas s CROSS APPLY sys.fn_my_permissions(QUOTENAME(s.name),'SCHEMA') p WHERE s.name NOT IN ('sys','INFORMATION_SCHEMA') AND p.permission_name NOT IN ('SELECT','CONNECT','REFERENCES','SHOWPLAN') AND p.permission_name NOT LIKE 'VIEW %'`);
  // db_datareader owns its empty built-in schema. It cannot create objects there
  // without a database CREATE grant; the database check above rejects those.
  if (schemas.some(row => row.schemaName !== 'db_datareader' || Number(row.objectCount) !== 0)) throw failure('BIONIC_VEGA_NOT_READ_ONLY');
  const grants = await read(`SELECT dp.class_desc,dp.major_id,dp.minor_id,dp.permission_name FROM sys.database_permissions dp JOIN sys.user_token tok ON tok.principal_id=dp.grantee_principal_id LEFT JOIN sys.objects o ON dp.class=1 AND o.object_id=dp.major_id WHERE dp.state IN ('G','W') AND dp.permission_name NOT IN ('SELECT','CONNECT','REFERENCES','SHOWPLAN') AND dp.permission_name NOT LIKE 'VIEW %' AND (dp.class<>1 OR ISNULL(o.is_ms_shipped,0)=0)`);
  const ownedObjects = await read(`SELECT o.object_id FROM sys.objects o JOIN sys.user_token tok ON tok.principal_id=o.principal_id WHERE o.is_ms_shipped=0`);
  const roles = await read(`SELECT p.name AS roleName FROM sys.database_principals p JOIN sys.user_token tok ON tok.principal_id=p.principal_id WHERE p.type='R'`);
  if (grants.length || ownedObjects.length || roles.some(row => !['public','db_datareader','db_denydatawriter'].includes(row.roleName))) throw failure('BIONIC_VEGA_NOT_READ_ONLY');
  const select = {};
  for (const table of Object.values(getBionicVegaTables())) {
    await read(`SELECT TOP (1) 1 AS readable FROM dbo.[${table}]`);
    select[table] = 'allowed';
  }
  return { databaseName: identity.databaseName, source: 'vega', connectionPool: 'bionic-vega-dedicated', readOnly: true, readOnlyAccountVerified: true,
    companyCode: settings.companyCode, periodCode: settings.periodCode,
    permissions: { select, insert: 'denied', update: 'denied', delete: 'denied', alter: 'denied', createTable: 'denied', execute: 'denied' } };
}
export async function getBionicVegaSqlPool() {
  if (!poolPromise) {
    const s = env.bionicVegaSql;
    if (!s.server || !s.user || !s.password || s.database !== 'VEGA2026' || !Number.isInteger(s.port) || s.port < 1 || s.port > 65535) throw failure('BIONIC_VEGA_NOT_CONFIGURED');
    getBionicVegaTables();
    const pool = new VegaReadOnlyPool({ server: s.server, port: s.port, database: s.database, user: s.user, password: s.password,
      options: { encrypt: s.encrypt, trustServerCertificate: s.trustServerCertificate, readOnlyIntent: true, appName: 'Melisa-Bionic-Vega-ReadOnly', ...(s.localAddress ? { localAddress: s.localAddress } : {}) },
      pool: { max: 3, min: 0, idleTimeoutMillis: 30000 }, connectionTimeout: 10000, requestTimeout: 30000 });
    poolPromise = (async () => {
      try { await pool.connect(); await verifyBionicVegaPermissions(pool); return pool; }
      catch (error) { await pool.close().catch(() => {}); poolPromise = undefined;
        if (String(error?.code || '').startsWith('BIONIC_VEGA_')) throw error;
        throw failure('BIONIC_VEGA_CONNECTION_FAILED'); }
    })();
  }
  return poolPromise;
}
export async function closeBionicVegaSqlPool() {
  if (poolPromise) { const current = poolPromise; poolPromise = undefined; const pool = await current; await pool.close(); }
}
