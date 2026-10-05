// Offline source builder for the normal TEST stock screen. Never connects to SQL.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {SUPPLIER_CARD_READY_SQL,SUPPLIER_CARD_PRESERVED_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
import {PRICE_OPERATIONAL_SQL,PRODUCT_PRICE_SQL_PROOF} from './enable-test-product-prices.mjs';

export const STOCK_PRODUCT_PROC='dbo.usp_read_stock_products';
export const STOCK_PRODUCT_PREVIOUS_HASH='8C09D817DFB3C54802FCECC8DC5A18457D891CD887D1AB8BDAAA65E274BF08F3';
export const STOCK_PRODUCT_RUN='VEGA-OPENING-TEST-20261004-06';
const sourceHash='36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400';
const planHash='18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a';
const bindingsHash='5842be926d493c8973566fd922ef840d9fe6f7cecd9d83f17f506be5aa3fbd72';
const digest=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
const quote=s=>"N'"+s.replaceAll("'","''")+"'";
const fail="THROW 51101,'STOCK_PRODUCT_BINDING_DRIFT',1;";
const oldObjects={
 openingDetailHash:['usp_get_accepted_opening_prices','1C3BFC303F49A4F86D4502725D32283FD9D74B621DA0E6DDE8B7F23B236DE5C9'],
 openingListHash:['usp_list_accepted_opening_products','28AD97EC4FFF2C5ECC8573FB8D91E744CA32F95F4F8F12FD6A1FE79446E4BE8E'],
 acceptedManifestGuardHash:['immutable_accepted_price_manifest','FEFA64E1BB8F916DF8B041E35FB1B3E0BCBAEAFC29D9F385DFE3BB1A126B1C0D'],
 acceptedProductsGuardHash:['immutable_accepted_price_products','66B379D695C70B467B46CB81B42F952F208421F0D027F84480F77D8CF7422DF3'],
 acceptedPricesGuardHash:['immutable_accepted_price_values','FF2BDA0E7429284C5D09BCC3B5A1FE18CF883314C06579488773789E17CB323C'],
 holdManifestGuardHash:['immutable_operation_quarantine_manifest','79757013332664F5830478D84611D873810490870D5D11D5A3C4CC2EF8BE94E0'],
 holdRowsGuardHash:['immutable_operation_quarantine_holds','E9028DC050A59872CE2958CDDA54777D72077034DF866FD9AD3091CA4BE08BCC'],
 customerReaderHash:['usp_read_customer_cards','7FE6BEE7728312D666FF3B68151CA60A08B84E4A6D5B33B36F300A48381E6C8E'],
 supplierReaderHash:['usp_read_supplier_cards','D750DDCD6B3F4AEDBDC9A38C5347DED081961A6018505559D2F7D50014404C0B']
};
const c09Objects={c09PriceGetterHash:['usp_get_test_product_prices',PRODUCT_PRICE_SQL_PROOF.getterHash],c09PriceSetterHash:['usp_set_test_product_price',PRODUCT_PRICE_SQL_PROOF.setterHash],c09NativePriceGuardHash:['c09_guard_native_product_prices',PRODUCT_PRICE_SQL_PROOF.nativeGuardHash],c09CurrentPriceGuardHash:['c09_guard_product_price_current',PRODUCT_PRICE_SQL_PROOF.currentGuardHash],c09PriceVersionGuardHash:['c09_guard_product_price_versions',PRODUCT_PRICE_SQL_PROOF.versionGuardHash],c09PriceJournalGuardHash:['c09_guard_product_price_requests',PRODUCT_PRICE_SQL_PROOF.journalGuardHash],c09PriceManifestGuardHash:['c09_immutable_test_product_price_manifest',PRODUCT_PRICE_SQL_PROOF.manifestGuardHash],c09PriceScopeGuardHash:['c09_immutable_test_product_price_scope',PRODUCT_PRICE_SQL_PROOF.scopeGuardHash],c09PriceUnitGuardHash:['c09_immutable_test_product_price_units',PRODUCT_PRICE_SQL_PROOF.unitGuardHash]};
const productFields=['product_id','product_source_key','source_id','native_source_key','stock_code','product_name','currency_code','unit','main_unit_source_id','stage_payload_hash','stage_sql_hash'];
const priceFields=['price_id','product_id','product_source_key','price_source_key','source_unit_id','price_type','price_tier','currency_code','price_exact','is_main_unit','stage_payload_hash','stage_sql_hash','native_row_hash'];
const rowHash=(a,fields)=>`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT ${fields.map(f=>`${a}.${f}`).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)`;
const binary=(a,b)=>`CONVERT(varbinary(max),${a})=CONVERT(varbinary(max),${b})`;
const pins=Object.entries(oldObjects).map(([, [name,hash]])=>`IF COALESCE(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${name.startsWith('immutable_')?'erp_migration':'dbo'}.${name}'))),2),'')<>'${hash}'${name.startsWith('immutable_')?` OR COALESCE(OBJECTPROPERTY(OBJECT_ID(N'erp_migration.${name}'),'ExecIsTriggerDisabled'),1)<>0`:''} ${fail}`).join('\n');
export const STOCK_PRODUCT_READY_SQL=`${SUPPLIER_CARD_READY_SQL.replaceAll('51076','51101').replaceAll('SUPPLIER_CARD_','STOCK_PRODUCT_')}
${pins}
${PRICE_OPERATIONAL_SQL}
${Object.values(c09Objects).map(([name,hash])=>`IF COALESCE(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}'))),2),'')<>'${hash}' ${fail}`).join('\n')}
IF NOT EXISTS(SELECT 1 FROM erp_migration.accepted_price_manifest WHERE run_id=N'${STOCK_PRODUCT_RUN}' AND source_hash='${sourceHash}' AND plan_hash='${planHash}' AND bindings_hash='${bindingsHash}' AND source_as_of=N'2026-09-30' AND sealed=1 AND product_count=16622 AND price_count=63774) ${fail}
IF(SELECT COUNT(*) FROM erp_migration.accepted_price_products)<>16622 OR(SELECT COUNT(*) FROM erp_migration.accepted_price_values)<>63774 ${fail}
IF EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND(h.native_id IS NULL OR h.status<>N'blocked' OR NOT EXISTS(SELECT 1 FROM dbo.products p WHERE p.id=h.native_id AND ${binary('p.source_record_key','h.native_source_key')} AND ${binary('p.stock_code','h.native_code')} AND ${binary('p.name','h.native_name')}) OR(SELECT COUNT(*) FROM dbo.product_source_aliases a WHERE a.product_id=h.native_id)<>1 OR(SELECT COUNT(*) FROM dbo.product_source_aliases a WHERE a.source_product_id=TRY_CONVERT(int,h.source_id) AND a.product_id=h.native_id)<>1 OR EXISTS(SELECT 1 FROM erp_migration.accepted_price_products b WHERE b.product_id=h.native_id))) ${fail}
IF(SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds WHERE entity=N'product' AND native_id IS NOT NULL)<>54 OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND(SELECT COUNT(*) FROM dbo.product_source_aliases a WHERE a.source_product_id=TRY_CONVERT(int,h.source_id))<>1) ${fail}
IF EXISTS(SELECT 1 FROM(VALUES(CONVERT(bigint,301984),N'TEST-V70-20260929-P'),(301985,N'TEST-V70-GOODS-P'),(301986,N'TEST-DAILY-PURCHASE')) f(id,code) WHERE NOT EXISTS(SELECT 1 FROM dbo.products p WHERE p.id=f.id AND ${binary('p.stock_code','f.code')} AND p.unit=N'ADET' AND p.source_record_key IS NULL AND p.migration_run_id IS NULL) OR EXISTS(SELECT 1 FROM erp_migration.accepted_price_products b WHERE b.product_id=f.id)) ${fail}`;
// Native quantity/cost are mutable operational fields; identity and source evidence are not inferred from them.
const nativeBindingSql=`IF EXISTS(SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id LEFT JOIN dbo.products p ON p.id=b.product_id LEFT JOIN erp_migration.records r ON r.run_id=N'${STOCK_PRODUCT_RUN}' AND r.entity=N'products' AND r.source_key=b.product_source_key WHERE p.id IS NULL OR r.source_key IS NULL OR EXISTS(SELECT CONVERT(varbinary(max),p.stock_code),CONVERT(varbinary(max),p.name),CONVERT(varbinary(max),p.unit),CONVERT(varbinary(max),p.currency_code),CONVERT(varbinary(max),p.source_record_key) EXCEPT SELECT CONVERT(varbinary(max),b.stock_code),CONVERT(varbinary(max),b.product_name),CONVERT(varbinary(max),b.unit),CONVERT(varbinary(max),b.currency_code),CONVERT(varbinary(max),b.native_source_key)) OR r.payload_hash IS NULL OR r.payload_json IS NULL OR r.payload_hash<>b.stage_payload_hash OR CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2)<>b.stage_sql_hash OR(SELECT COUNT(*) FROM dbo.product_source_aliases a WHERE a.product_id=b.product_id)<>1 OR(SELECT COUNT(*) FROM dbo.product_source_aliases a WHERE a.source_product_id=TRY_CONVERT(int,b.source_id) AND a.product_id=b.product_id)<>1 OR(TRY_CONVERT(bigint,JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.mainUnitSourceId')) IS NOT NULL AND TRY_CONVERT(bigint,JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.mainUnitSourceId'))<>b.main_unit_source_id) OR b.price_count<>(SELECT COUNT(*) FROM erp_migration.accepted_price_values v WHERE v.product_id=b.product_id)) ${fail}
IF @product_id IS NOT NULL AND @financial=1 BEGIN
IF EXISTS(SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_values v ON v.product_id=s.id LEFT JOIN dbo.product_prices n ON n.id=v.price_id LEFT JOIN erp_migration.records r ON r.run_id=N'${STOCK_PRODUCT_RUN}' AND r.entity=N'prices' AND r.source_key=v.price_source_key WHERE n.id IS NULL OR r.source_key IS NULL OR n.product_id<>v.product_id OR NOT(${binary('CONVERT(nvarchar(max),n.price_type)','v.price_type')} AND ${binary('CONVERT(nvarchar(max),n.currency_code)','v.currency_code')}) OR n.price_tier<>v.price_tier OR EXISTS(SELECT n.source_unit_id,n.price EXCEPT SELECT v.source_unit_id,v.price_exact) OR CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT n.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>v.native_row_hash OR r.payload_hash<>v.stage_payload_hash OR CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2)<>v.stage_sql_hash OR(SELECT COUNT(*) FROM dbo.product_prices z WHERE z.product_id=v.product_id AND ${binary('CONVERT(nvarchar(max),z.price_type)','v.price_type')} AND ${binary('CONVERT(nvarchar(max),z.currency_code)','v.currency_code')} AND z.price_tier=v.price_tier AND NOT EXISTS(SELECT z.source_unit_id EXCEPT SELECT v.source_unit_id))<>1) ${fail}
END;`;
export const STOCK_PRODUCT_BINDING_SQL=`${nativeBindingSql}
IF EXISTS(SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id WHERE b.binding_hash<>${rowHash('b',productFields)}) ${fail}
IF @product_id IS NOT NULL AND @financial=1 AND EXISTS(SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_values v ON v.product_id=s.id WHERE v.binding_hash<>${rowHash('v',priceFields)}) ${fail}`;
const proofMetadata=`CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2) readerDefinitionHash,${Object.entries({...oldObjects,...c09Objects}).map(([key,[name]])=>`CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${name.startsWith('immutable_')?'erp_migration':'dbo'}.${name}'))),2) ${key}`).join(',')},(${SUPPLIER_CARD_PRESERVED_SQL}) preservedGuardHash`;
const unitVerified=`(b.product_id IS NOT NULL AND b.unit=N'ADET' AND JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.unitStatus')=N'VERIFIED_ADET_FACTOR_1' AND TRY_CONVERT(decimal(28,8),JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.unitFactor'))=1) OR(p.id=301986 AND EXISTS(SELECT 1 FROM dbo.test_product_price_units u WHERE u.label=N'ADET' AND u.factor=1))`;
export const STOCK_PRODUCT_PROC_SQL=`CREATE OR ALTER PROCEDURE ${STOCK_PRODUCT_PROC}
 @actor_id bigint,@product_id bigint=NULL,@search nvarchar(120)=N'',@barcode nvarchar(160)=N'',@stock nvarchar(12)=N'all',@status nvarchar(12)=N'all',@page int=1,@page_size int=25
 WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;
 IF @@TRANCOUNT=0 OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE session_id=@@SPID AND transaction_isolation_level=4) THROW 51101,'STOCK_PRODUCT_READ_TRANSACTION_REQUIRED',1;
 IF @actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.permissions p ON p.role_id=u.role_id WHERE u.id=@actor_id AND u.is_active=1 AND p.permission_key=N'product.view' AND p.can_view=1) THROW 51101,'STOCK_PRODUCT_READ_FORBIDDEN',1;
 IF @page IS NULL OR @page<1 OR @page>1000000 OR @page_size IS NULL OR @page_size<1 OR @page_size>50 OR @search IS NULL OR @barcode IS NULL OR @stock IS NULL OR @stock NOT IN(N'all',N'positive',N'zero',N'negative') OR @status IS NULL OR @status NOT IN(N'all',N'active',N'passive') OR(@product_id IS NOT NULL AND @product_id<1) THROW 51101,'STOCK_PRODUCT_QUERY_INVALID',1;
 ${STOCK_PRODUCT_READY_SQL}
 DECLARE @financial bit=CASE WHEN EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.permissions p ON p.role_id=u.role_id WHERE u.id=@actor_id AND u.is_active=1 AND p.permission_key=N'purchase.view' AND p.can_view=1) THEN 1 ELSE 0 END,@read_at varchar(24)=CONVERT(varchar(23),CAST(SYSUTCDATETIME() AS datetime2(3)),126)+N'Z';
 CREATE TABLE #StockScope(id bigint NOT NULL PRIMARY KEY,kind nvarchar(30) NOT NULL);
 INSERT #StockScope SELECT b.product_id,N'accepted-opening' FROM erp_migration.accepted_price_products b;
 INSERT #StockScope SELECT p.id,N'synthetic-test' FROM dbo.products p WHERE p.id IN(301984,301985,301986);
 INSERT #StockScope SELECT h.native_id,N'quarantined-source' FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND h.native_id IS NOT NULL;
 CREATE TABLE #StockMatches(id bigint NOT NULL PRIMARY KEY,kind nvarchar(30) NOT NULL);
 INSERT #StockMatches SELECT s.id,s.kind FROM #StockScope s JOIN dbo.products p ON p.id=s.id WHERE(@product_id IS NULL OR p.id=@product_id) AND(@search=N'' OR CHARINDEX(@search,p.stock_code)>0 OR CHARINDEX(@search,p.name)>0) AND(@barcode=N'' OR EXISTS(SELECT 1 FROM dbo.product_barcodes bc WHERE bc.product_id=p.id AND bc.is_active=1 AND ${binary('bc.barcode','@barcode')})) AND(@stock=N'all' OR(@stock=N'positive' AND p.current_stock_qty>0) OR(@stock=N'zero' AND p.current_stock_qty=0) OR(@stock=N'negative' AND p.current_stock_qty<0)) AND(@status=N'all' OR(@status=N'active' AND p.is_active=1 AND p.is_deleted=0) OR(@status=N'passive' AND(p.is_active=0 OR p.is_deleted=1)));
 CREATE TABLE #StockPage(id bigint NOT NULL PRIMARY KEY,kind nvarchar(30) NOT NULL);
 INSERT #StockPage SELECT m.id,m.kind FROM #StockMatches m JOIN dbo.products p ON p.id=m.id ORDER BY p.stock_code,p.id OFFSET CONVERT(bigint,@page-1)*@page_size ROWS FETCH NEXT @page_size ROWS ONLY;
 ${STOCK_PRODUCT_BINDING_SQL}
 IF EXISTS(SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_products b ON b.product_id=s.id WHERE(SELECT COUNT(*) FROM dbo.product_source_aliases a WHERE a.source_product_id=TRY_CONVERT(int,b.source_id))<>1) ${fail}
 SELECT CONVERT(varchar(20),@actor_id) actorId,CONVERT(bit,1) canView,@financial canViewFinance,(SELECT COUNT(*) FROM #StockMatches) total,(SELECT COUNT(*) FROM #StockScope WHERE kind=N'accepted-opening') acceptedCount,(SELECT COUNT(*) FROM #StockScope WHERE kind=N'synthetic-test') syntheticCount,(SELECT COUNT(*) FROM #StockScope WHERE kind=N'quarantined-source') quarantinedCount,@page page,@page_size [limit],@read_at readAt,${proofMetadata},
 COALESCE(N'['+(SELECT STRING_AGG(CONVERT(nvarchar(max),CASE WHEN @product_id IS NOT NULL AND @financial=1 THEN j.row_json ELSE JSON_MODIFY(j.row_json,'$.financial',NULL) END),N',') WITHIN GROUP(ORDER BY p.stock_code,p.id) FROM #StockPage s JOIN dbo.products p ON p.id=s.id LEFT JOIN erp_migration.accepted_price_products b ON b.product_id=p.id LEFT JOIN erp_migration.operation_quarantine_holds ph ON ph.entity=N'product' AND ph.native_id=p.id LEFT JOIN erp_migration.records r ON r.run_id=N'${STOCK_PRODUCT_RUN}' AND r.entity=N'products' AND r.source_key=b.product_source_key CROSS APPLY(SELECT(SELECT CONVERT(varchar(20),p.id) id,p.stock_code stockCode,p.name productName,CONVERT(bit,CASE WHEN p.is_active=1 AND p.is_deleted=0 THEN 1 ELSE 0 END) isActive,CONVERT(varchar(100),CAST(p.current_stock_qty AS decimal(28,8))) stockQuantityExact,
 JSON_QUERY((SELECT CASE WHEN s.kind=N'synthetic-test' THEN p.unit WHEN b.product_id IS NOT NULL AND JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.unit') IS NOT NULL THEN b.unit ELSE NULL END label,CASE WHEN p.id=301986 THEN(SELECT TOP(1) CONVERT(varchar(20),u.id) FROM dbo.test_product_price_units u ORDER BY u.id) WHEN TRY_CONVERT(bigint,JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.mainUnitSourceId'))>0 THEN CONVERT(varchar(20),b.main_unit_source_id) ELSE NULL END sourceId,CASE WHEN ${unitVerified} THEN CONVERT(varchar(100),CAST(1 AS decimal(28,8))) ELSE NULL END factorExact8,CONVERT(bit,CASE WHEN ${unitVerified} THEN 1 ELSE 0 END) verified FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)) unit,
 JSON_QUERY(COALESCE((SELECT CONVERT(varchar(20),bc.id) id,bc.barcode value,bc.is_primary isPrimary,CAST(NULL AS nvarchar(250)) sourceKey FROM dbo.product_barcodes bc WHERE bc.product_id=p.id AND bc.is_active=1 ORDER BY bc.is_primary DESC,bc.id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) barcodes,
 (SELECT TOP(1) COALESCE(im.file_path,im.storage_key) FROM dbo.product_images im WHERE im.product_id=p.id AND im.is_active=1 ORDER BY im.is_primary DESC,im.sort_order,im.id) imageUrl,
 JSON_QUERY((SELECT s.kind kind,COALESCE(b.product_source_key,ph.source_key) sourceKey,CASE WHEN s.kind<>N'synthetic-test' THEN N'${STOCK_PRODUCT_RUN}' ELSE NULL END runId,CASE WHEN s.kind<>N'synthetic-test' THEN N'2026-09-30' ELSE NULL END sourceAsOf,CONVERT(bit,1) verified FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)) provenance,
 JSON_QUERY((SELECT CONVERT(bit,CASE WHEN EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND(h.native_id=p.id OR ${binary('h.native_source_key','p.source_record_key')} OR EXISTS(SELECT 1 FROM dbo.product_source_aliases a WHERE a.product_id=p.id AND a.source_product_id=TRY_CONVERT(int,h.source_id)))) THEN 1 ELSE 0 END) blocked,JSON_QUERY(COALESCE((SELECT TOP(1) h.reasons_json FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND h.native_id=p.id),N'[]')) reasons FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) hold,
 JSON_QUERY(CASE WHEN @product_id IS NOT NULL AND @financial=1 THEN(SELECT CASE WHEN s.kind=N'quarantined-source' THEN NULL ELSE CONVERT(varchar(100),CAST(p.average_cost_try AS decimal(28,8))) END averageCostTryExact,JSON_QUERY(COALESCE((SELECT f.* FROM(SELECT CONVERT(varchar(20),v.price_id) id,v.price_type type,CONVERT(varchar(20),v.source_unit_id) unitSourceId,v.price_tier tier,v.currency_code currency,CONVERT(varchar(100),v.price_exact) priceExact,v.is_main_unit isMainUnit,v.price_source_key sourceKey FROM erp_migration.accepted_price_values v WHERE v.product_id=p.id UNION ALL SELECT CONVERT(varchar(20),c.native_price_id),c.type,CONVERT(varchar(20),c.unit_id),c.tier,c.currency,CONVERT(varchar(100),pv.price_exact),CONVERT(bit,CASE WHEN c.unit_id IS NOT NULL THEN 1 ELSE 0 END),np.source_record_key FROM dbo.test_product_price_current c JOIN dbo.test_product_price_versions pv ON pv.id=c.version_id AND pv.price_id=c.id JOIN dbo.product_prices np ON np.id=c.native_price_id WHERE p.id=301986 AND c.product_id=p.id) f ORDER BY f.type,f.unitSourceId,f.tier,f.currency FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) prices FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) ELSE NULL END) financial
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) row_json) j)+N']',N'[]') rowsJson;
 END;`;
// SQL Server stores CREATE OR ALTER's header as CREATE plus three spaces.
// Pin that stored definition independently; the executable DDL remains CREATE OR ALTER.
export const STOCK_PRODUCT_STORED_DEFINITION=STOCK_PRODUCT_PROC_SQL.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE   PROCEDURE ');
export const STOCK_PRODUCT_SQL_PROOF=Object.freeze({readerDefinitionHash:digest(STOCK_PRODUCT_STORED_DEFINITION),...Object.fromEntries(Object.entries({...oldObjects,...c09Objects}).map(([key,[,hash]])=>[key,hash])),preservedGuardHash:'9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E'});
export const buildStockProductSqlProofModule=()=>`// Generated offline; expected SQL definitions are independent of returned row JSON.\nexport const STOCK_PRODUCT_PROC=${JSON.stringify(STOCK_PRODUCT_PROC)};\nexport const STOCK_PRODUCT_SQL_PROOF=Object.freeze(${JSON.stringify(STOCK_PRODUCT_SQL_PROOF,null,2)});\n`;
const principals=['melisa_sirket_test_20260929_01','melisa_sirket_sales_test_20260929_01'];
export const STOCK_PRODUCT_ACCESS_SQL=principals.map(p=>`IF DATABASE_PRINCIPAL_ID(N'${p}') IS NULL OR NOT EXISTS(SELECT 1 FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'${STOCK_PRODUCT_PROC}') AND minor_id=0 AND grantee_principal_id=DATABASE_PRINCIPAL_ID(N'${p}') AND permission_name=N'EXECUTE' AND state=N'G') THROW 51101,'STOCK_PRODUCT_EXECUTE_DRIFT',1;`).join('\n')+`\nIF(SELECT COUNT(*) FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'${STOCK_PRODUCT_PROC}'))<>2 THROW 51101,'STOCK_PRODUCT_EXECUTE_DRIFT',1;`;
export function buildStockProductsSql(){return `-- B02/A01: one new owner read procedure, two existing TEST object EXECUTE grants.
SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON; SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF; SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\\MELISADEV' OR COALESCE(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 THROW 51101,'STOCK_PRODUCT_INSTALL_TARGET_REQUIRED',1;
BEGIN TRY BEGIN TRANSACTION; DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @lock<0 THROW 51101,'STOCK_PRODUCT_INSTALL_LOCK_REQUIRED',1;
${STOCK_PRODUCT_READY_SQL}
${principals.map(p=>`IF DATABASE_PRINCIPAL_ID(N'${p}') IS NULL THROW 51101,'STOCK_PRODUCT_EXISTING_PRINCIPAL_REQUIRED',1;`).join('\n')}
IF OBJECT_ID(N'${STOCK_PRODUCT_PROC}') IS NOT NULL BEGIN
 IF OBJECT_ID(N'${STOCK_PRODUCT_PROC}',N'P') IS NULL THROW 51101,'STOCK_PRODUCT_DEFINITION_DRIFT',1;
 DECLARE @prior_definition_hash char(64)=CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${STOCK_PRODUCT_PROC}'))),2);
 ${STOCK_PRODUCT_ACCESS_SQL}
 IF @prior_definition_hash='${STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash}' BEGIN COMMIT; SELECT N'NOOP' result,0 writes; RETURN; END;
 IF @prior_definition_hash IS NULL OR @prior_definition_hash<>'${STOCK_PRODUCT_PREVIOUS_HASH}' THROW 51101,'STOCK_PRODUCT_DEFINITION_DRIFT',1;
 EXEC sys.sp_executesql ${quote(STOCK_PRODUCT_PROC_SQL)};
 IF CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${STOCK_PRODUCT_PROC}'))),2)<>'${STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash}' THROW 51101,'STOCK_PRODUCT_DEFINITION_DRIFT',1;
 ${STOCK_PRODUCT_ACCESS_SQL}
 ${STOCK_PRODUCT_READY_SQL}
 COMMIT; SELECT N'UPGRADED' result,1 writes; RETURN;
END;
EXEC sys.sp_executesql ${quote(STOCK_PRODUCT_PROC_SQL)};
${principals.map(p=>`GRANT EXECUTE ON OBJECT::${STOCK_PRODUCT_PROC} TO [${p}];`).join('\n')}
IF CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${STOCK_PRODUCT_PROC}'))),2)<>'${STOCK_PRODUCT_SQL_PROOF.readerDefinitionHash}' THROW 51101,'STOCK_PRODUCT_DEFINITION_DRIFT',1;
${STOCK_PRODUCT_ACCESS_SQL}
${STOCK_PRODUCT_READY_SQL}
COMMIT; SELECT N'INSTALLED' result,1 writes;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
`;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--write')throw new Error('OFFLINE_WRITE_MODE_REQUIRED');
 fs.writeFileSync(new URL('./enable-test-stock-products.sql',import.meta.url),buildStockProductsSql());
 fs.writeFileSync(new URL('../../apps/api/src/services/stockProductSqlProof.mjs',import.meta.url),buildStockProductSqlProofModule());
}
