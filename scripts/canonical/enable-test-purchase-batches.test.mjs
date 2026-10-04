import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSql,filterLegacyPseudoTables,EXPECTED_GUARDS,TABLES} from './enable-test-purchase-batches.mjs';
test('pseudo-table filter preserves real column names and unrelated table identifiers',()=>{
 const definition='SELECT i.is_deleted,d.deleted_at FROM inserted i LEFT JOIN deleted d ON i.id=d.id JOIN dbo.inserted_archive a ON a.id=i.id;';
 assert.equal(filterLegacyPseudoTables(definition),'SELECT i.is_deleted,d.deleted_at FROM #batch_legacy_inserted i LEFT JOIN #batch_legacy_deleted d ON i.id=d.id JOIN dbo.inserted_archive a ON a.id=i.id;');
});
test('mixed legacy/new trigger statements retain both old and new images for independent evaluation',()=>{
 const sql=buildSql();
 assert.equal((sql.match(/SELECT i\.\* INTO #batch_legacy_inserted/g)||[]).length,8);
 assert.equal((sql.match(/SELECT d\.\* INTO #batch_legacy_deleted/g)||[]).length,8);
 assert.equal((sql.match(/IF EXISTS\(SELECT 1 FROM deleted d WHERE/g)||[]).length>=8,true);
 assert.ok(sql.includes('TEST_BATCH_EXACT_SCOPE_REQUIRED'));
 assert.ok(!sql.includes("N'deleted',N'#batch_legacy_deleted'"));
});
test('generated artifact matches builder and has no runtime SQL client',()=>{
 assert.equal(fs.readFileSync(new URL('./enable-test-purchase-batches.sql',import.meta.url),'utf8'),buildSql());
 assert.equal(Object.keys(EXPECTED_GUARDS).length,8);assert.equal(TABLES.length,6);
 assert.ok(buildSql().includes('before_definition nvarchar(max)'));
});
test('unknown target, unknown hashes and partial schema fail before first transaction mutation',()=>{
 const sql=buildSql(),begin=sql.indexOf('BEGIN TRY BEGIN TRANSACTION;');
 for(const gate of ['WRONG_TEST_BATCH_TARGET','TEST_BATCH_UNKNOWN_PARTIAL_SCHEMA','TEST_BATCH_UNKNOWN_GUARD_BASELINE','TEST_BATCH_FIXTURE_BASELINE_REJECTED'])assert.ok(sql.indexOf(gate)<begin);
 assert.ok(sql.includes('Latin1_General_100_BIN2'));assert.ok(sql.includes('IF @@TRANCOUNT>0 ROLLBACK; THROW;'));
});
test('self immutable manifest registration precedes activating its guard',()=>{
 const sql=buildSql(),register=sql.lastIndexOf("INSERT dbo.test_purchase_batch_guard_manifest VALUES(N'test_batch_guard_test_purchase_batch_guard_manifest'");
 const activate=sql.indexOf("EXEC sys.sp_executesql N'CREATE TRIGGER dbo.test_batch_guard_test_purchase_batch_guard_manifest",register);
 assert.ok(register>0&&activate>register);
 assert.ok(sql.indexOf('PASS_IDENTICAL_NOOP')<sql.indexOf('BEGIN TRY BEGIN TRANSACTION;'));
});
test('native header construction uses registered exact intent and finalize requires complete linked lines',()=>{
 const sql=buildSql();for(const proof of ['t.state=N\'\'registered\'\'','t.invoice_id IS NULL','i.quantity=x.quantity','i.purchase_price=s.unit_cost','i.line_total=x.line_total','TEST_BATCH_PRESERVED_GUARD_DRIFT'])assert.ok(sql.includes(proof),proof);
 assert.ok(sql.includes('COUNT(*) FROM dbo.test_purchase_batch_links'));
 assert.ok(sql.includes('source_type=N\'\'goods_receipt_batch\'\''));
});
test('writer grants stay on named objects and scope/manifest remain immutable',()=>{
 const sql=buildSql();assert.ok(!/GRANT .*ON (?:DATABASE|SCHEMA)::/i.test(sql));
 assert.ok(sql.includes('DENY SELECT,INSERT,UPDATE,DELETE ON dbo.test_purchase_batch_guard_manifest'));
 assert.ok(sql.includes('DENY INSERT,UPDATE,DELETE ON dbo.test_purchase_batch_scope'));
 assert.ok(!sql.includes('DISABLE TRIGGER'));assert.ok(!sql.includes('SESSION_CONTEXT'));
});
