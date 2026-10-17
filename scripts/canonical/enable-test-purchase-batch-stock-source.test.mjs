import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {buildStockSourceSql,ORIGINAL_CHECK,ORIGINAL_HASH,BATCH_CHECK} from './enable-test-purchase-batch-stock-source.mjs';
test('preserves exact original CHECK as the unrestricted legacy branch',()=>{
 assert.equal(crypto.createHash('sha256').update(ORIGINAL_CHECK,'utf16le').digest('hex').toUpperCase(),ORIGINAL_HASH);
 assert.ok(buildStockSourceSql().includes(`CHECK (${ORIGINAL_CHECK} OR CASE WHEN ${BATCH_CHECK} THEN 1 ELSE 0 END=1)`));
});
test('new movement branch requires exact fixture IDs and complete native movement shape',()=>{
 for(const proof of ["[source_type]=N'goods_receipt_batch'",'[source_id]>0','[created_by]=16','[supplier_id]=13370','[product_id]=301985','[product_id]=325503','[quantity_in]=FLOOR([quantity_in])','[quantity_in] BETWEEN 1 AND 5','[quantity_out]=0','[quantity_net]=[quantity_in]','[unit_cost_try]=60','[unit_cost_try]=80',"[currency_code]=N'TRY'",'[source_record_key] IS NULL','[migration_run_id] IS NULL','[affects_inventory]=1'])assert.ok(BATCH_CHECK.includes(proof),proof);
 assert.ok(!BATCH_CHECK.includes('IS_SRVROLEMEMBER'));assert.ok(!BATCH_CHECK.includes('SESSION_CONTEXT'));
});
test('unknown target baseline and guard drift fail closed; locked atomic update keeps all guards intact',()=>{
 const sql=buildStockSourceSql(),begin=sql.indexOf('BEGIN TRY BEGIN TRANSACTION;');
 for(const gate of ['WRONG_TEST_BATCH_TARGET','TEST_BATCH_STOCK_INSTALLED_GUARD_DRIFT','TEST_BATCH_STOCK_SCOPE_DRIFT','TEST_BATCH_STOCK_UNKNOWN_CHECK_BASELINE'])assert.ok(sql.indexOf(gate)<begin);
 assert.equal((sql.match(/TEST_BATCH_STOCK_PRESERVED_GUARD_DRIFT/g)||[]).length,3);
 assert.ok(sql.includes('WITH CHECK ADD CONSTRAINT'));assert.ok(sql.includes('WITH CHECK CHECK CONSTRAINT'));
 assert.ok(sql.includes('IF @@TRANCOUNT>0 ROLLBACK; THROW;'));assert.ok(!sql.includes('NOCHECK'));assert.ok(!sql.includes('DISABLE TRIGGER'));
});
test('immutable upgrade provenance is seeded before guard creation and replay has zero writes',()=>{
 const sql=buildStockSourceSql();
 assert.ok(sql.indexOf('INSERT dbo.test_purchase_batch_stock_source_upgrade')<sql.indexOf("EXEC sys.sp_executesql N'CREATE TRIGGER"));
 assert.ok(sql.indexOf('PASS_IDENTICAL_NOOP')<sql.indexOf('BEGIN TRY BEGIN TRANSACTION;'));
 assert.ok(sql.includes('m.after_hash=CONVERT'));assert.ok(sql.includes('m.guard_hash=CONVERT'));
 assert.ok(sql.includes('DENY SELECT,INSERT,UPDATE,DELETE ON dbo.test_purchase_batch_stock_source_upgrade'));
 assert.equal(fs.readFileSync(new URL('./enable-test-purchase-batch-stock-source.sql',import.meta.url),'utf8'),sql);
});
