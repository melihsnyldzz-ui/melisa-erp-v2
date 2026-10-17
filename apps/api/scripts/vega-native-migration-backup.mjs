import path from 'node:path';
import { getTestPool, sql, run, SPEC, save, readRun, protectedManifest, literal, requireRule } from './vega-native-migration-runtime.mjs';
const pool = await getTestPool();
try {
 const before = await protectedManifest(() => pool.request());
 requireRule(before.hash === readRun('protected-before.json').hash, 'TERMINAL_CHANGED_BEFORE_BACKUP');
 const dir = (await pool.request().query("SELECT CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultBackupPath')) dir")).recordset[0].dir;
 const file = path.win32.join(dir, `${SPEC.target}_before_${run}.bak`);
 requireRule(path.win32.isAbsolute(dir) && path.win32.dirname(file) === path.win32.normalize(dir).replace(/\\$/, ''), 'BACKUP_DIRECTORY');
 const exists = (await pool.request().input('p', sql.NVarChar(4000), file).query('SELECT file_exists FROM sys.dm_os_file_exists(@p)')).recordset[0];
 requireRule(exists.file_exists === 0, 'BACKUP_ALREADY_EXISTS');
 await pool.request().query(`BACKUP DATABASE [MELISA_ERP_FULL_TEST_20260916] TO DISK=${literal(file)} WITH COPY_ONLY,CHECKSUM,NOINIT,NAME=${literal(run)}`);
 await pool.request().query(`RESTORE VERIFYONLY FROM DISK=${literal(file)} WITH CHECKSUM`);
 const h=(await pool.request().query(`RESTORE HEADERONLY FROM DISK=${literal(file)}`)).recordset;
 requireRule(h.length===1 && h[0].DatabaseName===SPEC.target && h[0].IsCopyOnly && h[0].HasBackupChecksums,'BACKUP_HEADER');
 const receipt={run,target:SPEC.target,file,guid:h[0].BackupSetGUID,bytes:String(h[0].BackupSize),verified:true,restoreExecuted:false,terminalHash:before.hash};
 save('backup-receipt.json',receipt);console.log(JSON.stringify(receipt));
} finally {await pool.close();}
