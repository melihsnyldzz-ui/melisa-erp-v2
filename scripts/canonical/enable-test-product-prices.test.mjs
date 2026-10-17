import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProductPricesSql,PRODUCT_PRICE_SQL_PROOF,PRICE_CONTEXT_SQL,PRICE_GET_SQL,PRICE_SET_SQL,PRICE_NATIVE_GUARD_SQL,PRICE_CURRENT_GUARD_SQL,PRICE_VERSION_GUARD_SQL,PRICE_REQUEST_GUARD_SQL,PRICE_SCHEMA_VERIFY_SQL,PRICE_CARD_WITNESS,PRICE_DDL,PRICE_GRANT_VERIFY_SQL,digest} from './enable-test-product-prices.mjs';
import {buildCombinedPriceSqlProofModule} from './enable-test-current-price-purchase.mjs';
import {findInlineCrossColumnChecks} from './enable-test-purchase-batches.mjs';
import {PRODUCT_PRICE_SQL_PROOF as artifactProof} from '../../apps/api/src/services/testProductPriceSqlProof.mjs';
test('checked-in SQL and independent API pins are exact offline products',()=>{
 assert.equal(fs.readFileSync(new URL('./enable-test-product-prices.sql',import.meta.url),'utf8'),buildProductPricesSql());
 assert.equal(fs.readFileSync(new URL('../../apps/api/src/services/testProductPriceSqlProof.mjs',import.meta.url),'utf8'),buildCombinedPriceSqlProofModule());
 assert.deepEqual(artifactProof,PRODUCT_PRICE_SQL_PROOF);
 assert.equal(artifactProof.getterHash,digest(PRICE_GET_SQL));assert.equal(artifactProof.setterHash,digest(PRICE_SET_SQL));
 assert.notEqual(digest(PRICE_GET_SQL.replace('product_id<>301986','product_id<>301987')),artifactProof.getterHash);
 assert.equal(findInlineCrossColumnChecks(buildProductPricesSql()).length,0);
});
test('only existing synthetic native rows can be written; sealed source and old guards stay intact',()=>{
 const sql=buildProductPricesSql();
 assert.doesNotMatch(sql,/ALTER\s+(?:TABLE|TRIGGER|PROCEDURE)|DISABLE\s+TRIGGER|SESSION_CONTEXT|UPDATE\s+erp_migration\.|UPDATE\s+dbo\.(?:products|suppliers)|INSERT\s+dbo\.audit_logs|TRUNCATE|DROP\s+/i);
 assert.match(PRICE_SET_SQL,/UPDATE dbo\.product_prices SET price=.*WHERE id=@native_id AND product_id=301986/);
 assert.match(PRICE_NATIVE_GUARD_SQL,/i\.product_id=301986/);assert.match(PRICE_NATIVE_GUARD_SQL,/i\.migration_run_id IS NULL/);
 assert.match(PRICE_NATIVE_GUARD_SQL,/SELECT d\.id,d\.product_id,d\.price_type/);
 assert.match(sql,/5842be926d493c8973566fd922ef840d9fe6f7cecd9d83f17f506be5aa3fbd72/);
 assert.match(sql,/COUNT\(\*\).*test_purchase_batch_guard_manifest\)<>15/);
 assert.match(sql,/COUNT\(\*\).*test_purchase_fx_guard_manifest\)<>17/);
});
test('historical UUID replay precedes whole-card revision and catches A-B-A via rowversion',()=>{
 assert.ok(PRICE_SET_SQL.indexOf('IF EXISTS(SELECT 1 FROM dbo.test_product_price_requests WHERE request_id=@request)')<PRICE_SET_SQL.indexOf("THROW 51098,'C09_PRICE_STALE'"));
 assert.match(PRICE_SET_SQL,/actor_id=@actor_id AND state=N'completed' AND payload_hash=@hash AND CONVERT\(varbinary\(max\),payload_json\)=CONVERT\(varbinary\(max\),@payload_json\)/);
 assert.match(PRICE_CARD_WITNESS,/c\.row_version/);assert.match(PRICE_CARD_WITNESS,/SELECT n\.\* FOR JSON/);
 assert.match(PRICE_CURRENT_GUARD_SQL,/i\.row_version=d\.row_version/);
 assert.match(PRICE_REQUEST_GUARD_SQL,/i\.after_revision<>i\.before_revision/);
 assert.match(PRICE_REQUEST_GUARD_SQL,/i\.response_json\)=CONVERT\(varbinary\(max\)/);
 assert.doesNotMatch(PRICE_SET_SQL,/IDENT_CURRENT|MAX\(id\)|CAST\(@exact_text AS float\)|COALESCE\(@exact_text/);
});
test('SQL preserves unknown/zero and rejects truncated or noncanonical decimal/tuple/body',()=>{
 assert.match(PRICE_DDL,/price_exact decimal\(28,8\) NULL/);assert.match(PRICE_SET_SQL,/TRY_CONVERT\(decimal\(28,8\),@exact_text\)/);
 assert.match(PRICE_SET_SQL,/DATALENGTH\(@payload_json\)>8192/);
 assert.match(PRICE_SET_SQL,/OPENJSON\(@payload_json\)\)<>7/);
 assert.match(PRICE_SET_SQL,/OPENJSON\(@tuple\)\)<>4/);
 assert.match(PRICE_SET_SQL,/j\.type NOT IN\(0,1\)/);
 assert.match(PRICE_SET_SQL,/CONVERT\(varbinary\(max\),@exact_text\)<>CONVERT\(varbinary\(max\),CONVERT\(nvarchar\(100\),TRY_CONVERT/);
 assert.match(PRICE_SET_SQL,/C09_PRICE_TUPLE_INVALID/);assert.match(PRICE_VERSION_GUARD_SQL,/EXISTS\(SELECT 1 FROM deleted\)/);
 // SQL FOR JSON can return NULL for an empty subquery; required lists must survive outer JSON serialization.
 assert.match(PRICE_CONTEXT_SQL,/JSON_QUERY\(COALESCE\(\(SELECT CONVERT[\s\S]*?FOR JSON PATH,INCLUDE_NULL_VALUES\),N'\[\]'\)\) prices/);
 assert.match(PRICE_CONTEXT_SQL,/JSON_QUERY\(COALESCE\(\(SELECT TOP\(20\)[\s\S]*?FOR JSON PATH,INCLUDE_NULL_VALUES\),N'\[\]'\)\) recentChanges/);
});
test('DB permissions and main-unit proof come from current authenticated TEST role and immutable scope',()=>{
 assert.match(PRICE_GET_SQL,/u\.id=@actor_id AND u\.is_active=1/);
 assert.match(PRICE_GET_SQL,/permission_key=N'product.view' AND p.can_view=1/);
 assert.match(PRICE_GET_SQL,/permission_key=N'purchase.view' AND p.can_view=1/);
 assert.match(PRICE_SET_SQL,/@actor_id=16/);assert.match(PRICE_SET_SQL,/permission_key=N'product.price.edit' AND p.can_update=1/);
 const sql=buildProductPricesSql();assert.match(sql,/SELECT TOP\(1\).*main_unit_source_id/);assert.match(sql,/s\.unit=N'ADET' AND s\.unit_factor=1/);
 assert.match(sql,/INSERT dbo.test_product_price_scope SELECT N'purchase',NULL,0,currency FROM dbo.test_purchase_fx_rates/);
 assert.match(sql,/CROSS JOIN\(VALUES\(1\),\(2\),\(3\),\(4\),\(5\),\(6\)\)/);
 assert.match(PRICE_GET_SQL,/supportedTuples/);assert.match(PRICE_GET_SQL,/isMainUnit/);
});
test('reinstallation validates schema/grants without silently repairing accepted state',()=>{
 const sql=buildProductPricesSql(),noop=sql.slice(sql.indexOf("IF OBJECT_ID(N'dbo.test_product_price_manifest',N'U') IS NOT NULL BEGIN"),sql.indexOf('CREATE TABLE dbo.test_product_price_units'));
 assert.match(noop,/NOOP/);assert.doesNotMatch(noop,/GRANT\s+|DENY\s+|INSERT dbo/);
 assert.match(PRICE_SCHEMA_VERIFY_SQL,/is_disabled=1 OR is_not_trusted=1/);
 assert.match(PRICE_GRANT_VERIFY_SQL,/minor_id<>0/);assert.match(PRICE_GRANT_VERIFY_SQL,/C09_PRICE_PRIVATE_ACCESS_DRIFT/);
 assert.doesNotMatch(sql,/GRANT\s+(?:INSERT|UPDATE|DELETE) ON OBJECT::dbo\.test_product_price/);
 assert.equal((sql.match(/GRANT SELECT ON OBJECT::dbo\.test_product_price/g)||[]).length,2);
});
test('authorized permission file adds exactly one role16 key and protects every other row',()=>{
 const sql=fs.readFileSync(new URL('./enable-test-ilker-product-price-access.sql',import.meta.url),'utf8');
 assert.match(sql,/u\.id=16 AND u\.role_id=16 AND u\.is_active=1 AND r\.code=N'isolated_test_ilker'/);
 assert.match(sql,/COUNT\(\*\) FROM dbo\.users WHERE role_id=16\)<>1/);
 assert.equal((sql.match(/INSERT dbo\.permissions\(/g)||[]).length,1);
 assert.match(sql,/VALUES\(16,N'product.price.edit',0,0,1,0,0/);
 assert.match(sql,/@before_hash<>CONVERT\(char\(64\),HASHBYTES/);
 assert.match(sql,/p\.\* FROM dbo\.permissions p.*ORDER BY p\.id FOR JSON/);
 assert.doesNotMatch(sql,/UPDATE dbo\.permissions|DELETE FROM dbo\.permissions|INSERT dbo\.users|UPDATE dbo\.users|UPDATE dbo\.roles/);
});
