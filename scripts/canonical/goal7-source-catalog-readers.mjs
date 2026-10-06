// Offline additive reader builder; historical RUN06 procedures stay byte exact.
import {CATALOG_PROC_SQL,CATALOG_SQL_PROOF} from './enable-test-work-catalog.mjs';
import {STOCK_PRODUCT_RUNTIME_READY_SQL,STOCK_PRODUCT_PROC_SQL,STOCK_PRODUCT_SQL_PROOF} from './enable-test-stock-products.mjs';
// Pure copy of the historical read template; avoids importing its SQL driver.
const readerSql=(()=>{
const RUN='VEGA-OPENING-TEST-20261004-06';
const EXPECTED={sourceHash:'36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',planHash:'18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a',products:16622,prices:63774};
const fail="THROW 51075,'OPENING_PRICE_BINDING_DRIFT',1;";
const productFields=['product_id','product_source_key','source_id','native_source_key','stock_code','product_name','currency_code','unit','main_unit_source_id','stage_payload_hash','stage_sql_hash'];
const priceFields=['price_id','product_id','product_source_key','price_source_key','source_unit_id','price_type','price_tier','currency_code','price_exact','is_main_unit','stage_payload_hash','stage_sql_hash','native_row_hash'];
const rowHash=(alias,fields)=>`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT ${fields.map(f=>`${alias}.${f}`).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)`;
const targetGuard="IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' THROW 51075,'WRONG_TEST_TARGET',1;";
const readiness=`${targetGuard} IF NOT EXISTS(SELECT 1 FROM erp_migration.accepted_price_manifest WHERE run_id=N'${RUN}' AND source_hash='${EXPECTED.sourceHash}' AND plan_hash='${EXPECTED.planHash}' AND source_as_of=N'2026-09-30' AND sealed=1 AND product_count=${EXPECTED.products} AND price_count=${EXPECTED.prices}) THROW 51075,'OPENING_PRICES_NOT_READY',1;
IF EXISTS(SELECT 1 FROM erp_migration.accepted_price_products b LEFT JOIN dbo.products p ON p.id=b.product_id WHERE p.id IS NULL) ${fail}
IF (SELECT COUNT(*) FROM erp_migration.accepted_price_products)<>${EXPECTED.products} OR (SELECT COUNT(*) FROM erp_migration.accepted_price_values)<>${EXPECTED.prices} ${fail}
IF NOT EXISTS(SELECT 1 FROM erp_migration.runs WHERE run_id=N'${RUN}' AND status COLLATE Latin1_General_100_BIN2=N'COMMITTED' AND source_hash='${EXPECTED.sourceHash}' AND plan_hash='${EXPECTED.planHash}' AND CONVERT(varbinary(max),source_as_of)=CONVERT(varbinary(max),CONVERT(nvarchar(40),N'2026-09-30'))) ${fail}`;
const legacyBindingValidation=`IF EXISTS(SELECT 1 FROM #selected s JOIN erp_migration.accepted_price_products b ON b.product_id=s.product_id LEFT JOIN dbo.products p ON p.id=b.product_id LEFT JOIN (SELECT source_product_id,COUNT_BIG(*) alias_count,MIN(product_id) product_id FROM dbo.product_source_aliases GROUP BY source_product_id) sa ON sa.source_product_id=CONVERT(int,b.source_id) LEFT JOIN (SELECT product_id,COUNT_BIG(*) alias_count,MIN(source_product_id) source_product_id FROM dbo.product_source_aliases GROUP BY product_id) pa ON pa.product_id=b.product_id LEFT JOIN erp_migration.records r ON r.run_id=N'${RUN}' AND r.entity=N'products' AND r.source_key=b.product_source_key
WHERE p.id IS NULL OR p.stock_code IS NULL OR p.name IS NULL OR p.currency_code IS NULL OR p.unit IS NULL OR CONVERT(varbinary(max),p.stock_code)<>CONVERT(varbinary(max),b.stock_code) OR CONVERT(varbinary(max),p.name)<>CONVERT(varbinary(max),b.product_name) OR CONVERT(varbinary(max),p.currency_code)<>CONVERT(varbinary(max),b.currency_code) OR CONVERT(varbinary(max),p.unit)<>CONVERT(varbinary(max),b.unit) OR p.source_record_key IS NULL OR CONVERT(varbinary(max),p.source_record_key)<>CONVERT(varbinary(max),b.native_source_key) OR r.source_key IS NULL OR r.payload_hash<>b.stage_payload_hash OR CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2)<>b.stage_sql_hash OR ${rowHash('b',productFields)}<>b.binding_hash OR ISNULL(sa.alias_count,0)<>1 OR sa.product_id<>b.product_id OR ISNULL(pa.alias_count,0)<>1 OR pa.source_product_id<>CONVERT(int,b.source_id)) ${fail}
IF EXISTS(SELECT 1 FROM #selected s JOIN erp_migration.accepted_price_values v ON v.product_id=s.product_id LEFT JOIN dbo.product_prices n ON n.id=v.price_id LEFT JOIN (SELECT z.product_id,z.price_type,z.price_tier,z.currency_code,z.source_unit_id,COUNT_BIG(*) key_count FROM dbo.product_prices z JOIN #selected selected ON selected.product_id=z.product_id GROUP BY z.product_id,z.price_type,z.price_tier,z.currency_code,z.source_unit_id) keys_scope ON keys_scope.product_id=v.product_id AND keys_scope.price_type=v.price_type AND keys_scope.price_tier=v.price_tier AND keys_scope.currency_code=v.currency_code AND ISNULL(keys_scope.source_unit_id,-1)=ISNULL(v.source_unit_id,-1) LEFT JOIN erp_migration.records r ON r.run_id=N'${RUN}' AND r.entity=N'prices' AND r.source_key=v.price_source_key WHERE ISNULL(keys_scope.key_count,0)<>1 OR n.id IS NULL OR n.product_id<>v.product_id OR n.price_type COLLATE Latin1_General_100_BIN2<>v.price_type COLLATE Latin1_General_100_BIN2 OR n.price_tier<>v.price_tier OR n.currency_code COLLATE Latin1_General_100_BIN2<>v.currency_code COLLATE Latin1_General_100_BIN2 OR n.price<>v.price_exact OR ISNULL(n.source_unit_id,-1)<>ISNULL(v.source_unit_id,-1) OR CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT n.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>v.native_row_hash OR r.source_key IS NULL OR r.payload_hash<>v.stage_payload_hash OR CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2)<>v.stage_sql_hash OR ${rowHash('v',priceFields)}<>v.binding_hash) ${fail}
IF EXISTS(SELECT 1 FROM #selected s JOIN erp_migration.accepted_price_products b ON b.product_id=s.product_id WHERE b.price_count<>(SELECT COUNT(*) FROM erp_migration.accepted_price_values v WHERE v.product_id=b.product_id)) ${fail}`;
const validationCaches=`CREATE TABLE #validation_source_aliases(source_product_id int PRIMARY KEY,alias_count bigint,product_id bigint);INSERT #validation_source_aliases SELECT source_product_id,COUNT_BIG(*),MIN(product_id) FROM dbo.product_source_aliases GROUP BY source_product_id;
CREATE TABLE #validation_product_aliases(product_id bigint PRIMARY KEY,alias_count bigint,source_product_id int);INSERT #validation_product_aliases SELECT product_id,COUNT_BIG(*),MIN(source_product_id) FROM dbo.product_source_aliases GROUP BY product_id;
CREATE TABLE #validation_price_keys(product_id bigint NOT NULL,type_key varbinary(80) NULL,price_tier int NULL,currency_key varbinary(40) NULL,source_unit_id bigint NULL,key_count bigint NOT NULL);CREATE UNIQUE CLUSTERED INDEX IX_validation_price_keys ON #validation_price_keys(product_id,type_key,price_tier,currency_key,source_unit_id);INSERT #validation_price_keys SELECT z.product_id,CONVERT(varbinary(80),CONVERT(nvarchar(max),z.price_type)),z.price_tier,CONVERT(varbinary(40),CONVERT(nvarchar(max),z.currency_code)),z.source_unit_id,COUNT_BIG(*) FROM dbo.product_prices z JOIN #selected s ON s.product_id=z.product_id GROUP BY z.product_id,CONVERT(varbinary(80),CONVERT(nvarchar(max),z.price_type)),z.price_tier,CONVERT(varbinary(40),CONVERT(nvarchar(max),z.currency_code)),z.source_unit_id;`;
const bindingValidation=validationCaches+legacyBindingValidation
  .replace('LEFT JOIN (SELECT source_product_id,COUNT_BIG(*) alias_count,MIN(product_id) product_id FROM dbo.product_source_aliases GROUP BY source_product_id) sa','LEFT JOIN #validation_source_aliases sa')
  .replace('LEFT JOIN (SELECT product_id,COUNT_BIG(*) alias_count,MIN(source_product_id) source_product_id FROM dbo.product_source_aliases GROUP BY product_id) pa','LEFT JOIN #validation_product_aliases pa')
  .replace('LEFT JOIN (SELECT z.product_id,z.price_type,z.price_tier,z.currency_code,z.source_unit_id,COUNT_BIG(*) key_count FROM dbo.product_prices z JOIN #selected selected ON selected.product_id=z.product_id GROUP BY z.product_id,z.price_type,z.price_tier,z.currency_code,z.source_unit_id) keys_scope','LEFT JOIN #validation_price_keys keys_scope')
  .replace('keys_scope.price_type=v.price_type','keys_scope.type_key=CONVERT(varbinary(80),v.price_type)')
  .replace('keys_scope.currency_code=v.currency_code','keys_scope.currency_key=CONVERT(varbinary(40),v.currency_code)')
  .replace('ISNULL(keys_scope.source_unit_id,-1)=ISNULL(v.source_unit_id,-1)','(keys_scope.source_unit_id=v.source_unit_id OR (keys_scope.source_unit_id IS NULL AND v.source_unit_id IS NULL))')
  .replace('n.price_type COLLATE Latin1_General_100_BIN2<>v.price_type COLLATE Latin1_General_100_BIN2','CONVERT(varbinary(max),CONVERT(nvarchar(max),n.price_type))<>CONVERT(varbinary(max),v.price_type)')
  .replace('n.currency_code COLLATE Latin1_General_100_BIN2<>v.currency_code COLLATE Latin1_General_100_BIN2','CONVERT(varbinary(max),CONVERT(nvarchar(max),n.currency_code))<>CONVERT(varbinary(max),v.currency_code)')
  .replace('ISNULL(n.source_unit_id,-1)<>ISNULL(v.source_unit_id,-1)','(n.source_unit_id<>v.source_unit_id OR (n.source_unit_id IS NULL AND v.source_unit_id IS NOT NULL) OR (n.source_unit_id IS NOT NULL AND v.source_unit_id IS NULL))');
const metadata=`SELECT DB_NAME() database_name,r.run_id,r.status run_status,r.source_hash,r.plan_hash,CONVERT(varchar(10),r.source_as_of) source_as_of`;
const priceSelect=`SELECT CONVERT(varchar(20),v.product_id) product_id,CONVERT(varchar(20),v.price_id) price_id,v.product_source_key,v.price_source_key,CONVERT(varchar(20),v.source_unit_id) source_unit_id,v.price_type,v.price_tier,v.currency_code,CONVERT(varchar(100),v.price_exact) price_exact,v.is_main_unit FROM erp_migration.accepted_price_values v JOIN #selected s ON s.product_id=v.product_id ORDER BY v.product_id,v.price_type,v.source_unit_id,v.price_tier,v.currency_code;`;
function readerSql(kind,bindingsHash='0'.repeat(64)){return renderReaderSql(kind,bindingsHash,bindingValidation);}
function legacyReaderSql(kind,bindingsHash='0'.repeat(64)){return renderReaderSql(kind,bindingsHash,legacyBindingValidation);}
function renderReaderSql(kind,bindingsHash,validation){
  check(['detail','list'].includes(kind),'READER_KIND_REQUIRED');check(/^[a-f0-9]{64}$/.test(bindingsHash),'BINDING_HASH_REQUIRED');const ready=readiness.replace('AND sealed=1',`AND bindings_hash='${bindingsHash}' AND sealed=1`);
  if(kind==='detail')return `CREATE PROCEDURE dbo.usp_get_accepted_opening_prices @product_id bigint AS BEGIN SET NOCOUNT ON; ${ready} CREATE TABLE #selected(product_id bigint PRIMARY KEY);INSERT #selected SELECT product_id FROM erp_migration.accepted_price_products WHERE product_id=@product_id;${validation}
${metadata},CONVERT(bit,CASE WHEN b.product_id IS NULL THEN 0 ELSE 1 END) accepted,CONVERT(varchar(20),@product_id) product_id,b.product_source_key,CONVERT(varchar(20),b.main_unit_source_id) main_unit_source_id,COALESCE(b.price_count,0) price_count FROM erp_migration.runs r LEFT JOIN erp_migration.accepted_price_products b ON b.product_id=@product_id WHERE r.run_id=N'${RUN}';${priceSelect} END`;
  return `CREATE PROCEDURE dbo.usp_list_accepted_opening_products @search nvarchar(120)=N'',@positive_only bit=0,@page int=1,@page_size int=50 AS BEGIN SET NOCOUNT ON;${ready} IF @page IS NULL OR @page<1 OR @page>100000 OR @page_size IS NULL OR @page_size<1 OR @page_size>100 OR @positive_only IS NULL THROW 51075,'OPENING_PRICES_NOT_READY',1;
CREATE TABLE #matches(product_id bigint PRIMARY KEY);INSERT #matches SELECT b.product_id FROM erp_migration.accepted_price_products b JOIN dbo.products p ON p.id=b.product_id WHERE (@positive_only=0 OR p.current_stock_qty>0) AND (COALESCE(@search,N'')=N'' OR CHARINDEX(@search,b.stock_code)>0 OR CHARINDEX(@search,b.product_name)>0);DECLARE @total bigint=(SELECT COUNT_BIG(*) FROM #matches);CREATE TABLE #selected(product_id bigint PRIMARY KEY);INSERT #selected SELECT m.product_id FROM #matches m JOIN erp_migration.accepted_price_products b ON b.product_id=m.product_id ORDER BY b.stock_code,b.product_id OFFSET CONVERT(bigint,@page-1)*@page_size ROWS FETCH NEXT @page_size ROWS ONLY;${validation}
${metadata},@total total,@page page,@page_size page_size FROM erp_migration.runs r WHERE r.run_id=N'${RUN}';SELECT CONVERT(varchar(20),b.product_id) product_id,b.stock_code,b.product_name,b.product_source_key,CONVERT(varchar(20),b.main_unit_source_id) main_unit_source_id,p.is_active,CONVERT(varchar(100),CAST(p.current_stock_qty AS decimal(28,8))) stock_quantity_exact,CONVERT(varchar(100),CAST(p.average_cost_try AS decimal(28,8))) average_cost_try_exact,b.price_count FROM erp_migration.accepted_price_products b JOIN #selected s ON s.product_id=b.product_id JOIN dbo.products p ON p.id=b.product_id ORDER BY b.stock_code,b.product_id;${priceSelect} END`;
}

return readerSql;})();

import {SUPPLIER_CARD_READY_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
import {sourceVersionSqlHash,SOURCE_VERSION_TABLES,sourceVersionImmutableSql} from '../migration/goal7-source-version.mjs';
export const SOURCE_CATALOG_PROC='dbo.usp_read_work_catalog_goal7';
const check=(yes,code)=>{if(!yes)throw Error(code);};
export function validateSourceCatalogContext(c){
 check(c&&/^GOAL7-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(c.runId),'VERSION_RUN_REQUIRED');
 for(const k of ['sourceHash','planHash','bindingsHash'])check(typeof c[k]==='string'&&/^[a-f0-9]{64}$/i.test(c[k]),'VERSION_HASH_REQUIRED');
 check(c.sourceAsOf==='2026-10-07'&&c.productCount===16671&&Number.isInteger(c.priceCount)&&c.priceCount>63774,'VERSION_COUNTS_REQUIRED');
 return c;
}
const lit=v=>"N'"+v.replaceAll("'","''")+"'";
const fail="THROW 51107,'VERSION_CATALOG_BINDING_DRIFT',1;";
export function buildSourceCatalogReader(c){
 validateSourceCatalogContext(c);
 const readiness=STOCK_PRODUCT_RUNTIME_READY_SQL.replace(SUPPLIER_CARD_READY_SQL,'');
 check(CATALOG_PROC_SQL.includes(readiness),'VERSION_TEMPLATE_READY_DRIFT');
 let text=CATALOG_PROC_SQL.replace(readiness,'/* GOAL7_HISTORICAL_READINESS */');
 text=text.replace('dbo.usp_read_work_catalog',SOURCE_CATALOG_PROC)
  .replaceAll('erp_migration.accepted_price_products','#Goal7Products')
  .replaceAll('erp_migration.accepted_price_values','#Goal7Prices')
  .replaceAll('erp_migration.records','erp_migration.goal7_source_version_records')
  .replaceAll("r.run_id=N'VEGA-OPENING-TEST-20261004-06' AND r.entity=N'products'",'r.run_id=b.lineage_run_id AND r.entity=N\'products\'')
  .replaceAll("r.run_id=N'VEGA-OPENING-TEST-20261004-06' AND r.entity=N'prices'",'r.run_id=v.lineage_run_id AND r.entity=N\'prices\'')
  .replaceAll('r.source_key=b.product_source_key','r.source_key=b.lineage_source_key')
  .replaceAll('r.source_key=v.price_source_key','r.source_key=v.lineage_source_key')
  .replaceAll('16676',String(c.productCount+54));
 const provenance="CASE WHEN s.kind<>N'synthetic-test' THEN N'VEGA-OPENING-TEST-20261004-06' ELSE NULL END runId,CASE WHEN s.kind<>N'synthetic-test' THEN N'2026-09-30' ELSE NULL END sourceAsOf";
 check(text.includes(provenance),'VERSION_TEMPLATE_PROVENANCE_DRIFT');
 text=text.replace(provenance,"CASE WHEN b.product_id IS NOT NULL THEN b.lineage_run_id ELSE N'VEGA-OPENING-TEST-20261004-06' END runId,CASE WHEN b.product_id IS NOT NULL THEN b.lineage_source_as_of ELSE N'2026-09-30' END sourceAsOf,CASE WHEN EXISTS(SELECT 1 FROM erp_migration.accepted_price_products old WHERE old.product_id=p.id AND CONVERT(varbinary(max),old.stock_code)=CONVERT(varbinary(max),p.stock_code)) THEN (SELECT old.product_source_key FROM erp_migration.accepted_price_products old WHERE old.product_id=p.id) END mediaSourceKey,CASE WHEN EXISTS(SELECT 1 FROM erp_migration.accepted_price_products old WHERE old.product_id=p.id AND CONVERT(varbinary(max),old.stock_code)=CONVERT(varbinary(max),p.stock_code)) THEN N'VEGA-OPENING-TEST-20261004-06' END mediaRunId");
 const priceView=`(SELECT * FROM ${SOURCE_VERSION_TABLES.prices} WHERE version_run_id=${lit(c.runId)})`;
 text=text.replaceAll('#Goal7Prices v',priceView+' v');
 const versionReady=`/* GOAL7_VERSION_READY */
${Object.values(SOURCE_VERSION_TABLES).map(table=>{const trigger='erp_migration.immutable_'+table.split('.')[1];return `IF COALESCE(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${trigger}'))),2),'')<>'${sourceVersionSqlHash(sourceVersionImmutableSql(table))}' OR COALESCE(OBJECTPROPERTY(OBJECT_ID(N'${trigger}'),'ExecIsTriggerDisabled'),1)<>0 ${fail}`;}).join('\n')}
IF NOT EXISTS(SELECT 1 FROM ${SOURCE_VERSION_TABLES.manifest} WHERE run_id=${lit(c.runId)} AND source_hash=${lit(c.sourceHash)} AND plan_hash=${lit(c.planHash)} AND bindings_hash=${lit(c.bindingsHash)} AND source_as_of=${lit(c.sourceAsOf)} AND product_count=${c.productCount} AND price_count=${c.priceCount} AND sealed=1) ${fail}
SELECT * INTO #Goal7Products FROM ${SOURCE_VERSION_TABLES.products} WHERE version_run_id=${lit(c.runId)};
CREATE UNIQUE CLUSTERED INDEX IX_Goal7Products ON #Goal7Products(product_id);
IF(SELECT COUNT(*) FROM #Goal7Products)<>${c.productCount} OR(SELECT COUNT(*) FROM ${SOURCE_VERSION_TABLES.prices} WHERE version_run_id=${lit(c.runId)})<>${c.priceCount} ${fail}
IF @classification_validation=1 BEGIN
 IF EXISTS(SELECT 1 FROM #Goal7Products b WHERE b.lineage_run_id NOT IN(N'VEGA-OPENING-TEST-20261004-06',${lit(c.runId)}) OR b.lineage_source_as_of<>CASE WHEN b.lineage_run_id=${lit(c.runId)} THEN ${lit(c.sourceAsOf)} ELSE N'2026-09-30' END OR CONVERT(varbinary(max),b.lineage_source_key)<>CONVERT(varbinary(max),CASE WHEN b.lineage_run_id=${lit(c.runId)} THEN N'VEGA2026/F0102/TBLSTOKLAR/' ELSE N'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/' END+b.source_id)) ${fail}
 IF EXISTS(SELECT 1 FROM ${priceView} v LEFT JOIN #Goal7Products b ON b.product_id=v.product_id WHERE b.product_id IS NULL OR v.lineage_run_id NOT IN(N'VEGA-OPENING-TEST-20261004-06',${lit(c.runId)}) OR CONVERT(varbinary(max),v.lineage_source_key)<>CONVERT(varbinary(max),CASE WHEN v.lineage_run_id=${lit(c.runId)} THEN N'VEGA2026/F0102/TBLSTOKLAR/' ELSE N'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/' END+b.source_id+N'/PRICE/'+v.price_type+N'/'+COALESCE(CONVERT(nvarchar(20),v.source_unit_id),N'CARD')+N'/'+CONVERT(nvarchar(10),v.price_tier)+N'/'+v.currency_code)) ${fail}
END;
 /* GOAL7_VERSION_READY_END */`;
 text=text.replace('/* GOAL7_HISTORICAL_READINESS */',readiness);
 const scopeStart=' CREATE TABLE #StockScope';check(text.includes(scopeStart),'VERSION_TEMPLATE_SCOPE_DRIFT');text=text.replace(scopeStart,versionReady+scopeStart);
 text=text.replaceAll('CONVERT(varbinary(max),m.source_key)=CONVERT(varbinary(max),b.product_source_key)',"EXISTS(SELECT 1 FROM erp_migration.accepted_price_products old_media WHERE old_media.product_id=b.product_id AND CONVERT(varbinary(max),old_media.stock_code)=CONVERT(varbinary(max),p.stock_code) AND CONVERT(varbinary(max),m.source_key)=CONVERT(varbinary(max),old_media.product_source_key))");
 // Returned counts describe the resolved snapshot; historical readiness above
 // continues to check 16622/63774, C09, quarantine and old procedure pins.
 text=text.replaceAll('(SELECT COUNT(*) FROM erp_migration.accepted_price_products) acceptedCount','(SELECT COUNT(*) FROM #Goal7Products) acceptedCount');
 // Source stage keys for revised rows can keep their stable opening key; their
 // lineage run and exact payload hash identify the revision independently.
 const header=' SELECT N\'{"brands":[],"productTypes":[]}\' filtersJson,';
 check(text.includes(header),'VERSION_TEMPLATE_HEADER_DRIFT');
 text=text.replace(header,`${header}${lit(c.runId)} sourceVersionRunId,${lit(c.sourceHash)} sourceVersionSourceHash,${lit(c.planHash)} sourceVersionPlanHash,${lit(c.bindingsHash)} sourceVersionBindingsHash,`);
 const startupHeader=' SELECT CONVERT(varchar(20),@actor_id) actorId,CONVERT(bit,1) canView,CONVERT(bit,1) classificationValidated,';
 check(text.includes(startupHeader),'VERSION_TEMPLATE_STARTUP_HEADER_DRIFT');
 text=text.replace(startupHeader,` SELECT ${lit(c.runId)} sourceVersionRunId,${lit(c.sourceHash)} sourceVersionSourceHash,${lit(c.planHash)} sourceVersionPlanHash,${lit(c.bindingsHash)} sourceVersionBindingsHash,CONVERT(varchar(20),@actor_id) actorId,CONVERT(bit,1) canView,CONVERT(bit,1) classificationValidated,`);
 // Read the indexed immutable version directly. Copying all products into a
 // temporary heap and sorting its index repeated startup work on every page.
 // Seal/count/trigger pins and selected native/stage/alias checks remain intact.
 const productView='(SELECT * FROM '+SOURCE_VERSION_TABLES.products+' WHERE version_run_id='+lit(c.runId)+')';
 const copy='SELECT * INTO #Goal7Products FROM '+SOURCE_VERSION_TABLES.products+' WHERE version_run_id='+lit(c.runId)+';';
 const index='CREATE UNIQUE CLUSTERED INDEX IX_Goal7Products ON #Goal7Products(product_id);';
 check(text.includes(copy)&&text.includes(index),'VERSION_TEMPLATE_COPY_DRIFT');
 text=text.replace(copy,'').replace(index,'')
  .replaceAll('FROM #Goal7Products)','FROM '+productView+' Goal7ResolvedProducts)')
  .replaceAll('#Goal7Products',productView);
 const stored=text.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE   PROCEDURE ');
 return {procedure:SOURCE_CATALOG_PROC,sql:text,readinessSql:versionReady,storedDefinition:stored,proof:{...CATALOG_SQL_PROOF,readerDefinitionHash:sourceVersionSqlHash(stored)},context:{...c,readerDefinitionHash:sourceVersionSqlHash(stored)}};
}
export function sourceCatalogAccessSql(){return ['melisa_sirket_test_20260929_01','melisa_sirket_sales_test_20260929_01'].map(p=>`IF DATABASE_PRINCIPAL_ID(N'${p}') IS NULL THROW 51107,'VERSION_EXISTING_PRINCIPAL_REQUIRED',1;`+[SOURCE_CATALOG_PROC,'dbo.usp_read_stock_products_goal7','dbo.usp_get_source_version_prices_goal7','dbo.usp_list_source_version_products_goal7'].map(proc=>`GRANT EXECUTE ON OBJECT::${proc} TO [${p}];`).join('')).join('\n');}
const sourceView=(table,c)=>`(SELECT * FROM ${table} WHERE version_run_id=${lit(c.runId)})`;
function resolvedTemplate(text,c){return text.replaceAll('erp_migration.accepted_price_products','#Goal7Products').replaceAll('erp_migration.accepted_price_values',sourceView(SOURCE_VERSION_TABLES.prices,c))
 .replaceAll('erp_migration.records','erp_migration.goal7_source_version_records')
 .replaceAll("r.run_id=N'VEGA-OPENING-TEST-20261004-06' AND r.entity=N'products'",'r.run_id=b.lineage_run_id AND r.entity=N\'products\'')
 .replaceAll("r.run_id=N'VEGA-OPENING-TEST-20261004-06' AND r.entity=N'prices'",'r.run_id=v.lineage_run_id AND r.entity=N\'prices\'')
 .replaceAll('r.source_key=b.product_source_key','r.source_key=b.lineage_source_key').replaceAll('r.source_key=v.price_source_key','r.source_key=v.lineage_source_key');}
function readySql(c){const sql=buildSourceCatalogReader(c).readinessSql,start=sql.indexOf('/* GOAL7_VERSION_READY */'),end=sql.indexOf('/* GOAL7_VERSION_READY_END */',start);check(start>=0&&end>start,'VERSION_READY_TEMPLATE_DRIFT');return sql.slice(start,end)+'\n';}
export function buildSourceStockReader(c){
 validateSourceCatalogContext(c);check(STOCK_PRODUCT_PROC_SQL.includes(STOCK_PRODUCT_RUNTIME_READY_SQL),'VERSION_STOCK_TEMPLATE_DRIFT');
 let text=resolvedTemplate(STOCK_PRODUCT_PROC_SQL.replace(STOCK_PRODUCT_RUNTIME_READY_SQL,'/* LEGACY_STOCK_READY */'),c).replace('dbo.usp_read_stock_products','dbo.usp_read_stock_products_goal7');
 text=text.replace('/* LEGACY_STOCK_READY */',STOCK_PRODUCT_RUNTIME_READY_SQL);
 text=text.replace(' CREATE TABLE #StockScope',` DECLARE @classification_validation bit=0;\n${readySql(c)} CREATE TABLE #StockScope`);
 text=text.replace("CASE WHEN s.kind<>N'synthetic-test' THEN N'VEGA-OPENING-TEST-20261004-06' ELSE NULL END runId,CASE WHEN s.kind<>N'synthetic-test' THEN N'2026-09-30' ELSE NULL END sourceAsOf","CASE WHEN b.product_id IS NOT NULL THEN b.lineage_run_id WHEN s.kind=N'quarantined-source' THEN N'VEGA-OPENING-TEST-20261004-06' END runId,CASE WHEN b.product_id IS NOT NULL THEN b.lineage_source_as_of WHEN s.kind=N'quarantined-source' THEN N'2026-09-30' END sourceAsOf");
 text=text.replace(' SELECT CONVERT(varchar(20),@actor_id) actorId,',` SELECT ${lit(c.runId)} sourceVersionRunId,${lit(c.sourceHash)} sourceVersionSourceHash,${lit(c.planHash)} sourceVersionPlanHash,${lit(c.bindingsHash)} sourceVersionBindingsHash,CONVERT(varchar(20),@actor_id) actorId,`);
 const stored=text.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE   PROCEDURE ');return {procedure:'dbo.usp_read_stock_products_goal7',sql:text,storedDefinition:stored,proof:{...STOCK_PRODUCT_SQL_PROOF,readerDefinitionHash:sourceVersionSqlHash(stored)}};
}
export function buildSourceOpeningReader(kind,c){
 validateSourceCatalogContext(c);check(['detail','list'].includes(kind),'VERSION_OPENING_KIND');
 const original=readerSql(kind,'5842be926d493c8973566fd922ef840d9fe6f7cecd9d83f17f506be5aa3fbd72');
 const start=original.indexOf(' AS BEGIN SET NOCOUNT ON;')+' AS BEGIN SET NOCOUNT ON;'.length,end=original.indexOf(kind==='detail'?' CREATE TABLE #selected':' IF @page IS NULL',start);check(end>start,'VERSION_OPENING_TEMPLATE_DRIFT');
 const oldReady=original.slice(start,end);let text=resolvedTemplate(original.slice(0,start)+'/* LEGACY_OPENING_READY */'+original.slice(end),c);
 const procedure=kind==='detail'?'dbo.usp_get_source_version_prices_goal7':'dbo.usp_list_source_version_products_goal7';text=text.replace(kind==='detail'?'dbo.usp_get_accepted_opening_prices':'dbo.usp_list_accepted_opening_products',procedure);
 text=text.replace('/* LEGACY_OPENING_READY */',oldReady+` DECLARE @classification_validation bit=0;${readySql(c)} SELECT run_id,source_hash,plan_hash,source_as_of,N'COMMITTED' status INTO #Goal7Run FROM ${SOURCE_VERSION_TABLES.manifest} WHERE run_id=${lit(c.runId)};`);
 text=text.replaceAll('FROM erp_migration.runs r','FROM #Goal7Run r').replaceAll("WHERE r.run_id=N'VEGA-OPENING-TEST-20261004-06'",`WHERE r.run_id=${lit(c.runId)}`);
 text=text.replaceAll('SELECT DB_NAME() database_name,',"SELECT CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2) readerDefinitionHash,DB_NAME() database_name,");
 if(kind==='detail')text=text.replace('b.product_source_key,CONVERT(varchar(20),b.main_unit_source_id)', 'b.lineage_run_id product_lineage_run_id,b.product_source_key,CONVERT(varchar(20),b.main_unit_source_id)');
 // Native tuple/stage/hash validation in the historical builder now resolves
 // the sealed v2 lineage; its original readiness checks stay byte exact above.
 return {procedure,sql:text,storedDefinition:text,proof:{readerDefinitionHash:sourceVersionSqlHash(text)}};
}
export function buildSourceVersionReaders(c){const catalog=buildSourceCatalogReader(c),stock=buildSourceStockReader(c),detail=buildSourceOpeningReader('detail',c),list=buildSourceOpeningReader('list',c);return {catalog,stock,detail,list,context:{...catalog.context,stockReaderDefinitionHash:stock.proof.readerDefinitionHash,openingDetailDefinitionHash:detail.proof.readerDefinitionHash,openingListDefinitionHash:list.proof.readerDefinitionHash}};}
