import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { TARGET, hash, requireRule, mapOpening } from './mapping-opening.mjs';
const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
export const sql = require('mssql/msnodesqlv8.js');
export const privateRoot = 'C:/Sirket/ERP/evidence/VEGA-MIGRATION-TEST-20261004/private';
export const RUN = 'VEGA-OPENING-TEST-20261004-06';
export const ident = value => { requireRule(/^[A-Za-z_][A-Za-z0-9_]*$/.test(value), 'SQL_IDENTIFIER'); return `[${value}]`; };
export function readSource(directory) {
  const resolved = path.resolve(directory);
  requireRule(resolved.toLowerCase().startsWith(path.resolve(privateRoot).toLowerCase() + path.sep), 'PRIVATE_EVIDENCE_REQUIRED');
  const snapshot = JSON.parse(fs.readFileSync(path.join(resolved, 'source-snapshot.json'))), summary = JSON.parse(fs.readFileSync(path.join(resolved, 'source-summary.json')));
  requireRule(hash(snapshot) === summary.snapshotHash, 'SOURCE_HASH_CHANGED');
  requireRule(summary.sourceSELECTOnly && summary.physicalReadOnly && summary.twoPassStable && !summary.source.freshLiveSource, 'FROZEN_READONLY_EVIDENCE_REQUIRED');
  requireRule(summary.source.database === 'VEGA_CAPTURE_20260930_01' && summary.source.server.toLowerCase() === TARGET.server.toLowerCase(), 'SOURCE_IDENTITY_CHANGED');
  return { snapshot, summary, mapped: mapOpening(snapshot) };
}
export async function testPool() {
  class Pool extends sql.ConnectionPool { request() { return new sql.Request(this); } }
  const pool = await new Pool({ connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=.\\MELISADEV;Database=${TARGET.database};Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`, requestTimeout: 180000 }).connect();
  const identity = (await pool.request().query('SELECT @@SERVERNAME server,DB_NAME() [database],IS_SRVROLEMEMBER(N\'sysadmin\') admin')).recordset[0];
  requireRule(identity.server.toLowerCase() === TARGET.server.toLowerCase() && identity.database === TARGET.database && identity.admin === 1, 'EXACT_ADMIN_TEST_TARGET_REQUIRED');
  return pool;
}
export const protectedTables = ['sales_invoices', 'sales_invoice_items', 'purchase_invoices', 'purchase_invoice_items', 'invoice_returns', 'invoice_return_items', 'finance_accounts', 'finance_account_movements', 'cash_adjustments', 'cash_drawer_accounts', 'cash_drawers', 'cash_expenses', 'cash_session_counts', 'cash_sessions', 'cash_transfers', 'terminal_sync_queue', 'inventory_cutovers', 'inventory_cutover_items', 'inventory_documents', 'inventory_document_items', 'financial_documents', 'financial_document_items', 'document_links','stock_movements','customer_movements','supplier_movements','audit_logs'];
export async function fingerprints(request, tables = protectedTables) {
  const result = {};
  for (const table of tables) {
    const predicate=['stock_movements','customer_movements','supplier_movements'].includes(table)?`WHERE ISNULL(x.migration_run_id,N'')<>N'${RUN}'`:'';
    const rows = (await request().query(`SELECT x.id,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM dbo.${ident(table)} x ${predicate} ORDER BY x.id`)).recordset;
    result[table] = { count: rows.length, hash: hash(rows) };
  }
  return result;
}
export function savePrivate(name, data, replace = false) {
  const dir = path.join(privateRoot, RUN); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data), { flag: replace ? 'w' : 'wx' });
}
export function readPrivate(name) { return JSON.parse(fs.readFileSync(path.join(privateRoot, RUN, name))); }
