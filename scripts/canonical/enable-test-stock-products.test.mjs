import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildStockProductsSql,buildStockProductSqlProofModule,STOCK_PRODUCT_PROC_SQL,STOCK_PRODUCT_STORED_DEFINITION,STOCK_PRODUCT_SQL_PROOF,STOCK_PRODUCT_READY_SQL,STOCK_PRODUCT_BINDING_SQL,STOCK_PRODUCT_ACCESS_SQL,STOCK_PRODUCT_PREVIOUS_HASH} from './enable-test-stock-products.mjs';
import {STOCK_PRODUCT_SQL_PROOF as artifactProof} from '../../apps/api/src/services/stockProductSqlProof.mjs';

test('SQL and API pin artifacts match source without any SQL connection',()=>{
 assert.equal(fs.readFileSync(new URL('./enable-test-stock-products.sql',import.meta.url),'utf8'),buildStockProductsSql());
 assert.equal(fs.readFileSync(new URL('../../apps/api/src/services/stockProductSqlProof.mjs',import.meta.url),'utf8'),buildStockProductSqlProofModule());
 assert.deepEqual(artifactProof,STOCK_PRODUCT_SQL_PROOF);
 const digest=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
 assert.equal(artifactProof.readerDefinitionHash,digest(STOCK_PRODUCT_STORED_DEFINITION));
 assert.notEqual(artifactProof.readerDefinitionHash,digest(STOCK_PRODUCT_STORED_DEFINITION.replace("p.permission_key=N'product.view'", "p.permission_key=N'supplier.view'")));
 for(const key of Object.keys(artifactProof))assert.match(STOCK_PRODUCT_PROC_SQL,new RegExp(`\\b${key}\\b`));
});
test('new owner procedure is read-only and preserves every old writer/reader/table definition',()=>{
 const sql=buildStockProductsSql();
 assert.doesNotMatch(sql,/ALTER\s+(?:TABLE|TRIGGER)|ALTER\s+PROCEDURE\s+dbo\.(?!usp_read_stock_products\b)|DISABLE\s+TRIGGER|SESSION_CONTEXT|DELETE\s+FROM|TRUNCATE|DROP\s+|INSERT\s+(?:dbo|erp_migration)\.|UPDATE\s+(?:dbo|erp_migration)\./i);
 assert.doesNotMatch(sql,/CREATE TABLE (?:dbo|erp_migration)\.|CREATE TRIGGER /i);
 assert.equal((sql.match(/GRANT EXECUTE ON OBJECT::dbo\.usp_read_stock_products TO/g)||[]).length,2);
 assert.doesNotMatch(sql,/GRANT (?:SELECT|INSERT|UPDATE|DELETE|CONTROL)|GRANT.*SCHEMA::/i);
 assert.match(STOCK_PRODUCT_PROC_SQL,/WITH EXECUTE AS OWNER/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/transaction_isolation_level=4/);
});
test('stock permission is independent from finance and DB actual role controls optional fields',()=>{
 assert.match(STOCK_PRODUCT_PROC_SQL,/u\.id=@actor_id AND u\.is_active=1 AND p\.permission_key=N'product.view' AND p\.can_view=1/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/DECLARE @financial bit=CASE WHEN EXISTS.*permission_key=N'purchase.view'/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/CASE WHEN @product_id IS NOT NULL AND @financial=1 THEN j\.row_json ELSE JSON_MODIFY\(j\.row_json,'\$\.financial',NULL\) END/);
 assert.doesNotMatch(STOCK_PRODUCT_PROC_SQL,/p\.(?:purchase_price|sales_price)/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/CAST\(p\.average_cost_try AS decimal\(28,8\)\)/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/s\.kind=N'quarantined-source' THEN NULL/);
});
test('exact barcode remains a literal string and multiple matches stay a paginated list',()=>{
 assert.match(STOCK_PRODUCT_PROC_SQL,/@barcode nvarchar\(160\)/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/CONVERT\(varbinary\(max\),bc\.barcode\)=CONVERT\(varbinary\(max\),@barcode\)/);
 assert.doesNotMatch(STOCK_PRODUCT_PROC_SQL,/TRY_CONVERT\([^,]+,@barcode\)|CAST\(@barcode|LTRIM\(@barcode|TRIM\(@barcode/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/@page_size>50/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/ORDER BY p\.stock_code,p\.id OFFSET CONVERT\(bigint,@page-1\)\*@page_size/);
 for(const filter of ['positive','zero','negative','active','passive'])assert.ok(STOCK_PRODUCT_PROC_SQL.includes(`N'${filter}'`));
 assert.match(STOCK_PRODUCT_PROC_SQL,/COALESCE\(N'\['\+\(SELECT STRING_AGG[\s\S]*\+N'\]',N'\[\]'\) rowsJson/);
});
test('unknown values remain NULL and source snapshot is distinguished from current native stock',()=>{
 assert.match(STOCK_PRODUCT_PROC_SQL,/CAST\(p\.current_stock_qty AS decimal\(28,8\)\)/);
 assert.doesNotMatch(STOCK_PRODUCT_PROC_SQL,/COALESCE\(p\.(?:current_stock_qty|average_cost_try),0\)/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/\.mainUnitSourceId'\)\)>0 THEN CONVERT\(varchar\(20\),b\.main_unit_source_id\) ELSE NULL END sourceId/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/ELSE NULL END factorExact8/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/CASE WHEN s\.kind<>N'synthetic-test' THEN N'2026-09-30' ELSE NULL END sourceAsOf/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/CONVERT\(varchar\(23\),CAST\(SYSUTCDATETIME\(\) AS datetime2\(3\)\),126\)\+N'Z'/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES\) row_json/);
});
test('accepted scope, explicit fixtures and sealed hold cards have separate counts and provenance',()=>{
 assert.match(STOCK_PRODUCT_READY_SQL,/product_count=16622 AND price_count=63774/);
 assert.match(STOCK_PRODUCT_READY_SQL,/entity=N'product' AND native_id IS NOT NULL\)<>54/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/p\.id IN\(301984,301985,301986\)/);
 for(const kind of ['accepted-opening','synthetic-test','quarantined-source'])assert.ok(STOCK_PRODUCT_PROC_SQL.includes(`N'${kind}'`));
 for(const count of ['acceptedCount','syntheticCount','quarantinedCount'])assert.ok(STOCK_PRODUCT_PROC_SQL.includes(count));
 assert.match(STOCK_PRODUCT_READY_SQL,/source_rows=176 AND native_holds=172 AND not_present=4/);
 assert.match(STOCK_PRODUCT_READY_SQL,/h\.reasons_json,h\.binding_basis FOR JSON PATH/);
 assert.match(STOCK_PRODUCT_READY_SQL,/9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E/);
});
test('source/native bindings and immutable C09 current versions fail closed without scalar price fallback',()=>{
 assert.match(STOCK_PRODUCT_BINDING_SQL,/b\.binding_hash<>CONVERT\(char\(64\),HASHBYTES/);
 assert.match(STOCK_PRODUCT_BINDING_SQL,/v\.binding_hash<>CONVERT\(char\(64\),HASHBYTES/);
 assert.match(STOCK_PRODUCT_BINDING_SQL,/p\.source_record_key\) EXCEPT SELECT CONVERT/);
 assert.match(STOCK_PRODUCT_BINDING_SQL,/r\.payload_hash IS NULL OR r\.payload_json IS NULL/);
 assert.match(STOCK_PRODUCT_BINDING_SQL,/r\.payload_hash<>b\.stage_payload_hash/);
 assert.match(STOCK_PRODUCT_BINDING_SQL,/SELECT n\.\* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/pv\.id=c\.version_id AND pv\.price_id=c\.id/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/WHERE p\.id=301986 AND c\.product_id=p\.id/);
 assert.match(STOCK_PRODUCT_READY_SQL,/C09_NATIVE_PRICE_BINDING_DRIFT/);
});
test('NOOP requires exact installed body and two narrow grants instead of repairing drift',()=>{
 const sql=buildStockProductsSql(),noop=sql.slice(sql.indexOf("IF OBJECT_ID(N'dbo.usp_read_stock_products') IS NOT NULL"),sql.indexOf('EXEC sys.sp_executesql'));
 assert.match(noop,/STOCK_PRODUCT_DEFINITION_DRIFT/);assert.match(noop,/STOCK_PRODUCT_EXECUTE_DRIFT/);
 assert.doesNotMatch(noop,/GRANT |DENY |ALTER /);
 assert.match(STOCK_PRODUCT_ACCESS_SQL,/minor_id=0/);assert.match(STOCK_PRODUCT_ACCESS_SQL,/\)<>2/);
});
test('expensive row witnesses are page-scoped while global count, seal and enabled immutable proofs remain',()=>{
 assert.doesNotMatch(STOCK_PRODUCT_READY_SQL,/b\.binding_hash<>|v\.binding_hash<>/);
 assert.match(STOCK_PRODUCT_READY_SQL,/COUNT\(\*\) FROM erp_migration\.accepted_price_products\)<>16622/);
 assert.match(STOCK_PRODUCT_READY_SQL,/COUNT\(\*\) FROM erp_migration\.accepted_price_values\)<>63774/);
 assert.match(STOCK_PRODUCT_READY_SQL,/bindings_hash='5842be926d493c8973566fd922ef840d9fe6f7cecd9d83f17f506be5aa3fbd72'/);
 assert.match(STOCK_PRODUCT_READY_SQL,/ExecIsTriggerDisabled/);
 assert.match(STOCK_PRODUCT_BINDING_SQL,/FROM #StockPage s JOIN erp_migration\.accepted_price_products b ON b\.product_id=s\.id WHERE b\.binding_hash<>/);
 assert.match(STOCK_PRODUCT_BINDING_SQL,/FROM #StockPage s JOIN erp_migration\.accepted_price_values v ON v\.product_id=s\.id WHERE v\.binding_hash<>/);
 assert.match(STOCK_PRODUCT_BINDING_SQL,/r\.payload_hash<>v\.stage_payload_hash/);
});
test('controlled metadata upgrade accepts exactly the previous hash and preserves existing grants',()=>{
 const sql=buildStockProductsSql(),start=sql.indexOf("IF OBJECT_ID(N'dbo.usp_read_stock_products') IS NOT NULL"),end=sql.indexOf('\nEND;\nEXEC sys.sp_executesql',start),upgrade=sql.slice(start,end);
 assert.equal(STOCK_PRODUCT_PREVIOUS_HASH,'8C09D817DFB3C54802FCECC8DC5A18457D891CD887D1AB8BDAAA65E274BF08F3');
 assert.match(STOCK_PRODUCT_PROC_SQL,/^CREATE OR ALTER PROCEDURE dbo\.usp_read_stock_products/);
 const oldCheck=upgrade.indexOf(`@prior_definition_hash<>'${STOCK_PRODUCT_PREVIOUS_HASH}'`),mutation=upgrade.indexOf('EXEC sys.sp_executesql');
 assert.ok(oldCheck>0&&oldCheck<mutation);
 assert.ok(upgrade.indexOf('STOCK_PRODUCT_EXECUTE_DRIFT')<oldCheck);
 assert.doesNotMatch(upgrade,/GRANT |DENY |DROP |UPDATE dbo\./);
 assert.match(upgrade,/N'UPGRADED' result,1 writes/);
 assert.match(upgrade,new RegExp(`@prior_definition_hash='${STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash}' BEGIN COMMIT; SELECT N'NOOP' result,0 writes; RETURN; END`));
});
test('independent pin uses the SQL Server stored header proven by the rolled-back compile',()=>{
 assert.match(STOCK_PRODUCT_STORED_DEFINITION,/^CREATE {3}PROCEDURE dbo\.usp_read_stock_products/);
 assert.equal(STOCK_PRODUCT_STORED_DEFINITION.slice('CREATE   PROCEDURE '.length),STOCK_PRODUCT_PROC_SQL.slice('CREATE OR ALTER PROCEDURE '.length));
 assert.equal(STOCK_PRODUCT_PROC_SQL.length-STOCK_PRODUCT_STORED_DEFINITION.length,7);
 assert.notEqual(STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash,createHash('sha256').update(STOCK_PRODUCT_PROC_SQL,'utf16le').digest('hex').toUpperCase());
});
test('list omits financial JSON and price witnesses; authorized detail retains full price evidence',()=>{
 const priceStart=STOCK_PRODUCT_BINDING_SQL.indexOf('IF @product_id IS NOT NULL AND @financial=1 BEGIN'),priceEnd=STOCK_PRODUCT_BINDING_SQL.indexOf('END;',priceStart);
 const productBranch=STOCK_PRODUCT_BINDING_SQL.slice(0,priceStart),priceBranch=STOCK_PRODUCT_BINDING_SQL.slice(priceStart,priceEnd);
 assert.match(productBranch,/r\.payload_hash<>b\.stage_payload_hash/);
 assert.match(productBranch,/b\.price_count<>\(SELECT COUNT\(\*\) FROM erp_migration\.accepted_price_values/);
 assert.doesNotMatch(productBranch,/LEFT JOIN dbo\.product_prices/);
 assert.match(priceBranch,/SELECT n\.\* FOR JSON PATH/);
 assert.match(priceBranch,/r\.payload_hash<>v\.stage_payload_hash/);
 assert.match(STOCK_PRODUCT_BINDING_SQL,/IF @product_id IS NOT NULL AND @financial=1 AND EXISTS[\s\S]*v\.binding_hash<>/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/JSON_QUERY\(CASE WHEN @product_id IS NOT NULL AND @financial=1 THEN\(SELECT/);
 assert.match(STOCK_PRODUCT_PROC_SQL,/@financial canViewFinance/);
});
