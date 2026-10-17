import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sql from '../../apps/api/node_modules/mssql/msnodesqlv8.js';

const RUN_ID = 'PRODUCTION-SWITCH-20260918-01';
const SERVER = 'Semih\\MELISADEV';
const DATABASES = ['MELISA_ERP_V2', 'MELISA_ERP_PROD_CANDIDATE_20260917_01'];
const BACKUP_DIR = 'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.MELISADEV\\MSSQL\\Backup';
const outDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const pool = await new sql.ConnectionPool({
  connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${SERVER};Database=master;Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`,
  requestTimeout: 0,
  connectionTimeout: 15000,
}).connect();

try {
  const identity = (await pool.request().query("SELECT @@SERVERNAME server,DB_NAME() [database],IS_SRVROLEMEMBER(N'sysadmin') sysadmin")).recordset[0];
  if (String(identity.server).toLowerCase() !== SERVER.toLowerCase() || identity.database !== 'master' || identity.sysadmin !== 1) throw Error('BACKUP_IDENTITY_REJECTED');
  const receipts = [];
  for (const database of DATABASES) {
    const state = (await pool.request().input('database', sql.NVarChar(128), database).query('SELECT name,state_desc FROM sys.databases WHERE name=@database')).recordset[0];
    if (!state || state.state_desc !== 'ONLINE') throw Error(`BACKUP_DATABASE_NOT_ONLINE:${database}`);
    const file = path.join(BACKUP_DIR, `${RUN_ID}-${database}-PRE-SWITCH-COPY_ONLY.bak`);
    const safeFile = file.replaceAll("'", "''");
    await pool.request().query(`BACKUP DATABASE [${database}] TO DISK=N'${safeFile}' WITH COPY_ONLY,CHECKSUM,INIT,STATS=10,NAME=N'${RUN_ID} pre-switch backup'`);
    await pool.request().query(`RESTORE VERIFYONLY FROM DISK=N'${safeFile}' WITH CHECKSUM`);
    const header = (await pool.request().query(`RESTORE HEADERONLY FROM DISK=N'${safeFile}'`)).recordset[0];
    const metadata = {
      backupSetUUID: header.BackupSetUUID,
      databaseName: header.DatabaseName,
      backupStartDate: header.BackupStartDate,
      backupFinishDate: header.BackupFinishDate,
      backupSize: String(header.BackupSize),
      compressedBackupSize: String(header.CompressedBackupSize || ''),
      databaseBackupLSN: String(header.DatabaseBackupLSN),
      firstLSN: String(header.FirstLSN),
      lastLSN: String(header.LastLSN),
    };
    receipts.push({
      database,
      file,
      sizeBytes: Number(header.BackupSize),
      compressedSizeBytes: Number(header.CompressedBackupSize || 0),
      copyOnly: true,
      checksum: header.HasBackupChecksums === true || header.HasBackupChecksums === 1,
      restoreVerifyOnly: 'PASS',
      metadataSha256: crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
      backupSetUUID: header.BackupSetUUID,
      startedAt: header.BackupStartDate,
      finishedAt: header.BackupFinishDate,
    });
  }
  const report = { runId: RUN_ID, generatedAt: new Date().toISOString(), server: SERVER, receipts, status: receipts.every((row) => row.checksum && row.restoreVerifyOnly === 'PASS') ? 'PASS' : 'FAIL' };
  fs.writeFileSync(path.join(outDir, 'backup-receipts.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ runId: RUN_ID, status: report.status, receipts: receipts.map(({ database, sizeBytes, compressedSizeBytes, checksum, restoreVerifyOnly, metadataSha256, backupSetUUID }) => ({ database, sizeBytes, compressedSizeBytes, checksum, restoreVerifyOnly, metadataSha256, backupSetUUID })) }));
  if (report.status !== 'PASS') process.exitCode = 2;
} finally {
  await pool.close();
}
