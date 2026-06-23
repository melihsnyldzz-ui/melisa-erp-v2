import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlDefault from 'mssql';
import sqlTrusted from 'mssql/msnodesqlv8.js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(apiRoot, '.env.local') });
dotenv.config({ path: path.join(apiRoot, '.env') });

const TARGET_DATABASE = 'MELISA_ERP_V2';
const RESET_CONFIRMATION = 'MELISA_ERP_V2_SIFIRLA';

const resetTables = [
  'dbo.auth_refresh_tokens',
  'dbo.audit_logs',
  'dbo.terminal_sync_queue',
  'dbo.finance_account_movements',
  'dbo.customer_movements',
  'dbo.supplier_movements',
  'dbo.stock_movements',
  'dbo.catalog_items',
  'dbo.catalogs',
  'dbo.sales_order_items',
  'dbo.sales_orders',
  'dbo.sales_offer_items',
  'dbo.sales_offers',
  'dbo.sales_invoice_items',
  'dbo.sales_invoices',
  'dbo.purchase_invoice_items',
  'dbo.purchase_invoices',
  'dbo.product_images',
  'dbo.product_barcodes',
  'dbo.products',
  'dbo.customers',
  'dbo.suppliers',
  'dbo.finance_accounts',
  'dbo.terminal_devices',
];

const preservedTables = [
  'dbo.roles',
  'dbo.permissions',
  'dbo.users',
  'dbo.currency_rates',
  'dbo.system_settings',
];

function argValue(name, fallback = '') {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function getMode() {
  if (hasArg('--backup-reset')) return 'backup-reset';
  if (hasArg('--reset')) return 'reset';
  if (hasArg('--backup')) return 'backup';
  return 'preview';
}

function sqlEnabled() {
  return Boolean(
    process.env.SQL_SERVER
    && process.env.SQL_DATABASE
    && (
      String(process.env.SQL_TRUSTED_CONNECTION || 'false').toLowerCase() === 'true'
      || (process.env.SQL_USER && process.env.SQL_PASSWORD)
    ),
  );
}

function getSqlDriver() {
  return String(process.env.SQL_TRUSTED_CONNECTION || 'false').toLowerCase() === 'true'
    ? sqlTrusted
    : sqlDefault;
}

function getSqlConfig() {
  const trustedConnection = String(process.env.SQL_TRUSTED_CONNECTION || 'false').toLowerCase() === 'true';
  const encrypt = String(process.env.SQL_ENCRYPT || 'false').toLowerCase() === 'true';
  const trustServerCertificate = String(process.env.SQL_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true';

  if (trustedConnection) {
    const driver = (process.env.SQL_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server').replace(/[{}]/g, '');
    const server = process.env.SQL_PORT
      ? `${process.env.SQL_SERVER},${process.env.SQL_PORT}`
      : process.env.SQL_SERVER;

    return {
      connectionString: [
        `Driver={${driver}}`,
        `Server=${server}`,
        `Database=${process.env.SQL_DATABASE}`,
        'Trusted_Connection=Yes',
        trustServerCertificate ? 'TrustServerCertificate=Yes' : 'TrustServerCertificate=No',
        encrypt ? 'Encrypt=Yes' : 'Encrypt=No',
      ].join(';'),
      connectionTimeout: 10000,
      requestTimeout: 120000,
    };
  }

  const config = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
      encrypt,
      trustServerCertificate,
    },
    pool: {
      max: 1,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 10000,
    requestTimeout: 120000,
  };

  if (process.env.SQL_PORT) {
    config.port = Number(process.env.SQL_PORT);
  }

  return config;
}

function assertTargetDatabase() {
  if (!sqlEnabled()) {
    throw new Error('SQL connection is not configured. apps/api/.env.local SQL settings are required.');
  }

  if (process.env.SQL_DATABASE !== TARGET_DATABASE) {
    throw new Error(`Refusing to continue. SQL_DATABASE must be ${TARGET_DATABASE}.`);
  }
}

function assertWriteMode() {
  if (String(process.env.SQL_READ_ONLY || 'true').toLowerCase() !== 'false') {
    throw new Error('Reset requires SQL_READ_ONLY=false in apps/api/.env.local.');
  }
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function backupStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

function fallbackBackupFile() {
  return path.resolve(apiRoot, '..', '..', 'backups', `${TARGET_DATABASE}-${backupStamp()}.bak`);
}

async function readServerBackupDirectory(pool) {
  try {
    const result = await pool.request().query(`
      SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(4000)) AS backupDirectory;
    `);
    return result.recordset?.[0]?.backupDirectory || '';
  } catch {
    return '';
  }
}

async function resolveBackupFile(pool) {
  const explicitBackupFile = argValue('--backup-file');
  if (explicitBackupFile) return path.resolve(explicitBackupFile);

  const backupDirectory = await readServerBackupDirectory(pool);
  if (backupDirectory) {
    return path.join(backupDirectory, `${TARGET_DATABASE}-${backupStamp()}.bak`);
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  return fallbackBackupFile(stamp);
}

function backupSql(backupFile) {
  return `
    BACKUP DATABASE [${TARGET_DATABASE}]
    TO DISK = N'${escapeSqlString(backupFile)}'
    WITH COPY_ONLY, INIT, NAME = N'${TARGET_DATABASE} Codex safety backup', STATS = 10;
  `;
}

function existingTableWhere(tableName) {
  const [schemaName, rawTableName] = tableName.split('.');
  return `OBJECT_ID(N'${schemaName}.${rawTableName}', N'U') IS NOT NULL`;
}

async function readTableCounts(pool) {
  const statements = [...resetTables, ...preservedTables].map((tableName) => `
    SELECT
      N'${tableName}' AS tableName,
      CASE
        WHEN ${existingTableWhere(tableName)}
          THEN (SELECT COUNT_BIG(1) FROM ${tableName})
        ELSE NULL
      END AS [rowCount]
  `);

  const result = await pool.request().query(statements.join('\nUNION ALL\n'));
  return result.recordset.map((row) => ({
    table: row.tableName,
    rowCount: row.rowCount === null || row.rowCount === undefined ? null : Number(row.rowCount),
  }));
}

function resetSql() {
  const deleteStatements = resetTables.map((tableName) => `
    IF ${existingTableWhere(tableName)}
    BEGIN
      DELETE FROM ${tableName};
      IF OBJECTPROPERTY(OBJECT_ID(N'${tableName}'), 'TableHasIdentity') = 1
        DBCC CHECKIDENT ('${tableName}', RESEED, 0) WITH NO_INFOMSGS;
    END;
  `).join('\n');

  return `
    SET XACT_ABORT ON;

    IF DB_NAME() <> N'${TARGET_DATABASE}'
      THROW 51000, 'Reset can only run on ${TARGET_DATABASE}.', 1;

    BEGIN TRANSACTION;
${deleteStatements}
    COMMIT TRANSACTION;
  `;
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  for (const row of counts) {
    const label = row.rowCount === null ? 'missing' : row.rowCount;
    console.log(`- ${row.table}: ${label}`);
  }
}

async function main() {
  const mode = getMode();
  const execute = hasArg('--execute');
  const confirmation = argValue('--confirm');
  const sqlDriver = getSqlDriver();

  assertTargetDatabase();

  if ((mode === 'reset' || mode === 'backup-reset') && (!execute || confirmation !== RESET_CONFIRMATION)) {
    throw new Error(`Reset is locked. Add --execute --confirm=${RESET_CONFIRMATION} after taking/reviewing a backup.`);
  }

  if (mode === 'reset' || mode === 'backup-reset') {
    assertWriteMode();
  }

  const pool = await sqlDriver.connect(getSqlConfig());
  try {
    const backupFile = await resolveBackupFile(pool);
    try {
      fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    } catch {
      // SQL Server may still be able to write to its own backup directory.
    }

    const beforeCounts = await readTableCounts(pool);
    printCounts('Current MELISA_ERP_V2 table counts', beforeCounts);

    if (mode === 'preview') {
      console.log('\nPreview only. No backup or reset was executed.');
      console.log(`Backup file that would be used: ${backupFile}`);
      console.log(`Reset confirmation word: ${RESET_CONFIRMATION}`);
      return;
    }

    if (mode === 'backup' || mode === 'backup-reset') {
      console.log(`\nCreating SQL backup: ${backupFile}`);
      await pool.request().query(backupSql(backupFile));
      console.log('Backup completed.');
    }

    if (mode === 'reset' || mode === 'backup-reset') {
      console.log('\nResetting operational ERP data...');
      await pool.request().query(resetSql());
      const afterCounts = await readTableCounts(pool);
      printCounts('Counts after reset', afterCounts);
      console.log('Reset completed.');
    }
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  for (const detail of error.precedingErrors || []) {
    console.error(`DETAIL: ${detail.message}`);
  }
  process.exitCode = 1;
});
