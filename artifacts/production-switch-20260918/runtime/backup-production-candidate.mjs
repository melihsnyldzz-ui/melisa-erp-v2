import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sql from 'mssql/msnodesqlv8.js';

const SERVER = 'Semih\\MELISADEV';
const DATABASE = 'MELISA_ERP_PROD_CANDIDATE_20260917_01';
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z');
const file = `C:\\Program Files\\Microsoft SQL Server\\MSSQL16.MELISADEV\\MSSQL\\Backup\\MELISA-PRODUCTION-${stamp}.bak`;
const receiptDir = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer', 'production-switch-20260918', 'backup-receipts');
fs.mkdirSync(receiptDir, { recursive: true });
const pool = await new sql.ConnectionPool({ connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${SERVER};Database=master;Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`, requestTimeout: 0 }).connect();
try {
  const identity = (await pool.request().query("SELECT @@SERVERNAME server,DB_NAME() [database],IS_SRVROLEMEMBER(N'sysadmin') sysadmin")).recordset[0];
  if (String(identity.server).toLowerCase() !== SERVER.toLowerCase() || identity.database !== 'master' || identity.sysadmin !== 1) throw Error('BACKUP_IDENTITY_REJECTED');
  await pool.request().query(`BACKUP DATABASE [${DATABASE}] TO DISK=N'${file.replaceAll("'", "''")}' WITH COPY_ONLY,CHECKSUM,INIT,STATS=10,NAME=N'Melisa production nightly verified backup'`);
  await pool.request().query(`RESTORE VERIFYONLY FROM DISK=N'${file.replaceAll("'", "''")}' WITH CHECKSUM`);
  const header = (await pool.request().query(`RESTORE HEADERONLY FROM DISK=N'${file.replaceAll("'", "''")}'`)).recordset[0];
  const metadata = { backupSetUUID: header.BackupSetUUID, databaseName: header.DatabaseName, backupStartDate: header.BackupStartDate, backupFinishDate: header.BackupFinishDate, backupSize: String(header.BackupSize), firstLSN: String(header.FirstLSN), lastLSN: String(header.LastLSN) };
  const receipt = { createdAt: new Date().toISOString(), database: DATABASE, file, sizeBytes: Number(header.BackupSize), checksum: header.HasBackupChecksums === true || header.HasBackupChecksums === 1, restoreVerifyOnly: 'PASS', metadataSha256: crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex') };
  fs.writeFileSync(path.join(receiptDir, `${stamp}.json`), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ database: DATABASE, sizeBytes: receipt.sizeBytes, checksum: receipt.checksum, restoreVerifyOnly: receipt.restoreVerifyOnly, metadataSha256: receipt.metadataSha256 }));
} finally {
  await pool.close();
}
