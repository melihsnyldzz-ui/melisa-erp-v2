// Owner-authorized recovery point for the exact TEST database; never restores.
import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql/msnodesqlv8.js';
import { SPEC, hash, requireRule, assertTestIdentity } from '../src/services/vegaMigrationSpecification.mjs';
import { identifier, projection } from './vega-migration-spec-preflight.mjs';
const [run, mode] = process.argv.slice(2);
requireRule(process.argv.length === 4 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(run || '') && mode === '--backup-test', 'EXACT_TEST_BACKUP_REQUIRED');
const dir = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer/migration-spec', run), read = n => JSON.parse(fs.readFileSync(path.join(dir, n)));
const plan = read('plan/plan.json'), { planHash, ...body } = plan;
requireRule(hash(body) === planHash && plan.specification.target === SPEC.target, 'PLAN_CHANGED');
const receiptPath = path.join(dir, 'backup-receipt.json');
const report = { run, planHash, database: SPEC.target, server: SPEC.server, status: 'STARTED', startedAt: new Date().toISOString(), copyOnly: true, checksum: true, restoreExecuted: false };
fs.writeFileSync(receiptPath, JSON.stringify(report), { flag: 'wx' });
const save = () => fs.writeFileSync(receiptPath, JSON.stringify(report, null, 2));
const literal = value => "N'" + value.replaceAll("'", "''") + "'";
const pool = new sql.ConnectionPool({ connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${SPEC.server};Database=${SPEC.target};Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`, requestTimeout: 180000, connectionTimeout: 15000 });
try {
  await pool.connect();
  const identity = (await pool.request().query("SELECT DB_NAME() [database],@@SERVERNAME server,CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultBackupPath')) backupPath")).recordset[0];
  assertTestIdentity(identity); requireRule(path.win32.isAbsolute(identity.backupPath), 'SQL_BACKUP_DIRECTORY_REQUIRED');
  report.identity = { database: identity.database, server: identity.server };
  const metadata = read('target-metadata.json'), captures = read('target-captures.json');
  for (const capture of captures) {
    const columns = metadata.filter(c => c.tableName === capture.table);
    const rows = (await pool.request().query(`SELECT ${projection(columns)} FROM dbo.${identifier(capture.table)} ORDER BY id`)).recordset;
    requireRule(hash(rows) === capture.hash, 'TARGET_CHANGED_SINCE_PLAN');
  }
  report.targetHash = hash(captures); requireRule(report.targetHash === plan.targetHash, 'TARGET_MANIFEST_CHANGED');
  const file = path.win32.join(identity.backupPath, `${SPEC.target}_before_${run}.bak`);
  const relative = path.win32.relative(identity.backupPath, file);
  requireRule(relative && !relative.startsWith('..') && !path.win32.isAbsolute(relative), 'BACKUP_PATH_OUTSIDE_DIRECTORY');
  const exists = (await pool.request().input('file', sql.NVarChar(4000), file).query('SELECT file_exists,parent_directory_exists FROM sys.dm_os_file_exists(@file)')).recordset[0];
  requireRule(exists?.file_exists === 0 && exists?.parent_directory_exists === 1, 'BACKUP_FILE_EXISTS_OR_DIRECTORY_MISSING');
  report.backupFile = file; save();
  await pool.request().query(`BACKUP DATABASE [MELISA_ERP_FULL_TEST_20260916] TO DISK=${literal(file)} WITH COPY_ONLY,CHECKSUM,NOINIT,NAME=${literal(`Before specification plan ${run}`)}`);
  report.backupCompletedAt = new Date().toISOString(); save();
  await pool.request().query(`RESTORE VERIFYONLY FROM DISK=${literal(file)} WITH CHECKSUM`);
  const headers = (await pool.request().query(`RESTORE HEADERONLY FROM DISK=${literal(file)}`)).recordset;
  requireRule(headers.length === 1 && headers[0].DatabaseName === SPEC.target && headers[0].IsCopyOnly && headers[0].HasBackupChecksums, 'BACKUP_HEADER_REJECTED');
  report.status = 'PASS_VERIFIED_TEST_BACKUP'; report.backupSetGuid = headers[0].BackupSetGUID; report.bytes = String(headers[0].BackupSize); report.completedAt = new Date().toISOString(); save();
} catch (e) { report.status = 'FAILED_NO_AUTOMATIC_RETRY'; report.error = /^[A-Z_0-9]+$/.test(e.code || e.message) ? e.code || e.message : 'BACKUP_FAILED'; save(); process.exitCode = 1; }
finally { await pool.close().catch(() => {}); console.log(JSON.stringify(report)); }
