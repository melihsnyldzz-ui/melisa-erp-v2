import fs from 'node:fs';
import assert from 'node:assert/strict';
import sql from '../../../apps/api/node_modules/mssql/index.js';
const binding=JSON.parse(fs.readFileSync(new URL('../../../temp/sql-lab/binding.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
assert.equal(binding.host,'127.0.0.1'); assert.equal(binding.port,51433); assert.equal(binding.name,'commerce-sql-20260908');
const credentials=JSON.parse(fs.readFileSync(binding.privateCredentials,'utf8').replace(/^\uFEFF/,''));
const pool = new sql.ConnectionPool({server:binding.host,port:binding.port,database:'master',user:'sa',password:credentials.saPassword,options:{encrypt:false,trustServerCertificate:true},connectionTimeout:5000});
try { await pool.connect(); const row=(await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(128)) AS machine, CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(40)) AS version, DB_NAME() AS db")).recordset[0]; assert.equal(row.machine,binding.name); console.log(JSON.stringify(row)); }
finally { await pool.close(); }
