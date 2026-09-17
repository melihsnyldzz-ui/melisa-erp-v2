import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sql from '../../../apps/api/node_modules/mssql/msnodesqlv8.js';

const RUN_ID = 'PRODUCTION-SWITCH-20260918-01';
const SERVER = 'Semih\\MELISADEV';
const DATABASE = 'MELISA_ERP_PROD_CANDIDATE_20260917_01';
const LOGIN = 'melisa_production_runtime_20260918';
const USER = 'melisa_app_production';
const privateDir = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer', 'production-switch-20260918');
const configPath = path.join(privateDir, 'runtime-private.json');
const pilotConfigPath = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer', 'pilot-private', 'pilot-config.json');
const nativeConfigPath = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer', 'native-terminal-private', 'native-config.json');

fs.mkdirSync(privateDir, { recursive: true });
const pilot = JSON.parse(fs.readFileSync(pilotConfigPath, 'utf8'));
const native = JSON.parse(fs.readFileSync(nativeConfigPath, 'utf8'));
let config;
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.runId !== RUN_ID || config.database !== DATABASE || config.sqlUser !== LOGIN) throw Error('PRIVATE_CONFIG_IDENTITY_REJECTED');
} else {
  config = {
    runId: RUN_ID,
    releaseId: 'melisa-production-20260918',
    server: 'localhost\\MELISADEV',
    database: DATABASE,
    sqlUser: LOGIN,
    sqlPassword: `M3lisa!${crypto.randomBytes(32).toString('hex')}`,
    jwtAccessSecret: crypto.randomBytes(48).toString('hex'),
    jwtRefreshSecret: crypto.randomBytes(48).toString('hex'),
    pilotSigningKey: pilot.signingKey,
    nativeSigningKey: native.signingKey,
    host: '192.168.1.46',
    erpPort: 4114,
    nativePort: 4116,
    webPort: 5188,
    printerName: native.printerName || pilot.printerName || '',
    approvedRates: pilot.approvedRates || null,
    dailyWebEnabled: true,
    automaticCardSyncEnabled: false,
    invoiceExportEnabled: false,
    customerRoutesEnabled: true,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { flag: 'wx' });
}

const admin = await new sql.ConnectionPool({ connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${SERVER};Database=master;Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No` }).connect();
try {
  const password = String(config.sqlPassword).replaceAll("'", "''");
  await admin.request().query(`IF SUSER_ID(N'${LOGIN}') IS NULL CREATE LOGIN [${LOGIN}] WITH PASSWORD=N'${password}',CHECK_POLICY=ON,CHECK_EXPIRATION=OFF,DEFAULT_DATABASE=[${DATABASE}]; ELSE BEGIN ALTER LOGIN [${LOGIN}] WITH PASSWORD=N'${password}'; ALTER LOGIN [${LOGIN}] ENABLE; END;`);
  await admin.request().query(`USE [${DATABASE}];
    IF DATABASE_PRINCIPAL_ID(N'${USER}') IS NULL CREATE USER [${USER}] FOR LOGIN [${LOGIN}];
    IF IS_ROLEMEMBER(N'melisa_app_runtime',N'${USER}')<>1 ALTER ROLE [melisa_app_runtime] ADD MEMBER [${USER}];
    GRANT CONNECT TO [${USER}];`);
  const serverRoles = (await admin.request().query(`SELECT r.name FROM sys.server_role_members rm JOIN sys.server_principals r ON r.principal_id=rm.role_principal_id JOIN sys.server_principals m ON m.principal_id=rm.member_principal_id WHERE m.name=N'${LOGIN}'`)).recordset.map((row) => row.name);
  if (serverRoles.length) throw Error(`SERVER_ROLE_REJECTED:${serverRoles.join(',')}`);
} finally {
  await admin.close();
}

const candidate = await new sql.ConnectionPool({ connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=localhost\\MELISADEV;Database=${DATABASE};UID=${LOGIN};PWD=${config.sqlPassword};Trusted_Connection=No;TrustServerCertificate=Yes;Encrypt=No` }).connect();
let identity;
try {
  identity = (await candidate.request().query(`SELECT DB_NAME() databaseName,SUSER_SNAME() loginName,USER_NAME() databaseUser,IS_SRVROLEMEMBER(N'sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'CONTROL') databaseControl,HAS_PERMS_BY_NAME(N'dbo.sales_invoices',N'OBJECT',N'SELECT') canSelectSales,HAS_PERMS_BY_NAME(N'dbo.sales_invoices',N'OBJECT',N'INSERT') canInsertSales,HAS_PERMS_BY_NAME(N'dbo.sales_invoices',N'OBJECT',N'UPDATE') canUpdateSales,HAS_PERMS_BY_NAME(N'dbo.sales_invoices',N'OBJECT',N'DELETE') canDeleteSales,HAS_PERMS_BY_NAME(N'dbo.sales_invoices',N'OBJECT',N'ALTER') canAlterSales`)).recordset[0];
  if (identity.databaseName !== DATABASE || identity.loginName !== LOGIN || identity.databaseUser !== USER || identity.sysadmin !== 0 || identity.databaseControl !== 0 || identity.canSelectSales !== 1 || identity.canInsertSales !== 1 || identity.canUpdateSales !== 1 || identity.canDeleteSales !== 1 || identity.canAlterSales !== 0) throw Error('LEAST_PRIVILEGE_RUNTIME_REJECTED');
} finally {
  await candidate.close();
}
const receipt = { runId: RUN_ID, preparedAt: new Date().toISOString(), configPath, database: DATABASE, login: LOGIN, databaseUser: USER, passwordPersistedOutsideRepo: true, secretsPrinted: false, identity, status: 'PASS' };
fs.writeFileSync(path.join(privateDir, 'runtime-receipt.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ runId: RUN_ID, database: DATABASE, login: LOGIN, databaseUser: USER, identity, privateConfigCreated: true, secretsPrinted: false, status: 'PASS' }));
