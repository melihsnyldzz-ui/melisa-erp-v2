import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCurrentPricePurchaseSql,buildPurchaseObjects,PURCHASE_DDL,PURCHASE_GET_SQL,PURCHASE_ASSERT_SQL,CURRENT_PRICE_PURCHASE_SQL_PROOF,intentTerms,postedReceipt,nativeComplete,PURCHASE_ACCESS_VERIFY_SQL} from './enable-test-current-price-purchase.mjs';
import {CURRENT_PRICE_PURCHASE_SQL_PROOF as artifactProof} from '../../apps/api/src/services/testProductPriceSqlProof.mjs';
import {findInlineCrossColumnChecks} from './enable-test-purchase-batches.mjs';
import {digest} from './enable-test-product-prices.mjs';
test('consumer artifact and independent getter/assert pins match exact sources',()=>{
 assert.equal(fs.readFileSync(new URL('./enable-test-current-price-purchase.sql',import.meta.url),'utf8'),buildCurrentPricePurchaseSql());
 assert.deepEqual(artifactProof,CURRENT_PRICE_PURCHASE_SQL_PROOF);
 assert.equal(artifactProof.consumerGetterHash,digest(PURCHASE_GET_SQL));assert.equal(artifactProof.consumerAssertHash,digest(PURCHASE_ASSERT_SQL));
 assert.equal(findInlineCrossColumnChecks(buildCurrentPricePurchaseSql()).length,0);
 assert.match(PURCHASE_GET_SQL,/consumerGetterHash/);assert.match(PURCHASE_ASSERT_SQL,/consumerAssertHash/);
});
test('C03 snapshots and existing native guards are never changed',()=>{
 const sql=buildCurrentPricePurchaseSql();
 assert.doesNotMatch(sql,/ALTER (?:TABLE|TRIGGER|PROCEDURE)|DISABLE TRIGGER|SESSION_CONTEXT|UPDATE dbo\.test_purchase_fx_|INSERT dbo\.test_purchase_fx_|UPDATE dbo\.test_purchase_batch_|UPDATE erp_migration\.|DELETE FROM|TRUNCATE|DROP /i);
 assert.match(sql,/N'{1,2}C09PRICE'{1,2}/);assert.match(sql,/N'{1,2}TDAY-C09-%'{1,2}/);
 assert.match(PURCHASE_DDL,/document_date=CONVERT\(date,N'2026-10-04'\)/);
 assert.match(PURCHASE_GET_SQL,/FROM dbo\.test_purchase_fx_rates ORDER BY id/);
 assert.match(sql,/t\.currency/);assert.match(sql,/source_rows=176 AND native_holds=172 AND not_present=4/);
});
test('quote binds immutable native version, current revision, exact rounding and positive bounded amount',()=>{
 const terms=intentTerms('t');assert.match(terms,/v\.id=t\.version_id AND v\.price_id=t\.price_id/);
 assert.match(terms,/c\.native_price_id=t\.native_price_id/);assert.match(terms,/TRY_CONVERT\(decimal\(18,4\),ROUND\(v\.price_exact,4\)\)=t\.native_price/);
 assert.match(terms,/t\.amount_try>0 AND t\.amount_try<=200/);assert.match(terms,/t\.quantity BETWEEN 1 AND 5/);
 const body=buildPurchaseObjects().find(([name])=>name==='c09_guard_current_price_purchase_intents')[1];
 assert.match(body,/i\.before_revision<>CONVERT\(char\(64\),HASHBYTES/);
 assert.match(body,/c\.id=i\.price_id AND c\.version_id=i\.version_id/);
 assert.match(body,/d\.status<>N'quoted'/);
 assert.match(PURCHASE_GET_SQL,/v\.reason price_reason/);assert.match(PURCHASE_GET_SQL,/price_changed_at/);
});
test('physical receipt posts one actual stock effect and native invoice posts no second effect',()=>{
 assert.match(postedReceipt('t'),/COUNT\(\*\) FROM dbo\.stock_movements.*\)=1/);
 assert.match(postedReceipt('t'),/g\.state=N'approved' AND g\.decided_by=16/);
 assert.match(nativeComplete('t'),/stock_effect_snapshot=N'goods_receipt_already_posted'/);
 assert.match(nativeComplete('t'),/NOT EXISTS\(SELECT 1 FROM dbo\.stock_movements WHERE source_type=N'purchase_invoice'/);
 assert.match(nativeComplete('i'),/purchase_invoice_items ni WHERE ni\.purchase_invoice_id=i\.invoice_id/);
 assert.doesNotMatch(nativeComplete('i'),/purchase_invoice_items i\b|purchase_invoices i\b/);
 const objects=buildPurchaseObjects();assert.match(objects.find(([name])=>name==='c09_guard_current_price_stock')[1],/IF EXISTS\(SELECT 1 FROM deleted m/);
 assert.match(PURCHASE_ASSERT_SQL,/t\.status=N'linked' AND h\.status IN\(N'draft',N'finalized'\)/);
});
test('historical intent and completed UUID journal cannot be rewritten or reassigned',()=>{
 const requests=buildPurchaseObjects().find(([name])=>name==='c09_guard_current_price_requests')[1];
 assert.match(requests,/IF EXISTS\(SELECT 1 FROM deleted\)/);
 assert.match(requests,/payload_hash=CONVERT\(char\(64\),HASHBYTES\('SHA2_256',r\.payload_json\)/);
 assert.match(requests,/JSON_VALUE\(r\.payload_json,'\$\.input.requestId'\)/);
 assert.match(requests,/sourceProof\.versionId/);assert.match(requests,/sourceProof\.revision/);
 assert.match(PURCHASE_DDL,/request_id uniqueidentifier NOT NULL PRIMARY KEY/);
 assert.match(PURCHASE_DDL,/native_price_id=price_id/);
 const movementGuard=buildPurchaseObjects().find(([name])=>name==='c09_guard_current_price_supplier_movements')[1];
 assert.match(movementGuard,/OR NOT EXISTS\(SELECT 1 WHERE m\.supplier_id=13373/);
 assert.doesNotMatch(movementGuard,/OR NOT\(m\.supplier_id/);
});
test('new metadata access is narrow and replay validates grants instead of repairing them',()=>{
 const sql=buildCurrentPricePurchaseSql();assert.match(sql,/GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo\.test_current_price_purchase_intents/);
 assert.match(sql,/GRANT SELECT,INSERT ON OBJECT::dbo\.test_current_price_purchase_requests/);
 assert.doesNotMatch(sql,/GRANT .*SCHEMA::|GRANT CONTROL|GRANT .*dbo\.products|GRANT .*dbo\.suppliers/);
 assert.match(PURCHASE_ACCESS_VERIFY_SQL,/minor_id<>0/);
 const noop=sql.slice(sql.indexOf("IF OBJECT_ID(N'dbo.test_current_price_purchase_manifest',N'U') IS NOT NULL BEGIN"),sql.indexOf('CREATE TABLE dbo.test_current_price_purchase_intents'));
 assert.match(noop,/C09_PURCHASE_ACCESS_DRIFT/);assert.doesNotMatch(noop,/GRANT |DENY |INSERT dbo/);
});
