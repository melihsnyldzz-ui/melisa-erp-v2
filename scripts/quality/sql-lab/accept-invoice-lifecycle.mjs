import fs from 'node:fs';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const here = new URL('../../../temp/sql-lab/', import.meta.url);
const read = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const binding = read(new URL('binding.json', here)), secret = read(binding.privateCredentials);
assert.equal(binding.host, '127.0.0.1'); assert.equal(binding.port, 51433);
assert.equal(binding.name, 'commerce-sql-20260908'); assert.equal(binding.database, 'MELISA_ERP_V2');
assert.equal(fs.existsSync('.env'), false); assert.equal(fs.existsSync('.env.local'), false);
for (const key of Object.keys(process.env)) if (!/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|COMSPEC|PATHEXT|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE)$/i.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: 'test', SQL_SERVER: binding.host, SQL_PORT: '51433', SQL_DATABASE: binding.database,
  SQL_USER: 'commerce_test_app', SQL_PASSWORD: secret.appPassword, SQL_READ_ONLY: 'false', SQL_TRUSTED_CONNECTION: 'false' });
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const values = Array.isArray(args[0]) ? args[0] : args, options = values[0];
  const host = typeof options === 'object' ? options.host : values[1], port = typeof options === 'object' ? options.port : options;
  assert.equal(host, '127.0.0.1'); assert.equal(Number(port), 51433);
  return connect.apply(this, args);
};
const deny = () => { throw new Error('CASH_LAB_EXTERNAL_ACTION_DENIED'); };
tls.connect = deny; net.Server.prototype.listen = deny; dgram.Socket.prototype.send = deny; globalThis.fetch = deny;
for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) child[key] = deny;
syncBuiltinESMExports();
const { getSqlPool } = await import('../../../apps/api/src/config/database.js');
const pool = await getSqlPool();
const api = await import('../../../apps/api/src/services/invoiceDraftService.js');
const cash = await import('../../../apps/api/src/services/cashRegisterService.js');
const actor = read(new URL('fixture.json', here)).actor;
const tables = ['audit_logs','stock_movements','customer_movements','supplier_movements','finance_account_movements',
  'sales_invoice_items','purchase_invoice_items','sales_invoices','purchase_invoices','cash_session_counts','cash_sessions',
  'cash_drawer_accounts','cash_drawers','finance_accounts','products','customers','suppliers'];
async function snapshot() { const data = {}; for (const table of tables) data[table] = (await pool.request().query('SELECT * FROM dbo.'+table+' ORDER BY id;')).recordset; return data; }
const prefix = 'TEST-INVOICE-LIFE', results = [], vulnerable = process.argv.includes('--expect-vulnerable');
let before, productId;
async function value(table, column, id) { return Number((await pool.request().input('id',sql.BigInt,id).query('SELECT '+column+' value FROM dbo.'+table+' WHERE id=@id;')).recordset[0].value); }
const counts = amount => ({TRY:{physicalOpening:amount,physicalClosing:amount,carryForward:amount},USD:{},EUR:{}});
try {
  const identity=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) machine,DB_NAME() db,IS_SRVROLEMEMBER('sysadmin') sa; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine,binding.name);assert.equal(identity[0][0].db,binding.database);assert.equal(identity[0][0].sa,0);assert.equal(identity[1][0].fixture_id,'commerce-no-messaging-20260908');
  before=await snapshot();assert.ok(before.cash_sessions.every(row=>row.session_status==='closed'));
  assert.ok(!before.customers.some(row=>row.customer_code==='PESIN-TRY'),'Alias must be unused for an isolated cash customer');
  productId=Number((await pool.request().input('code',sql.NVarChar(80),prefix).query("INSERT dbo.products(stock_code,name,currency_code,sales_price,purchase_price,average_cost_try,current_stock_qty,is_active,is_deleted) OUTPUT inserted.id VALUES(@code,@code,N'TRY',25,12,0,0,1,0);")).recordset[0].id);
  const customerId=Number((await pool.request().input('code',sql.NVarChar(80),prefix).query("INSERT dbo.customers(customer_code,name,currency_code,balance) OUTPUT inserted.id VALUES(@code,@code,N'TRY',0);")).recordset[0].id);
  const cashCustomerId=Number((await pool.request().query("INSERT dbo.customers(customer_code,name,currency_code,balance) OUTPUT inserted.id VALUES(N'PESIN-TRY',N'TEST-INVOICE-LIFE CASH',N'TRY',0);")).recordset[0].id);
  const supplierId=Number((await pool.request().input('code',sql.NVarChar(80),prefix).query("INSERT dbo.suppliers(supplier_code,name,currency_code,balance) OUTPUT inserted.id VALUES(@code,@code,N'TRY',0);")).recordset[0].id);
  const common={documentDate:'2099-03-01',documentCurrency:'TRY',exchangeRate:1,description:prefix};
  await pool.request().input('product',sql.BigInt,productId).input('supplier',sql.BigInt,supplierId).query('UPDATE dbo.products SET supplier_id=@supplier WHERE id=@product;');
  const purchase={...common,supplierId,supplierCurrency:'TRY',items:[{productId,quantity:10,purchasePrice:10,currency:'TRY'}]};
  const p=await api.createPurchaseDraft(purchase,actor);await api.finalizePurchaseInvoice(p.id,actor);
  assert.equal(await value('products','current_stock_qty',productId),10);assert.equal(await value('suppliers','balance',supplierId),100);
  const revisedPurchase={...purchase,items:[{productId,quantity:8,purchasePrice:12,currency:'TRY'}]};
  await api.updatePurchaseDraft(p.id,revisedPurchase,actor);
  assert.equal(await value('products','current_stock_qty',productId),8);assert.equal(await value('products','average_cost_try',productId),12);assert.equal(await value('suppliers','balance',supplierId),96);
  results.push({case:'real purchase finalize and correction',stock:8,averageCost:12,supplierBalance:96});
  const sale={...common,customerId,customerCurrency:'TRY',items:[{productId,quantity:2,unitPrice:20,currency:'TRY'}]};
  const s=await api.createSalesDraft(sale,actor);await api.finalizeSalesInvoice(s.id,actor);
  assert.equal(await value('products','current_stock_qty',productId),6);assert.equal(await value('customers','balance',customerId),40);
  const revisedSale={...sale,items:[{productId,quantity:3,unitPrice:25,currency:'TRY'}]};
  await api.updateSalesDraft(s.id,revisedSale,actor);
  assert.equal(await value('products','current_stock_qty',productId),5);assert.equal(await value('customers','balance',customerId),75);
  const cancelResults=await Promise.allSettled([1,2].map(()=>api.cancelSalesInvoice(s.id,{reason:prefix},actor)));
  assert.equal(cancelResults.filter(row=>row.status==='fulfilled').length,1);assert.equal(cancelResults.find(row=>row.status==='rejected').reason.code,'SALES_CANCEL_STATUS_INVALID');
  assert.equal(await value('products','current_stock_qty',productId),8);assert.equal(await value('customers','balance',customerId),0);
  await assert.rejects(api.updateSalesDraft(s.id,revisedSale,actor),{code:'SALES_DRAFT_STATUS_INVALID'});
  results.push({case:'real sale finalize correction concurrent cancel and cancelled edit rejection',stock:8,customerBalance:0,cancelledOnce:true});

  const drawerId=Number((await pool.request().input('code',sql.NVarChar(40),prefix).query('INSERT dbo.cash_drawers(drawer_code,drawer_name) OUTPUT inserted.id VALUES(@code,@code);')).recordset[0].id);
  let cashAccountId;
  for(const currency of ['TRY','USD','EUR']){
    const account=Number((await pool.request().input('code',sql.NVarChar(40),prefix+'-'+currency).input('currency',sql.NVarChar(3),currency).query("INSERT dbo.finance_accounts(account_code,account_name,account_type,currency_code) OUTPUT inserted.id VALUES(@code,@code,N'cash',@currency);")).recordset[0].id);
    if(currency==='TRY')cashAccountId=account;
    await pool.request().input('drawer',sql.BigInt,drawerId).input('account',sql.BigInt,account).input('currency',sql.NVarChar(3),currency).query('INSERT dbo.cash_drawer_accounts(drawer_id,currency_code,finance_account_id) VALUES(@drawer,@currency,@account);');
  }
  const session=await cash.openCashSession({drawerId,businessDate:common.documentDate,counts:counts(0)},actor);
  const cashSale={...sale,customerId:cashCustomerId,items:[{productId,quantity:1,unitPrice:20,currency:'TRY'}]};
  const c=await api.createSalesDraft(cashSale,actor);await api.finalizeSalesInvoice(c.id,actor);
  assert.equal(await value('finance_accounts','current_balance',cashAccountId),20);assert.equal(await value('customers','balance',cashCustomerId),0);
  const cashEdit={...cashSale,items:[{productId,quantity:1,unitPrice:30,currency:'TRY'}]};
  await api.updateSalesDraft(c.id,cashEdit,actor);assert.equal(await value('finance_accounts','current_balance',cashAccountId),30);
  await cash.closeCashSession({sessionId:session.session.id,counts:counts(30)},actor);
  const closedSnapshot=await snapshot();
  const unsafeEdit={...cashEdit,items:[{productId,quantity:1,unitPrice:40,currency:'TRY'}]};
  if(vulnerable){
    await api.updateSalesDraft(c.id,unsafeEdit,actor);
    assert.equal(await value('finance_accounts','current_balance',cashAccountId),40);
    const observed=await cash.getCashRegisterOverview({drawerId,businessDate:common.documentDate});
    assert.equal(observed.session.status,'closed');
    results.push({case:'REPRODUCED closed cash history changes on invoice correction',counted:30,accountAfter:40,reportedExpected:observed.currencies[0].expected});
  }else{
    await assert.rejects(api.updateSalesDraft(c.id,unsafeEdit,actor),{code:'SALES_CORRECTION_CASH_SESSION_CLOSED'});
    assert.deepEqual(await snapshot(),closedSnapshot);
    results.push({case:'closed cash monetary correction rejected with complete rollback',counted:30,accountAfter:30});
    await assert.rejects(api.updateSalesDraft(c.id,{...cashEdit,documentDate:'2099-03-02'},actor),{code:'SALES_CORRECTION_CASH_SESSION_CLOSED'});
    assert.deepEqual(await snapshot(),closedSnapshot);
    await api.updateSalesDraft(c.id,{...cashEdit,description:prefix+' note'},actor);
    const noteSnapshot=await snapshot();
    assert.deepEqual(noteSnapshot.finance_account_movements,closedSnapshot.finance_account_movements);
    assert.deepEqual(noteSnapshot.finance_accounts,closedSnapshot.finance_accounts);
    const reopened=await cash.openCashSession({drawerId,businessDate:'2099-03-02',counts:counts(30)},actor);
    const reopenedSnapshot=await snapshot();
    await assert.rejects(api.updateSalesDraft(c.id,unsafeEdit,actor),{code:'SALES_CORRECTION_CASH_SESSION_CLOSED'});
    assert.deepEqual(await snapshot(),reopenedSnapshot);
    await cash.closeCashSession({sessionId:reopened.session.id,counts:counts(30)},actor);
    results.push({case:'closed receipt date locked, note edit leaves finance untouched, newer open session cannot unlock history'});
  }
  await api.cancelSalesInvoice(c.id,{reason:prefix},actor);
  assert.equal(await value('products','current_stock_qty',productId),8);
  assert.equal(await value('customers','balance',cashCustomerId),vulnerable?-40:-30);
  assert.equal(await value('finance_accounts','current_balance',cashAccountId),vulnerable?40:30);
  results.push({case:'cash sale cancellation retains receipt as customer credit; no automatic refund',credit:vulnerable?40:30});
  const purchaseCancels=await Promise.allSettled([1,2].map(()=>api.cancelPurchaseInvoice(p.id,{reason:prefix},actor)));
  assert.equal(purchaseCancels.filter(row=>row.status==='fulfilled').length,1);assert.equal(purchaseCancels.find(row=>row.status==='rejected').reason.code,'PURCHASE_CANCEL_STATUS_INVALID');
  assert.equal(await value('products','current_stock_qty',productId),0);assert.equal(await value('products','average_cost_try',productId),0);assert.equal(await value('suppliers','balance',supplierId),0);
  results.push({case:'purchase concurrent cancellation returns net stock cost and supplier balance to zero'});
}finally{
  try{
    if(before){const current=await snapshot();for(const table of tables)for(const row of before[table])assert.deepEqual(current[table].find(value=>value.id===row.id),row,'Existing '+table+' changed');
      for(const table of tables){const old=new Set(before[table].map(row=>row.id));for(const row of current[table].filter(value=>!old.has(value.id)))await pool.request().input('id',sql.BigInt,row.id).query('DELETE FROM dbo.'+table+' WHERE id=@id;');}
      assert.deepEqual(await snapshot(),before);
    }
  }finally{await pool.close();}
}
const evidence={at:new Date().toISOString(),status:vulnerable?'REPRODUCED_CLOSED_CASH_CORRECTION':'PASS_INVOICE_LIFECYCLE_SERVICES',results,originalTablesPreserved:tables.length,syntheticRowsRemoved:true};
fs.writeFileSync(new URL('invoice-lifecycle-'+(vulnerable?'before':'after')+'.json',here),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
