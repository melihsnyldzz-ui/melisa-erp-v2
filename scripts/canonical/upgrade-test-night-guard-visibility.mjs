// Offline controlled upgrade; no SQL/network calls. Original installed pins are independent constants.
import {sqlHash} from './enable-test-night-workflows.mjs';
export const VISIBILITY_PREVIOUS_GUARDS=Object.freeze({
  "test_guard_products": "86E1F7863AFB3D988B1A4D9F9D4E6D1636DE9A445A795AB79E4D929C5D10E782",
  "test_guard_customers": "120E406E48A055BAD7DCA2A058DEBA7767BAD0287D7A7641E8CB00DE183263B2",
  "test_guard_finance_accounts": "E0CD2B7D069BD36CCEAE2213929D49C73E4A97FB9CCF6357D382993C5C6AD7A5",
  "test_guard_sales_invoices": "B8ABE1166B18531FBFEBFE7FEDB8E71604DFE3A5FCAC3DEDA3A55011FCB3EB72",
  "test_guard_sales_invoice_items": "F47E46AD1ABA24B5FF0754FCFC7F507F57B36BEDF5E44211B7EDB1BD1B76ED6C",
  "test_guard_stock_movements": "FE79FAE9102A457890D828870B030179F934895519018250A55D6EAE011A1037",
  "test_guard_customer_movements": "4B10B9A7A25C67FE578778D770E6CD8F47A8BEBBF122B21BDFCB8007EEDC5C6C",
  "test_guard_finance_movements": "F24ECF07CFB104F6A780237744A68CCB1C9B88A03F3BB66201307A9BEBF74D95",
  "test_guard_audit_logs": "72C7133DD8C3139027F7EA9247C7265128468B31CAAACFEA98CDEAF7A654419E"
});
export function buildVisibilityUpgrade(build){
 if(!build||build.wrapped?.length!==9||new Set(build.wrapped.map(o=>o.name)).size!==9||build.wrapped.some(o=>!Object.hasOwn(VISIBILITY_PREVIOUS_GUARDS,o.name)))throw Error('EXACT_NIGHT_GUARDS_REQUIRED');
 const quote=s=>"N'"+s.replaceAll("'","''")+"'";
 const fail="THROW 51106,'WORK_VISIBILITY_UPGRADE_REJECTED',1;";
 const statements=["SET XACT_ABORT ON;SET NOCOUNT ON;IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' OR IS_SRVROLEMEMBER(N'sysadmin')<>1 "+fail,"BEGIN TRY BEGIN TRANSACTION;DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @lock<0 "+fail,"EXEC dbo.work_trade_assert_ready;"];
 for(const o of build.wrapped)statements.push("IF CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo."+o.name+"'))),2)<>"+quote(VISIBILITY_PREVIOUS_GUARDS[o.name])+" "+fail);
 const metadata=[['test_batch_guard_test_purchase_batch_guard_manifest','test_purchase_batch_guard_manifest'],['c03_immutable_test_purchase_fx_guard_manifest','test_purchase_fx_guard_manifest'],['work_night_guard_work_trade_guard_manifest','work_trade_guard_manifest']];
 for(const [guard,table]of metadata)statements.push('DISABLE TRIGGER dbo.'+guard+' ON dbo.'+table+';');
 statements.push('DECLARE @definition nvarchar(max);');
 for(const o of build.wrapped){const hash=sqlHash(o.after);if(hash===VISIBILITY_PREVIOUS_GUARDS[o.name]||!o.after.includes('EXEC dbo.work_trade_assert_ready')||!o.after.endsWith(o.before.slice(o.before.indexOf(' AS BEGIN')+' AS BEGIN'.length)))throw Error('LEGACY_BODY_OR_OWNER_CHECK_CHANGED');statements.push('SET @definition=REPLACE(CAST('+quote(o.after.replace(/^CREATE TRIGGER/,'ALTER TRIGGER'))+' AS nvarchar(max)),NCHAR(13)+NCHAR(10),NCHAR(10));EXEC sys.sp_executesql @definition;','UPDATE dbo.test_purchase_batch_guard_manifest SET after_hash='+quote(hash)+' WHERE name='+quote(o.name)+';','UPDATE dbo.test_purchase_fx_guard_manifest SET definition_hash='+quote(hash)+' WHERE name='+quote(o.name)+';','UPDATE dbo.work_trade_guard_manifest SET after_hash='+quote(hash)+' WHERE name='+quote(o.name)+';');}
 for(const [guard,table]of metadata)statements.push(`ENABLE TRIGGER dbo.${guard} ON dbo.${table};IF OBJECTPROPERTY(OBJECT_ID(N'dbo.${guard}'),'ExecIsTriggerDisabled')<>0 ${fail}`);
 statements.push("EXEC dbo.work_trade_assert_ready;COMMIT;SELECT N'PASS_NIGHT_VISIBILITY_UPGRADE' result;END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;");
 return statements.join('\n\n');
}
