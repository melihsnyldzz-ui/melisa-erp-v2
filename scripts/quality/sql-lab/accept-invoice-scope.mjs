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
  SQL_USER:'commerce_test_app', SQL_PASSWORD:credentials.appPassword, SQL_READ_ONLY:'true', SQL_TRUSTED_CONNECTION:'false', SQL_ENCRYPT:'false', SQL_TRUST_SERVER_CERTIFICATE:'true' });
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
const { getSqlPool } = await import('../../../apps/api/src/config/database.js');
const pool = await getSqlPool();
try {
  const identity = (await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine, DB_NAME() AS db, HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS ddl, IS_SRVROLEMEMBER('sysadmin') AS sysadmin; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine, binding.name); assert.equal(identity[0][0].db, binding.database);
  assert.equal(identity[0][0].ddl, 0); assert.equal(identity[0][0].sysadmin, 0);
  assert.equal(identity[1][0].fixture_id, 'commerce-no-messaging-20260908');

  const api=await import('../../../apps/api/src/services/invoiceDraftService.js');
  const snapshot=async()=>JSON.stringify((await pool.request().query('SELECT id,current_stock_qty FROM dbo.products ORDER BY id; SELECT id,balance FROM dbo.customers ORDER BY id; SELECT id,balance FROM dbo.suppliers ORDER BY id; SELECT id,current_balance FROM dbo.finance_accounts ORDER BY id; SELECT COUNT_BIG(*) n FROM dbo.stock_movements; SELECT COUNT_BIG(*) n FROM dbo.finance_account_movements; SELECT id,status,grand_total FROM dbo.sales_invoices ORDER BY id; SELECT id,status,grand_total FROM dbo.purchase_invoices ORDER BY id;')).recordsets);
  const before=await snapshot();
  const checks=[];
  for(const [kind,party,list] of [['sales','customer',api.getSalesDraftsList],['purchase','supplier',api.getPurchaseDraftsList]]) {
    const partyIds=(await pool.request().query('SELECT id FROM dbo.'+(party==='customer'?'customers':'suppliers')+' ORDER BY id')).recordset.map(r=>String(r.id));
    const products=(await pool.request().query('SELECT id FROM dbo.products ORDER BY id')).recordset.map(r=>String(r.id));
    const cases=[{},...products.map(productId=>({productId})),...partyIds.map(id=>({[party+'Id']:id})),{productId:'9223372036854775807'},{[party+'Id']:'9223372036854775807'},...products.flatMap(productId=>partyIds.map(id=>({productId,[party+'Id']:id})))];
    for(const scope of cases)for(const status of ['ALL','FINALIZED']) {
      const query={...scope,status,limit:500,page:1};
      const result=await list(query);
      const expected=(await pool.request().input('productId',scope.productId||null).input('partyId',scope[party+'Id']||null).input('status',status==='ALL'?null:status.toLowerCase()).query("SELECT h.id FROM dbo."+kind+"_invoices h WHERE (@partyId IS NULL OR h."+party+"_id=@partyId) AND (@productId IS NULL OR EXISTS(SELECT 1 FROM dbo."+kind+"_invoice_items i WHERE i."+kind+"_invoice_id=h.id AND i.product_id=@productId)) AND (@status IS NULL OR h.status=@status) AND COALESCE(h.description,N'' ) NOT LIKE N'%TEST_ARCHIVED%' ORDER BY h.created_at DESC,h.id DESC")).recordset.map(r=>String(r.id));
      assert.deepEqual(result.data.map(r=>String(r.id)),expected);
      assert.equal(result.meta.total,expected.length);
      assert.equal(result.meta.filters.productId,scope.productId||null);
      assert.equal(result.meta.filters[party+'Id'],scope[party+'Id']||null);
      checks.push({kind,scope,status,ids:expected,total:result.meta.total});
    }
  }
  assert.deepEqual(await snapshot(),before);
  const record={at:new Date().toISOString(),status:'PASS_READ_ONLY_SQL_INVOICE_SCOPE',checks,businessStateUnchanged:true,businessWrites:0,messagingActions:0};
  fs.writeFileSync(new URL('invoice-scope-sql.json',here),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({status:record.status,checks:checks.length,businessWrites:0}));
} finally {await pool.close();}
