// Offline companion source builder. Root owns TEST application; no SQL connection.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {identity} from './enable-test-purchase-batches.mjs';
const quote=s=>"N'"+s.replaceAll("'","''")+"'";
export const ORIGINAL_CHECK="([source_type]=N'goods_receipt' OR [source_type]=N'sales_invoice' OR [source_type]=N'purchase_invoice' OR [source_type]=N'stock_adjustment' OR [source_type]=N'terminal_sync' OR [source_type]=N'stock_count' OR [source_type]=N'invoice_return' OR [source_type]=N'invoice_return_cancel' OR [source_record_key] IS NOT NULL AND [source_type]=N'vega_history' AND [affects_inventory]=(0) OR ([source_type]=N'uninvoiced_return_cancel' OR [source_type]=N'stock_count_cancel') AND [source_id] IS NOT NULL AND [created_by]=(16) AND ([product_id]=(301989) OR [product_id]=(301986) OR [product_id]=(301990) OR [product_id]=(301988)))";
export const ORIGINAL_HASH='EEC8D85A7E9C95110A3E2C28BAA78DECE0A3E4C72E8EEB084BD157B9D74F40D6';
export const BATCH_CHECK="([source_type]=N'goods_receipt_batch' AND [movement_type]=N'in' AND [source_id]>0 AND [created_by]=16 AND [supplier_id]=13370 AND [currency_code]=N'TRY' AND [warehouse_name]=N'TEST V70 MAL KABUL DEPOSU' AND [source_warehouse]=N'TEST-V70-GOODS-WH' AND [source_record_key] IS NULL AND [migration_run_id] IS NULL AND [affects_inventory]=1 AND [quantity_in] BETWEEN 1 AND 5 AND [quantity_in]=FLOOR([quantity_in]) AND [quantity_out]=0 AND [quantity_net]=[quantity_in] AND (([product_id]=301985 AND [unit_cost_try]=60 AND [unit_price]=60 AND [average_cost_try_after]=60 AND [amount_try]=[quantity_in]*60) OR ([product_id]=325503 AND [unit_cost_try]=80 AND [unit_price]=80 AND [average_cost_try_after]=80 AND [amount_try]=[quantity_in]*80)))";
const preservedHash="SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(name,N'|',CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(object_id)),2),N'|',is_disabled,N'|',OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger'))),N';') WITHIN GROUP(ORDER BY name)),2) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' OR name LIKE N'immutable[_]operation[_]%' OR name LIKE N'immutable[_]accepted[_]%'";
const gates=`${identity}
IF NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_manifest WHERE run_id=N'VEGA-OPENING-TEST-20261004-06' AND sealed=1 AND seal_hash='69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7' AND source_rows=176 AND native_holds=172 AND not_present=4) THROW 51071,'TEST_BATCH_STOCK_QUARANTINE_NOT_READY',1;
IF (SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' AND is_disabled=0 AND OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger')=1)<>37 THROW 51071,'TEST_BATCH_STOCK_FIRST_GUARD_DRIFT',1;
IF (${preservedHash})<>'9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E' THROW 51071,'TEST_BATCH_STOCK_PRESERVED_GUARD_DRIFT',1;
IF (SELECT COUNT(*) FROM dbo.test_purchase_batch_guard_manifest)<>15 OR EXISTS(SELECT 1 FROM dbo.test_purchase_batch_guard_manifest m LEFT JOIN sys.triggers t ON t.object_id=OBJECT_ID(N'dbo.'+m.name) WHERE t.object_id IS NULL OR t.is_disabled=1 OR m.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2)) THROW 51071,'TEST_BATCH_STOCK_INSTALLED_GUARD_DRIFT',1;
IF (SELECT COUNT(*) FROM dbo.test_purchase_batch_scope)<>2 OR (SELECT COUNT(*) FROM dbo.test_purchase_batch_scope WHERE supplier_id=13370 AND warehouse_id=1 AND unit=N'ADET' AND unit_factor=1 AND ((product_id=301985 AND stock_code=N'TEST-V70-GOODS-P' AND unit_cost=60) OR (product_id=325503 AND stock_code=N'TEST-FINISH-GOODS-P2' AND unit_cost=80)))<>2 OR EXISTS(SELECT 1 FROM dbo.test_purchase_batch_scope z JOIN dbo.products p ON p.id=z.product_id JOIN dbo.suppliers s ON s.id=z.supplier_id WHERE p.stock_code<>z.stock_code OR p.supplier_id<>z.supplier_id OR p.unit<>N'ADET' OR p.currency_code<>N'TRY' OR p.average_cost_try<>z.unit_cost OR p.is_active<>1 OR p.is_deleted<>0 OR s.supplier_code<>N'TEST-V70-GOODS-S' OR s.currency_code<>N'TRY' OR s.is_active<>1 OR s.is_deleted<>0 OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE (h.entity=N'product' AND h.native_id=z.product_id) OR (h.entity=N'supplier' AND h.native_id=z.supplier_id))) THROW 51071,'TEST_BATCH_STOCK_SCOPE_DRIFT',1;`;
const guard=`CREATE TRIGGER dbo.immutable_test_batch_stock_source_upgrade ON dbo.test_purchase_batch_stock_source_upgrade WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON; ${identity} IF EXISTS(SELECT 1 FROM inserted) OR EXISTS(SELECT 1 FROM deleted) THROW 51071,'TEST_BATCH_STOCK_MANIFEST_IMMUTABLE',1; END;`;
export function buildStockSourceSql(){return `-- Generated offline. Companion to the installed 15-guard C01/C02 schema.
-- Original stock source CHECK expression is retained verbatim as the first OR branch.
SET NOCOUNT ON; SET XACT_ABORT ON;
SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_WARNINGS ON;
SET ANSI_PADDING ON; SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
${identity}
IF COALESCE(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 THROW 51071,'TEST_BATCH_STOCK_INSTALLER_ADMIN_REQUIRED',1;
IF OBJECT_ID(N'dbo.test_purchase_batch_guard_manifest',N'U') IS NULL OR OBJECT_ID(N'dbo.test_purchase_batch_scope',N'U') IS NULL THROW 51071,'TEST_BATCH_STOCK_BASE_INSTALL_REQUIRED',1;
${gates}
IF OBJECT_ID(N'dbo.test_purchase_batch_stock_source_upgrade',N'U') IS NOT NULL BEGIN
 IF (SELECT COUNT(*) FROM dbo.test_purchase_batch_stock_source_upgrade)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.test_purchase_batch_stock_source_upgrade m JOIN sys.check_constraints c ON c.name=m.constraint_name AND c.parent_object_id=OBJECT_ID(N'dbo.stock_movements') JOIN sys.triggers t ON t.object_id=OBJECT_ID(N'dbo.immutable_test_batch_stock_source_upgrade') WHERE m.id=1 AND m.before_hash='${ORIGINAL_HASH}' AND m.before_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',m.before_definition),2) AND m.after_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',c.definition),2) AND m.guard_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2) AND c.is_disabled=0 AND c.is_not_trusted=0 AND t.is_disabled=0) THROW 51071,'TEST_BATCH_STOCK_UPGRADE_DRIFT',1;
 SELECT N'PASS_IDENTICAL_NOOP' status,0 writes; RETURN; END;
IF OBJECT_ID(N'dbo.immutable_test_batch_stock_source_upgrade') IS NOT NULL THROW 51071,'TEST_BATCH_STOCK_UNKNOWN_PARTIAL_UPGRADE',1;
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.stock_movements') AND name=N'CK_stock_movements_source_type_native' AND is_disabled=0 AND is_not_trusted=0 AND CONVERT(varchar(64),HASHBYTES('SHA2_256',definition),2)='${ORIGINAL_HASH}') THROW 51071,'TEST_BATCH_STOCK_UNKNOWN_CHECK_BASELINE',1;
BEGIN TRY BEGIN TRANSACTION;
DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @lock<0 THROW 51071,'TEST_BATCH_STOCK_INSTALL_LOCK_FAILED',1;
${gates}
DECLARE @before nvarchar(max)=(SELECT definition FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.stock_movements') AND name=N'CK_stock_movements_source_type_native');
IF CONVERT(varchar(64),HASHBYTES('SHA2_256',@before),2)<>'${ORIGINAL_HASH}' THROW 51071,'TEST_BATCH_STOCK_CHECK_LOCKED_DRIFT',1;
CREATE TABLE dbo.test_purchase_batch_stock_source_upgrade(id int PRIMARY KEY CHECK(id=1),constraint_name sysname NOT NULL,before_definition nvarchar(max) NOT NULL,before_hash varchar(64) NOT NULL,after_hash varchar(64) NOT NULL,guard_hash varchar(64) NOT NULL);
ALTER TABLE dbo.stock_movements DROP CONSTRAINT CK_stock_movements_source_type_native;
ALTER TABLE dbo.stock_movements WITH CHECK ADD CONSTRAINT CK_stock_movements_source_type_native CHECK (${ORIGINAL_CHECK} OR CASE WHEN ${BATCH_CHECK} THEN 1 ELSE 0 END=1);
ALTER TABLE dbo.stock_movements WITH CHECK CHECK CONSTRAINT CK_stock_movements_source_type_native;
INSERT dbo.test_purchase_batch_stock_source_upgrade SELECT 1,N'CK_stock_movements_source_type_native',@before,'${ORIGINAL_HASH}',CONVERT(varchar(64),HASHBYTES('SHA2_256',definition),2),CONVERT(varchar(64),HASHBYTES('SHA2_256',${quote(guard)}),2) FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.stock_movements') AND name=N'CK_stock_movements_source_type_native' AND is_disabled=0 AND is_not_trusted=0;
IF (SELECT COUNT(*) FROM dbo.test_purchase_batch_stock_source_upgrade)<>1 THROW 51071,'TEST_BATCH_STOCK_CHECK_NOT_TRUSTED',1;
EXEC sys.sp_executesql ${quote(guard)};
DENY SELECT,INSERT,UPDATE,DELETE ON dbo.test_purchase_batch_stock_source_upgrade TO [melisa_sirket_sales_test_20260929_01];
${gates}
IF NOT EXISTS(SELECT 1 FROM dbo.test_purchase_batch_stock_source_upgrade m JOIN sys.triggers t ON t.object_id=OBJECT_ID(N'dbo.immutable_test_batch_stock_source_upgrade') WHERE m.guard_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2) AND t.is_disabled=0) THROW 51071,'TEST_BATCH_STOCK_MANIFEST_GUARD_DRIFT',1;
COMMIT; SELECT N'PASS_INSTALLED_STOCK_SOURCE_SCOPE' status,2 fixture_products,1 changed_check;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
-- Rollback ownership: exact before_definition/hash retained in immutable manifest.
-- Restore only when current after_hash matches, under the same owner-reviewed lock;
-- WITH CHECK must pass all existing rows. Posted batch movements require application
-- reversal first. Never delete movement history or disable CHECK/trigger protection.
`}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]!=='--write')throw Error('OFFLINE_SQL_SOURCE_WRITE_FLAG_REQUIRED');
 fs.writeFileSync(new URL('./enable-test-purchase-batch-stock-source.sql',import.meta.url),buildStockSourceSql());
}
