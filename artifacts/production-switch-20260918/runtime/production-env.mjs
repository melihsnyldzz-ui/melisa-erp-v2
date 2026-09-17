import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_DATABASE = 'MELISA_ERP_PROD_CANDIDATE_20260917_01';
const EXPECTED_LOGIN = 'melisa_production_runtime_20260918';
const EXPECTED_USER = 'melisa_app_production';
const EXPECTED_RUN = 'PRODUCTION-SWITCH-20260918-01';

export async function configureProductionRuntime(configPath, mode) {
  if (!path.isAbsolute(configPath || '')) throw Error('ABSOLUTE_PRIVATE_CONFIG_REQUIRED');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.runId !== EXPECTED_RUN || config.database !== EXPECTED_DATABASE || config.sqlUser !== EXPECTED_LOGIN || !['erp', 'native'].includes(mode)) throw Error('PRODUCTION_CONFIG_IDENTITY_REJECTED');
  for (const key of Object.keys(process.env)) if (/^(SQL_|VEGA_|ARMADA_|WHATSAPP_|EVOLUTION_)/.test(key)) delete process.env[key];
  const port = mode === 'erp' ? config.erpPort : config.nativePort;
  Object.assign(process.env, {
    NODE_ENV: 'production',
    API_PORT: String(port),
    SQL_SERVER: config.server,
    SQL_DATABASE: config.database,
    SQL_USER: config.sqlUser,
    SQL_PASSWORD: config.sqlPassword,
    SQL_TRUSTED_CONNECTION: 'false',
    SQL_READ_ONLY: 'false',
    SQL_ENCRYPT: 'false',
    SQL_TRUST_SERVER_CERTIFICATE: 'true',
    MELISA_PILOT_RUNTIME: 'true',
    MELISA_LOCAL_PASSWORDLESS_LOGIN: 'false',
    NATIVE_CUSTOMER_ROUTES_ENABLED: String(config.customerRoutesEnabled === true),
    WHATSAPP_ENABLED: 'false',
    NAKLIYAT_ENABLED: 'false',
    JWT_ACCESS_SECRET: config.jwtAccessSecret,
    JWT_SECRET: config.jwtAccessSecret,
    JWT_REFRESH_SECRET: config.jwtRefreshSecret,
    JWT_ACCESS_EXPIRES_IN: '8h',
    NATIVE_TERMINAL_SIGNING_KEY: config.nativeSigningKey,
    TERMINAL_RECEIPT_PRINTER_NAME: config.printerName || '',
    TERMINAL_RECEIPT_PRINT_MODE: config.printerName ? 'windows' : 'disabled',
    TERMINAL_RECEIPT_PRINT_ENABLED: config.printerName ? 'true' : 'false',
    CORS_ORIGINS: `http://${config.host}:${config.webPort},http://localhost:${config.webPort},http://127.0.0.1:${config.webPort}`,
  });
  const { env } = await import('./src/config/env.js');
  if (env.sql.database !== EXPECTED_DATABASE || env.sql.readOnly || env.sql.trustedConnection || env.vega.enabled || env.whatsapp.enabled || env.port !== port) throw Error('PRODUCTION_ENVIRONMENT_GUARD_FAILED');
  const { getSqlPool } = await import('./src/config/database.js');
  const pool = await getSqlPool();
  const identity = (await pool.request().query("SELECT DB_NAME() databaseName,CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) serverName,SUSER_SNAME() loginName,USER_NAME() databaseUser,IS_SRVROLEMEMBER(N'sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'CONTROL') databaseControl,HAS_PERMS_BY_NAME(N'dbo.sales_invoices',N'OBJECT',N'INSERT') canInsertSales,HAS_PERMS_BY_NAME(N'dbo.sales_invoices',N'OBJECT',N'ALTER') canAlterSales")).recordset[0];
  if (identity.databaseName !== EXPECTED_DATABASE || String(identity.serverName).toLowerCase() !== 'semih\\melisadev' || identity.loginName !== EXPECTED_LOGIN || identity.databaseUser !== EXPECTED_USER || identity.sysadmin !== 0 || identity.databaseControl !== 0 || identity.canInsertSales !== 1 || identity.canAlterSales !== 0) throw Error('PRODUCTION_SQL_IDENTITY_GUARD_FAILED');
  return { config, env, pool, identity, port };
}
