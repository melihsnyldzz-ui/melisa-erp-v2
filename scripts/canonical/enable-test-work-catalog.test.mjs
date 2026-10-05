import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CATALOG_PROC_SQL,CATALOG_STORED_DEFINITION,CATALOG_SQL_PROOF,CATALOG_SALE_BINDING_SQL,CATALOG_NATIVE_PAGE_SQL,CATALOG_ACCESS_SQL,CATALOG_PREVIOUS_HASH,CATALOG_INDEX_SPECS,CATALOG_INDEX_INSTALL_SQL,CATALOG_INDEX_VERIFY_SQL,CATALOG_ALIAS_TARGET_SQL,CATALOG_ALIAS_CACHE_SQL,CATALOG_CLASSIFICATION_SQL,CATALOG_ORDER_SQL,CATALOG_FAST_CLASSIFICATION_SQL,CATALOG_FAST_ORDER_SQL,CATALOG_CLASSIFICATION_VALIDATE_SQL,buildWorkCatalogSql,buildCatalogSqlProofModule} from './enable-test-work-catalog.mjs';
import {CATALOG_SQL_PROOF as artifactProof} from '../../apps/api/src/services/catalogSqlProof.mjs';
import {STOCK_PRODUCT_SQL_PROOF,STOCK_PRODUCT_BINDING_SQL} from './enable-test-stock-products.mjs';
import {SUPPLIER_CARD_READY_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
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
 const projection=CATALOG_PROC_SQL.slice(CATALOG_PROC_SQL.indexOf(' SELECT N\'{"brands":[],"productTypes":[]}\' filtersJson'));
 assert.doesNotMatch(projection,/financial|average_cost|purchase|sales_price/);
 assert.match(projection,/WHERE @sales=1 AND s.kind=N'accepted-opening'/);
 assert.match(projection,/CONVERT\(varbinary\(max\),N'sale'\)/);
 assert.match(projection,/N'\[\]'\)\) salePrices/);
});
test('every returned sale tuple has native full row, stage, binding and global native ownership witnesses',()=>{
 assert.match(CATALOG_SALE_BINDING_SQL,/FROM #StockPage s JOIN erp_migration.accepted_price_values v/);
 assert.match(CATALOG_SALE_BINDING_SQL,/LEFT JOIN #CatalogNativePagePrices n ON n.id=v.price_id/);
 assert.match(CATALOG_SALE_BINDING_SQL,/r.payload_hash IS NULL OR r.payload_json IS NULL/);
 assert.match(CATALOG_SALE_BINDING_SQL,/SELECT n.\* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES/);
 assert.match(CATALOG_SALE_BINDING_SQL,/r.payload_hash<>v.stage_payload_hash/);
 assert.match(CATALOG_SALE_BINDING_SQL,/v.stage_sql_hash/);
 assert.match(CATALOG_SALE_BINDING_SQL,/v.binding_hash IS NULL OR v.binding_hash<>CONVERT/);
 assert.match(CATALOG_SALE_BINDING_SQL,/SELECT n.source_unit_id,n.price EXCEPT SELECT v.source_unit_id,v.price_exact/);
 assert.match(CATALOG_SALE_BINDING_SQL,/SELECT COUNT\(\*\) FROM #CatalogNativePagePrices z WHERE z.product_id=v.product_id/);
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
test('NOOP and controlled upgrade require exact definitions and preserve existing grants',()=>{
 const sql=buildWorkCatalogSql(),noop=sql.slice(sql.indexOf("IF OBJECT_ID(N'dbo.usp_read_work_catalog') IS NOT NULL"),sql.indexOf('EXEC sys.sp_executesql'));
 assert.match(noop,/WORK_CATALOG_DEFINITION_DRIFT/);assert.match(noop,/WORK_CATALOG_EXECUTE_DRIFT/);
 assert.doesNotMatch(noop,/GRANT |ALTER |DENY /);
 assert.match(noop,/NOOP/);
 assert.match(sql,/Semih\\MELISADEV/);assert.match(sql,/IS_SRVROLEMEMBER\(N'sysadmin'\)/);
 assert.match(CATALOG_PROC_SQL,new RegExp(STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash));
 const upgradeStart=sql.indexOf("IF OBJECT_ID(N'dbo.usp_read_work_catalog') IS NOT NULL"),upgradeEnd=sql.indexOf("COMMIT; SELECT N'UPGRADED'",upgradeStart),upgrade=sql.slice(upgradeStart,upgradeEnd+"COMMIT; SELECT N'UPGRADED'".length);
 assert.match(upgrade,new RegExp(`@prior_definition_hash<>'${CATALOG_PREVIOUS_HASH}'`));
 assert.match(upgrade,/@prior_definition_hash IS NULL/);
 assert.match(upgrade,/UPGRADED/);
 assert.match(upgrade,/WORK_CATALOG_EXECUTE_DRIFT/);
 assert.doesNotMatch(upgrade,/GRANT |DENY /);
 assert.ok(upgrade.indexOf(`@prior_definition_hash<>'${CATALOG_PREVIOUS_HASH}'`)<upgrade.indexOf('EXEC sys.sp_executesql'));
});
test('one native page scan retains every row and its exact full-row witness, including unbound duplicate tuples',()=>{
 assert.match(CATALOG_NATIVE_PAGE_SQL,/SELECT n\.\* INTO #CatalogNativePagePrices FROM dbo.product_prices n INNER JOIN #StockPage s ON s.id=n.product_id OPTION\(RECOMPILE\)/);
 assert.doesNotMatch(CATALOG_NATIVE_PAGE_SQL,/accepted_price_values|WHERE |DISTINCT|price_type|ROW_NUMBER|extra|TOP\(/i);
 assert.equal((CATALOG_SALE_BINDING_SQL.match(/FROM dbo.product_prices/g)||[]).length,1);
 assert.doesNotMatch(CATALOG_SALE_BINDING_SQL,/COUNT\(\*\) FROM dbo.product_prices/);
 assert.match(CATALOG_SALE_BINDING_SQL,/COUNT\(\*\) FROM #CatalogNativePagePrices/);
 assert.match(CATALOG_SALE_BINDING_SQL,/SELECT n\.\* FOR JSON PATH/);
 const page=new Set([11,12]);
 const native=[
  {id:1,productId:11,type:'sale',currency:'TRY',tier:1,unit:null},
  {id:2,productId:11,type:'sale',currency:'TRY',tier:1,unit:null}, // unbound duplicate must count
  {id:3,productId:11,type:'Sale',currency:'TRY',tier:1,unit:null},
  {id:4,productId:11,type:'sale',currency:'TRY ',tier:1,unit:null},
  {id:5,productId:11,type:'sale',currency:'TRY',tier:1,unit:1},
  {id:6,productId:12,type:'sale',currency:'USD',tier:2,unit:1},
  {id:7,productId:13,type:'sale',currency:'TRY',tier:1,unit:null},
  {id:8,productId:11,type:'purchase',currency:'TRY',tier:0,unit:null}
 ];
 const selected=native.filter(n=>page.has(n.productId)),same=(a,b)=>['productId','type','currency','tier','unit'].every(k=>a[k]===b[k]);
 for(const tuple of native.filter(n=>page.has(n.productId)))assert.equal(selected.filter(n=>same(n,tuple)).length,native.filter(n=>same(n,tuple)).length);
 assert.equal(selected.filter(n=>same(n,native[0])).length,2);
 assert.equal(selected.filter(n=>same(n,native[4])).length,1);
 assert.equal(selected.find(n=>n.id===8),native[7]);
});
test('four narrow nonunique indexes have exact keys/includes and never repair existing drift',()=>{
 assert.deepEqual(CATALOG_INDEX_SPECS.map(s=>[s.table,s.keys,s.include]),[
  ['product_prices',['product_id'],[]],
  ['product_barcodes',['product_id','is_active'],['barcode','is_primary']],
  ['product_source_aliases',['product_id','source_product_id'],[]],
  ['product_source_aliases',['source_product_id','product_id'],[]]
 ]);
 assert.equal((CATALOG_INDEX_INSTALL_SQL.match(/CREATE NONCLUSTERED INDEX/g)||[]).length,4);
 assert.doesNotMatch(CATALOG_INDEX_INSTALL_SQL,/CREATE UNIQUE|DROP |ALTER |ONLINE|WHERE product|IGNORE_DUP_KEY/i);
 assert.match(CATALOG_INDEX_VERIFY_SQL,/i.type=2 AND i.is_unique=0/);
 assert.match(CATALOG_INDEX_VERIFY_SQL,/i.is_disabled=0 AND i.is_hypothetical=0 AND i.has_filter=0/);
 assert.match(CATALOG_INDEX_VERIFY_SQL,/x.key_ordinal>0 OR x.is_included_column=1/);
 for(const spec of CATALOG_INDEX_SPECS){assert.ok(CATALOG_INDEX_INSTALL_SQL.includes(spec.name));assert.ok(CATALOG_INDEX_VERIFY_SQL.includes(spec.name));}
 assert.ok(CATALOG_PROC_SQL.includes(CATALOG_INDEX_VERIFY_SQL));
 const sql=buildWorkCatalogSql(),noop=sql.slice(sql.indexOf("IF @prior_definition_hash='"),sql.indexOf("IF @prior_definition_hash IS NULL"));
 assert.ok(noop.includes(CATALOG_INDEX_VERIFY_SQL));assert.doesNotMatch(noop,/CREATE |SET @index_writes/);
 assert.match(sql,/1\+@index_writes writes,@index_writes indexWrites,1 readerWrites/);
});
test('adaptive access paths keep exact barcode enforcement and apply only to data selection',()=>{
 assert.match(CATALOG_PROC_SQL,/bc.barcode=@barcode AND CONVERT\(varbinary\(max\),bc.barcode\)=CONVERT\(varbinary\(max\),@barcode\)/);
 assert.match(CATALOG_PROC_SQL,/DATALENGTH\(@barcode\)=0/);
 assert.match(CATALOG_PROC_SQL,/OR\(@status=N'passive' AND\(p.is_active=0 OR p.is_deleted=1\)\)\) OPTION\(RECOMPILE\)/);
 assert.doesNotMatch(CATALOG_PROC_SQL,/INNER HASH JOIN/);
 assert.match(CATALOG_PROC_SQL,/ROWS FETCH NEXT @page_size ROWS ONLY OPTION\(RECOMPILE\)/);
 assert.equal((CATALOG_PROC_SQL.match(/OPTION\(RECOMPILE\)/g)||[]).length,3);
});
test('scoped alias cache keeps full two-direction counts including outside-page, orphan, NULL and duplicate aliases',()=>{
 assert.match(CATALOG_ALIAS_TARGET_SQL,/h.entity=N'product' AND h.native_id IS NOT NULL/);
 assert.match(CATALOG_ALIAS_TARGET_SQL,/FROM #StockPage s JOIN erp_migration.accepted_price_products b/);
 assert.match(CATALOG_ALIAS_CACHE_SQL,/WHERE EXISTS\(SELECT 1 FROM #CatalogAliasTargetProducts t WHERE t.product_id=a.product_id\) OR EXISTS\(SELECT 1 FROM #CatalogAliasTargetSources t WHERE t.source_product_id=a.source_product_id\)/);
 assert.match(CATALOG_ALIAS_CACHE_SQL,/COUNT_BIG\(\*\)/);
 assert.match(CATALOG_ALIAS_CACHE_SQL,/SUM\(pair_count\)/);
 assert.doesNotMatch(CATALOG_ALIAS_CACHE_SQL,/COUNT\(DISTINCT|SELECT DISTINCT|COALESCE\(a\./);
 const native=new Set([11,99]),sources=new Set([101,909]),aliases=[
  {product:11,source:101},{product:11,source:101}, // actual duplicate pair
  {product:11,source:null}, // NULL source still counts against selected native
  {product:12,source:101}, // outside-page native still counts against selected source
  {product:null,source:101}, // orphan native still counts against selected source
  {product:99,source:909},{product:77,source:909}, // hold and outside-page hold-source collision
  {product:99,source:404}, // foreign source still counts against hold native
  {product:13,source:303},{product:null,source:null}
 ];
 const eq=(a,b)=>a!==null&&b!==null&&a===b;
 const cached=aliases.filter(a=>a.product!==null&&native.has(a.product)||a.source!==null&&sources.has(a.source));
 const count=(rows,predicate)=>rows.filter(predicate).length;
 for(const product of native)assert.equal(count(cached,a=>eq(a.product,product)),count(aliases,a=>eq(a.product,product)));
 for(const source of sources)assert.equal(count(cached,a=>eq(a.source,source)),count(aliases,a=>eq(a.source,source)));
 for(const product of native)for(const source of sources)assert.equal(count(cached,a=>eq(a.product,product)&&eq(a.source,source)),count(aliases,a=>eq(a.product,product)&&eq(a.source,source)));
 assert.equal(count(cached,a=>eq(a.product,11)),3);assert.equal(count(cached,a=>eq(a.source,101)),4);
 assert.equal(count(cached,a=>eq(a.product,99)),2);assert.equal(count(cached,a=>eq(a.source,909)),2);
});
test('all readiness checks occur after page selection but before bindings and public output in the same serializable read',()=>{
 const page=CATALOG_PROC_SQL.indexOf('INSERT #StockPage'),cache=CATALOG_PROC_SQL.indexOf('CREATE TABLE #CatalogAliasTargetProducts'),ready=CATALOG_PROC_SQL.indexOf('STOCK_PRODUCT_STAGE_UNAVAILABLE'),binding=CATALOG_PROC_SQL.indexOf('b.binding_hash<>'),output=CATALOG_PROC_SQL.indexOf(' SELECT N\'{"brands":[],"productTypes":[]}\' filtersJson');
 assert.ok(page<cache&&cache<ready&&ready<binding&&binding<output);
 assert.equal(CATALOG_PROC_SQL.split('INSERT #StockAliasPairs').length-1,1);
 assert.match(CATALOG_PROC_SQL,/transaction_isolation_level=4/);
});
test('duplicate supplier expansion is removed but the complete identical readiness checks remain once',()=>{
 const renamed=SUPPLIER_CARD_READY_SQL.replaceAll('51076','51101').replaceAll('SUPPLIER_CARD_','STOCK_PRODUCT_');
 assert.ok(CATALOG_PROC_SQL.includes(renamed));
 assert.equal(CATALOG_PROC_SQL.split('59A82329B54B3B08FF5A1AF23B1AC2ED4322ADC2785772604558F1F32BFB8644').length-1,1);
 assert.equal(CATALOG_PROC_SQL.split('STOCK_PRODUCT_STAGE_UNAVAILABLE').length-1,1);
 for(const guard of ['C09_PRICE_SCHEMA_DRIFT','C09_NATIVE_PRICE_BINDING_DRIFT','C09_PRICE_GUARD_DRIFT','STOCK_PRODUCT_QUARANTINE_BINDING_DRIFT'])assert.ok(CATALOG_PROC_SQL.includes(guard));
 assert.match(CATALOG_PROC_SQL,/@page_size int=50/);
 assert.match(CATALOG_PROC_SQL,/@page_size>50/);
});
test('verified source classification uses full outer stage payload and native identity before whole-scope filters',()=>{
 assert.match(CATALOG_CLASSIFICATION_SQL,/OPENJSON\(r.payload_json\) WITH\(brand nvarchar\(250\) '\$.brand',product_type nvarchar\(250\) '\$.category',source_name nvarchar\(500\) '\$.name'\)/);
 assert.doesNotMatch(CATALOG_CLASSIFICATION_SQL,/JSON_VALUE\(JSON_VALUE|source_payload_json|COALESCE\(c.brand/i);
 for(const evidence of ['r.payload_hash<>b.stage_payload_hash','<>b.stage_sql_hash','p.stock_code','p.name','p.source_record_key','p.brand','p.category'])assert.ok(CATALOG_CLASSIFICATION_SQL.includes(evidence));
 assert.ok(CATALOG_PROC_SQL.indexOf('INSERT #CatalogClassification')<CATALOG_PROC_SQL.indexOf('INSERT #StockMatches'));
 assert.match(CATALOG_FAST_CLASSIFICATION_SQL,/IF @classification_validation=1 BEGIN/);
 const normal=CATALOG_FAST_CLASSIFICATION_SQL.slice(CATALOG_FAST_CLASSIFICATION_SQL.indexOf('END ELSE BEGIN'),CATALOG_FAST_CLASSIFICATION_SQL.indexOf('CREATE TABLE #CatalogMediaBindings'));
 assert.doesNotMatch(normal,/erp_migration.records|HASHBYTES|REPLACE\(|brand|category|p.name|p.source_record_key/);assert.match(normal,/OPENJSON\(@candidate_bindings\)/);assert.match(normal,/p.stock_code,x.rank/);
 assert.ok(normal.includes("WITH(id bigint '$[0]',rank bigint '$[1]')"));
 assert.match(normal,/id bigint NOT NULL,rank bigint NOT NULL CHECK\(rank BETWEEN 1 AND 16676\)/);
 const load=normal.indexOf('INSERT #CatalogCandidates'),uniqueId=normal.indexOf('CREATE UNIQUE CLUSTERED INDEX IX_CatalogCandidates_Id'),uniqueRank=normal.indexOf('CREATE UNIQUE NONCLUSTERED INDEX IX_CatalogCandidates_Rank'),use=normal.indexOf('SELECT id FROM #CatalogCandidates EXCEPT');
 assert.ok(load<uniqueId&&uniqueId<uniqueRank&&uniqueRank<use);
 assert.match(CATALOG_CLASSIFICATION_VALIDATE_SQL,/UPPER\(i.stage_payload_hash\)<>UPPER\(b.stage_payload_hash\)/);assert.match(CATALOG_CLASSIFICATION_VALIDATE_SQL,/UPPER\(i.stage_sql_hash\)<>UPPER\(b.stage_sql_hash\)/);
});
test('startup classification returns only after full accepted binding witnesses with finance disabled',()=>{
 const start=CATALOG_PROC_SQL.indexOf('IF @classification_validation=1 INSERT #StockPage SELECT id,kind FROM #StockScope;');
 const binding=CATALOG_PROC_SQL.indexOf('b.binding_hash<>',start);
 const result=CATALOG_PROC_SQL.indexOf('classificationValidated',binding);
 assert.ok(start>=0&&binding>start&&result>binding);
 const guarded=CATALOG_PROC_SQL.slice(start,result);
 for(const witness of ['p.unit','p.currency_code','b.main_unit_source_id','b.price_count','b.binding_hash'])assert.ok(guarded.includes(witness));
 assert.match(CATALOG_PROC_SQL,/DECLARE @financial bit=0/);
 assert.equal(CATALOG_PROC_SQL.split('b.binding_hash<>').length-1,1);
});
test('full binding hash uses materialized selected rows without changing the immutable hash predicate',()=>{
 const source=STOCK_PRODUCT_BINDING_SQL.slice(STOCK_PRODUCT_BINDING_SQL.indexOf('WHERE b.binding_hash<>'));
 assert.ok(CATALOG_PROC_SQL.includes('SELECT b.* INTO #CatalogPageAcceptedBindings FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id;'));
 assert.ok(CATALOG_PROC_SQL.includes('SELECT 1 FROM #CatalogPageAcceptedBindings b '+source));
 assert.ok(CATALOG_PROC_SQL.indexOf('INTO #CatalogPageAcceptedBindings')<CATALOG_PROC_SQL.indexOf('classificationValidated'));
 assert.equal(CATALOG_PROC_SQL.split('INTO #CatalogPageAcceptedBindings').length-1,1);
});
test('candidate scope/ranks are exact; source identity is validated globally at startup and freshly on selected pages',()=>{
 assert.ok(CATALOG_FAST_CLASSIFICATION_SQL.includes('SELECT id FROM #CatalogCandidates EXCEPT SELECT id FROM #StockScope'));
 assert.doesNotMatch(CATALOG_FAST_CLASSIFICATION_SQL,/#CatalogCandidateNative/);
 const normal=CATALOG_FAST_CLASSIFICATION_SQL.slice(CATALOG_FAST_CLASSIFICATION_SQL.indexOf('END ELSE BEGIN'),CATALOG_FAST_CLASSIFICATION_SQL.indexOf('CREATE TABLE #CatalogMediaBindings'));
 assert.doesNotMatch(normal,/p.name|p.source_record_key|b.stock_code/);
 for(const field of ['p.stock_code','p.name','p.source_record_key','p.brand','p.category'])assert.ok(CATALOG_FAST_CLASSIFICATION_SQL.slice(0,CATALOG_FAST_CLASSIFICATION_SQL.indexOf('END ELSE BEGIN')).includes(field));
 for(const field of ['p.unit','p.currency_code','p.source_record_key','r.payload_hash<>b.stage_payload_hash','b.price_count','b.binding_hash'])assert.ok(CATALOG_PROC_SQL.includes(field));
});
test('safe display suffix lengths cannot be negative; natural sorting is overflow-safe before OFFSET and JSON order',()=>{
 assert.match(CATALOG_CLASSIFICATION_SQL,/LEFT\(p.stock_code,CASE WHEN DATALENGTH\(p.stock_code\)>DATALENGTH\(c.brand\)\+2 THEN\(DATALENGTH\(p.stock_code\)-DATALENGTH\(c.brand\)-2\)\/2 ELSE 0 END\)/);
 assert.doesNotMatch(CATALOG_CLASSIFICATION_SQL,/LEN\(p.stock_code\)|LEN\(c.brand\)|UNICODE\(LEFT\(c.brand/);
 assert.match(CATALOG_CLASSIFICATION_SQL,/PATINDEX\(N'%\[\^0-9\]%'/);assert.match(CATALOG_ORDER_SQL,/c.digit_length/);assert.match(CATALOG_ORDER_SQL,/CONVERT\(varbinary\(500\),c.numeric_value\)/);assert.doesNotMatch(CATALOG_ORDER_SQL,/CONVERT\((?:bigint|decimal|float|int),c/);
 assert.ok(CATALOG_PROC_SQL.indexOf('ROW_NUMBER() OVER(ORDER BY')<CATALOG_PROC_SQL.indexOf('INSERT #StockPage'));assert.match(CATALOG_PROC_SQL,/ORDER BY o.position OFFSET/);assert.match(CATALOG_PROC_SQL,/WITHIN GROUP\(ORDER BY o.position\)/);
});
test('descending code reverses the whole natural order including numeric/text group and stable original/id ties',()=>{
 for(const key of ['c.numeric_group','c.digit_length','CONVERT(varbinary(500),c.numeric_value)','CONVERT(varbinary(500),c.digit_suffix)','CONVERT(varbinary(500),c.display_code)','CONVERT(varbinary(500),p.stock_code)','p.id']){
  assert.ok(CATALOG_ORDER_SQL.includes(`CASE WHEN @sort<>N'code-desc' THEN ${key} END ASC`));assert.ok(CATALOG_ORDER_SQL.includes(`CASE WHEN @sort=N'code-desc' THEN ${key} END DESC`));
 }
 assert.match(CATALOG_FAST_ORDER_SQL,/@sort<>N'code-desc' THEN c.rank END ASC/);assert.match(CATALOG_FAST_ORDER_SQL,/@sort=N'code-desc' THEN c.rank END DESC/);assert.match(CATALOG_FAST_ORDER_SQL,/@sort=N'stock-desc' THEN p.current_stock_qty END DESC/);
});
test('image filter intersects current accepted identity, both alias directions and hold before counts/page',()=>{
 const start=CATALOG_PROC_SQL.indexOf('UPDATE c SET photo_available=1'),page=CATALOG_PROC_SQL.indexOf('INSERT #StockPage');assert.ok(start<page);
 for(const evidence of ['m.stock_code','p.stock_code','b.stock_code','m.source_key','b.product_source_key','m.run_id','h.native_id=c.id OR h.source_id=b.source_id','pc.alias_count=1','sc.alias_count=1','ap.pair_count=1'])assert.ok(CATALOG_CLASSIFICATION_SQL.includes(evidence));
 assert.match(CATALOG_PROC_SQL,/@image=N'available' AND c.photo_available=1/);assert.match(CATALOG_PROC_SQL,/@image=N'missing' AND c.photo_available=0/);
 assert.match(CATALOG_PROC_SQL,/SELECT COUNT\(\*\) FROM #StockMatches/);assert.ok(CATALOG_PROC_SQL.indexOf('INSERT #StockMatches')<page);
});
test('photo alias aggregation counts all duplicate/orphan/NULL rows in both directions, freshly before paging',()=>{
 for(const part of ['COUNT_BIG(*)','SUM(pair_count)','m.product_id=a.product_id','t.source_product_id=a.source_product_id','GROUP BY product_id,source_product_id'])assert.ok(CATALOG_CLASSIFICATION_SQL.includes(part));
 assert.doesNotMatch(CATALOG_CLASSIFICATION_SQL,/COUNT\(DISTINCT|WHERE a.product_id IS NOT NULL|WHERE a.source_product_id IS NOT NULL/);
 assert.ok(CATALOG_PROC_SQL.indexOf('INSERT #CatalogMediaAliasPairs')<CATALOG_PROC_SQL.indexOf('UPDATE c SET photo_available=1'));
 assert.ok(CATALOG_PROC_SQL.indexOf('UPDATE c SET photo_available=1')<CATALOG_PROC_SQL.indexOf('INSERT #StockMatches'));
 const aliases=[{p:12,s:90},{p:12,s:null},{p:99,s:90},{p:null,s:91},{p:13,s:91},{p:13,s:91}];
 const targets=new Set([12,13]),sources=new Set([90,91]);const scoped=aliases.filter(a=>targets.has(a.p)||sources.has(a.s));
 for(const [p,s] of [[12,90],[13,91]]){
  const counts=rows=>[rows.filter(a=>a.p===p).length,rows.filter(a=>a.s===s).length,rows.filter(a=>a.p===p&&a.s===s).length];
  assert.deepEqual(counts(scoped),counts(aliases));assert.ok(counts(scoped).some(n=>n!==1));
 }
});
