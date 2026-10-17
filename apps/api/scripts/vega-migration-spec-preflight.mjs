// SELECT-only source/TEST discovery. No schema changes, services, resets or imports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPEC, hash, requireRule, assertTestIdentity, migrationWindow } from '../src/services/vegaMigrationSpecification.mjs';

export const identifier = value => { requireRule(/^[A-Za-z_][A-Za-z0-9_ ]{0,127}$/.test(value || ''), 'IDENTIFIER_REJECTED'); return `[${value}]`; };
export function sourceTableKind(name) {
  if (/^F010[234]TBL(STOKLAR|BIRIMLEREX|CARI|DEPOLAR)$/.test(name)) return 'master';
  if (!/^F010[234]D\d{4}TBL[A-Z0-9_]+$/.test(name)) return null;
  if (/SIP|CEK|SENET/.test(name)) return 'excluded_order_or_cheque';
  if (/BASLIK$/.test(name)) return 'document';
  if (/HAREKET$/.test(name)) return 'line_or_auxiliary';
  if (/TBL(STOKHAREKETLERI|CARIHAREKETLERI|CARIGENELHAREKET|KASA|BANKA|BANKAHAREKETLERI)$/.test(name)) return 'movement';
  return 'unclassified';
}
export function projection(columns) {
  return columns.filter(c => !/SIFRE|PASSWORD|TOKEN|SECRET|ANAHTAR|APIKEY|RESIM|IMAGE|FOTO|PICTURE/i.test(c.columnName) && !/image|binary|timestamp|rowversion/i.test(c.dataType)).map(c => {
    const col = identifier(c.columnName);
    return /decimal|numeric|money|float|real|bigint/.test(c.dataType) ? `CONVERT(varchar(100),${col}) ${col}` : /date|time/.test(c.dataType) ? `CONVERT(varchar(40),${col},126) ${col}` : col;
  }).join(',');
}
export const identitySql = "SELECT DB_NAME() [database],IS_SRVROLEMEMBER(N'sysadmin') sysadmin,HAS_PERMS_BY_NAME(NULL,NULL,N'CONTROL SERVER') controlServer,HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'CONTROL') controlDatabase,IS_MEMBER(N'db_owner') dbOwner";
export function assertSourceIdentity(identity) {
  requireRule(identity?.database === SPEC.source && ['sysadmin', 'controlServer', 'controlDatabase', 'dbOwner'].every(k => identity[k] === 0), 'SOURCE_IDENTITY_REJECTED');
}
export function permissionsSql(tables) {
  return tables.map(t => { identifier(t); return `SELECT N'${t}' [table],HAS_PERMS_BY_NAME(N'dbo.${t}',N'OBJECT',N'SELECT') canSelect,${['INSERT', 'UPDATE', 'DELETE', 'ALTER', 'CONTROL'].map(p => `HAS_PERMS_BY_NAME(N'dbo.${t}',N'OBJECT',N'${p}') [${p}]`).join(',')}`; }).join(' UNION ALL ');
}
export function assertReadOnlyPermissions(rows, names) {
  requireRule(rows.length === names.length && new Set(rows.map(r => r.table)).size === names.length && rows.every(r => names.includes(r.table) && r.canSelect === 1 && ['INSERT', 'UPDATE', 'DELETE', 'ALTER', 'CONTROL'].every(p => r[p] === 0)), 'SOURCE_EFFECTIVE_PERMISSIONS_REJECTED');
}
export async function main(args = process.argv.slice(2)) {
  const [run] = args;
  requireRule(args.length === 1 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(run || ''), 'RUN_REQUIRED');
  const directory = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer/migration-spec', run);
  fs.mkdirSync(path.dirname(directory), { recursive: true }); fs.mkdirSync(directory);
  const save = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value), { flag: 'wx' });
  const window = migrationWindow({ endExclusive: new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) });
  const report = { run, at: new Date().toISOString(), specification: SPEC, window, mode: 'SELECT_ONLY', sqlWrites: 0, status: 'RUNNING', issues: [], privateDirectory: directory };
  let sourcePool, targetPool, closeSource;
  try {
    // env.js resolves its file relative to the API directory. Never print values.
    process.chdir(fileURLToPath(new URL('../', import.meta.url)));
    const vega = await import('../src/config/vegaDatabase.js'); closeSource = vega.closeVegaSqlPool;
    sourcePool = await vega.getVegaSqlPool(); sourcePool.config.requestTimeout = 120000;
    const q = async statement => { requireRule(/^SELECT\b/.test(statement), 'SELECT_ONLY'); return (await sourcePool.request().query(statement)).recordset; };
    const identity = (await q(identitySql))[0];
    assertSourceIdentity(identity);
    const metadata = await q("SELECT t.name tableName,c.name columnName,ty.name dataType,c.column_id ordinal FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE s.name=N'dbo' AND (t.name LIKE N'F010[234]%TBL%' OR t.name=N'TBLDONEM') ORDER BY t.name,c.column_id");
    save('source-metadata.json', metadata);
    const tables = [...new Set(metadata.map(c => c.tableName))].filter(t => sourceTableKind(t) || t === 'TBLDONEM');
    for (let i = 0; i < tables.length; i += 40) assertReadOnlyPermissions(await q(permissionsSql(tables.slice(i, i + 40))), tables.slice(i, i + 40));
    report.sourcePermissions = { database: identity.database, tables: tables.length, writePermissions: false };
    const periods = await q('SELECT FIND,IND,DONEM FROM dbo.TBLDONEM ORDER BY FIND,IND'); save('periods.json', periods);
    const selectedPeriods = periods.filter(p => [102, 103, 104].includes(p.FIND) && p.DONEM >= 2020 && p.DONEM <= Number(window.endExclusive.slice(0, 4)));
    report.periods = selectedPeriods;
    const prefixes = selectedPeriods.map(p => `F${String(p.FIND).padStart(4, '0')}D${String(p.IND).padStart(4, '0')}`);
    const selected = tables.filter(t => sourceTableKind(t) === 'master' || prefixes.some(p => t.startsWith(p)));
    const census = [];
    for (let i = 0; i < selected.length; i += 25) {
      const batch = selected.slice(i, i + 25);
      const statements = batch.map(t => {
        const dated = metadata.some(c => c.tableName === t && c.columnName === 'TARIH');
        return `SELECT N'${t}' [table],CONVERT(varchar(30),COUNT_BIG(*)) [rows],${dated ? "CONVERT(varchar(30),MIN(TARIH),126) firstDate,CONVERT(varchar(30),MAX(TARIH),126) lastDate,CONVERT(varchar(30),SUM(CONVERT(bigint,CASE WHEN TARIH IS NULL THEN 1 ELSE 0 END))) nullDates" : 'CAST(NULL AS varchar(30)) firstDate,CAST(NULL AS varchar(30)) lastDate,CAST(NULL AS varchar(30)) nullDates'} FROM dbo.${identifier(t)}`;
      });
      census.push(...await q(statements.join(' UNION ALL ')));
      if (census.length % 250 === 0 || census.length === selected.length) console.log(JSON.stringify({ phase: 'source-census', tables: census.length, total: selected.length }));
    }
    save('source-census.json', census.map(r => ({ ...r, kind: sourceTableKind(r.table) })));
    const captures = [];
    for (const table of selected.filter(t => sourceTableKind(t) === 'master')) {
      const cols = metadata.filter(c => c.tableName === table);
      const statement = `SELECT ${projection(cols)} FROM dbo.${identifier(table)} ORDER BY IND`;
      const rows = await q(statement), again = await q(statement), stable = hash(rows) === hash(again);
      save(`${table}.json`, rows); captures.push({ table, count: rows.length, hash: hash(rows), twoPassStable: stable });
      if (!stable) report.issues.push({ code: 'MASTER_CHANGED_DURING_CAPTURE', table });
    }
    const current = selectedPeriods.filter(p => p.DONEM === Number(window.endExclusive.slice(0, 4)) && p.FIND === 102);
    if (current.length === 1) {
      const table = `F0102D${String(current[0].IND).padStart(4, '0')}TBLSTOKHAREKETLERI`;
      if (selected.includes(table)) {
        const rows = await q(`SELECT STOKNO,DEPO,CONVERT(varchar(100),SUM(GIREN-CIKAN)) quantity,CONVERT(varchar(30),COUNT_BIG(*)) movementCount FROM dbo.${identifier(table)} GROUP BY STOKNO,DEPO ORDER BY STOKNO,DEPO`);
        save('current-quantities.json', { table, basis: 'SOURCE_PERIOD_NET_BEFORE_CANCELLATION_LINK_AUDIT', rows });
      }
    }
    // Dates determine activity; period names alone must not hide cross-period rows.
    const activity = [];
    for (const table of selected.filter(t => /TBLCARIHAREKETLERI$/.test(t))) {
      const rows = await q(`SELECT FIRMANO,CONVERT(varchar(30),COUNT_BIG(*)) movementCount FROM dbo.${identifier(table)} WHERE TARIH>='20200101' AND TARIH<'${window.endExclusive.replaceAll('-', '')}' GROUP BY FIRMANO ORDER BY FIRMANO`);
      activity.push({ table, rows });
    }
    save('party-activity.json', activity); save('source-captures.json', captures);
    report.source = { masterCaptures: captures.length, censusTables: census.length, nonemptyTables: census.filter(t => t.rows !== '0').length, earliestDate: census.filter(t => t.firstDate).map(t => t.firstDate).sort()[0] ?? null };
    // This is a separate, explicitly pinned connection; never inherit the live SQL config.
    const sql = (await import('mssql/msnodesqlv8.js')).default;
    targetPool = new sql.ConnectionPool({ connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${SPEC.server};Database=${SPEC.target};Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`, requestTimeout: 120000, connectionTimeout: 15000 });
    await targetPool.connect();
    const tq = async statement => { requireRule(/^SELECT\b/.test(statement), 'TEST_SELECT_ONLY'); return (await targetPool.request().query(statement)).recordset; };
    const targetIdentity = (await tq('SELECT DB_NAME() [database],@@SERVERNAME server'))[0]; assertTestIdentity(targetIdentity); report.targetIdentity = targetIdentity;
    const targetNames = ['products', 'product_barcodes', 'customers', 'suppliers', 'customer_movements', 'supplier_movements', 'sales_invoices', 'sales_invoice_items', 'purchase_invoices', 'purchase_invoice_items', 'stock_movements', 'finance_accounts', 'finance_account_movements', 'invoice_returns', 'invoice_return_items', 'migration_map', 'terminal_sync_queue', 'personnel'];
    const targetMeta = await tq(`SELECT t.name tableName,c.name columnName,ty.name dataType,c.column_id ordinal FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE s.name=N'dbo' AND t.name IN(${targetNames.map(n => `N'${n}'`).join(',')}) ORDER BY t.name,c.column_id`);
    save('target-metadata.json', targetMeta);
    const targetCaptures = [];
    for (const table of targetNames.filter(t => targetMeta.some(c => c.tableName === t))) {
      const cols = targetMeta.filter(c => c.tableName === table), statement = `SELECT ${projection(cols)} FROM dbo.${identifier(table)} ORDER BY id`;
      const rows = await tq(statement); save(`target-${table}.json`, rows);
      targetCaptures.push({ table, count: rows.length, hash: hash(rows) });
    }
    save('target-captures.json', targetCaptures); report.targetCounts = Object.fromEntries(targetCaptures.map(c => [c.table, c.count]));
    report.status = report.issues.length ? 'SOURCE_REVIEW_REQUIRED' : 'PREFLIGHT_CAPTURED_NOT_MIGRATED';
  } catch (e) { report.status = 'BLOCKED'; report.failure = { code: /^[A-Z_0-9]+$/.test(e.code || e.message) ? e.code || e.message : 'PREFLIGHT_FAILED', sqlNumber: e.number ?? null }; process.exitCode = 1; }
  finally { if (closeSource) await closeSource().catch(() => {}); if (targetPool) await targetPool.close().catch(() => {}); save('preflight.json', report); console.log(JSON.stringify(report)); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(e => { console.error(JSON.stringify({ code: e.code || 'PREFLIGHT_START_FAILED' })); process.exitCode = 1; });
