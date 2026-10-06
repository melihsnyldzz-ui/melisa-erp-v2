import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {installerSql,READY_SQL,WORK_INBOUND_SQL_PROOF,GUARDS} from './enable-test-work-inbound-counts.mjs';
test('generated SQL equals reviewed source and pinned owner body across CRLF archives',()=>{
 const sql=installerSql();assert.equal(fs.readFileSync(new URL('./enable-test-work-inbound-counts.sql',import.meta.url),'utf8'),sql);assert.equal(createHash('sha256').update(READY_SQL.replaceAll('\n','\r\n').replaceAll('\r\n','\n'),'utf16le').digest('hex').toUpperCase(),WORK_INBOUND_SQL_PROOF.readyHash);assert.match(sql,/REPLACE\(@def_usp_work_inbound_ready,NCHAR\(13\)\+NCHAR\(10\),NCHAR\(10\)\)/);
});
test('installer requires exact outer TEST transaction, adds only narrow metadata privileges and no core/role alteration',()=>{
 const sql=installerSql();assert.match(sql,/@@TRANCOUNT=0/);assert.match(sql,/MELISA_ERP_SIRKET_TEST_20260929_01/);assert.match(sql,/Semih\\MELISADEV/);assert.match(sql,/melisa_sirket_sales_test_20260929_01/);assert.doesNotMatch(sql,/COMMIT|DISABLE TRIGGER|ALTER ROLE|GRANT.*dbo\.products|GRANT.*dbo\.purchase_invoices/);assert.match(sql,/DENY DELETE ON dbo\.work_inbound_counts/);assert.match(sql,/DENY UPDATE,DELETE ON dbo\.work_inbound_requests/);
});
test('metadata retains unknown rows and history, versions are monotone and owner readiness preserves prior guards/schema',()=>{
 const sql=installerSql();assert.match(sql,/needs_review/);assert.match(sql,/i\.version<>d\.version\+1/);assert.match(sql,/IF EXISTS\(SELECT 1 FROM deleted\)/);assert.match(sql,/test_purchase_batch_guard_manifest/);assert.match(sql,/<>15/);assert.match(sql,/sys\.check_constraints/);assert.match(sql,/__schema__/);assert.ok(sql.indexOf('INSERT dbo.work_inbound_manifest')<sql.indexOf('EXEC sys.sp_executesql @def_work_inbound_manifest_guard'));
});
test('replay verifies independent own hash before execution, owner prior chain and principal/grants cannot be inferred or repaired',()=>{
 const sql=installerSql();const noop=sql.slice(sql.indexOf("IF OBJECT_ID(N'dbo.work_inbound_counts',N'U')"),sql.indexOf('CREATE TABLE dbo.work_inbound_counts'));assert.ok(noop.indexOf(WORK_INBOUND_SQL_PROOF.readyHash)<noop.indexOf('EXEC dbo.usp_work_inbound_ready'));assert.match(READY_SQL,/EXEC dbo\.work_trade_assert_ready/);assert.match(READY_SQL,/sid=SUSER_SID/);assert.match(READY_SQL,/DECLARE @expected TABLE/);assert.match(READY_SQL,/minor_id<>0/);assert.match(GUARDS.work_inbound_requests_guard,/JSON_VALUE\(i\.payload_json,'\$\.actorId'\)\) IS NULL/);assert.match(GUARDS.work_inbound_requests_guard,/JSON_VALUE\(i\.response_json,'\$\.draft.id'\)\) IS NULL/);assert.match(sql,/i\.version<>1/);assert.match(sql,/EXCEPT SELECT product_id,client_line_id COLLATE Latin1_General_100_BIN2,quantity/);
});
test('catalog-collation-independent EXCEPT preserves binary permission and receipt-line identity on both sides',()=>{
 assert.match(READY_SQL,/object_name sysname COLLATE Latin1_General_100_BIN2,permission_name nvarchar\(128\) COLLATE Latin1_General_100_BIN2,state char\(1\) COLLATE Latin1_General_100_BIN2/);
 assert.equal((READY_SQL.match(/SELECT object_name COLLATE Latin1_General_100_BIN2,permission_name COLLATE Latin1_General_100_BIN2,state COLLATE Latin1_General_100_BIN2 FROM @expected/g)||[]).length,2);
 assert.equal((READY_SQL.match(/SELECT OBJECT_NAME\(major_id\) COLLATE Latin1_General_100_BIN2,permission_name COLLATE Latin1_General_100_BIN2,state COLLATE Latin1_General_100_BIN2 FROM sys.database_permissions/g)||[]).length,2);
 assert.equal((GUARDS.work_inbound_counts_guard.match(/clientLineId COLLATE Latin1_General_100_BIN2/g)||[]).length,2);assert.equal((GUARDS.work_inbound_counts_guard.match(/client_line_id COLLATE Latin1_General_100_BIN2/g)||[]).length,2);
});
