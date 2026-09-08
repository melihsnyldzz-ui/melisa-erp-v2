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
  const snapshot = async () => (await pool.request().query('SELECT id, stock_code, current_stock_qty, sales_price FROM dbo.products ORDER BY id; SELECT id,balance FROM dbo.suppliers ORDER BY id;')).recordsets;
  const before = await snapshot();
  const hasLink = (await pool.request().query("SELECT COL_LENGTH(N'dbo.products',N'supplier_id') AS size")).recordset[0].size !== null;
  const links = async () => (await pool.request().query('SELECT id,supplier_id FROM dbo.products ORDER BY id')).recordset;
  const expectedLinks = hasLink ? await links() : before[0].map(row => ({ id: row.id, supplier_id: null }));
  const source = fs.readFileSync(new URL('../../../infra/sql/migrations/0018_product_supplier_link.sql', import.meta.url), 'utf8');
  for (let run = 0; run < 2; run++) {
    const tx = new sql.Transaction(pool); await tx.begin();
    try {
      for (const batch of source.split(/^\s*GO\s*$/gmi).map(s => s.trim()).filter(Boolean)) await new sql.Request(tx).batch(batch);
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; }
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(await links(), expectedLinks);
  }
  const unassigned = (await pool.request().query('SELECT COUNT(*) AS count FROM dbo.products WHERE supplier_id IS NULL')).recordset[0].count;
  assert.equal(unassigned, expectedLinks.filter(row => row.supplier_id === null).length);
  await assert.rejects(pool.request().query('UPDATE dbo.products SET supplier_id = -999999 WHERE id = (SELECT MIN(id) FROM dbo.products)'), error => error.number === 547);
  assert.deepEqual(await snapshot(), before);
  const evidence = { at: new Date().toISOString(), status: 'PASS', syntheticOnly: true, migration: '0018_product_supplier_link.sql', sha256: createHash('sha256').update(source).digest('hex'), runs: 2, businessValuesUnchanged: true, unassignedProducts: unassigned, orphanSupplierRejected: true };
  fs.writeFileSync(new URL('product-schema-acceptance.json', here), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await pool.close(); }
