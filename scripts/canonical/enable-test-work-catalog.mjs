// Offline builder: a new read-only companion, leaving the accepted stock reader intact.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {STOCK_PRODUCT_PROC_SQL,STOCK_PRODUCT_READY_SQL,STOCK_PRODUCT_SQL_PROOF,STOCK_PRODUCT_RUN,STOCK_PRODUCT_ALIAS_CACHE_SQL,STOCK_PRODUCT_RUNTIME_READY_SQL,STOCK_PRODUCT_BINDING_SQL} from './enable-test-stock-products.mjs';
import {SUPPLIER_CARD_READY_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
export const CATALOG_PROC='dbo.usp_read_work_catalog';
export const CATALOG_PREVIOUS_HASH='4C070222CB1CA34D605C328E6485B123174CE726288EB4DD66BC7D421A69ADB4';
const digest=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
const quote=s=>"N'"+s.replaceAll("'","''")+"'";
const fail="THROW 51102,'WORK_CATALOG_BINDING_DRIFT',1;";
const binary=(a,b)=>`CONVERT(varbinary(max),${a})=CONVERT(varbinary(max),${b})`;
// Nonunique access paths preserve all duplicate/NULL rows. Existing names with
// another shape fail closed; the installer never rewrites another index.
export const CATALOG_INDEX_SPECS=Object.freeze([
 {table:'product_prices',name:'IX_WorkCatalog_ProductPrices_Product',keys:['product_id'],include:[]},
 {table:'product_barcodes',name:'IX_WorkCatalog_ProductBarcodes_ProductActive',keys:['product_id','is_active'],include:['barcode','is_primary']},
 {table:'product_source_aliases',name:'IX_WorkCatalog_ProductAliases_ProductSource',keys:['product_id','source_product_id'],include:[]},
 {table:'product_source_aliases',name:'IX_WorkCatalog_ProductAliases_SourceProduct',keys:['source_product_id','product_id'],include:[]}
]);
const indexShape=s=>JSON.stringify([...s.keys.map((name,index)=>({name,keyOrdinal:index+1,descending:false,included:false})),...s.include.map(name=>({name,keyOrdinal:0,descending:false,included:true}))]);
const indexVerify=s=>`IF NOT EXISTS(SELECT 1 FROM sys.indexes i WHERE i.object_id=OBJECT_ID(N'dbo.${s.table}') AND i.name=N'${s.name}' AND i.type=2 AND i.is_unique=0 AND i.is_primary_key=0 AND i.is_unique_constraint=0 AND i.is_disabled=0 AND i.is_hypothetical=0 AND i.has_filter=0 AND i.filter_definition IS NULL AND CONVERT(varbinary(max),(SELECT c.name name,x.key_ordinal keyOrdinal,x.is_descending_key descending,x.is_included_column included FROM sys.index_columns x JOIN sys.columns c ON c.object_id=x.object_id AND c.column_id=x.column_id WHERE x.object_id=i.object_id AND x.index_id=i.index_id AND(x.key_ordinal>0 OR x.is_included_column=1) ORDER BY x.index_column_id FOR JSON PATH))=CONVERT(varbinary(max),${quote(indexShape(s))})) THROW 51102,'WORK_CATALOG_INDEX_DRIFT',1;`;
export const CATALOG_INDEX_VERIFY_SQL=CATALOG_INDEX_SPECS.map(indexVerify).join('\n');
export const CATALOG_INDEX_INSTALL_SQL=CATALOG_INDEX_SPECS.map(s=>`IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.${s.table}') AND name=N'${s.name}') BEGIN
 CREATE NONCLUSTERED INDEX [${s.name}] ON dbo.[${s.table}](${s.keys.map(k=>`[${k}] ASC`).join(',')})${s.include.length?` INCLUDE(${s.include.map(k=>`[${k}]`).join(',')})`:''};
 SET @index_writes=@index_writes+1;
END;
${indexVerify(s)}`).join('\n');
// Targets are sets; alias records are not. Include both directions so an alias
// on an outside-page/orphan product still counts against a selected source, and
// a NULL/foreign source still counts against a selected native product.
export const CATALOG_ALIAS_TARGET_SQL=`CREATE TABLE #CatalogAliasTargetProducts(product_id bigint NOT NULL PRIMARY KEY);
INSERT #CatalogAliasTargetProducts SELECT h.native_id FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND h.native_id IS NOT NULL
UNION SELECT b.product_id FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id;
CREATE TABLE #CatalogAliasTargetSources(source_product_id int NOT NULL PRIMARY KEY);
INSERT #CatalogAliasTargetSources SELECT TRY_CONVERT(int,h.source_id) FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND TRY_CONVERT(int,h.source_id) IS NOT NULL
UNION SELECT TRY_CONVERT(int,b.source_id) FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id WHERE TRY_CONVERT(int,b.source_id) IS NOT NULL;`;
export const CATALOG_ALIAS_CACHE_SQL=STOCK_PRODUCT_ALIAS_CACHE_SQL.replace('FROM dbo.product_source_aliases GROUP BY product_id,source_product_id;',`FROM dbo.product_source_aliases a WHERE EXISTS(SELECT 1 FROM #CatalogAliasTargetProducts t WHERE t.product_id=a.product_id) OR EXISTS(SELECT 1 FROM #CatalogAliasTargetSources t WHERE t.source_product_id=a.source_product_id) GROUP BY product_id,source_product_id;`);
export const CATALOG_MEDIA_ALIAS_CACHE_SQL=STOCK_PRODUCT_ALIAS_CACHE_SQL.replaceAll('StockAlias','CatalogMediaAlias').replace('FROM dbo.product_source_aliases GROUP BY product_id,source_product_id;',`FROM dbo.product_source_aliases a WHERE EXISTS(SELECT 1 FROM #CatalogMediaBindings m WHERE m.product_id=a.product_id) OR EXISTS(SELECT 1 FROM #CatalogMediaAliasTargetSources t WHERE t.source_product_id=a.source_product_id) GROUP BY product_id,source_product_id;`);
const priceFields=['price_id','product_id','product_source_key','price_source_key','source_unit_id','price_type','price_tier','currency_code','price_exact','is_main_unit','stage_payload_hash','stage_sql_hash','native_row_hash'];
const bindingHash=`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT ${priceFields.map(f=>`v.${f}`).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)`;
// Copy every native price belonging to the returned products, including unbound
// duplicates and non-sale tuples. Do not add columns: n.* remains the exact row
// witness, with the original field order and SQL value representations.
export const CATALOG_NATIVE_PAGE_SQL=`SELECT n.* INTO #CatalogNativePagePrices FROM dbo.product_prices n INNER JOIN #StockPage s ON s.id=n.product_id OPTION(RECOMPILE);
CREATE UNIQUE CLUSTERED INDEX IX_CatalogNativePagePrices ON #CatalogNativePagePrices(id);`;
export const CATALOG_SALE_BINDING_SQL=`IF @sales=1 BEGIN
${CATALOG_NATIVE_PAGE_SQL}
IF EXISTS(SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_values v ON v.product_id=s.id
LEFT JOIN #CatalogNativePagePrices n ON n.id=v.price_id
LEFT JOIN erp_migration.records r ON r.run_id=N'${STOCK_PRODUCT_RUN}' AND r.entity=N'prices' AND r.source_key=v.price_source_key
WHERE ${binary('CONVERT(nvarchar(max),v.price_type)',"N'sale'")} AND (
n.id IS NULL OR r.source_key IS NULL OR n.product_id<>v.product_id
OR NOT(${binary('CONVERT(nvarchar(max),n.price_type)','CONVERT(nvarchar(max),v.price_type)')} AND ${binary('CONVERT(nvarchar(max),n.currency_code)','CONVERT(nvarchar(max),v.currency_code)')})
OR n.price_tier<>v.price_tier OR EXISTS(SELECT n.source_unit_id,n.price EXCEPT SELECT v.source_unit_id,v.price_exact)
OR v.native_row_hash IS NULL OR CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT n.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>v.native_row_hash
OR r.payload_hash IS NULL OR r.payload_json IS NULL OR r.payload_hash<>v.stage_payload_hash OR CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2)<>v.stage_sql_hash
OR v.binding_hash IS NULL OR v.binding_hash<>${bindingHash}
OR(SELECT COUNT(*) FROM #CatalogNativePagePrices z WHERE z.product_id=v.product_id AND ${binary('CONVERT(nvarchar(max),z.price_type)','CONVERT(nvarchar(max),v.price_type)')} AND ${binary('CONVERT(nvarchar(max),z.currency_code)','CONVERT(nvarchar(max),v.currency_code)')} AND z.price_tier=v.price_tier AND NOT EXISTS(SELECT z.source_unit_id EXCEPT SELECT v.source_unit_id))<>1)) ${fail}
END;`;
const saleRows=`JSON_QUERY(COALESCE((SELECT CONVERT(varchar(20),v.price_id) id,v.price_type type,CONVERT(varchar(20),v.source_unit_id) unitSourceId,v.price_tier tier,v.currency_code currency,CONVERT(varchar(100),v.price_exact) priceExact,v.is_main_unit isMainUnit,v.price_source_key sourceKey FROM erp_migration.accepted_price_values v WHERE @sales=1 AND s.kind=N'accepted-opening' AND v.product_id=p.id AND ${binary('CONVERT(nvarchar(max),v.price_type)',"N'sale'")} ORDER BY v.source_unit_id,v.price_tier,v.currency_code,v.price_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) salePrices`;
function replaceOnce(text,oldValue,newValue){
 if(!text.includes(oldValue)||text.indexOf(oldValue)!==text.lastIndexOf(oldValue))throw new Error('CATALOG_SOURCE_TEMPLATE_DRIFT');
 return text.replace(oldValue,newValue);
}
const whitespace=[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279];
const blankToNull=value=>`CASE WHEN DATALENGTH(${whitespace.reduce((v,n)=>`REPLACE(${v},NCHAR(${n}),N'')`,value)})=0 THEN NULL ELSE ${value} END`;
const safePrefixLength=`CASE WHEN DATALENGTH(p.stock_code)>DATALENGTH(c.brand)+2 THEN(DATALENGTH(p.stock_code)-DATALENGTH(c.brand)-2)/2 ELSE 0 END`;
export const CATALOG_CLASSIFICATION_SQL=`
CREATE TABLE #CatalogClassification(id bigint NOT NULL PRIMARY KEY,brand nvarchar(250) NULL,product_type nvarchar(250) NULL,source_name nvarchar(500) NULL,verified bit NOT NULL,display_code nvarchar(250) NOT NULL,numeric_group int NULL,digit_length int NULL,numeric_value nvarchar(250) NULL,digit_suffix nvarchar(250) NULL,photo_available bit NOT NULL DEFAULT(0));
IF EXISTS(SELECT 1 FROM #StockScope s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id
 LEFT JOIN dbo.products p ON p.id=s.id LEFT JOIN erp_migration.records r ON r.run_id=N'${STOCK_PRODUCT_RUN}' AND r.entity=N'products' AND r.source_key=b.product_source_key
 OUTER APPLY OPENJSON(r.payload_json) WITH(brand nvarchar(250) '$.brand',product_type nvarchar(250) '$.category',source_name nvarchar(500) '$.name') c
 WHERE s.kind=N'accepted-opening' AND(p.id IS NULL OR r.source_key IS NULL OR r.payload_hash IS NULL OR r.payload_json IS NULL OR r.payload_hash<>b.stage_payload_hash OR CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2)<>b.stage_sql_hash
 OR EXISTS(SELECT CONVERT(varbinary(max),p.stock_code),CONVERT(varbinary(max),p.name),CONVERT(varbinary(max),p.source_record_key),CONVERT(varbinary(max),p.brand),CONVERT(varbinary(max),p.category) EXCEPT SELECT CONVERT(varbinary(max),b.stock_code),CONVERT(varbinary(max),b.product_name),CONVERT(varbinary(max),b.native_source_key),CONVERT(varbinary(max),c.brand),CONVERT(varbinary(max),c.product_type)))) ${fail}
INSERT #CatalogClassification(id,brand,product_type,source_name,verified,display_code)
 SELECT s.id,CASE WHEN s.kind=N'accepted-opening' THEN ${blankToNull('c.brand')} END,CASE WHEN s.kind=N'accepted-opening' THEN ${blankToNull('c.product_type')} END,CASE WHEN s.kind=N'accepted-opening' THEN ${blankToNull('c.source_name')} END,CONVERT(bit,CASE WHEN s.kind=N'accepted-opening' THEN 1 ELSE 0 END),p.stock_code
 FROM #StockScope s JOIN dbo.products p ON p.id=s.id LEFT JOIN erp_migration.accepted_price_products b ON b.product_id=s.id LEFT JOIN erp_migration.records r ON r.run_id=N'${STOCK_PRODUCT_RUN}' AND r.entity=N'products' AND r.source_key=b.product_source_key
 OUTER APPLY OPENJSON(r.payload_json) WITH(brand nvarchar(250) '$.brand',product_type nvarchar(250) '$.category',source_name nvarchar(500) '$.name') c;
UPDATE c SET display_code=LEFT(p.stock_code,${safePrefixLength})
 FROM #CatalogClassification c JOIN dbo.products p ON p.id=c.id
 WHERE c.verified=1 AND c.brand IS NOT NULL AND DATALENGTH(p.stock_code)>DATALENGTH(c.brand)+2
 AND CONVERT(varbinary(max),RIGHT(p.stock_code,DATALENGTH(c.brand)/2+1))=CONVERT(varbinary(max),N' '+c.brand)
 AND UNICODE(RIGHT(LEFT(p.stock_code,${safePrefixLength}),1)) NOT IN(${whitespace.join(',')});
UPDATE c SET numeric_group=CASE WHEN d.digit_count>0 THEN 0 ELSE 1 END,digit_length=DATALENGTH(n.numeric_value)/2,numeric_value=n.numeric_value,digit_suffix=SUBSTRING(c.display_code,d.digit_count+1,250)
 FROM #CatalogClassification c CROSS APPLY(SELECT PATINDEX(N'%[^0-9]%',c.display_code COLLATE Latin1_General_100_BIN2+N'X')-1 digit_count)d
 CROSS APPLY(SELECT LEFT(c.display_code,d.digit_count) raw_digits)z
 CROSS APPLY(SELECT CASE WHEN d.digit_count=0 THEN N'' WHEN PATINDEX(N'%[^0]%',z.raw_digits COLLATE Latin1_General_100_BIN2)=0 THEN N'0' ELSE SUBSTRING(z.raw_digits,PATINDEX(N'%[^0]%',z.raw_digits COLLATE Latin1_General_100_BIN2),250) END numeric_value)n;
CREATE TABLE #CatalogMediaBindings(product_id bigint NOT NULL PRIMARY KEY,stock_code nvarchar(250) NOT NULL,source_key nvarchar(400) NOT NULL,run_id nvarchar(80) NOT NULL);
IF @image<>N'all' BEGIN
 IF ISJSON(@media_bindings)<>1 OR LEFT(@media_bindings,1)<>N'[' OR(SELECT COUNT(*) FROM OPENJSON(@media_bindings))>3830 THROW 51102,'WORK_CATALOG_MEDIA_BINDING_INVALID',1;
 INSERT #CatalogMediaBindings SELECT product_id,stock_code,source_key,run_id FROM OPENJSON(@media_bindings) WITH(product_id bigint '$.productId',stock_code nvarchar(250) '$.stockCode',source_key nvarchar(400) '$.sourceKey',run_id nvarchar(80) '$.runId');
 CREATE TABLE #CatalogMediaAliasTargetSources(source_product_id int NOT NULL PRIMARY KEY);
 INSERT #CatalogMediaAliasTargetSources SELECT DISTINCT TRY_CONVERT(int,b.source_id) FROM #CatalogMediaBindings m JOIN erp_migration.accepted_price_products b ON b.product_id=m.product_id WHERE TRY_CONVERT(int,b.source_id) IS NOT NULL;
 ${CATALOG_MEDIA_ALIAS_CACHE_SQL}
 UPDATE c SET photo_available=1 FROM #CatalogClassification c JOIN #CatalogMediaBindings m ON m.product_id=c.id JOIN erp_migration.accepted_price_products b ON b.product_id=c.id JOIN dbo.products p ON p.id=c.id
 JOIN #CatalogMediaAliasProductCounts pc ON pc.product_id=c.id JOIN #CatalogMediaAliasSourceCounts sc ON sc.source_product_id=TRY_CONVERT(int,b.source_id) JOIN #CatalogMediaAliasPairs ap ON ap.product_id=c.id AND ap.source_product_id=TRY_CONVERT(int,b.source_id)
 WHERE c.verified=1 AND ${binary('m.stock_code','p.stock_code')} AND ${binary('m.stock_code','b.stock_code')} AND ${binary('m.source_key','b.product_source_key')} AND ${binary('m.run_id',`N'${STOCK_PRODUCT_RUN}'`)}
 AND NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND(h.native_id=c.id OR h.source_id=b.source_id))
 AND pc.alias_count=1 AND sc.alias_count=1 AND ap.pair_count=1;
END;
`;
export const CATALOG_ORDER_SQL=`CASE WHEN @sort=N'stock-desc' AND p.current_stock_qty IS NULL THEN 1 ELSE 0 END ASC,CASE WHEN @sort=N'stock-desc' THEN p.current_stock_qty END DESC,
 CASE WHEN @sort<>N'code-desc' THEN c.numeric_group END ASC,CASE WHEN @sort=N'code-desc' THEN c.numeric_group END DESC,
 CASE WHEN @sort<>N'code-desc' THEN c.digit_length END ASC,CASE WHEN @sort=N'code-desc' THEN c.digit_length END DESC,
 CASE WHEN @sort<>N'code-desc' THEN CONVERT(varbinary(500),c.numeric_value) END ASC,CASE WHEN @sort=N'code-desc' THEN CONVERT(varbinary(500),c.numeric_value) END DESC,
 CASE WHEN @sort<>N'code-desc' THEN CONVERT(varbinary(500),c.digit_suffix) END ASC,CASE WHEN @sort=N'code-desc' THEN CONVERT(varbinary(500),c.digit_suffix) END DESC,
 CASE WHEN @sort<>N'code-desc' THEN CONVERT(varbinary(500),c.display_code) END ASC,CASE WHEN @sort=N'code-desc' THEN CONVERT(varbinary(500),c.display_code) END DESC,
 CASE WHEN @sort<>N'code-desc' THEN CONVERT(varbinary(500),p.stock_code) END ASC,CASE WHEN @sort=N'code-desc' THEN CONVERT(varbinary(500),p.stock_code) END DESC,
 CASE WHEN @sort<>N'code-desc' THEN p.id END ASC,CASE WHEN @sort=N'code-desc' THEN p.id END DESC`;
const classificationRows=`c.display_code displayCode,JSON_QUERY((SELECT c.brand brand,c.product_type productType,c.source_name sourceName,c.verified verified FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)) classification,`;
const facets=`N'{"brands":[],"productTypes":[]}' filtersJson,`;
const startupClass=CATALOG_CLASSIFICATION_SQL.slice(CATALOG_CLASSIFICATION_SQL.indexOf('IF EXISTS'),CATALOG_CLASSIFICATION_SQL.indexOf('UPDATE c SET display_code'));
const mediaSql=CATALOG_CLASSIFICATION_SQL.slice(CATALOG_CLASSIFICATION_SQL.indexOf('CREATE TABLE #CatalogMediaBindings'));
export const CATALOG_FAST_CLASSIFICATION_SQL=`
CREATE TABLE #CatalogClassification(id bigint NOT NULL PRIMARY KEY,brand nvarchar(250) NULL,product_type nvarchar(250) NULL,source_name nvarchar(500) NULL,verified bit NOT NULL,display_code nvarchar(250) NOT NULL,numeric_group int NULL,digit_length int NULL,numeric_value nvarchar(250) NULL,digit_suffix nvarchar(250) NULL,photo_available bit NOT NULL DEFAULT(0),rank bigint NULL);
IF @classification_validation=1 BEGIN
${startupClass}
END ELSE BEGIN
 IF ISJSON(@candidate_bindings)<>1 OR LEFT(@candidate_bindings,1)<>N'[' OR(SELECT COUNT(*) FROM OPENJSON(@candidate_bindings))>16676 THROW 51102,'WORK_CATALOG_CANDIDATES_INVALID',1;
 CREATE TABLE #CatalogCandidates(id bigint NOT NULL,rank bigint NOT NULL CHECK(rank BETWEEN 1 AND 16676));
 INSERT #CatalogCandidates SELECT id,rank FROM OPENJSON(@candidate_bindings) WITH(id bigint '$[0]',rank bigint '$[1]');
 CREATE UNIQUE CLUSTERED INDEX IX_CatalogCandidates_Id ON #CatalogCandidates(id);
 CREATE UNIQUE NONCLUSTERED INDEX IX_CatalogCandidates_Rank ON #CatalogCandidates(rank);
 IF EXISTS(SELECT id FROM #CatalogCandidates EXCEPT SELECT id FROM #StockScope) ${fail}
 INSERT #CatalogClassification(id,verified,display_code,rank) SELECT s.id,CONVERT(bit,CASE WHEN s.kind=N'accepted-opening' THEN 1 ELSE 0 END),p.stock_code,x.rank FROM #CatalogCandidates x JOIN #StockScope s ON s.id=x.id JOIN dbo.products p ON p.id=s.id;
END;
${mediaSql}`;
export const CATALOG_FAST_ORDER_SQL=`CASE WHEN @sort=N'stock-desc' AND p.current_stock_qty IS NULL THEN 1 ELSE 0 END ASC,CASE WHEN @sort=N'stock-desc' THEN p.current_stock_qty END DESC,CASE WHEN @sort<>N'code-desc' THEN c.rank END ASC,CASE WHEN @sort=N'code-desc' THEN c.rank END DESC,p.id ASC`;
const selectedClassSql=`UPDATE c SET brand=${blankToNull('v.brand')},product_type=${blankToNull('v.product_type')},source_name=${blankToNull('v.source_name')}
 FROM #CatalogClassification c JOIN #StockPage s ON s.id=c.id JOIN erp_migration.accepted_price_products b ON b.product_id=s.id JOIN erp_migration.records r ON r.run_id=N'${STOCK_PRODUCT_RUN}' AND r.entity=N'products' AND r.source_key=b.product_source_key
 CROSS APPLY OPENJSON(r.payload_json) WITH(brand nvarchar(250) '$.brand',product_type nvarchar(250) '$.category',source_name nvarchar(500) '$.name') v;
IF EXISTS(SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id JOIN dbo.products p ON p.id=s.id JOIN erp_migration.records r ON r.run_id=N'${STOCK_PRODUCT_RUN}' AND r.entity=N'products' AND r.source_key=b.product_source_key CROSS APPLY OPENJSON(r.payload_json) WITH(brand nvarchar(250) '$.brand',product_type nvarchar(250) '$.category') v WHERE EXISTS(SELECT CONVERT(varbinary(max),p.brand),CONVERT(varbinary(max),p.category) EXCEPT SELECT CONVERT(varbinary(max),v.brand),CONVERT(varbinary(max),v.product_type))) ${fail}
UPDATE c SET display_code=LEFT(p.stock_code,${safePrefixLength}) FROM #CatalogClassification c JOIN #StockPage s ON s.id=c.id JOIN dbo.products p ON p.id=c.id WHERE c.verified=1 AND c.brand IS NOT NULL AND DATALENGTH(p.stock_code)>DATALENGTH(c.brand)+2 AND ${binary('RIGHT(p.stock_code,DATALENGTH(c.brand)/2+1)',"N' '+c.brand")} AND UNICODE(RIGHT(LEFT(p.stock_code,${safePrefixLength}),1)) NOT IN(${whitespace.join(',')});`;
const proofStart=STOCK_PRODUCT_PROC_SQL.indexOf("CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID))");
const proofEnd=STOCK_PRODUCT_PROC_SQL.indexOf(",\n COALESCE(N'['",proofStart);
if(proofStart<0||proofEnd<0)throw Error('CATALOG_PROOF_TEMPLATE_DRIFT');
const metadataProof=STOCK_PRODUCT_PROC_SQL.slice(proofStart,proofEnd)+`,CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_stock_products'))),2) stockReaderDefinitionHash`;
// Materialize only the selected immutable binding rows before their full JSON
// hash. Startup selects all rows; ordinary page/detail requests select 50/1.
// This prevents a startup-sized cached plan from hashing the entire catalog
// before applying the page join, without changing any binding predicate.
const pageBindingStart=STOCK_PRODUCT_BINDING_SQL.indexOf('IF EXISTS(SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id WHERE b.binding_hash<>');
if(pageBindingStart<0)throw Error('CATALOG_BINDING_TEMPLATE_DRIFT');
export const CATALOG_PRODUCT_BINDING_SQL=STOCK_PRODUCT_BINDING_SQL.slice(0,pageBindingStart)+
 'SELECT b.* INTO #CatalogPageAcceptedBindings FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id;\n'+
 STOCK_PRODUCT_BINDING_SQL.slice(pageBindingStart).replace('SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id WHERE b.binding_hash<>','SELECT 1 FROM #CatalogPageAcceptedBindings b WHERE b.binding_hash<>');
export const CATALOG_CLASSIFICATION_VALIDATE_SQL=`
 IF ISJSON(@classification_bindings)<>1 OR LEFT(@classification_bindings,1)<>N'[' THROW 51102,'WORK_CATALOG_CLASSIFICATION_INDEX_INVALID',1;
 CREATE TABLE #CatalogIndex(id bigint NOT NULL PRIMARY KEY,stock_code nvarchar(250) NOT NULL,source_key nvarchar(400) NOT NULL,kind nvarchar(30) NOT NULL,brand nvarchar(250) NULL,product_type nvarchar(250) NULL,source_name nvarchar(500) NULL,stage_payload_hash char(64) NULL,stage_sql_hash char(64) NULL);
 INSERT #CatalogIndex SELECT id,stock_code,source_key,kind,brand,product_type,source_name,stage_payload_hash,stage_sql_hash FROM OPENJSON(@classification_bindings) WITH(id bigint '$.productId',stock_code nvarchar(250) '$.stockCode',source_key nvarchar(400) '$.sourceKey',kind nvarchar(30) '$.kind',brand nvarchar(250) '$.brand',product_type nvarchar(250) '$.productType',source_name nvarchar(500) '$.sourceName',stage_payload_hash char(64) '$.stagePayloadHash',stage_sql_hash char(64) '$.stageSqlHash');
 IF(SELECT COUNT(*) FROM #CatalogIndex)<>16676 OR(SELECT COUNT(*) FROM #CatalogClassification)<>16676 ${fail}
 IF EXISTS(SELECT 1 FROM #CatalogIndex i LEFT JOIN #CatalogClassification c ON c.id=i.id LEFT JOIN #StockScope s ON s.id=i.id LEFT JOIN erp_migration.accepted_price_products b ON b.product_id=i.id LEFT JOIN erp_migration.operation_quarantine_holds h ON h.entity=N'product' AND h.native_id=i.id WHERE c.id IS NULL OR NOT(${binary('i.stock_code','(SELECT p.stock_code FROM dbo.products p WHERE p.id=i.id)')}) OR NOT(${binary('i.kind','s.kind')}) OR EXISTS(SELECT CONVERT(varbinary(max),i.brand),CONVERT(varbinary(max),i.product_type),CONVERT(varbinary(max),i.source_name) EXCEPT SELECT CONVERT(varbinary(max),c.brand),CONVERT(varbinary(max),c.product_type),CONVERT(varbinary(max),c.source_name))
 OR(s.kind=N'accepted-opening' AND(NOT(${binary('i.source_key','b.product_source_key')}) OR i.stage_payload_hash IS NULL OR i.stage_sql_hash IS NULL OR UPPER(i.stage_payload_hash)<>UPPER(b.stage_payload_hash) OR UPPER(i.stage_sql_hash)<>UPPER(b.stage_sql_hash)))
 OR(s.kind=N'quarantined-source' AND(i.stage_payload_hash IS NOT NULL OR i.stage_sql_hash IS NOT NULL OR NOT(${binary('i.source_key',"N'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/'+h.source_id")})))) ${fail}
 IF EXISTS(SELECT 1 FROM erp_migration.accepted_price_products b JOIN #CatalogIndex i ON i.id=b.product_id WHERE COALESCE((SELECT a.alias_count FROM #StockAliasProductCounts a WHERE a.product_id=b.product_id),0)<>1 OR COALESCE((SELECT a.alias_count FROM #StockAliasSourceCounts a WHERE a.source_product_id=TRY_CONVERT(int,b.source_id)),0)<>1 OR COALESCE((SELECT a.pair_count FROM #StockAliasPairs a WHERE a.product_id=b.product_id AND a.source_product_id=TRY_CONVERT(int,b.source_id)),0)<>1) ${fail}
 SELECT CONVERT(varchar(20),@actor_id) actorId,CONVERT(bit,1) canView,CONVERT(bit,1) classificationValidated,${metadataProof};RETURN;
`;
function catalogBody(){
 let sql=replaceOnce(STOCK_PRODUCT_PROC_SQL,'CREATE OR ALTER PROCEDURE dbo.usp_read_stock_products',`CREATE OR ALTER PROCEDURE ${CATALOG_PROC}`);
 sql=replaceOnce(sql,'@page_size int=25','@page_size int=50');
 sql=replaceOnce(sql,'@page_size int=50\n',"@page_size int=50,@brand nvarchar(250)=N'',@product_type nvarchar(250)=N'',@image nvarchar(12)=N'all',@sort nvarchar(12)=N'code-asc',@media_bindings nvarchar(max)=N'[]',@candidate_bindings nvarchar(max)=N'[]',@classification_validation bit=0,@classification_bindings nvarchar(max)=N'[]'\n");
 // PRICE_OPERATIONAL expands CONTACT_READY, which repeats this exact supplier
 // block. The first renamed stock-ready copy retains every check in this same
 // SERIALIZABLE read; remove only the second byte-for-byte source expansion.
 sql=replaceOnce(sql,SUPPLIER_CARD_READY_SQL,'');
 const readyOnce=STOCK_PRODUCT_RUNTIME_READY_SQL.replace(SUPPLIER_CARD_READY_SQL,'');
 sql=replaceOnce(sql,STOCK_PRODUCT_ALIAS_CACHE_SQL,'');
 sql=replaceOnce(sql,readyOnce,'');
 sql=replaceOnce(sql,STOCK_PRODUCT_BINDING_SQL,`${CATALOG_ALIAS_TARGET_SQL}\n${CATALOG_ALIAS_CACHE_SQL}\n${readyOnce}\n${CATALOG_PRODUCT_BINDING_SQL}\nIF @classification_validation=1 BEGIN\n${CATALOG_CLASSIFICATION_VALIDATE_SQL}\nEND;\n${selectedClassSql}`);
 sql=replaceOnce(sql," INSERT #StockScope SELECT p.id,N'synthetic-test' FROM dbo.products p WHERE p.id IN(301984,301985,301986);",'');
 sql=replaceOnce(sql,' CREATE TABLE #StockMatches',` IF @brand IS NULL OR @product_type IS NULL OR @image IS NULL OR @image NOT IN(N'all',N'available',N'missing') OR @sort IS NULL OR @sort NOT IN(N'code-asc',N'code-desc',N'stock-desc') OR @media_bindings IS NULL OR @candidate_bindings IS NULL OR @classification_validation IS NULL THROW 51102,'WORK_CATALOG_QUERY_INVALID',1;\n${CATALOG_FAST_CLASSIFICATION_SQL}\n CREATE TABLE #StockMatches`);
 sql=replaceOnce(sql,'FROM #StockScope s JOIN dbo.products p ON p.id=s.id WHERE','FROM #StockScope s JOIN dbo.products p ON p.id=s.id JOIN #CatalogClassification c ON c.id=s.id WHERE'+"(@image=N'all' OR(@image=N'available' AND c.photo_available=1) OR(@image=N'missing' AND c.photo_available=0)) AND");
 sql=replaceOnce(sql,' CREATE TABLE #StockPage',` SELECT m.id,ROW_NUMBER() OVER(ORDER BY ${CATALOG_FAST_ORDER_SQL}) position INTO #CatalogOrder FROM #StockMatches m JOIN #CatalogClassification c ON c.id=m.id JOIN dbo.products p ON p.id=m.id;\n CREATE UNIQUE CLUSTERED INDEX IX_CatalogOrder ON #CatalogOrder(id);\n CREATE TABLE #StockPage`);
 sql=replaceOnce(sql,'FROM #StockMatches m JOIN dbo.products p ON p.id=m.id ORDER BY p.stock_code,p.id','FROM #StockMatches m JOIN dbo.products p ON p.id=m.id JOIN #CatalogOrder o ON o.id=m.id ORDER BY o.position');
 sql=replaceOnce(sql,' INSERT #StockPage SELECT',` IF @classification_validation=1 INSERT #StockPage SELECT id,kind FROM #StockScope;\n ELSE INSERT #StockPage SELECT`);
 sql=replaceOnce(sql,'WITHIN GROUP(ORDER BY p.stock_code,p.id) FROM #StockPage s JOIN dbo.products p ON p.id=s.id','WITHIN GROUP(ORDER BY o.position) FROM #StockPage s JOIN dbo.products p ON p.id=s.id JOIN #CatalogOrder o ON o.id=s.id JOIN #CatalogClassification c ON c.id=s.id');
 sql=replaceOnce(sql,'p.stock_code stockCode,p.name productName,',`p.stock_code stockCode,p.name productName,${classificationRows}`);
 // SQL equality pads NVARCHAR operands. Only zero bytes means no barcode filter;
 // spaces are literal barcode characters and must never broaden to all products.
 sql=replaceOnce(sql,"(@barcode=N'' OR EXISTS","(DATALENGTH(@barcode)=0 OR EXISTS");
 // The indexed collation comparison is only a prefilter. The binary predicate
 // remains mandatory and rejects folded case, accents, padding and partial IDs.
 sql=replaceOnce(sql,"bc.is_active=1 AND CONVERT(varbinary(max),bc.barcode)=CONVERT(varbinary(max),@barcode)","bc.is_active=1 AND bc.barcode=@barcode AND CONVERT(varbinary(max),bc.barcode)=CONVERT(varbinary(max),@barcode)");
 sql=replaceOnce(sql,"OR(@status=N'passive' AND(p.is_active=0 OR p.is_deleted=1)));","OR(@status=N'passive' AND(p.is_active=0 OR p.is_deleted=1))) OPTION(RECOMPILE);");
 sql=replaceOnce(sql,'ROWS FETCH NEXT @page_size ROWS ONLY;','ROWS FETCH NEXT @page_size ROWS ONLY OPTION(RECOMPILE);');
 const financeStart=sql.indexOf(' DECLARE @financial bit=CASE'),readAtStart=sql.indexOf(',@read_at varchar(24)=',financeStart);
 if(financeStart<0||readAtStart<0)throw new Error('CATALOG_SOURCE_TEMPLATE_DRIFT');
 sql=sql.slice(0,financeStart)+" DECLARE @financial bit=0,@sales bit=CASE WHEN EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.permissions p ON p.role_id=u.role_id WHERE u.id=@actor_id AND u.is_active=1 AND p.permission_key=N'sales.view' AND p.can_view=1) THEN 1 ELSE 0 END"+sql.slice(readAtStart);
 sql=replaceOnce(sql,'@financial canViewFinance','@sales canViewSalesPrices');
 sql=replaceOnce(sql,',\n COALESCE(N\'[\'+(SELECT STRING_AGG',`,CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_stock_products'))),2) stockReaderDefinitionHash,\n COALESCE(N'['+(SELECT STRING_AGG`);
 sql=replaceOnce(sql,"CASE WHEN @product_id IS NOT NULL AND @financial=1 THEN j.row_json ELSE JSON_MODIFY(j.row_json,'$.financial',NULL) END",'j.row_json');
 const image="(SELECT TOP(1) COALESCE(im.file_path,im.storage_key) FROM dbo.product_images im WHERE im.product_id=p.id AND im.is_active=1 ORDER BY im.is_primary DESC,im.sort_order,im.id) imageUrl,";
 sql=replaceOnce(sql,image,`CAST(NULL AS nvarchar(max)) imageUrl,\n JSON_QUERY(N'{"status":"missing","url":null,"sourceKey":null,"verified":false}') photo,\n ${saleRows},`);
 const financialStart=sql.indexOf(' JSON_QUERY(CASE WHEN @product_id IS NOT NULL AND @financial=1 THEN'),financialEnd=sql.indexOf(' financial\n',financialStart);
 if(financialStart<0||financialEnd<0)throw new Error('CATALOG_SOURCE_TEMPLATE_DRIFT');
 sql=sql.slice(0,financialStart)+sql.slice(financialEnd+' financial\n'.length);
 // The preceding hold projection was followed by financial, so remove its comma.
 sql=replaceOnce(sql,'WITHOUT_ARRAY_WRAPPER)) hold,\n FOR JSON','WITHOUT_ARRAY_WRAPPER)) hold\n FOR JSON');
 const publicHeader=' SELECT CONVERT(varchar(20),@actor_id) actorId,CONVERT(bit,1) canView,@sales canViewSalesPrices';
 sql=replaceOnce(sql,publicHeader,` ${CATALOG_SALE_BINDING_SQL}\n${publicHeader}`);
 sql=replaceOnce(sql,publicHeader,` SELECT ${facets}CONVERT(varchar(20),@actor_id) actorId,CONVERT(bit,1) canView,@sales canViewSalesPrices`);
 // Independently pin the unchanged prerequisite reader before serving this companion.
 sql=replaceOnce(sql,' WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;',` WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;\n ${CATALOG_STOCK_PIN_SQL}\n ${CATALOG_INDEX_VERIFY_SQL}`);
 return sql.replace(/^[\t ]+$/gm,'');
}
export const CATALOG_STOCK_PIN_SQL=`IF COALESCE(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_stock_products'))),2),'')<>'${STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash}' ${fail}`;
export const CATALOG_PROC_SQL=catalogBody();
export const CATALOG_STORED_DEFINITION=CATALOG_PROC_SQL.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE   PROCEDURE ');
export const CATALOG_SQL_PROOF=Object.freeze({...STOCK_PRODUCT_SQL_PROOF,readerDefinitionHash:digest(CATALOG_STORED_DEFINITION),stockReaderDefinitionHash:STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash});
export const buildCatalogSqlProofModule=()=>`// Generated offline; expected proofs are independent of returned data.\nexport const CATALOG_PROC=${JSON.stringify(CATALOG_PROC)};\nexport const CATALOG_SQL_PROOF=Object.freeze(${JSON.stringify(CATALOG_SQL_PROOF,null,2)});\n`;
const principals=['melisa_sirket_test_20260929_01','melisa_sirket_sales_test_20260929_01'];
export const CATALOG_ACCESS_SQL=principals.map(p=>`IF DATABASE_PRINCIPAL_ID(N'${p}') IS NULL OR NOT EXISTS(SELECT 1 FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'${CATALOG_PROC}') AND minor_id=0 AND grantee_principal_id=DATABASE_PRINCIPAL_ID(N'${p}') AND permission_name=N'EXECUTE' AND state=N'G') THROW 51102,'WORK_CATALOG_EXECUTE_DRIFT',1;`).join('\n')+`\nIF(SELECT COUNT(*) FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'${CATALOG_PROC}'))<>2 THROW 51102,'WORK_CATALOG_EXECUTE_DRIFT',1;`;
export function buildWorkCatalogSql(){return `-- ERP-D02: read-only real catalogue; no business rows or prior definitions change.
SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON; SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF; SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\\MELISADEV' OR COALESCE(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 THROW 51102,'WORK_CATALOG_INSTALL_TARGET_REQUIRED',1;
BEGIN TRY BEGIN TRANSACTION; DECLARE @lock int,@index_writes int=0; EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @lock<0 THROW 51102,'WORK_CATALOG_INSTALL_LOCK_REQUIRED',1;
${STOCK_PRODUCT_READY_SQL}
${CATALOG_STOCK_PIN_SQL}
${principals.map(p=>`IF DATABASE_PRINCIPAL_ID(N'${p}') IS NULL THROW 51102,'WORK_CATALOG_EXISTING_PRINCIPAL_REQUIRED',1;`).join('\n')}
IF OBJECT_ID(N'${CATALOG_PROC}') IS NOT NULL BEGIN
 IF OBJECT_ID(N'${CATALOG_PROC}',N'P') IS NULL THROW 51102,'WORK_CATALOG_DEFINITION_DRIFT',1;
 DECLARE @prior_definition_hash char(64)=CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CATALOG_PROC}'))),2);
 ${CATALOG_ACCESS_SQL}
 IF @prior_definition_hash='${CATALOG_SQL_PROOF.readerDefinitionHash}' BEGIN
 ${CATALOG_INDEX_VERIFY_SQL}
 COMMIT; SELECT N'NOOP' result,0 writes,0 indexWrites,0 readerWrites; RETURN; END;
 IF @prior_definition_hash IS NULL OR @prior_definition_hash<>'${CATALOG_PREVIOUS_HASH}' THROW 51102,'WORK_CATALOG_DEFINITION_DRIFT',1;
 ${CATALOG_INDEX_INSTALL_SQL}
 EXEC sys.sp_executesql ${quote(CATALOG_PROC_SQL)};
 IF COALESCE(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CATALOG_PROC}'))),2),'')<>'${CATALOG_SQL_PROOF.readerDefinitionHash}' THROW 51102,'WORK_CATALOG_DEFINITION_DRIFT',1;
 ${CATALOG_ACCESS_SQL}
 ${STOCK_PRODUCT_READY_SQL}
 COMMIT; SELECT N'UPGRADED' result,1+@index_writes writes,@index_writes indexWrites,1 readerWrites; RETURN;
END;
${CATALOG_INDEX_INSTALL_SQL}
EXEC sys.sp_executesql ${quote(CATALOG_PROC_SQL)};
${principals.map(p=>`GRANT EXECUTE ON OBJECT::${CATALOG_PROC} TO [${p}];`).join('\n')}
IF COALESCE(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CATALOG_PROC}'))),2),'')<>'${CATALOG_SQL_PROOF.readerDefinitionHash}' THROW 51102,'WORK_CATALOG_DEFINITION_DRIFT',1;
${CATALOG_ACCESS_SQL}
${STOCK_PRODUCT_READY_SQL}
COMMIT; SELECT N'INSTALLED' result,1+@index_writes writes,@index_writes indexWrites,1 readerWrites;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
`;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--write')throw new Error('OFFLINE_WRITE_MODE_REQUIRED');
 fs.writeFileSync(new URL('./enable-test-work-catalog.sql',import.meta.url),buildWorkCatalogSql());
 fs.writeFileSync(new URL('../../apps/api/src/services/catalogSqlProof.mjs',import.meta.url),buildCatalogSqlProofModule());
}
