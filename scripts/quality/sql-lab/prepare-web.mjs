import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import sql from '../../../apps/api/node_modules/mssql/index.js';
import bcrypt from '../../../apps/api/node_modules/bcrypt/bcrypt.js';

const here = new URL('../../../temp/sql-lab/', import.meta.url);
const binding = JSON.parse(fs.readFileSync(new URL('binding.json', here), 'utf8').replace(/^\uFEFF/, ''));
assert.equal(binding.host, '127.0.0.1');
assert.equal(binding.port, 51433);
assert.equal(binding.name, 'commerce-sql-20260908');
assert.equal(binding.database, 'MELISA_ERP_V2');
const credentials = JSON.parse(fs.readFileSync(binding.privateCredentials, 'utf8').replace(/^\uFEFF/, ''));
const privateFile = path.join(path.dirname(binding.privateCredentials), 'web-credentials.json');
assert.equal(fs.existsSync(privateFile), false, 'Web fixture already exists; inspect instead of resetting');
const pool = await new sql.ConnectionPool({ server: binding.host, port: binding.port, database: binding.database,
  user: 'sa', password: credentials.saPassword, options: { encrypt: false, trustServerCertificate: true } }).connect();
try {
  const identity = (await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine, DB_NAME() AS db; SELECT fixture_id FROM dbo.commerce_test_fixture;")).recordsets;
  assert.equal(identity[0][0].machine, binding.name);
  assert.equal(identity[0][0].db, binding.database);
  assert.equal(identity[1][0].fixture_id, 'commerce-no-messaging-20260908');
  const web = { username: 'TEST-web', password: randomBytes(24).toString('base64url'), accessSecret: randomBytes(48).toString('hex'), refreshSecret: randomBytes(48).toString('hex') };
  const result = await pool.request().input('hash', sql.NVarChar(255), await bcrypt.hash(web.password, 12)).query(`
    IF EXISTS (SELECT 1 FROM dbo.users WHERE username=N'TEST-web') THROW 51112, 'Test web user already exists', 1;
    INSERT dbo.users (username, password_hash, display_name, role_id, is_active)
      OUTPUT INSERTED.id SELECT N'TEST-web', @hash, N'TEST Commerce Operator', id, 1 FROM dbo.roles WHERE code=N'admin';
  `);
  assert.equal(result.recordset.length, 1);
  fs.writeFileSync(privateFile, JSON.stringify(web), { flag: 'wx' });
  fs.writeFileSync(new URL('web-fixture.json', here), JSON.stringify({ at: new Date().toISOString(), userId: Number(result.recordset[0].id), username: web.username, privateFile, syntheticDataOnly: true }, null, 2));
  console.log('PASS: isolated TEST-web account prepared; credentials stored privately');
} finally { await pool.close(); }
