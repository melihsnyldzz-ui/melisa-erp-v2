// E02 offline SQL source builder. Never opens a database or changes a runtime.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CRM_OPENING as O,normalizeCrmOpeningBaseline,normalizeCrmOpeningMapping} from './crmOrderOpeningMapping.mjs';
const quote=s=>"N'"+s.replaceAll("'","''")+"'";
const sha=s=>createHash('sha256').update(s,'utf16le').digest('hex');
const storedSha=(name,sql)=>sha(name.startsWith('usp_test_crm_order_')?persistedCrmProcedureDefinition(sql,name):sql);
const binary=(a,b)=>`CONVERT(varbinary(max),${a})=CONVERT(varbinary(max),${b})`;
export const PRODUCT_HASH_FIELDS=['product_id','product_source_key','source_id','native_source_key','stock_code','product_name','currency_code','unit','main_unit_source_id','stage_payload_hash','stage_sql_hash'];
export const PRICE_HASH_FIELDS=['price_id','product_id','product_source_key','price_source_key','source_unit_id','price_type','price_tier','currency_code','price_exact','is_main_unit','stage_payload_hash','stage_sql_hash','native_row_hash'];
const holdFields=['entity','source_key','source_id','source_company','source_code','source_name','native_id','native_entity_id','native_source_key','native_code','native_name','status','reasons_json','binding_basis'];
const rowHash=(a,fields)=>`LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT ${fields.map(f=>a+'.'+f).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2))`;
const scope='dbo.test_crm_order_opening_scope',manifest='dbo.test_crm_order_opening_manifest',definitions='dbo.test_crm_order_opening_definitions';
const scopeColumns=[
 ['source_id','nvarchar(50)','sourceId'],['source_stock_code','nvarchar(120)','stockCode'],['source_product_name','nvarchar(250)','productName'],
 ['product_id','bigint','nativeProductId'],['native_stock_code','nvarchar(50)','nativeStockCode'],['native_product_name','nvarchar(250)','nativeProductName'],
 ['price_id','bigint','nativePriceId'],['price_source_key','nvarchar(400)','priceSourceKey'],['source_unit_id','bigint','unitSourceId'],['main_unit_source_id','bigint','mainUnitSourceId'],
 ['price_tier','int','tier'],['currency','nvarchar(3)','currency'],['price_exact','decimal(28,8)','priceExact8'],['native_price','decimal(18,4)','nativePriceExact4'],
 ['unit','nvarchar(40)','unit'],['unit_factor','decimal(28,8)','factorExact8'],['product_binding_hash','char(64)','productBindingHash'],
 ['price_binding_hash','char(64)','priceBindingHash'],['native_price_row_hash','char(64)','nativePriceRowHash'],['evidence_sha256','char(64)','evidenceSha256'],
];
const scopeHash=rowHash('s',scopeColumns.map(c=>c[0]));
const scopeSeal=`LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT s.source_id,s.row_hash FROM ${scope} s ORDER BY s.source_id FOR JSON PATH)),2))`;
const preservedHash="SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(name,N'|',CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(object_id)),2),N'|',is_disabled,N'|',OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger'))),N';') WITHIN GROUP(ORDER BY name)),2) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' OR name LIKE N'immutable[_]operation[_]%' OR name LIKE N'immutable[_]accepted[_]%'";
const target=`IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${O.database}' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'${O.server}' THROW 51090,'CRM_TEST_DATABASE_REQUIRED',1;`;
export const CRM_OPENING_READY_SQL=`${target}
IF (${preservedHash})<>'9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E' THROW 51099,'CRM_TEST_OPENING_NOT_READY',1;
IF NOT EXISTS(SELECT 1 FROM erp_migration.runs WITH(HOLDLOCK) WHERE run_id=N'${O.runId}' AND status COLLATE Latin1_General_100_BIN2=N'COMMITTED' AND source_hash='${O.sourceHash}' AND plan_hash='${O.planHash}' AND source_as_of=N'${O.sourceAsOf}') THROW 51099,'CRM_TEST_OPENING_NOT_READY',1;
IF NOT EXISTS(SELECT 1 FROM erp_migration.accepted_price_manifest WITH(HOLDLOCK) WHERE run_id=N'${O.runId}' AND source_hash='${O.sourceHash}' AND plan_hash='${O.planHash}' AND bindings_hash='${O.bindingsHash}' AND source_as_of=N'${O.sourceAsOf}' AND sealed=1 AND product_count=16622 AND price_count=63774) OR (SELECT COUNT(*) FROM erp_migration.accepted_price_products)<>16622 OR (SELECT COUNT(*) FROM erp_migration.accepted_price_values)<>63774 THROW 51099,'CRM_TEST_OPENING_NOT_READY',1;
IF NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_manifest WITH(HOLDLOCK) WHERE run_id=N'${O.runId}' AND source_hash='${O.sourceHash}' AND plan_hash='${O.planHash}' AND source_as_of=N'${O.sourceAsOf}' AND sealed=1 AND seal_hash='${O.quarantineSeal}' AND source_rows=176 AND native_holds=172 AND not_present=4) THROW 51099,'CRM_TEST_OPENING_NOT_READY',1;
IF (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds WITH(HOLDLOCK))<>176 OR (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds WHERE native_id IS NOT NULL)<>172 OR (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds WHERE native_id IS NULL)<>4 OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE ${rowHash('h',holdFields)}<>LOWER(h.row_hash)) THROW 51099,'CRM_TEST_OPENING_NOT_READY',1;
IF LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT h.source_key,h.row_hash FROM erp_migration.operation_quarantine_holds h ORDER BY h.source_key FOR JSON PATH)),2))<>'${O.quarantineSeal}' OR (SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' AND is_disabled=0 AND OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger')=1)<>37 THROW 51099,'CRM_TEST_OPENING_NOT_READY',1;`;
const actorSql=permission=>`IF @crm_actor_id IS NULL OR LEN(@crm_actor_id) NOT BETWEEN 1 AND 80 OR NOT EXISTS(SELECT 1 FROM dbo.users u WITH(HOLDLOCK) JOIN dbo.roles r WITH(HOLDLOCK) ON r.id=u.role_id WHERE u.id=@actor_id AND u.is_active=1 AND (r.code COLLATE Latin1_General_100_BIN2 IN(N'admin',N'owner_manager',N'owner_partner') OR EXISTS(SELECT 1 FROM dbo.permissions a WITH(HOLDLOCK) WHERE a.role_id=u.role_id AND ((a.permission_key=N'sales.${permission}' AND (a.can_view=1 OR a.can_create=1 OR a.can_update=1 OR a.can_approve=1)) OR (a.permission_key IN(N'sales.draft.write',N'sales_invoices.manage') AND a.${permission==='create'?'can_create':'can_view'}=1))))) THROW 51094,'CRM_TEST_SCOPE_REQUIRED',1;
IF NOT EXISTS(SELECT 1 FROM dbo.customers WITH(HOLDLOCK) WHERE id=593 AND customer_code COLLATE Latin1_General_100_BIN2=N'TEST-V70-20260929-C' AND is_active=1 AND is_deleted=0) THROW 51094,'CRM_TEST_SCOPE_REQUIRED',1;`;
const operationalReady=`${CRM_OPENING_READY_SQL}
IF (SELECT COUNT(*) FROM ${manifest})<>1 OR NOT EXISTS(SELECT 1 FROM ${manifest} m WHERE m.id=1 AND m.mapping_hash=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',m.mapping_json),2)) AND m.scope_count BETWEEN 1 AND 50 AND m.scope_count=(SELECT COUNT(*) FROM ${scope}) AND m.scope_hash=${scopeSeal}) OR EXISTS(SELECT 1 FROM ${scope} s WHERE s.row_hash<>${scopeHash}) THROW 51099,'CRM_TEST_OPENING_NOT_READY',1;
IF (SELECT COUNT(*) FROM ${definitions})<>7 OR EXISTS(SELECT 1 FROM ${definitions} d LEFT JOIN sys.objects o ON o.object_id=OBJECT_ID(N'dbo.'+d.name) WHERE o.object_id IS NULL OR d.after_hash<>LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2)) OR (o.type=N'TR' AND OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled')<>0)) THROW 51099,'CRM_TEST_OPENING_NOT_READY',1;`;
// Mirrors the existing accepted-opening row hashes, alias uniqueness and exact
// native-price row lineage. The caller owns SERIALIZABLE until the draft commits.
export const CRM_OPENING_BINDING_SQL=`IF (SELECT COUNT(*) FROM #E02Selected)<>(SELECT COUNT(*) FROM #E02Selected q JOIN ${scope} s WITH(HOLDLOCK) ON s.product_id=q.product_id
JOIN erp_migration.accepted_price_products b WITH(HOLDLOCK) ON b.product_id=s.product_id
JOIN erp_migration.accepted_price_values v WITH(HOLDLOCK) ON v.price_id=s.price_id AND v.product_id=b.product_id
JOIN dbo.products p WITH(HOLDLOCK) ON p.id=b.product_id JOIN dbo.product_prices n WITH(HOLDLOCK) ON n.id=v.price_id
JOIN erp_migration.records r WITH(HOLDLOCK) ON r.run_id=N'${O.runId}' AND r.entity=N'products' AND r.source_key=b.product_source_key
JOIN erp_migration.records pr WITH(HOLDLOCK) ON pr.run_id=N'${O.runId}' AND pr.entity=N'prices' AND pr.source_key=v.price_source_key
WHERE s.source_id=N'vega-'+b.source_id AND b.product_source_key=N'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/'+b.source_id
AND ${binary('s.source_stock_code','b.stock_code')} AND ${binary('s.source_product_name','b.product_name')} AND ${binary('s.native_stock_code','p.stock_code')} AND ${binary('s.native_product_name','p.name')}
AND ${binary('p.stock_code','b.stock_code')} AND ${binary('p.name','b.product_name')} AND ${binary('p.source_record_key','b.native_source_key')} AND ${binary('p.currency_code','b.currency_code')}
AND p.is_active=1 AND p.is_deleted=0 AND p.unit=N'ADET' AND b.unit=N'ADET' AND s.unit=N'ADET' AND s.unit_factor=1
AND JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.unitStatus')=N'VERIFIED_ADET_FACTOR_1' AND TRY_CONVERT(decimal(28,8),JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.unitFactor'))=1
AND TRY_CONVERT(bigint,JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.mainUnitSourceId'))=b.main_unit_source_id AND s.main_unit_source_id=b.main_unit_source_id AND s.source_unit_id=b.main_unit_source_id
AND (SELECT COUNT(*) FROM dbo.product_source_aliases a WITH(HOLDLOCK) WHERE a.product_id=p.id)=1 AND (SELECT COUNT(*) FROM dbo.product_source_aliases a WITH(HOLDLOCK) WHERE CONVERT(varchar(80),a.source_product_id)=b.source_id)=1
AND EXISTS(SELECT 1 FROM dbo.product_source_aliases a WITH(HOLDLOCK) WHERE a.product_id=p.id AND CONVERT(varchar(80),a.source_product_id)=b.source_id)
AND LOWER(b.binding_hash)=s.product_binding_hash AND LOWER(v.binding_hash)=s.price_binding_hash AND LOWER(v.native_row_hash)=s.native_price_row_hash
AND ${rowHash('b',PRODUCT_HASH_FIELDS)}=LOWER(b.binding_hash) AND ${rowHash('v',PRICE_HASH_FIELDS)}=LOWER(v.binding_hash)
AND r.payload_hash=b.stage_payload_hash AND CONVERT(char(64),HASHBYTES('SHA2_256',r.payload_json),2)=b.stage_sql_hash AND pr.payload_hash=v.stage_payload_hash AND CONVERT(char(64),HASHBYTES('SHA2_256',pr.payload_json),2)=v.stage_sql_hash
AND v.product_source_key=b.product_source_key AND v.price_source_key=s.price_source_key AND v.price_type=N'sale' AND v.price_tier=1 AND s.price_tier=1 AND v.is_main_unit=1
AND v.source_unit_id=s.source_unit_id AND v.currency_code=s.currency AND v.price_exact=s.price_exact AND CONVERT(decimal(18,4),ROUND(v.price_exact,4))=s.native_price
AND v.price_source_key=b.product_source_key+N'/PRICE/sale/'+CONVERT(nvarchar(20),v.source_unit_id)+N'/1/'+v.currency_code
AND n.product_id=v.product_id AND n.price_type=N'sale' AND n.price_tier=v.price_tier AND n.currency_code=v.currency_code AND n.source_unit_id=v.source_unit_id AND n.price=v.price_exact
AND LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT n.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2))=LOWER(v.native_row_hash)
AND (SELECT COUNT(*) FROM dbo.product_prices z WITH(HOLDLOCK) WHERE z.product_id=v.product_id AND ${binary('z.price_type','v.price_type')} AND z.price_tier=v.price_tier AND ${binary('z.currency_code','v.currency_code')} AND z.source_unit_id=v.source_unit_id)=1) THROW 51097,'CRM_TEST_OPENING_BINDING_DRIFT',1;
IF EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WITH(HOLDLOCK) WHERE (h.entity=N'product' AND (h.native_id IN(SELECT product_id FROM #E02Selected) OR h.source_id IN(SELECT SUBSTRING(s.source_id,6,50) FROM ${scope} s JOIN #E02Selected q ON q.product_id=s.product_id))) OR (h.entity=N'customer' AND (h.native_id=593 OR h.native_entity_id IN(SELECT party_entity_id FROM dbo.customers WHERE id=593)))) THROW 51098,'CRM_TEST_PRODUCT_QUARANTINED',1;`;
const productSelect=`SELECT s.source_id sourceId,s.source_stock_code stockCode,s.source_product_name productName,s.currency,s.native_price unitPrice,CONVERT(varchar(20),s.product_id) erpProductId,CONVERT(varchar(20),s.product_id) nativeProductId,
N'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/'+SUBSTRING(s.source_id,6,50) productSourceKey,CONVERT(varchar(20),s.price_id) nativePriceId,s.price_source_key priceSourceKey,N'sale' type,CONVERT(varchar(20),s.source_unit_id) unitSourceId,CONVERT(bit,1) isMainUnit,s.price_tier tier,
CONVERT(varchar(100),s.price_exact) priceExact8,CONVERT(varchar(100),s.native_price) nativePriceExact4,CONVERT(varchar(20),s.main_unit_source_id) mainUnitSourceId,s.unit,CONVERT(varchar(100),s.unit_factor) factorExact8,
N'${O.runId}' runId,N'${O.sourceHash}' sourceHash,N'${O.planHash}' planHash,N'${O.sourceAsOf}' sourceAsOf FROM ${scope} s ORDER BY s.source_id;`;
export function buildCrmOpeningProcedures(){
 const context=`ALTER PROCEDURE dbo.usp_test_crm_order_context @actor_id BIGINT,@crm_actor_id NVARCHAR(80) WITH EXECUTE AS OWNER AS BEGIN
SET NOCOUNT ON; SET XACT_ABORT ON; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRY BEGIN TRANSACTION; ${actorSql('view')} ${operationalReady}
CREATE TABLE #E02Selected(product_id bigint PRIMARY KEY); INSERT #E02Selected SELECT product_id FROM ${scope}; ${CRM_OPENING_BINDING_SQL}
SELECT id,customer_code code,name,currency_code currency FROM dbo.customers WHERE id=593; ${productSelect}
COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH; END;`;
 const create=`ALTER PROCEDURE dbo.usp_test_crm_order_create @actor_id BIGINT,@crm_actor_id NVARCHAR(80),@request_id UNIQUEIDENTIFIER,@conversation_id NVARCHAR(20),@customer_id BIGINT,@exchange_rate DECIMAL(18,8),@items_json NVARCHAR(MAX),@payload_hash VARCHAR(64) WITH EXECUTE AS OWNER AS BEGIN
SET NOCOUNT ON; SET XACT_ABORT ON; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE; ${target}
IF @conversation_id IS NULL OR @customer_id IS NULL OR @crm_actor_id IS NULL OR @payload_hash IS NULL OR @exchange_rate IS NULL OR @items_json IS NULL OR @conversation_id<>N'55' OR @customer_id<>593 OR @request_id IS NULL OR LEN(@crm_actor_id) NOT BETWEEN 1 AND 80 OR LEN(@payload_hash)<>64 OR @payload_hash LIKE '%[^0-9a-f]%' OR @exchange_rate<=0 OR @exchange_rate>10000 OR DATALENGTH(@items_json)>65536 OR ISJSON(@items_json)<>1 OR LEFT(LTRIM(@items_json),1)<>N'[' THROW 51091,'CRM_TEST_LINES_INVALID',1;
DECLARE @lines TABLE(source_id nvarchar(50),stock_code nvarchar(120),quantity int,unit_price decimal(18,4),currency nvarchar(3),product_id bigint,product_name nvarchar(250),native_stock_code nvarchar(50));
IF (SELECT COUNT(*) FROM OPENJSON(@items_json)) NOT BETWEEN 1 AND 50 OR EXISTS(SELECT 1 FROM OPENJSON(@items_json) j WHERE j.type<>5 OR EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key] NOT IN(N'sourceId',N'stockCode',N'quantity',N'unitPrice',N'currency')) OR (SELECT COUNT(*) FROM OPENJSON(j.value))<>5 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) WHERE [key]='quantity' AND [type]=2) OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) WHERE [key]='unitPrice' AND [type]=2)) THROW 51091,'CRM_TEST_LINES_INVALID',1;
IF EXISTS(SELECT 1 FROM OPENJSON(@items_json) WITH(sourceId nvarchar(max),stockCode nvarchar(max),quantity nvarchar(max),unitPrice nvarchar(max),currency nvarchar(max)) j WHERE sourceId IS NULL OR LEN(sourceId)>50 OR sourceId NOT LIKE N'vega-[1-9]%' OR SUBSTRING(sourceId,6,50) LIKE '%[^0-9]%' OR TRY_CONVERT(bigint,SUBSTRING(sourceId,6,50)) IS NULL OR LEN(stockCode)>120 OR LEN(currency)<>3 OR TRY_CONVERT(int,quantity) IS NULL OR TRY_CONVERT(decimal(38,8),quantity) IS NULL OR TRY_CONVERT(decimal(38,8),quantity)<>TRY_CONVERT(int,quantity) OR TRY_CONVERT(decimal(18,4),unitPrice) IS NULL OR TRY_CONVERT(decimal(38,10),unitPrice) IS NULL OR TRY_CONVERT(decimal(38,10),unitPrice)<>TRY_CONVERT(decimal(18,4),unitPrice)) THROW 51091,'CRM_TEST_LINES_INVALID',1;
INSERT @lines(source_id,stock_code,quantity,unit_price,currency) SELECT sourceId,stockCode,quantity,unitPrice,currency FROM OPENJSON(@items_json) WITH(sourceId nvarchar(50),stockCode nvarchar(120),quantity int,unitPrice decimal(18,4),currency nvarchar(3));
IF EXISTS(SELECT 1 FROM @lines WHERE source_id IS NULL OR stock_code IS NULL OR quantity IS NULL OR quantity NOT BETWEEN 1 AND 9999 OR unit_price IS NULL OR unit_price<0 OR unit_price>1000000 OR currency IS NULL OR currency NOT IN(N'TRY',N'USD',N'EUR')) OR (SELECT COUNT(DISTINCT source_id) FROM @lines)<>(SELECT COUNT(*) FROM @lines) OR (SELECT COUNT(DISTINCT stock_code) FROM @lines)<>(SELECT COUNT(*) FROM @lines) OR (SELECT COUNT(DISTINCT currency) FROM @lines)<>1 THROW 51091,'CRM_TEST_LINES_INVALID',1;
DECLARE @currency nvarchar(3)=(SELECT TOP(1) currency FROM @lines),@total decimal(18,4)=(SELECT SUM(CONVERT(decimal(18,4),quantity)*unit_price) FROM @lines);
IF (@currency=N'TRY' AND @exchange_rate<>1) OR @total>10000000000 OR @total*@exchange_rate>10000000000 THROW 51091,'CRM_TEST_LINES_INVALID',1;
BEGIN TRY BEGIN TRANSACTION;
DECLARE @lock int,@resource nvarchar(255)=N'TEST-CRM-ORDER-'+CONVERT(nvarchar(36),@request_id); EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @lock<0 THROW 51095,'CRM_TEST_LOCK_TIMEOUT',1;
${actorSql('create')}
-- Historical UUID replay precedes every new accepted-opening/scope check.
IF EXISTS(SELECT 1 FROM dbo.test_crm_order_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@request_id) BEGIN
IF NOT EXISTS(SELECT 1 FROM dbo.test_crm_order_requests WHERE request_id=@request_id AND actor_id=@actor_id AND ${binary('crm_actor_id','@crm_actor_id')} AND conversation_id=@conversation_id AND customer_id=@customer_id AND peer=N'905387217733' AND payload_hash=@payload_hash AND ${binary('items_json','@items_json')} AND exchange_rate=@exchange_rate) THROW 51093,'CRM_TEST_REQUEST_CONFLICT',1;
COMMIT; EXEC dbo.usp_test_crm_order_read @actor_id,@crm_actor_id,@request_id; RETURN; END;
${operationalReady}
UPDATE l SET product_id=s.product_id,product_name=s.native_product_name,native_stock_code=s.native_stock_code FROM @lines l JOIN ${scope} s WITH(HOLDLOCK) ON ${binary('s.source_id','l.source_id')} AND ${binary('s.source_stock_code','l.stock_code')} AND s.currency=l.currency AND s.native_price=l.unit_price;
IF EXISTS(SELECT 1 FROM @lines WHERE product_id IS NULL) THROW 51092,'CRM_TEST_PRODUCT_MAPPING_REQUIRED',1;
CREATE TABLE #E02Selected(product_id bigint PRIMARY KEY); INSERT #E02Selected SELECT product_id FROM @lines; ${CRM_OPENING_BINDING_SQL}
DECLARE @order_id bigint,@document_no nvarchar(30)=N'CRM-'+LEFT(REPLACE(CONVERT(nvarchar(36),@request_id),N'-',N''),26);
INSERT dbo.sales_orders(document_no,document_date,customer_id,status,customer_currency,document_currency,exchange_rate_snapshot,description,subtotal,discount_rate,discount_total,grand_total,amount_try,created_by)
SELECT @document_no,CONVERT(date,SYSUTCDATETIME()),593,N'draft',currency_code,@currency,@exchange_rate,N'CRM TEST · konuşma 55 · '+@payload_hash,@total,0,0,@total,ROUND(@total*@exchange_rate,4),@actor_id FROM dbo.customers WHERE id=593;
SET @order_id=SCOPE_IDENTITY(); DECLARE @created TABLE(item_id bigint,product_id bigint);
INSERT dbo.sales_order_items(sales_order_id,product_id,stock_code_snapshot,product_name_snapshot,quantity,currency_code,unit_price,line_total) OUTPUT inserted.id,inserted.product_id INTO @created SELECT @order_id,product_id,native_stock_code,product_name,quantity,currency,unit_price,quantity*unit_price FROM @lines;
INSERT dbo.test_crm_order_requests(request_id,actor_id,crm_actor_id,conversation_id,peer,customer_id,payload_hash,items_json,exchange_rate,order_id) VALUES(@request_id,@actor_id,@crm_actor_id,N'55',N'905387217733',593,@payload_hash,@items_json,@exchange_rate,@order_id);
INSERT dbo.test_crm_order_request_lines(request_id,item_id,source_id,source_stock_code) SELECT @request_id,c.item_id,l.source_id,l.stock_code FROM @created c JOIN @lines l ON l.product_id=c.product_id;
INSERT dbo.test_crm_order_opening_lines(request_id,item_id,source_id,scope_row_hash,price_exact,native_price,price_id,price_source_key) SELECT @request_id,c.item_id,s.source_id,s.row_hash,s.price_exact,s.native_price,s.price_id,s.price_source_key FROM @created c JOIN ${scope} s ON s.product_id=c.product_id;
DECLARE @audit_json nvarchar(max)=(SELECT CONVERT(nvarchar(36),@request_id) requestId,@crm_actor_id crmActorId,N'55' conversationId,N'905387217733' peer,@payload_hash payloadHash,@order_id orderId,@currency currency,@total grandTotal,CAST(0 AS bit) stockEffect,CAST(0 AS bit) ledgerEffect FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,after_json,reason,source) VALUES(@actor_id,N'sales_order_created',N'sales_order',@order_id,@audit_json,N'CRM TEST draft only; verified CRM actor '+@crm_actor_id,N'crm-test');
COMMIT; EXEC dbo.usp_test_crm_order_read @actor_id,@crm_actor_id,@request_id;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH; END;`;
 return {context,create};
}
const immutable=(name,table)=>`CREATE TRIGGER dbo.${name} ON ${table} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM inserted) OR EXISTS(SELECT 1 FROM deleted) THROW 51099,'CRM_TEST_OPENING_IMMUTABLE',1; END;`;
const guards=()=>[
 ['crm_opening_immutable_scope',immutable('crm_opening_immutable_scope',scope)],
 ['crm_opening_immutable_manifest',immutable('crm_opening_immutable_manifest',manifest)],
 ['crm_opening_immutable_definitions',immutable('crm_opening_immutable_definitions',definitions)],
 ['crm_opening_append_lines',`CREATE TRIGGER dbo.crm_opening_append_lines ON dbo.test_crm_order_opening_lines WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM deleted) THROW 51099,'CRM_TEST_OPENING_IMMUTABLE',1;
IF EXISTS(SELECT 1 FROM inserted i WHERE NOT EXISTS(SELECT 1 FROM ${scope} s JOIN dbo.test_crm_order_request_lines l ON l.request_id=i.request_id AND l.item_id=i.item_id AND l.source_id=s.source_id JOIN dbo.test_crm_order_requests r ON r.request_id=l.request_id JOIN dbo.sales_order_items n ON n.id=l.item_id AND n.sales_order_id=r.order_id AND n.product_id=s.product_id WHERE s.source_id=i.source_id AND s.row_hash=i.scope_row_hash AND s.price_exact=i.price_exact AND s.native_price=i.native_price AND s.price_id=i.price_id AND s.price_source_key=i.price_source_key AND n.unit_price=s.native_price AND n.currency_code=s.currency AND r.customer_id=593 AND r.conversation_id=N'55' AND r.peer=N'905387217733')) THROW 51097,'CRM_TEST_OPENING_BINDING_DRIFT',1; END;`],
];
// Recovery changes definitions only. The immutable companion and every old/new
// request, draft and provenance row stay in place for either direction.
export function normalizeCrmRecoveryDefinition(definition,name){
 if(!['usp_test_crm_order_context','usp_test_crm_order_create','usp_test_crm_order_read'].includes(name)||typeof definition!=='string')throw Error('CRM_TEST_RECOVERY_HEADER_UNSUPPORTED');
 const header=definition.match(/^(\s*)(CREATE\s+OR\s+ALTER|CREATE|ALTER)(\s+)(PROC(?:EDURE)?)(\s+)([^\s(]+)/i);
 if(!header||![`dbo.${name}`,`[dbo].[${name}]`,`dbo.[${name}]`,`[dbo].${name}`].some(x=>x.toLowerCase()===header[6].toLowerCase()))throw Error('CRM_TEST_RECOVERY_HEADER_UNSUPPORTED');
 return /^CREATE$/i.test(header[2])?definition.slice(0,header[1].length)+'ALTER'+definition.slice(header[1].length+6):definition;
}
// Confirmed on the named TEST SQL Server: an ALTER is executable SQL, while
// OBJECT_DEFINITION stores the same procedure with its CREATE verb restored.
// Nothing after that verb is normalized; whitespace and body remain exact.
export function persistedCrmProcedureDefinition(definition,name){
 normalizeCrmRecoveryDefinition(definition,name);
 return definition.replace(/^(\s*)ALTER(?=\s+PROC(?:EDURE)?\s)/i,'$1CREATE');
}
export function buildTestCrmOrderRecoverySql({direction}={}){
 if(!['before','after'].includes(direction))throw Error('CRM_OPENING_RECOVERY_DIRECTION_REQUIRED');
 const procedures=buildCrmOpeningProcedures(),known=[['usp_test_crm_order_context',procedures.context],['usp_test_crm_order_create',procedures.create],...guards()];
 const checkAfter=`IF EXISTS(SELECT 1 FROM ${definitions} d WHERE d.after_hash<>LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name))),2))) THROW 51099,'CRM_TEST_RECOVERY_AFTER_MISMATCH',1;`;
 const checkBefore=`IF EXISTS(SELECT 1 FROM @restore d WHERE d.recovery_hash<>LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name))),2))) THROW 51099,'CRM_TEST_RECOVERY_BEFORE_MISMATCH',1;`;
 const prepare=['context','create'].map(k=>`SELECT @original=before_definition FROM ${definitions} WHERE name=N'usp_test_crm_order_${k}';
SET @scan=REPLACE(REPLACE(REPLACE(@original,CHAR(13),N' '),CHAR(10),N' '),CHAR(9),N' '); SET @first=PATINDEX(N'%[^ ]%',@scan); SET @tail=LTRIM(@scan);
SET @verb=LEFT(@tail,CHARINDEX(N' ',@tail+N' ')-1); SET @tail=LTRIM(SUBSTRING(@tail,LEN(@verb)+1,2147483647)); SET @compound=0;
IF @verb COLLATE Latin1_General_100_CI_AS=N'CREATE' AND LEFT(@tail,3) COLLATE Latin1_General_100_CI_AS=N'OR ' BEGIN SET @tail=LTRIM(SUBSTRING(@tail,3,2147483647)); IF LEFT(@tail,6) COLLATE Latin1_General_100_CI_AS<>N'ALTER ' THROW 51099,'CRM_TEST_RECOVERY_HEADER_UNSUPPORTED',1; SET @tail=LTRIM(SUBSTRING(@tail,6,2147483647)); SET @compound=1; END;
SET @kind=LEFT(@tail,CHARINDEX(N' ',@tail+N' ')-1); SET @tail=LTRIM(SUBSTRING(@tail,LEN(@kind)+1,2147483647)); SET @object=LEFT(@tail,CHARINDEX(N' ',@tail+N' ')-1);
IF @verb COLLATE Latin1_General_100_CI_AS NOT IN(N'CREATE',N'ALTER') OR @kind COLLATE Latin1_General_100_CI_AS NOT IN(N'PROC',N'PROCEDURE') OR @object COLLATE Latin1_General_100_CI_AS NOT IN(N'dbo.usp_test_crm_order_${k}',N'[dbo].[usp_test_crm_order_${k}]',N'dbo.[usp_test_crm_order_${k}]',N'[dbo].usp_test_crm_order_${k}') THROW 51099,'CRM_TEST_RECOVERY_HEADER_UNSUPPORTED',1;
SET @statement=CASE WHEN @verb COLLATE Latin1_General_100_CI_AS=N'CREATE' AND @compound=0 THEN STUFF(@original,@first,6,N'ALTER') ELSE @original END;
SET @stored_statement=CASE WHEN @compound=0 THEN STUFF(@statement,@first,5,N'CREATE') ELSE @statement END;
INSERT @restore VALUES(N'usp_test_crm_order_${k}',@statement,LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',@statement),2)),LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',@stored_statement),2)));`).join('\n');
 return `-- Offline E02 definition-only recovery: ${direction}. Root executes only if needed.
SET NOCOUNT ON; SET XACT_ABORT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON; SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF;
${target} IF COALESCE(IS_SRVROLEMEMBER('sysadmin'),0)<>1 THROW 51099,'CRM_TEST_INSTALL_OWNER_REQUIRED',1;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRY BEGIN TRANSACTION;
DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @lock<0 THROW 51095,'CRM_TEST_LOCK_TIMEOUT',1;
${CRM_OPENING_READY_SQL}
IF OBJECT_ID(N'${definitions}',N'U') IS NULL OR (SELECT COUNT(*) FROM ${definitions} WITH(HOLDLOCK))<>7 OR EXISTS(SELECT 1 FROM ${definitions} WHERE name NOT IN(N'usp_test_crm_order_context',N'usp_test_crm_order_create',N'usp_test_crm_order_read',N'crm_opening_immutable_scope',N'crm_opening_immutable_manifest',N'crm_opening_immutable_definitions',N'crm_opening_append_lines')) THROW 51099,'CRM_TEST_RECOVERY_METADATA_INVALID',1;
IF EXISTS(SELECT 1 FROM ${definitions} d WHERE OBJECT_ID(N'dbo.'+d.name) IS NULL OR OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name)) IS NULL OR (d.name LIKE N'usp[_]%' AND OBJECTPROPERTY(OBJECT_ID(N'dbo.'+d.name),'IsProcedure')<>1) OR (d.name LIKE N'crm[_]%' AND OBJECTPROPERTY(OBJECT_ID(N'dbo.'+d.name),'IsTrigger')<>1)) THROW 51099,'CRM_TEST_RECOVERY_METADATA_INVALID',1;
${known.map(([name,sql])=>`IF NOT EXISTS(SELECT 1 FROM ${definitions} WHERE name=N'${name}' AND after_hash='${storedSha(name,sql)}') THROW 51099,'CRM_TEST_RECOVERY_METADATA_INVALID',1;`).join('\n')}
IF EXISTS(SELECT 1 FROM ${definitions} d WHERE (d.name LIKE N'usp[_]%' AND (d.before_definition IS NULL OR d.before_hash IS NULL OR d.before_hash<>LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',d.before_definition),2)))) OR (d.name LIKE N'crm[_]%' AND (d.before_definition IS NOT NULL OR d.before_hash IS NOT NULL OR OBJECTPROPERTY(OBJECT_ID(N'dbo.'+d.name),'ExecIsTriggerDisabled')<>0 OR d.after_hash<>LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name))),2))))) OR NOT EXISTS(SELECT 1 FROM ${definitions} WHERE name=N'usp_test_crm_order_read' AND before_hash=after_hash) THROW 51099,'CRM_TEST_RECOVERY_METADATA_INVALID',1;
IF (SELECT COUNT(*) FROM ${manifest})<>1 OR NOT EXISTS(SELECT 1 FROM ${manifest} m WITH(HOLDLOCK) WHERE m.id=1 AND m.mapping_hash=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',m.mapping_json),2)) AND m.scope_count=(SELECT COUNT(*) FROM ${scope}) AND m.scope_hash=${scopeSeal}) OR EXISTS(SELECT 1 FROM ${scope} s WITH(HOLDLOCK) WHERE s.row_hash<>${scopeHash}) THROW 51099,'CRM_TEST_RECOVERY_METADATA_INVALID',1;
-- Preserve exact stored originals. Only bare CREATE's verb becomes ALTER in the
-- executable statement has its own hash. SQL Server persists the CREATE verb,
-- so OBJECT_DEFINITION is compared against the separately calculated stored hash.
DECLARE @restore TABLE(name sysname PRIMARY KEY,recovery_definition nvarchar(max),execution_hash char(64),recovery_hash char(64));
DECLARE @statement nvarchar(max),@stored_statement nvarchar(max),@original nvarchar(max),@scan nvarchar(max),@tail nvarchar(max),@first int,@verb nvarchar(20),@kind nvarchar(20),@object nvarchar(256),@compound bit;
${prepare}
${direction==='before'?checkAfter:checkBefore}
IF NOT EXISTS(SELECT 1 FROM ${definitions} d WHERE d.name=N'usp_test_crm_order_read' AND d.before_hash=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name))),2))) THROW 51099,'CRM_TEST_RECOVERY_READ_MISMATCH',1;
-- The unchanged read procedure stays byte-for-byte; no unnecessary ALTER.
${['context','create'].map(k=>direction==='after'?`SET @statement=${quote(procedures[k])}; EXEC sys.sp_executesql @statement;`:`SELECT @statement=recovery_definition FROM @restore WHERE name=N'usp_test_crm_order_${k}'; EXEC sys.sp_executesql @statement;`).join('\n')}
${direction==='before'?checkBefore:checkAfter}
COMMIT; SELECT N'PASS_CRM_OPENING_RECOVERY_${direction.toUpperCase()}' result,CAST(0 AS bit) dataDeleted,CAST(0 AS bit) databaseRestored; SELECT name,execution_hash executableRecoveryHash,recovery_hash storedRecoveryHash FROM @restore;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
`;
}
export function buildTestCrmOrdersSql({baseline=null,mapping=null}={}){
 const before=baseline==null?null:normalizeCrmOpeningBaseline(baseline),data=mapping==null?null:normalizeCrmOpeningMapping(mapping);
 if((before===null)!==(data===null))throw Error('CRM_OPENING_METADATA_PAIR_REQUIRED');
 const payload=data?JSON.stringify(data):null,procedures=buildCrmOpeningProcedures(),objects=[['usp_test_crm_order_context',procedures.context],['usp_test_crm_order_create',procedures.create],...guards()];
 const permissionChecks=['context','create','read'].map(k=>`IF NOT EXISTS(SELECT 1 FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'dbo.usp_test_crm_order_${k}') AND grantee_principal_id=DATABASE_PRINCIPAL_ID(N'melisa_sirket_sales_test_20260929_01') AND permission_name=N'EXECUTE' AND state=N'G') THROW 51099,'CRM_TEST_EXISTING_EXECUTE_REQUIRED',1;`).join('\n');
 return `-- Generated offline E02 TEST companion. Unconfigured committed template fails closed.
-- Root renders actual verified hash/mapping metadata outside Git before any install.
SET NOCOUNT ON; SET XACT_ABORT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON; SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF;
DECLARE @mapping_json nvarchar(max)=${payload?quote(payload):'NULL'},@baseline_json nvarchar(max)=${before?quote(JSON.stringify(before)):'NULL'};
IF @mapping_json IS NULL OR @baseline_json IS NULL THROW 51099,'CRM_TEST_ACTUAL_INSTALL_METADATA_REQUIRED',1;
${target} IF COALESCE(IS_SRVROLEMEMBER('sysadmin'),0)<>1 THROW 51099,'CRM_TEST_INSTALL_OWNER_REQUIRED',1;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRY BEGIN TRANSACTION;
DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @lock<0 THROW 51095,'CRM_TEST_LOCK_TIMEOUT',1;
${CRM_OPENING_READY_SQL}
IF DATABASE_PRINCIPAL_ID(N'melisa_sirket_sales_test_20260929_01') IS NULL OR OBJECT_ID(N'dbo.test_crm_order_product_scope',N'U') IS NULL OR OBJECT_ID(N'dbo.test_crm_order_requests',N'U') IS NULL OR OBJECT_ID(N'dbo.test_crm_order_request_lines',N'U') IS NULL THROW 51099,'CRM_TEST_LEGACY_CONTRACT_REQUIRED',1;
${permissionChecks}
CREATE TABLE #E02Selected(product_id bigint PRIMARY KEY);
IF OBJECT_ID(N'${manifest}') IS NOT NULL BEGIN
${operationalReady}
IF NOT EXISTS(SELECT 1 FROM ${manifest} WHERE mapping_hash=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',@mapping_json),2))) THROW 51099,'CRM_TEST_EXISTING_INSTALL_MISMATCH',1;
INSERT #E02Selected SELECT product_id FROM ${scope}; ${CRM_OPENING_BINDING_SQL}
COMMIT; SELECT N'PASS_IDENTICAL_NOOP' result,0 writes; RETURN; END;
IF OBJECT_ID(N'${scope}') IS NOT NULL OR OBJECT_ID(N'${definitions}') IS NOT NULL OR OBJECT_ID(N'dbo.test_crm_order_opening_lines') IS NOT NULL OR EXISTS(SELECT 1 FROM sys.objects WHERE name LIKE N'crm[_]opening[_]%') THROW 51099,'CRM_TEST_UNKNOWN_PARTIAL_INSTALL',1;
${['context','create','read'].map(k=>`IF COALESCE(LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_test_crm_order_${k}'))),2)),'')<>JSON_VALUE(@baseline_json,'$.procedures.${k}') THROW 51099,'CRM_TEST_OLD_DEFINITION_MISMATCH',1;`).join('\n')}
CREATE TABLE ${manifest}(id int PRIMARY KEY CHECK(id=1),mapping_json nvarchar(max) NOT NULL,mapping_hash char(64) NOT NULL,scope_hash char(64) NOT NULL,scope_count int NOT NULL);
CREATE TABLE ${definitions}(name sysname PRIMARY KEY,before_definition nvarchar(max) NULL,before_hash char(64) NULL,after_hash char(64) NOT NULL);
CREATE TABLE ${scope}(${scopeColumns.map(([name,type])=>name+' '+type+' NOT NULL').join(',')},row_hash char(64) NOT NULL,PRIMARY KEY(source_id),UNIQUE(source_stock_code),UNIQUE(product_id),UNIQUE(price_id),FOREIGN KEY(product_id) REFERENCES dbo.products(id),FOREIGN KEY(price_id) REFERENCES dbo.product_prices(id));
CREATE TABLE dbo.test_crm_order_opening_lines(request_id uniqueidentifier NOT NULL REFERENCES dbo.test_crm_order_requests(request_id),item_id bigint NOT NULL REFERENCES dbo.sales_order_items(id),source_id nvarchar(50) NOT NULL REFERENCES ${scope}(source_id),scope_row_hash char(64) NOT NULL,price_exact decimal(28,8) NOT NULL,native_price decimal(18,4) NOT NULL,price_id bigint NOT NULL,price_source_key nvarchar(400) NOT NULL,PRIMARY KEY(request_id,item_id));
INSERT ${scope}(${scopeColumns.map(c=>c[0]).join(',')},row_hash) SELECT ${scopeColumns.map(c=>'s.'+c[0]).join(',')},${scopeHash} FROM OPENJSON(@mapping_json,'$.products') WITH(${scopeColumns.map(([name,type,key])=>name+' '+type+" '$."+key+"'").join(',')}) s;
IF (SELECT COUNT(*) FROM ${scope}) NOT BETWEEN 1 AND 50 THROW 51099,'CRM_TEST_ACTUAL_INSTALL_METADATA_REQUIRED',1;
INSERT ${manifest} SELECT 1,@mapping_json,LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',@mapping_json),2)),${scopeSeal},(SELECT COUNT(*) FROM ${scope});
INSERT ${definitions}(name,before_definition,before_hash,after_hash) SELECT name,OBJECT_DEFINITION(object_id),LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(object_id)),2)),LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(object_id)),2)) FROM sys.procedures WHERE schema_id=SCHEMA_ID(N'dbo') AND name IN(N'usp_test_crm_order_context',N'usp_test_crm_order_create',N'usp_test_crm_order_read');
-- Scope is validated before any procedure replacement. No native-card DML.
INSERT #E02Selected SELECT product_id FROM ${scope}; ${CRM_OPENING_BINDING_SQL}
${objects.map(([name,sql])=>name.startsWith('usp_')?`UPDATE ${definitions} SET after_hash='${storedSha(name,sql)}' WHERE name=N'${name}';`:`INSERT ${definitions}(name,before_definition,before_hash,after_hash) VALUES(N'${name}',NULL,NULL,'${sha(sql)}');`).join('\n')}
${objects.map(([,sql])=>`EXEC sys.sp_executesql ${quote(sql)};`).join('\n')}
-- The legacy read procedure is retained byte-for-byte. Existing UUID rows survive.
${[scope,manifest,definitions,'dbo.test_crm_order_opening_lines'].map(t=>`DENY SELECT,INSERT,UPDATE,DELETE ON OBJECT::${t} TO [melisa_sirket_sales_test_20260929_01];`).join('\n')}
${operationalReady} ${permissionChecks}
COMMIT; SELECT N'PASS_INSTALLED_CRM_OPENING' result,(SELECT COUNT(*) FROM ${scope}) mappedProducts;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
-- Recovery: exact before_definition/before_hash and after_hash are retained above.
-- Owner may restore only the two changed definitions after matching current hashes.
-- Keep all old/new UUID requests, lines, drafts and companion evidence; no DB restore,
-- DELETE, table DROP, scalar price overwrite or accepted/quarantine seal replacement.
`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--write')fs.writeFileSync(new URL('./enable-test-crm-orders.sql',import.meta.url),buildTestCrmOrdersSql());
 else{
  if(args.length!==6||args[0]!=='--baseline-json'||args[2]!=='--mapping-json'||args[4]!=='--output'||args.filter((_,i)=>i%2===1).some(p=>!path.isAbsolute(p)))throw Error('CRM_OPENING_OFFLINE_ARGUMENTS_REQUIRED');
  const repo=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),output=path.resolve(args[5]);
  const relative=path.relative(repo,output);if(!relative||!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))throw Error('CRM_OPENING_PRIVATE_OUTPUT_OUTSIDE_REPO_REQUIRED');
  const read=p=>{const stat=fs.statSync(p);if(!stat.isFile()||stat.size>65536)throw Error('CRM_OPENING_METADATA_FILE_INVALID');return JSON.parse(fs.readFileSync(p,'utf8'));};
  fs.writeFileSync(output,buildTestCrmOrdersSql({baseline:read(args[1]),mapping:read(args[3])}),{flag:'wx'});
 }
}
