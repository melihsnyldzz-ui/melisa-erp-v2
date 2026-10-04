import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSql,completeInvoice,filterLegacyPseudoTables,findInlineCrossColumnChecks,EXPECTED_GUARDS,TABLES} from './enable-test-purchase-batches.mjs';
test('complete invoice correlated proof preserves outer header and intent identities',()=>{
 for(const outerId of ['i.invoice_id','i.id','p.id']){
  const proof=completeInvoice(outerId);
  assert.ok(proof.includes(`WHERE proof_item.purchase_invoice_id=${outerId}`));
  assert.ok(proof.includes(`WHERE l.invoice_id=${outerId}`));
  assert.ok(proof.includes('l.invoice_item_id=proof_item.id'));
  assert.ok(proof.includes('proof_item.quantity=x.quantity'));
  assert.ok(!/FROM dbo\.purchase_invoice_items i\b/.test(proof),'native item must not shadow the outer inserted identity');
  assert.ok(!proof.includes('proof_item.invoice_id'),'native item schema has purchase_invoice_id, never invoice_id');
 }
});
test('DDL validator rejects cross-column inline checks including nested decimal and arithmetic expressions',()=>{
 const invalid="CREATE TABLE dbo.drafts(subtotal decimal(18,4) NOT NULL,grand_total decimal(18,4) NOT NULL CHECK(grand_total=subtotal)); CREATE TABLE dbo.lines(quantity decimal(18,3) CHECK(quantity=FLOOR(quantity)),purchase_price decimal(18,4),line_total decimal(18,4) CHECK(line_total=quantity*purchase_price));";
 assert.deepEqual(findInlineCrossColumnChecks(invalid),[
  {table:'drafts',column:'grand_total',references:['subtotal']},
  {table:'lines',column:'line_total',references:['quantity','purchase_price']}
 ]);
});
test('DDL validator accepts self-column and table-level checks without treating quoted values as references',()=>{
 const valid="CREATE TABLE dbo.lines(quantity decimal(18,3) CHECK(quantity=FLOOR(quantity)),purchase_price decimal(18,4),line_total decimal(18,4),note nvarchar(50) CHECK(note<>N'quantity,purchase_price'),CONSTRAINT CK_total CHECK(line_total=quantity*purchase_price));";
 assert.deepEqual(findInlineCrossColumnChecks(valid),[]);
 assert.deepEqual(findInlineCrossColumnChecks(buildSql()),[]);
 assert.ok(buildSql().includes('CONSTRAINT CK_test_batch_draft_total CHECK(grand_total=subtotal)'));
 assert.ok(buildSql().includes('CONSTRAINT CK_test_batch_intent_line_total CHECK(line_total=quantity*purchase_price)'));
});
test('pseudo-table filter preserves real column names and unrelated table identifiers',()=>{
 const definition='SELECT i.is_deleted,d.deleted_at FROM inserted i LEFT JOIN deleted d ON i.id=d.id JOIN dbo.inserted_archive a ON a.id=i.id;';
 assert.equal(filterLegacyPseudoTables(definition),'SELECT i.is_deleted,d.deleted_at FROM #batch_legacy_inserted i LEFT JOIN #batch_legacy_deleted d ON i.id=d.id JOIN dbo.inserted_archive a ON a.id=i.id;');
});
test('dynamic guard prefix substitutions use max operands and retain their complete tail beyond 4000 characters',()=>{
 const sql=buildSql();
 const expressions=[...sql.matchAll(/SET @prefix=REPLACE\(CAST\(N'((?:''|[^'])*)' AS nvarchar\(max\)\),N'__PREDICATE__',REPLACE\(CAST\(N'((?:''|[^'])*)' AS nvarchar\(max\)\),N'__UNCHANGED__',@unchanged\)\);/g)];
 assert.equal(expressions.length,8);
 let oversized=0;
 for(const match of expressions){
  const prefix=match[1].replaceAll("''","'"),predicate=match[2].replaceAll("''","'").replaceAll('__UNCHANGED__','NOT EXISTS(SELECT i.[id],i.[name],i.[is_deleted] EXCEPT SELECT d.[id],d.[name],d.[is_deleted])');
  const assembled=prefix.replace('__PREDICATE__',predicate);
  assert.ok(assembled.endsWith('RETURN;\n'));
  assert.ok(!assembled.includes('__PREDICATE__')&&!assembled.includes('__UNCHANGED__'));
  if(assembled.length>4000){oversized++;assert.ok(!assembled.slice(0,4000).endsWith('RETURN;\n'));}
 }
 assert.ok(oversized>0,'real guard fixture must reproduce SQL Server bounded REPLACE truncation');
});
test('mixed legacy/new trigger statements retain both old and new images for independent evaluation',()=>{
 const sql=buildSql();
 assert.equal((sql.match(/SELECT i\.\* INTO #batch_exact_inserted FROM inserted i WHERE __PREDICATE__/g)||[]).length,8);
 assert.ok(!sql.includes('INSERT #batch_exact_inserted'));
 assert.ok(!sql.includes('SELECT TOP(0) * INTO #batch_exact_inserted'));
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
 for(const setting of ['ANSI_NULLS','QUOTED_IDENTIFIER','ANSI_WARNINGS','ANSI_PADDING','CONCAT_NULL_YIELDS_NULL','ARITHABORT'])assert.ok(sql.indexOf(`SET ${setting} ON;`)<begin&&sql.includes(`SET ${setting} ON;`),setting);
 assert.ok(sql.indexOf('SET NUMERIC_ROUNDABORT OFF;')<begin&&sql.includes('SET NUMERIC_ROUNDABORT OFF;'));
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
