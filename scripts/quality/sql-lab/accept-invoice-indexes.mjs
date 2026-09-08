import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const here = new URL('../../../temp/sql-lab/', import.meta.url);
const binding = JSON.parse(fs.readFileSync(new URL('binding.json', here), 'utf8').replace(/^\uFEFF/, ''));
assert.equal(binding.host, '127.0.0.1'); assert.equal(binding.port, 51433);
assert.equal(binding.name, 'commerce-sql-20260908'); assert.equal(binding.database, 'MELISA_ERP_V2');
const credentials = JSON.parse(fs.readFileSync(binding.privateCredentials, 'utf8').replace(/^\uFEFF/, ''));
const pool = await new sql.ConnectionPool({ server: binding.host, port: binding.port, database: binding.database,
  user: 'sa', password: credentials.saPassword, options: { encrypt: false, trustServerCertificate: true } }).connect();
try {
  const identity = (await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine, DB_NAME() AS db; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine, binding.name); assert.equal(identity[0][0].db, binding.database);
  assert.equal(identity[1][0].fixture_id, 'commerce-no-messaging-20260908');
  const snapshot=async()=> (await pool.request().query('SELECT * FROM dbo.sales_invoice_items ORDER BY id; SELECT * FROM dbo.purchase_invoice_items ORDER BY id;')).recordsets;
  const before=await snapshot();
  const source=fs.readFileSync(new URL('../../../infra/sql/migrations/0019_invoice_item_snapshot_indexes.sql',import.meta.url),'utf8');
  for(let run=0;run<2;run++) {
    const tx=new sql.Transaction(pool);await tx.begin();
    try {for(const batch of source.split(/^\s*GO\s*$/gmi).map(s=>s.trim()).filter(Boolean)) await new sql.Request(tx).batch(batch);await tx.commit();}
    catch(error){await tx.rollback();throw error;}
    assert.deepEqual(await snapshot(),before);
  }
  const indexes=(await pool.request().query("SELECT name,is_disabled FROM sys.indexes WHERE name IN ('IX_sales_invoice_items_invoice_snapshot','IX_purchase_invoice_items_invoice_snapshot')")).recordset;
  assert.equal(indexes.length,2);assert.ok(indexes.every(i=>!i.is_disabled));
  const result={at:new Date().toISOString(),status:'PASS',migration:'0019_invoice_item_snapshot_indexes.sql',sha256:createHash('sha256').update(source).digest('hex'),runs:2,businessRowsUnchanged:true,indexes};
  fs.writeFileSync(new URL('invoice-index-acceptance.json',here),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {await pool.close();}
