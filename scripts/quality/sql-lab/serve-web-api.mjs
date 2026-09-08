import fs from 'node:fs';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import express from '../../../apps/api/node_modules/express/index.js';

const here = new URL('../../../temp/sql-lab/', import.meta.url);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const binding = read(new URL('binding.json', here));
assert.equal(binding.host, '127.0.0.1'); assert.equal(binding.port, 51433);
assert.equal(binding.name, 'commerce-sql-20260908'); assert.equal(binding.database, 'MELISA_ERP_V2');
const credentials = read(binding.privateCredentials);
const web = read(read(new URL('web-fixture.json', here)).privateFile);
assert.equal(fs.existsSync('.env'), false); assert.equal(fs.existsSync('.env.local'), false);
for (const key of Object.keys(process.env)) if (!/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|COMSPEC|PATHEXT|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE)$/i.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: 'test', SQL_SERVER: binding.host, SQL_PORT: '51433', SQL_DATABASE: binding.database,
  SQL_USER: 'commerce_test_app', SQL_PASSWORD: credentials.appPassword, SQL_READ_ONLY: 'false', SQL_TRUSTED_CONNECTION: 'false',
  JWT_ACCESS_SECRET: web.accessSecret, JWT_REFRESH_SECRET: web.refreshSecret, JWT_ACCESS_EXPIRES_IN: '4h',
  MELISA_LOCAL_PASSWORDLESS_LOGIN: 'false', WHATSAPP_ENABLED: 'false', WHATSAPP_SEND_APPROVED: 'false', NAKLIYAT_ENABLED: 'false',
  TERMINAL_RECEIPT_PRINT_ENABLED: 'false', TERMINAL_RECEIPT_PRINT_MODE: 'disabled', CORS_ORIGINS: 'http://127.0.0.1:54173', RATE_LIMIT_MAX: '3000' });
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const values = Array.isArray(args[0]) ? args[0] : args;
  const options = values[0];
  const host = typeof options === 'object' ? options.host : values[1];
  const port = typeof options === 'object' ? options.port : options;
  if (host !== '127.0.0.1' || Number(port) !== 51433) throw new Error('WEB_LAB_OTHER_NETWORK_DENIED');
  return connect.apply(this, args);
};
const deny = () => { throw new Error('WEB_LAB_EXTERNAL_ACTION_DENIED'); };
tls.connect = deny; dgram.Socket.prototype.send = deny; globalThis.fetch = deny;
for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) child[key] = deny;
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (options, ...args) {
  assert.equal(options.host, '127.0.0.1'); assert.equal(options.port, 54100);
  return listen.call(this, options, ...args);
};
syncBuiltinESMExports();
const { getSqlPool } = await import('../../../apps/api/src/config/database.js');
const pool = await getSqlPool();
const rows = (await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine, DB_NAME() AS db, HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS ddl, IS_SRVROLEMEMBER('sysadmin') AS sysadmin; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
assert.equal(rows[0][0].machine, binding.name); assert.equal(rows[0][0].db, binding.database);
assert.equal(rows[0][0].ddl, 0); assert.equal(rows[0][0].sysadmin, 0);
assert.equal(rows[1][0].fixture_id, 'commerce-no-messaging-20260908');
if (process.argv.includes('--probe-products')) {
  const products = await import('../../../apps/api/src/services/productService.js');
  for (const name of ['getProductFilterOptions', 'getProductsList']) {
    try { const result = await products[name]({}); console.log(JSON.stringify({ name, status: 'PASS', keys: Object.keys(result) })); }
    catch (error) { console.log(JSON.stringify({ name, status: 'FAIL', code: error.code, number: error.number, message: error.message })); process.exitCode = 1; }
  }
  await pool.close();
  process.exit(process.exitCode || 0);
}
const { createApp } = await import('../../../apps/api/src/app.js');
const wrapper = express();
wrapper.use((req, res, next) => {
  const requestPath = req.path;
  res.on('finish', () => fs.appendFileSync(new URL('web-requests.jsonl', here), JSON.stringify({ at: new Date().toISOString(), method: req.method, path: requestPath, status: res.statusCode }) + '\n'));
  if (/whatsapp|chatwoot|evolution|\/crm|\/print|\/shipping|\/nakliyat/i.test(req.path)) return res.status(403).json({ success: false, error: { code: 'WEB_LAB_OUT_OF_SCOPE' } });
  next();
});
wrapper.use(createApp());
const server = wrapper.listen({ host: '127.0.0.1', port: 54100 }, () => console.log('WEB_LAB_READY 127.0.0.1:54100; isolated SQL; external actions denied'));
async function stop() { server.close(); await pool.close(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
