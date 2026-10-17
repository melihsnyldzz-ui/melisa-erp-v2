import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql/msnodesqlv8.js';
import { SPEC, assertTestIdentity, hash, requireRule } from '../src/services/vegaMigrationSpecification.mjs';
export { sql, SPEC, hash, requireRule };
export const sourceRun = 'spec-20260917-01';
export const run = 'native-spec-20260917-02';
export const root = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer/migration-spec');
export const inputDir = path.join(root, sourceRun), runDir = path.join(root, run);
export const readSource = name => JSON.parse(fs.readFileSync(path.join(inputDir, name)));
export const readRun = name => JSON.parse(fs.readFileSync(path.join(runDir, name)));
export const save = (name, value) => { fs.mkdirSync(runDir, { recursive: true }); fs.writeFileSync(path.join(runDir, name), JSON.stringify(value), { flag: 'wx' }); };
export const ident = name => { requireRule(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name), 'SQL_IDENTIFIER_REJECTED'); return `[${name}]`; };
export const literal = value => "N'" + String(value).replaceAll("'", "''") + "'";
export async function getTestPool() {
  class TestPool extends sql.ConnectionPool { request() { return new sql.Request(this); } }
  const pool = new TestPool({ connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${SPEC.server};Database=${SPEC.target};Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`, requestTimeout: 180000, connectionTimeout: 15000 });
  await pool.connect();
  try { assertTestIdentity((await pool.request().query('SELECT @@SERVERNAME server,DB_NAME() [database]')).recordset[0]); return pool; }
  catch (e) { await pool.close(); throw e; }
}
export async function protectedManifest(request) {
  const ids = (await request().query("SELECT DISTINCT i.id FROM dbo.sales_invoices i WHERE ISNULL(i.is_migrated,0)=0 AND (i.terminal_device_id IS NOT NULL OR i.description LIKE N'%terminalClientEventId:%' OR EXISTS(SELECT 1 FROM dbo.terminal_sync_queue q WHERE q.target_entity=N'sales_invoice' AND q.target_entity_id=i.id)) ORDER BY i.id")).recordset.map(r => String(r.id));
  requireRule(ids.length > 0 && ids.every(id => /^\d+$/.test(id)), 'PROTECTED_TERMINAL_SCOPE_REQUIRED');
  const where = { sales_invoices: `id IN(${ids.join(',')})`, sales_invoice_items: `sales_invoice_id IN(${ids.join(',')})`, stock_movements: `source_type=N'sales_invoice' AND source_id IN(${ids.join(',')})`, customer_movements: `sales_invoice_id IN(${ids.join(',')})`, terminal_sync_queue: '1=1' };
  const tables = {};
  const original = readRun('target-schema.json').metadata;
  for (const [table, predicate] of Object.entries(where)) {
    const projection = original.filter(c => c.table === table).map(c => ident(c.column)).join(',');
    const result = (await request().query(`SELECT (SELECT ${projection} FROM dbo.${ident(table)} WHERE ${predicate} ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES) data`)).recordset[0].data;
    tables[table] = { hash: hash(result), count: JSON.parse(result || '[]').length };
  }
  return { ids, tables, hash: hash({ ids, tables }) };
}
