import fs from 'node:fs';
import assert from 'node:assert/strict';
import { safeTrustedSqlDriver as driver } from '../../../apps/api/src/config/safeTrustedSqlDriver.js';
const here=new URL('../../../temp/sql-lab/',import.meta.url);
const binding=JSON.parse(fs.readFileSync(new URL('binding.json',here),'utf8').replace(/^\uFEFF/,''));
assert.equal(binding.host,'127.0.0.1');assert.equal(binding.port,51433);assert.equal(binding.database,'MELISA_ERP_V2');
const credentials=JSON.parse(fs.readFileSync(binding.privateCredentials,'utf8').replace(/^\uFEFF/,''));
assert.match(credentials.appPassword,/^[A-Za-z0-9!]+$/);assert.match(credentials.saPassword,/^[A-Za-z0-9!]+$/);
const config=(user,password)=>({connectionString:`Driver={ODBC Driver 17 for SQL Server};Server=127.0.0.1,51433;Database=MELISA_ERP_V2;Uid=${user};Pwd=${password};Encrypt=No;TrustServerCertificate=Yes`,pool:{max:2,min:0},requestTimeout:10000});
let admin;let app;
const report={at:new Date().toISOString(),target:binding.name,driver:'safeTrustedSqlDriver / msnodesqlv8 / ODBC Driver 17',authentication:'SQL test login (not Windows integrated authentication)',checks:[]};
try {
  admin=await new driver.ConnectionPool(config('sa',credentials.saPassword)).connect();
  const identity=(await admin.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine,DB_NAME() AS db; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine,'commerce-sql-20260908');assert.equal(identity[0][0].db,'MELISA_ERP_V2');assert.equal(identity[1][0].fixture_id,'commerce-no-messaging-20260908');
  await admin.request().query(`IF OBJECT_ID(N'dbo.commerce_driver_probe',N'U') IS NULL CREATE TABLE dbo.commerce_driver_probe (label NVARCHAR(100) NOT NULL PRIMARY KEY);`);
  app=await new driver.ConnectionPool(config('commerce_test_app',credentials.appPassword)).connect();
  const run=String(Date.now());
  const insert=async(tx,label)=>new driver.Request(tx).input('label',driver.NVarChar(100),label).query('INSERT dbo.commerce_driver_probe(label) VALUES (@label)');
  const count=async(label)=>Number((await app.request().input('label',driver.NVarChar(100),label).query('SELECT COUNT(*) AS n FROM dbo.commerce_driver_probe WHERE label=@label')).recordset[0].n);
  for(const operation of ['commit','rollback']) {
    const tx=app.transaction();await tx.begin();const label=`${run}-${operation}`;await insert(tx,label);await tx[operation]();assert.equal(await count(label),operation==='commit'?1:0);
    report.checks.push({case:`real ${operation}`,status:'PASS',persisted:operation==='commit'?1:0});
  }
  for(const operation of ['commit','rollback']) {
    const tx=app.transaction();await tx.begin();const label=`${run}-${operation}-failure`;await insert(tx,label);
    await new driver.Request(tx).query('ROLLBACK TRANSACTION');
    let successEvents=0;tx.on(operation,()=>successEvents++);
    let error;try {await tx[operation]();}catch(caught){error=caught;}
    assert.ok(error,'A real SQL boundary error must reject');assert.equal(error.transactionOutcome,'unverified');assert.equal(successEvents,0);assert.equal(await count(label),0);
    report.checks.push({case:`real ${operation} SQL error is propagated`,status:'PASS',successEvents,persisted:0,outcome:error.transactionOutcome});
  }
  report.status='PASS_REAL_NATIVE_DRIVER_BOUNDARIES';
} catch(error) {report.status='FAIL';report.error={code:error.code,message:error.message};process.exitCode=1;}
finally {await app?.close();await admin?.close();}
fs.writeFileSync(new URL('native-driver-acceptance.json',here),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
