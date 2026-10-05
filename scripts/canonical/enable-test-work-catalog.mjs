// Offline builder: a new read-only companion, leaving the accepted stock reader intact.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {STOCK_PRODUCT_PROC_SQL,STOCK_PRODUCT_READY_SQL,STOCK_PRODUCT_SQL_PROOF,STOCK_PRODUCT_RUN} from './enable-test-stock-products.mjs';
export const CATALOG_PROC='dbo.usp_read_work_catalog';
const digest=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
const quote=s=>"N'"+s.replaceAll("'","''")+"'";
const fail="THROW 51102,'WORK_CATALOG_BINDING_DRIFT',1;";
const binary=(a,b)=>`CONVERT(varbinary(max),${a})=CONVERT(varbinary(max),${b})`;
const priceFields=['price_id','product_id','product_source_key','price_source_key','source_unit_id','price_type','price_tier','currency_code','price_exact','is_main_unit','stage_payload_hash','stage_sql_hash','native_row_hash'];
const bindingHash=`CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT ${priceFields.map(f=>`v.${f}`).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)`;
export const CATALOG_SALE_BINDING_SQL=`IF @sales=1 BEGIN
IF EXISTS(SELECT 1 FROM #StockPage s JOIN erp_migration.accepted_price_values v ON v.product_id=s.id
LEFT JOIN dbo.product_prices n ON n.id=v.price_id
LEFT JOIN erp_migration.records r ON r.run_id=N'${STOCK_PRODUCT_RUN}' AND r.entity=N'prices' AND r.source_key=v.price_source_key
WHERE ${binary('CONVERT(nvarchar(max),v.price_type)',"N'sale'")} AND (
n.id IS NULL OR r.source_key IS NULL OR n.product_id<>v.product_id
OR NOT(${binary('CONVERT(nvarchar(max),n.price_type)','CONVERT(nvarchar(max),v.price_type)')} AND ${binary('CONVERT(nvarchar(max),n.currency_code)','CONVERT(nvarchar(max),v.currency_code)')})
OR n.price_tier<>v.price_tier OR EXISTS(SELECT n.source_unit_id,n.price EXCEPT SELECT v.source_unit_id,v.price_exact)
OR v.native_row_hash IS NULL OR CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT n.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>v.native_row_hash
OR r.payload_hash IS NULL OR r.payload_json IS NULL OR r.payload_hash<>v.stage_payload_hash OR CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2)<>v.stage_sql_hash
OR v.binding_hash IS NULL OR v.binding_hash<>${bindingHash}
OR(SELECT COUNT(*) FROM dbo.product_prices z WHERE z.product_id=v.product_id AND ${binary('CONVERT(nvarchar(max),z.price_type)','CONVERT(nvarchar(max),v.price_type)')} AND ${binary('CONVERT(nvarchar(max),z.currency_code)','CONVERT(nvarchar(max),v.currency_code)')} AND z.price_tier=v.price_tier AND NOT EXISTS(SELECT z.source_unit_id EXCEPT SELECT v.source_unit_id))<>1)) ${fail}
END;`;
const saleRows=`JSON_QUERY(COALESCE((SELECT CONVERT(varchar(20),v.price_id) id,v.price_type type,CONVERT(varchar(20),v.source_unit_id) unitSourceId,v.price_tier tier,v.currency_code currency,CONVERT(varchar(100),v.price_exact) priceExact,v.is_main_unit isMainUnit,v.price_source_key sourceKey FROM erp_migration.accepted_price_values v WHERE @sales=1 AND s.kind=N'accepted-opening' AND v.product_id=p.id AND ${binary('CONVERT(nvarchar(max),v.price_type)',"N'sale'")} ORDER BY v.source_unit_id,v.price_tier,v.currency_code,v.price_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) salePrices`;
function replaceOnce(text,oldValue,newValue){
 if(!text.includes(oldValue)||text.indexOf(oldValue)!==text.lastIndexOf(oldValue))throw new Error('CATALOG_SOURCE_TEMPLATE_DRIFT');
 return text.replace(oldValue,newValue);
}
function catalogBody(){
 let sql=replaceOnce(STOCK_PRODUCT_PROC_SQL,'CREATE OR ALTER PROCEDURE dbo.usp_read_stock_products',`CREATE OR ALTER PROCEDURE ${CATALOG_PROC}`);
 sql=replaceOnce(sql," INSERT #StockScope SELECT p.id,N'synthetic-test' FROM dbo.products p WHERE p.id IN(301984,301985,301986);",'');
 // SQL equality pads NVARCHAR operands. Only zero bytes means no barcode filter;
 // spaces are literal barcode characters and must never broaden to all products.
 sql=replaceOnce(sql,"(@barcode=N'' OR EXISTS","(DATALENGTH(@barcode)=0 OR EXISTS");
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
 sql=replaceOnce(sql,' SELECT CONVERT(varchar(20),@actor_id) actorId',` ${CATALOG_SALE_BINDING_SQL}\n SELECT CONVERT(varchar(20),@actor_id) actorId`);
 // Independently pin the unchanged prerequisite reader before serving this companion.
 sql=replaceOnce(sql,' WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;',` WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;\n ${CATALOG_STOCK_PIN_SQL}`);
 return sql;
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
BEGIN TRY BEGIN TRANSACTION; DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @lock<0 THROW 51102,'WORK_CATALOG_INSTALL_LOCK_REQUIRED',1;
${STOCK_PRODUCT_READY_SQL}
${CATALOG_STOCK_PIN_SQL}
${principals.map(p=>`IF DATABASE_PRINCIPAL_ID(N'${p}') IS NULL THROW 51102,'WORK_CATALOG_EXISTING_PRINCIPAL_REQUIRED',1;`).join('\n')}
IF OBJECT_ID(N'${CATALOG_PROC}') IS NOT NULL BEGIN
 IF OBJECT_ID(N'${CATALOG_PROC}',N'P') IS NULL OR COALESCE(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CATALOG_PROC}'))),2),'')<>'${CATALOG_SQL_PROOF.readerDefinitionHash}' THROW 51102,'WORK_CATALOG_DEFINITION_DRIFT',1;
 ${CATALOG_ACCESS_SQL}
 COMMIT; SELECT N'NOOP' result,0 writes; RETURN;
END;
EXEC sys.sp_executesql ${quote(CATALOG_PROC_SQL)};
${principals.map(p=>`GRANT EXECUTE ON OBJECT::${CATALOG_PROC} TO [${p}];`).join('\n')}
IF COALESCE(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CATALOG_PROC}'))),2),'')<>'${CATALOG_SQL_PROOF.readerDefinitionHash}' THROW 51102,'WORK_CATALOG_DEFINITION_DRIFT',1;
${CATALOG_ACCESS_SQL}
${STOCK_PRODUCT_READY_SQL}
COMMIT; SELECT N'INSTALLED' result,1 writes;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
`;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--write')throw new Error('OFFLINE_WRITE_MODE_REQUIRED');
 fs.writeFileSync(new URL('./enable-test-work-catalog.sql',import.meta.url),buildWorkCatalogSql());
 fs.writeFileSync(new URL('../../apps/api/src/services/catalogSqlProof.mjs',import.meta.url),buildCatalogSqlProofModule());
}
