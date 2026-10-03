import fs from 'node:fs';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const here=new URL('../../../temp/sql-lab/',import.meta.url);
const replayOnly=process.argv.includes('--replay-only');
const outputName=replayOnly?'terminal-replay-acceptance.json':'terminal-acceptance.json';
const binding=JSON.parse(fs.readFileSync(new URL('binding.json',here),'utf8').replace(/^\uFEFF/,''));
const fixture=JSON.parse(fs.readFileSync(new URL('fixture.json',here),'utf8'));
assert.equal(binding.host,'127.0.0.1'); assert.equal(binding.port,51433); assert.equal(binding.name,'commerce-sql-20260908');
assert.equal(binding.database,'MELISA_ERP_V2'); assert.equal(fixture.purpose,'commerce-no-messaging-20260908');
const credentials=JSON.parse(fs.readFileSync(binding.privateCredentials,'utf8').replace(/^\uFEFF/,''));
assert.equal(fs.existsSync('.env'),false); assert.equal(fs.existsSync('.env.local'),false);
for(const key of Object.keys(process.env)) if(/^(SQL_|VEGA_|WHATSAPP|CHATWOOT|EVOLUTION|JWT_|AUTH_)/.test(key)) delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',SQL_SERVER:binding.host,SQL_PORT:String(binding.port),SQL_DATABASE:binding.database,
  SQL_USER:'commerce_test_app',SQL_PASSWORD:credentials.appPassword,SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',SQL_ENCRYPT:'false',SQL_TRUST_SERVER_CERTIFICATE:'true'});
const originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){ const first=Array.isArray(args[0])?args[0]:args; const options=first[0];
  const host=typeof options==='object'?options.host:first[1]; const port=typeof options==='object'?options.port:options;
  if(host!=='127.0.0.1'||Number(port)!==51433) throw new Error('SQL_LAB_OTHER_NETWORK_DENIED');
  return originalConnect.apply(this,args);
};
const deny=()=>{throw new Error('SQL_LAB_EXTERNAL_ACTION_DENIED');};
tls.connect=deny; net.Server.prototype.listen=deny; dgram.Socket.prototype.send=deny;globalThis.fetch=deny;
for(const key of ['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork']) child[key]=deny;
syncBuiltinESMExports();
const admin=new sql.ConnectionPool({server:binding.host,port:binding.port,database:binding.database,user:'sa',password:credentials.saPassword,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0}});
let appPool; let trigger=false;
const evidence={at:new Date().toISOString(),target:{host:binding.host,port:binding.port,name:binding.name,database:binding.database},driver:'tedious',syntheticDataOnly:true,checks:[]};
try {
  await admin.connect();
  const identity=(await admin.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine, DB_NAME() AS db; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine,binding.name);assert.equal(identity[0][0].db,binding.database);assert.equal(identity[1][0].fixture_id,fixture.purpose);
  const database=await import('../../../apps/api/src/config/database.js'); appPool=await database.getSqlPool();
  const permissions=(await appPool.request().query("SELECT HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS canCreateTable, HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') AS canControl, IS_SRVROLEMEMBER('sysadmin') AS isSysadmin, USER_NAME() AS principal")).recordset[0];
  assert.equal(permissions.canCreateTable,0);assert.equal(permissions.canControl,0);assert.equal(permissions.isSysadmin,0);assert.equal(permissions.principal,'commerce_test_app');
  evidence.permissions=permissions;
  const {submitTerminalSale}=await import('../../../apps/api/src/services/terminalService.js');
  const {getFinanceAccounts}=await import('../../../apps/api/src/services/financeService.js');
  const snapshot=async()=> (await admin.request().query(`
    SELECT id,current_stock_qty FROM dbo.products ORDER BY id;
    SELECT id,balance FROM dbo.customers ORDER BY id;
    SELECT (SELECT COUNT(*) FROM dbo.sales_invoices) invoices,(SELECT COUNT(*) FROM dbo.sales_invoice_items) items,
      (SELECT COUNT(*) FROM dbo.stock_movements) stockMovements,(SELECT COUNT(*) FROM dbo.customer_movements) customerMovements,
      (SELECT COUNT(*) FROM dbo.finance_account_movements) financeMovements,(SELECT COUNT(*) FROM dbo.audit_logs) audits,
      (SELECT COUNT(*) FROM dbo.terminal_sync_queue) ledger;
  `)).recordsets;
  if(replayOnly) {
    const previous=JSON.parse(fs.readFileSync(new URL('last-terminal-request.json',here),'utf8'));
    const before=await snapshot();
    const result=await submitTerminalSale(previous.payload,fixture.actor);
    assert.equal(result.duplicate,true);assert.equal(result.invoiceId,previous.invoiceId);
    assert.deepEqual(await snapshot(),before);
    evidence.checks.push({case:'fresh process replays durable SQL ledger without commercial changes',status:'PASS',invoiceId:result.invoiceId,businessDelta:0});
    evidence.status='PASS_DURABLE_SQL_REPLAY';
    fs.writeFileSync(new URL(outputName,here),JSON.stringify(evidence,null,2)+'\n');
    console.log(JSON.stringify(evidence));
  } else {
  const prefix=`TEST-SQL-${Date.now()}`;
  const payload={clientEventId:`${prefix}-SAME`,terminalCode:'TEST-DEVICE',customerId:fixture.customerId,documentNumber:`T${Date.now()}`,
    documentCurrency:'TRY',exchangeRate:1,note:'Synthetic SQL acceptance',items:fixture.products.map((p,i)=>({productId:p.id,barcode:`TEST-BAR-${p.id}`,quantity:i+1,unitPrice:p.price,currency:'TRY'}))};
  const before=await snapshot();
  const results=await Promise.all(Array.from({length:4},()=>submitTerminalSale(payload,fixture.actor)));
  assert.equal(results.filter(r=>!r.duplicate).length,1);assert.equal(new Set(results.map(r=>r.invoiceId)).size,1);
  const after=await snapshot(); const invoiceId=results[0].invoiceId;
  fs.writeFileSync(new URL('last-terminal-request.json',here),JSON.stringify({payload,invoiceId},null,2)+'\n');
  assert.equal(after[2][0].invoices-before[2][0].invoices,1);assert.equal(after[2][0].ledger-before[2][0].ledger,1);
  assert.equal(after[2][0].stockMovements-before[2][0].stockMovements,2);assert.equal(after[2][0].customerMovements-before[2][0].customerMovements,1);
  assert.equal(before[0][0].current_stock_qty-after[0][0].current_stock_qty,1);assert.equal(before[0][1].current_stock_qty-after[0][1].current_stock_qty,2);
  const customerBefore=before[1].find(c=>Number(c.id)===fixture.customerId);const customerAfter=after[1].find(c=>Number(c.id)===fixture.customerId);
  assert.equal(customerAfter.balance-customerBefore.balance,50);
  evidence.checks.push({case:'four simultaneous same-event requests',status:'PASS',invoiceId,created:1,replays:3,stockDeltas:[-1,-2],customerDelta:50});
  await assert.rejects(submitTerminalSale({...payload,note:'changed'},fixture.actor),{code:'TERMINAL_SALE_IDEMPOTENCY_CONFLICT'});
  await assert.rejects(submitTerminalSale(payload,{id:fixture.actor.id+100}),{code:'TERMINAL_SALE_IDEMPOTENCY_OWNER_MISMATCH'});
  assert.deepEqual(await snapshot(),after);evidence.checks.push({case:'payload and owner conflicts',status:'PASS',businessDelta:0});
  const replay=await submitTerminalSale(payload,fixture.actor);assert.equal(replay.duplicate,true);assert.equal(replay.invoiceId,invoiceId);
  assert.deepEqual(await snapshot(),after);evidence.checks.push({case:'later replay retains original invoice and result',status:'PASS',businessDelta:0});
  await admin.request().batch(`CREATE TRIGGER dbo.commerce_test_fail_terminal_audit ON dbo.audit_logs AFTER INSERT AS BEGIN
    IF EXISTS (SELECT 1 FROM inserted WHERE action=N'terminal_sales_submitted') THROW 51111, 'TEST_ONLY_TERMINAL_AUDIT_FAILURE', 1;
  END;`); trigger=true;
  let failure; try { await submitTerminalSale({...payload,clientEventId:`${prefix}-ROLLBACK`,documentNumber:`R${Date.now()}`},fixture.actor); } catch(error) { failure=error; }
  assert.ok(failure,'Injected failure must reject');
  assert.deepEqual(await snapshot(),after);
  evidence.checks.push({case:'SQL trigger failure after finalization rolls back invoice stock customer ledger and audit',status:'PASS',errorCode:failure.code,businessDelta:0});
  await admin.request().batch('DROP TRIGGER dbo.commerce_test_fail_terminal_audit');trigger=false;
  const accounts=await getFinanceAccounts({});assert.ok(accounts);
  assert.deepEqual(await snapshot(),after);evidence.checks.push({case:'finance account read with no schema creation permission',status:'PASS',businessDelta:0});
  const result=(await admin.request().input('invoice',sql.BigInt,invoiceId).query(`SELECT si.id,si.status,si.grand_total,tsq.status AS ledger_status,JSON_VALUE(tsq.payload_json,'$.resultSnapshot.invoiceId') AS replay_invoice_id
    FROM dbo.sales_invoices si INNER JOIN dbo.terminal_sync_queue tsq ON tsq.target_entity_id=si.id WHERE si.id=@invoice`)).recordset[0];
  evidence.result=result;evidence.status='PASS_BOUNDED_REAL_SQL_ACCEPTANCE';
  fs.writeFileSync(new URL(outputName,here),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
  }
} catch(error) {
  evidence.status='FAIL';evidence.error={code:error.code,number:error.number,message:error.message,stack:error.stack?.split('\n').slice(0,4)};
  fs.writeFileSync(new URL(outputName,here),JSON.stringify(evidence,null,2)+'\n');
  console.error(JSON.stringify(evidence));process.exitCode=1;
} finally {
  if(trigger) await admin.request().batch('DROP TRIGGER dbo.commerce_test_fail_terminal_audit');
  await appPool?.close();await admin.close();
}
