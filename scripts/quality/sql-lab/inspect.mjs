import fs from 'node:fs';
import assert from 'node:assert/strict';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const b=JSON.parse(fs.readFileSync(new URL('../../../temp/sql-lab/binding.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
assert.equal(b.host,'127.0.0.1');assert.equal(b.port,51433);
const c=JSON.parse(fs.readFileSync(b.privateCredentials,'utf8').replace(/^\uFEFF/,''));
const pool=await new sql.ConnectionPool({server:b.host,port:b.port,database:b.database,user:'sa',password:c.saPassword,options:{encrypt:false,trustServerCertificate:true}}).connect();
try {
 const id=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS name")).recordset[0];assert.equal(id.name,'commerce-sql-20260908');
 console.log(JSON.stringify((await pool.request().query(`SELECT id,document_no,status,grand_total FROM dbo.sales_invoices; SELECT id,client_request_id,status,target_entity_id FROM dbo.terminal_sync_queue;
 SELECT id,stock_code,current_stock_qty FROM dbo.products; SELECT id,customer_code,balance FROM dbo.customers;
 SELECT movement_type,amount,balance_effect,sales_invoice_id FROM dbo.customer_movements; SELECT action,entity_id FROM dbo.audit_logs;`)).recordsets));
} finally { await pool.close(); }
