// Explicit read-only SQL integration regression. No schema or business DML.
import test from 'node:test';
import assert from 'node:assert/strict';
import {testPool} from './target-opening-runtime.mjs';
test('binary TEST identity remains exact under Turkish SQL collation',async()=>{
 const pool=await testPool();
 try{
  const row=(await pool.request().query(`SELECT
   CASE WHEN DB_NAME() COLLATE Latin1_General_100_BIN2=N'MELISA_ERP_SIRKET_TEST_20260929_01' THEN 1 ELSE 0 END database_matches,
   CASE WHEN CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2=N'Semih\\MELISADEV' THEN 1 ELSE 0 END server_matches,
   CASE WHEN LOWER(N'MELISADEV' COLLATE Turkish_100_CI_AS) COLLATE Latin1_General_100_BIN2=N'melisadev' THEN 1 ELSE 0 END linguistic_lower_safe,
   CASE WHEN N'MELISA_ERP_V2' COLLATE Latin1_General_100_BIN2=N'MELISA_ERP_SIRKET_TEST_20260929_01' THEN 1 ELSE 0 END live_matches,
   CASE WHEN N'Semih\\OTHER' COLLATE Latin1_General_100_BIN2=N'Semih\\MELISADEV' THEN 1 ELSE 0 END other_server_matches`)).recordset[0];
  assert.deepEqual(row,{database_matches:1,server_matches:1,linguistic_lower_safe:0,live_matches:0,other_server_matches:0});
 }finally{await pool.close();}
});
