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
const cash = await import('../../../apps/api/src/services/cashRegisterService.js');
const finance = await import('../../../apps/api/src/services/financeService.js');
const tables = ['cash_drawers', 'cash_drawer_accounts', 'cash_sessions', 'cash_session_counts', 'cash_adjustments',
  'cash_transfers', 'cash_expenses', 'finance_accounts', 'finance_account_movements', 'customers', 'suppliers',
  'customer_movements', 'supplier_movements', 'audit_logs', 'products', 'sales_invoices', 'purchase_invoices'];
async function snapshot() { const result = {}; for (const table of tables) result[table] = (await pool.request().query('SELECT * FROM dbo.' + table + ' ORDER BY id;')).recordset; return result; }
const prefix = 'TEST-CASH-ROUTE', checks = [], accounts = {}, parties = { customers: {}, suppliers: {} }, pending = [];
let before, drawerId;
const originalQuery = sql.Request.prototype.query;
const counts = amounts => Object.fromEntries(['TRY', 'USD', 'EUR'].map(currency => [currency, { physicalOpening: amounts[currency] || 0, physicalClosing: amounts[currency] || 0, carryForward: amounts[currency] || 0 }]));
const actor = read(new URL('fixture.json', here)).actor;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function collection(currency, amount, extra = {}) {
  return finance.createCustomerCollection({ customerId: parties.customers[currency], currency, amount, paymentMethod: 'cash', documentDate: '2099-02-01', description: prefix, ...extra }, actor);
}
try {
  const identity = (await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) machine,DB_NAME() db,IS_SRVROLEMEMBER('sysadmin') sa; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine, binding.name); assert.equal(identity[0][0].db, binding.database); assert.equal(identity[0][0].sa, 0);
  assert.equal(identity[1][0].fixture_id, 'commerce-no-messaging-20260908');
  before = await snapshot(); assert.ok(before.cash_sessions.every(row => row.session_status === 'closed'));
  assert.ok(!before.cash_drawers.some(row => row.drawer_code === prefix));
  drawerId = Number((await pool.request().input('code', sql.NVarChar(40), prefix).query('INSERT dbo.cash_drawers(drawer_code,drawer_name) OUTPUT inserted.id VALUES(@code,@code);')).recordset[0].id);
  for (const currency of ['TRY', 'USD', 'EUR']) {
    accounts[currency] = Number((await pool.request().input('code', sql.NVarChar(40), prefix + '-' + currency).input('currency', sql.NVarChar(3), currency)
      .query("INSERT dbo.finance_accounts(account_code,account_name,account_type,currency_code) OUTPUT inserted.id VALUES(@code,@code,N'cash',@currency);")).recordset[0].id);
    await pool.request().input('drawer', sql.BigInt, drawerId).input('account', sql.BigInt, accounts[currency]).input('currency', sql.NVarChar(3), currency)
      .query('INSERT dbo.cash_drawer_accounts(drawer_id,currency_code,finance_account_id) VALUES(@drawer,@currency,@account);');
    for (const table of ['customers', 'suppliers']) {
      const col = table === 'customers' ? 'customer_code' : 'supplier_code';
      parties[table][currency] = Number((await pool.request().input('code', sql.NVarChar(50), prefix + '-' + currency).input('currency', sql.NVarChar(3), currency)
        .query('INSERT dbo.' + table + '(' + col + ',name,currency_code,balance) OUTPUT inserted.id VALUES(@code,@code,@currency,100);')).recordset[0].id);
    }
  }
  // Real services, different business dates: unique(drawer,date) alone cannot
  // enforce the documented single-open-session invariant.
  const opened = await Promise.allSettled(['2099-02-01', '2099-02-02'].map(businessDate => cash.openCashSession({ drawerId, businessDate, counts: counts({}) }, actor)));
  assert.equal(opened.filter(row => row.status === 'fulfilled').length, 1, JSON.stringify(opened));
  assert.equal(opened.find(row => row.status === 'rejected').reason.code, 'CASH_REGISTER_SESSION_EXISTS');
  const first = opened.find(row => row.status === 'fulfilled').value;
  checks.push({ case: 'two concurrent real opens on different dates', created: 1, rejected: 1 });

  // Pause AFTER the real account SELECT acquired its lock, then dispatch the
  // complete closing service; no mocked DB results or artificial SQL locks.
  let routed, release, closeEntered;
  const routedPromise = new Promise(resolve => { routed = resolve; });
  const releasePromise = new Promise(resolve => { release = resolve; });
  const closePromise = new Promise(resolve => { closeEntered = resolve; });
  let armed = true;
  sql.Request.prototype.query = async function (statement, ...rest) {
    if (String(statement).includes('@closeSessionId')) closeEntered();
    const result = await originalQuery.call(this, statement, ...rest);
    if (armed && String(statement).includes('@openDrawerAccountCurrency')) {
      armed = false; routed(); await releasePromise;
    }
    return result;
  };
  let closed, completed = false;
  const receipt = collection('TRY', 10);
  pending.push(receipt);
  try {
    await Promise.race([routedPromise, pause(5000).then(() => { throw new Error('Receipt did not reach routing'); })]);
    closed = cash.closeCashSession({ sessionId: first.session.id, counts: counts({ TRY: 10 }) }, actor).then(value => { completed = true; return value; });
    pending.push(closed);
    await closePromise; await pause(150); assert.equal(completed, false, 'Closing passed the in-flight receipt');
  } finally { release(); sql.Request.prototype.query = originalQuery; }
  const receiptResult = await receipt, closingResult = await closed;
  assert.equal(receiptResult.account.id, accounts.TRY);
  assert.equal(closingResult.session.status, 'closed');
  assert.equal(closingResult.currencies.find(row => row.currency === 'TRY').expected, 10);
  checks.push({ case: 'real receipt versus real closing', account: receiptResult.account.id, expected: 10, closingWaited: true });
  await assert.rejects(collection('TRY', 1, { accountId: accounts.TRY }), { code: 'CASH_REGISTER_OPEN_SESSION_REQUIRED' });
  checks.push({ case: 'explicit closed drawer rejected without a movement' });

  const second = await cash.openCashSession({ drawerId, businessDate: '2099-02-03', counts: counts({ TRY: 10 }) }, actor);
  for (const currency of ['TRY', 'USD', 'EUR']) {
    assert.equal((await collection(currency, 10)).account.id, accounts[currency]);
    const paid = await finance.createSupplierPayment({ supplierId: parties.suppliers[currency], currency, amount: 3, paymentMethod: 'cash', documentDate: '2099-02-03', description: prefix }, actor);
    assert.equal(paid.account.id, accounts[currency]);
  }
  assert.equal((await collection('TRY', 2, { accountId: accounts.TRY })).account.id, accounts.TRY);
  for (const paymentMethod of ['bank', 'card']) await assert.rejects(collection('TRY', 1, { accountId: accounts.TRY, paymentMethod }), { code: 'FINANCE_DRAWER_CASH_METHOD_REQUIRED' });
  let closingLocked, releaseClosing;
  const closingLockedPromise = new Promise(resolve => { closingLocked = resolve; });
  const releaseClosingPromise = new Promise(resolve => { releaseClosing = resolve; });
  sql.Request.prototype.query = async function (statement, ...rest) {
    const result = await originalQuery.call(this, statement, ...rest);
    if (String(statement).includes('@closeSessionId')) { closingLocked(); await releaseClosingPromise; }
    return result;
  };
  const finalPromise = cash.closeCashSession({ sessionId: second.session.id, counts: counts({ TRY: 19, USD: 7, EUR: 7 }) }, actor);
  pending.push(finalPromise);
  let deniedPromise, deniedFinished = false;
  try {
    await closingLockedPromise;
    deniedPromise = collection('TRY', 1, { accountId: accounts.TRY }).then(
      () => { deniedFinished = true; return { unexpectedSuccess: true }; },
      error => { deniedFinished = true; return { code: error.code }; });
    pending.push(deniedPromise);
    await pause(150); assert.equal(deniedFinished, false);
  } finally { releaseClosing(); sql.Request.prototype.query = originalQuery; }
  const final = await finalPromise;
  assert.deepEqual(await deniedPromise, { code: 'CASH_REGISTER_OPEN_SESSION_REQUIRED' });
  checks.push({ case: 'real closing first blocks explicit receipt then rejects it without writes' });
  assert.deepEqual(final.currencies.map(row => row.expected), [19, 7, 7]);
  assert.ok(final.currencies.every(row => row.difference === 0));
  for (const [currency, expected] of [['TRY', 19], ['USD', 7], ['EUR', 7]]) {
    const ledger = (await pool.request().input('account', sql.BigInt, accounts[currency]).query(`
      SELECT fa.current_balance,
        (SELECT SUM(CASE WHEN direction=N'in' THEN amount ELSE -amount END)
         FROM dbo.finance_account_movements WHERE account_id=@account) AS movement_total
      FROM dbo.finance_accounts fa WHERE fa.id=@account;
    `)).recordset[0];
    assert.deepEqual(ledger, { current_balance: expected, movement_total: expected });
  }
  checks.push({ case: 'three currency receipt payment explicit account and noncash exclusion', expected: [19, 7, 7], difference: 0 });
  const transaction = new sql.Transaction(pool); await transaction.begin();
  try {
    const fallback = await finance.resolveFinanceAccount(transaction, sql, { currency: 'TRY', paymentMethod: 'cash' });
    assert.equal(fallback.code, 'KASA-TRY');
    checks.push({ case: 'no open session retains main cash fallback', code: fallback.code });
  } finally { await transaction.rollback(); }
} finally {
  sql.Request.prototype.query = originalQuery;
  await Promise.allSettled(pending);
  try {
    if (before) {
      // Remove only rows created after the exact guarded snapshot. This isolated
      // process is the sole lab writer; refuse any unexpected source row changes.
      const current = await snapshot();
      for (const table of tables) for (const row of before[table]) assert.deepEqual(current[table].find(value => value.id === row.id), row, 'Existing ' + table + ' changed');
      const order = ['audit_logs', 'finance_account_movements', 'customer_movements', 'supplier_movements', 'cash_expenses', 'cash_transfers', 'cash_adjustments', 'cash_session_counts', 'cash_sessions', 'cash_drawer_accounts', 'finance_accounts', 'cash_drawers', 'customers', 'suppliers'];
      for (const table of order) {
        const oldIds = new Set(before[table].map(row => row.id));
        for (const row of current[table].filter(value => !oldIds.has(value.id))) await pool.request().input('id', sql.BigInt, row.id).query('DELETE FROM dbo.' + table + ' WHERE id=@id;');
      }
      assert.deepEqual(await snapshot(), before);
    }
  } finally { await pool.close(); }
}
const result = { at: new Date().toISOString(), status: 'PASS_REAL_CASH_ROUTING_SERVICES', checks, originalTablesPreserved: tables.length, syntheticRowsRemoved: true,
  limitation: 'Real service and SQL acceptance; no browser/HTTP or invoice finalization in this probe.' };
fs.writeFileSync(new URL('cash-routing-acceptance.json', here), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
