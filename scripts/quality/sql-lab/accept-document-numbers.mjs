import fs from 'node:fs';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const here = new URL('../../../temp/sql-lab/', import.meta.url);
const binding = JSON.parse(fs.readFileSync(new URL('binding.json', here), 'utf8').replace(/^\uFEFF/, ''));
assert.equal(binding.host, '127.0.0.1'); assert.equal(binding.port, 51433);
assert.equal(binding.database, 'MELISA_ERP_V2'); assert.equal(binding.name, 'commerce-sql-20260908');
const credentials = JSON.parse(fs.readFileSync(binding.privateCredentials, 'utf8').replace(/^\uFEFF/, ''));
assert.equal(fs.existsSync('.env'), false); assert.equal(fs.existsSync('.env.local'), false);
for (const key of Object.keys(process.env)) if (!/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|PROGRAMFILES|SYSTEMDRIVE)$/i.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV:'test', SQL_SERVER:binding.host, SQL_PORT:String(binding.port), SQL_DATABASE:binding.database,
  SQL_USER:'commerce_test_app', SQL_PASSWORD:credentials.appPassword, SQL_READ_ONLY:'false', SQL_TRUSTED_CONNECTION:'false', SQL_ENCRYPT:'false', SQL_TRUST_SERVER_CERTIFICATE:'true' });
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0] : args;
  const options = first[0]; const host = typeof options === 'object' ? options.host : first[1]; const port = typeof options === 'object' ? options.port : options;
  assert.equal(host, '127.0.0.1'); assert.equal(Number(port), 51433);
  return originalConnect.apply(this, args);
};
const deny = () => { throw new Error('SQL_LAB_EXTERNAL_ACTION_DENIED'); };
tls.connect=deny; net.Server.prototype.listen=deny; dgram.Socket.prototype.send=deny; globalThis.fetch=deny;
for (const key of ['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork']) child[key]=deny;
syncBuiltinESMExports();
const { getSqlPool, getSqlDriver } = await import('../../../apps/api/src/config/database.js');
const pool = await getSqlPool();
try {
  const identity = (await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine, DB_NAME() AS db, HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS ddl, IS_SRVROLEMEMBER('sysadmin') AS sysadmin; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine, binding.name); assert.equal(identity[0][0].db, binding.database);
  assert.equal(identity[0][0].ddl, 0); assert.equal(identity[0][0].sysadmin, 0);
  assert.equal(identity[1][0].fixture_id, 'commerce-no-messaging-20260908');
  const ids = (await pool.request().query("SELECT id FROM dbo.products WHERE stock_code=N'TEST-WEB-P1'; SELECT id FROM dbo.customers WHERE customer_code=N'TEST-WEB-C1'; SELECT id FROM dbo.suppliers WHERE supplier_code=N'TEST-WEB-S1';")).recordsets;
  assert.ok(ids.every(rows => rows.length === 1));
  const productId = Number(ids[0][0].id), customerId = Number(ids[1][0].id), supplierId = Number(ids[2][0].id);
  const snapshot = async () => (await pool.request().query(`
    SELECT id,current_stock_qty FROM dbo.products ORDER BY id;
    SELECT id,balance FROM dbo.customers ORDER BY id;
    SELECT id,balance FROM dbo.suppliers ORDER BY id;
    SELECT id,current_balance FROM dbo.finance_accounts ORDER BY id;
    SELECT COUNT(*) AS count FROM dbo.stock_movements;
    SELECT COUNT(*) AS count FROM dbo.customer_movements;
    SELECT COUNT(*) AS count FROM dbo.supplier_movements;
    SELECT COUNT(*) AS count FROM dbo.finance_account_movements;
  `)).recordsets;
  const before = await snapshot();
  const oldHeaders = (await pool.request().query('SELECT id,document_no,status FROM dbo.sales_invoices ORDER BY id; SELECT id,document_no,status FROM dbo.purchase_invoices ORDER BY id;')).recordsets;
  const api = await import('../../../apps/api/src/services/invoiceDraftService.js');
  const common = { documentDate:new Date().toISOString().slice(0,10), documentCurrency:'TRY', exchangeRate:1, description:'TEST document number acceptance: draft only' };
  const sale = { ...common, customerId, customerCurrency:'TRY', items:[{productId,quantity:1,unitPrice:30,currency:'TRY'}] };
  const purchase = { ...common, supplierId, supplierCurrency:'TRY', items:[{productId,quantity:1,purchasePrice:12,currency:'TRY'}] };
  const settled = await Promise.allSettled([
    ...Array.from({length:4}, () => api.createSalesDraft(sale)),
    ...Array.from({length:4}, () => api.createPurchaseDraft(purchase)),
  ]);
  const failures = settled.filter(result => result.status === 'rejected');
  assert.equal(failures.length, 0, failures.map(result => result.reason?.code || result.reason?.message).join('; '));
  const results = settled.map(result => result.value);
  for (const [index, result] of results.entries()) {
    assert.equal(result.documentNo, `${index < 4 ? 'SDR' : 'PDR'}-${result.id}`);
    assert.equal(result.status, 'DRAFT');
  }
  assert.equal(new Set(results.map(row => row.documentNo)).size, 8);
  const saleUpdated = await api.updateSalesDraft(results[0].id, { ...sale, documentNo:'   ' });
  const purchaseUpdated = await api.updatePurchaseDraft(results[4].id, { ...purchase, documentNo:'' });
  assert.equal(saleUpdated.documentNo, results[0].documentNo);
  assert.equal(purchaseUpdated.documentNo, results[4].documentNo);
  const custom = `LAB-REF-${results[1].id}`;
  assert.equal((await api.updateSalesDraft(results[1].id, {...sale,documentNo:custom})).documentNo, custom);
  assert.equal((await api.updatePurchaseDraft(results[5].id, {...purchase,documentNo:custom})).documentNo, custom);
  const customSale = await api.createSalesDraft({...sale, documentNo:`LAB-S-${results[2].id}`});
  const customPurchase = await api.createPurchaseDraft({...purchase, documentNo:`LAB-P-${results[6].id}`});
  assert.equal(customSale.documentNo, `LAB-S-${results[2].id}`);
  assert.equal(customPurchase.documentNo, `LAB-P-${results[6].id}`);
  const driver = getSqlDriver(); const transaction = new driver.Transaction(pool);
  await transaction.begin();
  let rolledBackId;
  try {
    const draft = await api.createSalesDraft(sale, null, { pool, sqlDriver:driver, transaction });
    rolledBackId = draft.id;
    assert.equal(draft.documentNo, `SDR-${draft.id}`);
  } finally { await transaction.rollback(); }
  assert.equal((await pool.request().input('id', rolledBackId).query('SELECT id FROM dbo.sales_invoices WHERE id=@id')).recordset.length, 0);
  assert.deepEqual(await snapshot(), before);
  const newHeaders = (await pool.request().query('SELECT id,document_no,status FROM dbo.sales_invoices ORDER BY id; SELECT id,document_no,status FROM dbo.purchase_invoices ORDER BY id;')).recordsets;
  for (let i=0;i<2;i++) assert.deepEqual(newHeaders[i].filter(row => oldHeaders[i].some(old => old.id===row.id)), oldHeaders[i]);
  const evidence = { at:new Date().toISOString(), status:'PASS_REAL_SQL_DOCUMENT_NUMBERS', syntheticOnly:true, parallelDrafts:8, customDrafts:2, committedDrafts:10, rolledBackDrafts:1,
    checks:['parallel automatically numbered sales and purchases are distinct','blank edits preserve assigned numbers','custom create and edit numbers preserved','number assignment follows owning transaction rollback','existing document numbers unchanged','drafts have no stock customer supplier or cash effects'],
    generated:results.map(row => ({id:row.id,documentNo:row.documentNo})), commercialBalanceDelta:0, messagingRequests:0 };
  fs.writeFileSync(new URL('document-number-acceptance.json',here),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
} finally { await pool.close(); }
