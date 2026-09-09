import fs from 'node:fs';
import assert from 'node:assert/strict';
import sql from '../../../apps/api/node_modules/mssql/index.js';

// Manual, isolated SQL probe. Uses the exact service SELECTs; no expense,
// transfer, account movement or real closing operation is dispatched.
const here = new URL('../../../temp/sql-lab/', import.meta.url);
const read = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const binding = read(new URL('binding.json', here));
assert.equal(binding.host, '127.0.0.1');
assert.equal(binding.port, 51433);
assert.equal(binding.name, 'commerce-sql-20260908');
assert.equal(binding.database, 'MELISA_ERP_V2');
const secrets = read(binding.privateCredentials);
const pool = await new sql.ConnectionPool({ server: binding.host, port: binding.port,
  database: binding.database, user: 'commerce_test_app', password: secrets.appPassword,
  options: { encrypt: false, trustServerCertificate: true }, pool: { max: 5 }, requestTimeout: 5000 }).connect();
const source = fs.readFileSync(new URL('../../../apps/api/src/services/cashRegisterService.js', import.meta.url), 'utf8');
function statement(name, marker) {
  const body = source.slice(source.indexOf('export async function ' + name));
  const matches = [...body.matchAll(/\.query\(`([\s\S]*?)`\)/g)];
  const found = matches.find(match => match[1].includes(marker));
  assert.ok(found, 'Service statement missing: ' + name);
  return found[1];
}
const expense = statement('createCashExpense', '@expenseSessionId');
const transfer = statement('createCashTransfer', '@manualTransferSessionId');
const closing = statement('closeCashSession', '@closeSessionId');
const mode = process.argv.includes('--expect-vulnerable') ? 'before' : 'after';
const results = [];
let sessionId;
let original;
async function snapshot() {
  return (await pool.request().query(`
    SELECT * FROM dbo.cash_sessions ORDER BY id;
    SELECT * FROM dbo.finance_accounts ORDER BY id;
    SELECT * FROM dbo.finance_account_movements ORDER BY id;
    SELECT * FROM dbo.cash_expenses ORDER BY id;
    SELECT * FROM dbo.cash_transfers ORDER BY id;
    SELECT * FROM dbo.cash_session_counts ORDER BY session_id, currency_code;
  `)).recordsets;
}
function request(transaction) {
  return new sql.Request(transaction)
    .input('expenseSessionId', sql.BigInt, sessionId).input('expenseCurrency', sql.NVarChar(3), 'TRY')
    .input('expenseCategoryId', sql.BigInt, 1)
    .input('manualTransferSessionId', sql.BigInt, sessionId).input('manualTransferCurrency', sql.NVarChar(3), 'TRY')
    .input('closeSessionId', sql.BigInt, sessionId);
}
try {
  const identity = (await pool.request().query(`
    SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) machine, DB_NAME() db,
      IS_SRVROLEMEMBER('sysadmin') sysadmin;
    SELECT fixture_id FROM dbo.commerce_test_fixture;
  `)).recordsets;
  assert.equal(identity[0][0].machine, binding.name);
  assert.equal(identity[0][0].db, binding.database);
  assert.equal(identity[0][0].sysadmin, 0);
  assert.equal(identity[1][0].fixture_id, 'commerce-no-messaging-20260908');
  original = await snapshot();
  assert.ok(original[0].every(row => row.session_status === 'closed'));
  const inserted = await pool.request().query(`
    INSERT INTO dbo.cash_sessions (drawer_id, business_date, opening_note)
    OUTPUT inserted.id
    VALUES (1, '2099-01-01', N'TEST-CASH-LOCK-PROBE');
  `);
  sessionId = Number(inserted.recordset[0].id);
  for (const [name, writer] of [['expense', expense], ['transfer', transfer]]) {
    for (const closeFirst of [false, true]) {
      const first = new sql.Transaction(pool), second = new sql.Transaction(pool);
      await first.begin();
      await second.begin();
      let firstActive = true;
      try {
        assert.equal((await request(first).query(closeFirst ? closing : writer)).recordset.length, 1);
        let blocked = false;
        try {
          assert.equal((await request(second).query('SET LOCK_TIMEOUT 350;\n' + (closeFirst ? writer : closing))).recordset.length, 1);
        } catch (error) {
          if (error.number !== 1222) throw error;
          blocked = true;
        }
        results.push({ operation: name, first: closeFirst ? 'close' : name, blocked });
        await first.rollback();
        firstActive = false;
        // The same statement succeeds after release; timeout is lock contention,
        // not an invalid query, missing fixture or permission failure.
        assert.equal((await request(second).query(closeFirst ? writer : closing)).recordset.length, 1);
      } finally {
        if (firstActive) await first.rollback();
        await new sql.Request(second).query('SET LOCK_TIMEOUT -1;');
        await second.rollback();
      }
    }
  }
} finally {
  try {
    if (sessionId) await pool.request().input('id', sql.BigInt, sessionId).query(`
      DELETE FROM dbo.cash_sessions WHERE id = @id AND opening_note = N'TEST-CASH-LOCK-PROBE';
    `);
    if (original) assert.deepEqual(await snapshot(), original, 'Existing lab rows changed');
  } finally { await pool.close(); }
}
assert.equal(results.length, 4);
assert.ok(results.every(row => row.blocked === (mode === 'after')), JSON.stringify(results));
const evidence = { at: new Date().toISOString(), mode, results, preservedTables: 6,
  status: mode === 'after' ? 'PASS_SQL_SESSION_SERIALIZATION' : 'REPRODUCED_UNPROTECTED_SESSION_READ',
  limitation: 'Exact production SELECTs on real SQL transactions; not full HTTP business-flow acceptance.' };
fs.writeFileSync(new URL('cash-session-locks-' + mode + '.json', here), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
