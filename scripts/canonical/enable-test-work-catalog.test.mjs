import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CATALOG_PROC_SQL,CATALOG_STORED_DEFINITION,CATALOG_SQL_PROOF,CATALOG_SALE_BINDING_SQL,CATALOG_ACCESS_SQL,buildWorkCatalogSql,buildCatalogSqlProofModule} from './enable-test-work-catalog.mjs';
import {CATALOG_SQL_PROOF as artifactProof} from '../../apps/api/src/services/catalogSqlProof.mjs';
import {STOCK_PRODUCT_SQL_PROOF} from './enable-test-stock-products.mjs';
test('offline SQL and independent expected-proof artifacts exactly match source',()=>{
 assert.equal(fs.readFileSync(new URL('./enable-test-work-catalog.sql',import.meta.url),'utf8'),buildWorkCatalogSql());
 assert.equal(fs.readFileSync(new URL('../../apps/api/src/services/catalogSqlProof.mjs',import.meta.url),'utf8'),buildCatalogSqlProofModule());
 assert.deepEqual(artifactProof,CATALOG_SQL_PROOF);
 assert.equal(CATALOG_SQL_PROOF.readerDefinitionHash,createHash('sha256').update(CATALOG_STORED_DEFINITION,'utf16le').digest('hex').toUpperCase());
 assert.ok(CATALOG_STORED_DEFINITION.startsWith('CREATE   PROCEDURE dbo.usp_read_work_catalog'));
 for(const [key,value] of Object.entries(STOCK_PRODUCT_SQL_PROOF))assert.equal(CATALOG_SQL_PROOF[key==='readerDefinitionHash'?'stockReaderDefinitionHash':key],value);
});
test('new owner reader writes no business rows and grants only its narrow two TEST executes',()=>{
 const sql=buildWorkCatalogSql();
 assert.doesNotMatch(sql,/ALTER\s+(?:TABLE|TRIGGER)|ALTER\s+PROCEDURE\s+dbo\.(?!usp_read_work_catalog\b)|DISABLE\s+TRIGGER|SESSION_CONTEXT|DELETE\s+FROM|TRUNCATE|DROP\s+|INSERT\s+(?:dbo|erp_migration)\.|UPDATE\s+(?:dbo|erp_migration)\./i);
 assert.doesNotMatch(sql,/CREATE TABLE (?:dbo|erp_migration)\.|CREATE TRIGGER |GRANT (?:SELECT|INSERT|UPDATE|DELETE|CONTROL)|GRANT.*SCHEMA::/i);
 assert.equal((sql.match(/GRANT EXECUTE ON OBJECT::dbo\.usp_read_work_catalog TO/g)||[]).length,2);
 assert.match(CATALOG_PROC_SQL,/WITH EXECUTE AS OWNER/);
 assert.match(CATALOG_PROC_SQL,/transaction_isolation_level=4/);
 assert.match(CATALOG_ACCESS_SQL,/minor_id=0/);assert.match(CATALOG_ACCESS_SQL,/\)<>2/);
});
test('real scope omits fixtures before filtering, count and pagination without excluding quarantine cards',()=>{
 const scope=CATALOG_PROC_SQL.slice(CATALOG_PROC_SQL.indexOf('CREATE TABLE #StockScope'),CATALOG_PROC_SQL.indexOf('CREATE TABLE #StockMatches'));
 assert.match(scope,/accepted_price_products/);assert.match(scope,/operation_quarantine_holds/);
 assert.doesNotMatch(scope,/synthetic-test|301984|301985|301986/);
 assert.match(CATALOG_PROC_SQL,/FROM #StockScope s JOIN dbo.products p/);
 assert.match(CATALOG_PROC_SQL,/SELECT COUNT\(\*\) FROM #StockMatches/);
 assert.match(CATALOG_PROC_SQL,/FROM #StockMatches m JOIN dbo.products p[\s\S]*OFFSET CONVERT\(bigint,@page-1\)\*@page_size/);
 assert.match(CATALOG_PROC_SQL,/COUNT\(\*\) FROM #StockScope WHERE kind=N'synthetic-test'/);
});
test('sale permission is actual-role gated separately from product visibility and has no purchase/cost projection',()=>{
 assert.match(CATALOG_PROC_SQL,/permission_key=N'product.view' AND p.can_view=1/);
 assert.match(CATALOG_PROC_SQL,/@sales bit=CASE WHEN EXISTS[\s\S]*permission_key=N'sales.view' AND p.can_view=1/);
 assert.match(CATALOG_PROC_SQL,/@sales canViewSalesPrices/);
 const projection=CATALOG_PROC_SQL.slice(CATALOG_PROC_SQL.indexOf(' SELECT CONVERT(varchar(20),@actor_id) actorId'));
 assert.doesNotMatch(projection,/financial|average_cost|purchase|sales_price/);
 assert.match(projection,/WHERE @sales=1 AND s.kind=N'accepted-opening'/);
 assert.match(projection,/CONVERT\(varbinary\(max\),N'sale'\)/);
 assert.match(projection,/N'\[\]'\)\) salePrices/);
});
test('every returned sale tuple has native full row, stage, binding and global native ownership witnesses',()=>{
 assert.match(CATALOG_SALE_BINDING_SQL,/FROM #StockPage s JOIN erp_migration.accepted_price_values v/);
 assert.match(CATALOG_SALE_BINDING_SQL,/LEFT JOIN dbo.product_prices n ON n.id=v.price_id/);
 assert.match(CATALOG_SALE_BINDING_SQL,/r.payload_hash IS NULL OR r.payload_json IS NULL/);
 assert.match(CATALOG_SALE_BINDING_SQL,/SELECT n.\* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES/);
 assert.match(CATALOG_SALE_BINDING_SQL,/r.payload_hash<>v.stage_payload_hash/);
 assert.match(CATALOG_SALE_BINDING_SQL,/v.stage_sql_hash/);
 assert.match(CATALOG_SALE_BINDING_SQL,/v.binding_hash IS NULL OR v.binding_hash<>CONVERT/);
 assert.match(CATALOG_SALE_BINDING_SQL,/SELECT n.source_unit_id,n.price EXCEPT SELECT v.source_unit_id,v.price_exact/);
 assert.match(CATALOG_SALE_BINDING_SQL,/SELECT COUNT\(\*\) FROM dbo.product_prices z WHERE z.product_id=v.product_id/);
 assert.match(CATALOG_SALE_BINDING_SQL,/z.price_tier=v.price_tier AND NOT EXISTS\(SELECT z.source_unit_id EXCEPT SELECT v.source_unit_id\)\)<>1/);
 const projection=CATALOG_PROC_SQL.slice(CATALOG_PROC_SQL.indexOf('CAST(NULL AS nvarchar(max)) imageUrl'));
 for(const field of ['source_unit_id','price_tier','currency_code','price_exact','is_main_unit','price_source_key'])assert.ok(projection.includes(`v.${field}`));
 assert.doesNotMatch(projection,/TOP\(1\).*accepted_price_values|COALESCE\(v.price_exact,0\)/);
});
test('photo is explicitly missing until an approved source link exists; exact barcode and source age remain unchanged',()=>{
 assert.match(CATALOG_PROC_SQL,/\{"status":"missing","url":null,"sourceKey":null,"verified":false\}/);
 assert.match(CATALOG_PROC_SQL,/CAST\(NULL AS nvarchar\(max\)\) imageUrl/);
 assert.doesNotMatch(CATALOG_PROC_SQL,/FROM dbo.product_images|im\.file_path|storage_key/);
 assert.match(CATALOG_PROC_SQL,/CONVERT\(varbinary\(max\),bc.barcode\)=CONVERT\(varbinary\(max\),@barcode\)/);
 assert.match(CATALOG_PROC_SQL,/N'2026-09-30'/);
 assert.match(CATALOG_PROC_SQL,/CAST\(p.current_stock_qty AS decimal\(28,8\)\)/);
 assert.doesNotMatch(CATALOG_PROC_SQL,/COALESCE\(p.current_stock_qty,0\)/);
});
test('empty barcode bypass uses byte length so whitespace-only literals never broaden to the whole catalogue',()=>{
 assert.match(CATALOG_PROC_SQL,/\(DATALENGTH\(@barcode\)=0 OR EXISTS/);
 assert.doesNotMatch(CATALOG_PROC_SQL,/@barcode=N''|LTRIM\(@barcode|RTRIM\(@barcode|TRIM\(@barcode/);
 assert.match(CATALOG_PROC_SQL,/CONVERT\(varbinary\(max\),bc.barcode\)=CONVERT\(varbinary\(max\),@barcode\)/);
 for(const barcode of [' ','  ','\t','0000000000000'])assert.notEqual(Buffer.byteLength(barcode,'utf16le'),0);
 assert.equal(Buffer.byteLength('','utf16le'),0);
});
test('existing procedure or permission drift fails closed rather than being silently upgraded',()=>{
 const sql=buildWorkCatalogSql(),noop=sql.slice(sql.indexOf("IF OBJECT_ID(N'dbo.usp_read_work_catalog') IS NOT NULL"),sql.indexOf('EXEC sys.sp_executesql'));
 assert.match(noop,/WORK_CATALOG_DEFINITION_DRIFT/);assert.match(noop,/WORK_CATALOG_EXECUTE_DRIFT/);
 assert.doesNotMatch(noop,/GRANT |ALTER |DENY /);
 assert.match(noop,/NOOP/);
 assert.match(sql,/Semih\\MELISADEV/);assert.match(sql,/IS_SRVROLEMEMBER\(N'sysadmin'\)/);
 assert.match(CATALOG_PROC_SQL,new RegExp(STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash));
});
