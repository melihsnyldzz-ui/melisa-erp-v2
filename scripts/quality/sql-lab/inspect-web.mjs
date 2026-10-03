import fs from 'node:fs';
import assert from 'node:assert/strict';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const here = new URL('../../../temp/sql-lab/', import.meta.url);
const b = JSON.parse(fs.readFileSync(new URL('binding.json', here), 'utf8').replace(/^\uFEFF/, ''));
assert.equal(b.host, '127.0.0.1'); assert.equal(b.port, 51433); assert.equal(b.database, 'MELISA_ERP_V2');
const c = JSON.parse(fs.readFileSync(b.privateCredentials, 'utf8').replace(/^\uFEFF/, ''));
const pool = await new sql.ConnectionPool({ server: b.host, port: b.port, database: b.database, user: 'commerce_test_app', password: c.appPassword, options: { encrypt: false, trustServerCertificate: true } }).connect();
try {
  const id = (await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS name; SELECT fixture_id FROM dbo.commerce_test_fixture")).recordsets;
  assert.equal(id[0][0].name, 'commerce-sql-20260908'); assert.equal(id[1][0].fixture_id, 'commerce-no-messaging-20260908');
  const records = (await pool.request().query(`
    SELECT id,stock_code,current_stock_qty,sales_price,purchase_price,average_cost_try,supplier_id FROM dbo.products WHERE stock_code=N'TEST-WEB-P1';
    SELECT id,customer_code,balance FROM dbo.customers WHERE customer_code=N'TEST-WEB-C1';
    SELECT id,supplier_code,balance FROM dbo.suppliers WHERE supplier_code=N'TEST-WEB-S1';
    SELECT id,document_no,status,grand_total FROM dbo.purchase_invoices WHERE supplier_id IN (SELECT id FROM dbo.suppliers WHERE supplier_code=N'TEST-WEB-S1');
    SELECT id,document_no,status,grand_total FROM dbo.sales_invoices WHERE customer_id IN (SELECT id FROM dbo.customers WHERE customer_code=N'TEST-WEB-C1');
    SELECT movement_type,quantity_in,quantity_out FROM dbo.stock_movements WHERE product_id IN (SELECT id FROM dbo.products WHERE stock_code=N'TEST-WEB-P1');
    SELECT account_code,current_balance FROM dbo.finance_accounts WHERE account_code=N'KASA-TRY';
    SELECT source_type,party_type,amount,direction FROM dbo.finance_account_movements;
  `)).recordsets;
  const [products, customers, suppliers, purchases, sales, movements, accounts, cashMovements] = records;
  const stage = process.argv[2] || 'snapshot';
  if (stage === 'purchase-draft') { assert.equal(products[0].current_stock_qty, 0); assert.equal(suppliers[0].balance, 0); assert.equal(purchases.length, 1); assert.equal(purchases[0].status, 'draft'); assert.equal(purchases[0].grand_total, 120); assert.equal(movements.length, 0); }
  if (stage === 'purchase-final') { assert.equal(products[0].current_stock_qty, 10); assert.equal(suppliers[0].balance, 120); assert.equal(purchases.length, 1); assert.equal(purchases[0].status, 'finalized'); assert.equal(movements.length, 1); }
  if (stage === 'sale-draft') { assert.equal(products[0].current_stock_qty, 10); assert.equal(customers[0].balance, 0); assert.equal(sales.length, 1); assert.equal(sales[0].status, 'draft'); assert.equal(sales[0].grand_total, 60); assert.equal(movements.length, 1); }
  if (stage === 'sale-final') { assert.equal(products[0].current_stock_qty, 8); assert.equal(customers[0].balance, 60); assert.equal(sales.length, 1); assert.equal(sales[0].status, 'finalized'); assert.equal(sales[0].grand_total, 60); assert.equal(movements.length, 2); }
  if (stage === 'finance-final') { assert.equal(products[0].current_stock_qty, 8); assert.equal(customers[0].balance, 40); assert.equal(suppliers[0].balance, 110); assert.equal(accounts[0].current_balance, 10); assert.equal(cashMovements.length, 2); }
  const result = { at: new Date().toISOString(), stage, status: 'PASS', syntheticOnly: true, products, customers, suppliers, purchases, sales, movements, accounts, cashMovements };
  assert.match(stage, /^[a-z-]+$/);
  fs.writeFileSync(new URL(`web-${stage}.json`, here), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await pool.close(); }
