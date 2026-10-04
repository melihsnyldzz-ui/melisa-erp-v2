// Offline source builder. Application and database deployment belong to root.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SUPPLIER_CARD_PROC,SUPPLIER_CARD_PROC_SQL,SUPPLIER_CARD_PROC_HASH,SUPPLIER_CARD_READY_SQL,SUPPLIER_CARD_PRESERVED_SQL} from '../../apps/api/src/services/supplierCardReadStore.mjs';
const quote=s=>"N'"+s.replaceAll("'","''")+"'";
export function buildSupplierCardsSql(){return `-- C07 narrow owner read projection; no commercial DML, tables, or broad grants.
SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON;
SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\\MELISADEV' OR COALESCE(IS_SRVROLEMEMBER('sysadmin'),0)<>1 THROW 51076,'SUPPLIER_CARD_INSTALL_TARGET_REQUIRED',1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
 IF @lock<0 THROW 51076,'SUPPLIER_CARD_INSTALL_LOCK_REQUIRED',1;
 ${SUPPLIER_CARD_READY_SQL}
 IF DATABASE_PRINCIPAL_ID(N'melisa_sirket_sales_test_20260929_01') IS NULL THROW 51076,'SUPPLIER_CARD_EXISTING_PRINCIPAL_REQUIRED',1;
 IF OBJECT_ID(N'${SUPPLIER_CARD_PROC}') IS NOT NULL BEGIN
  IF OBJECT_ID(N'${SUPPLIER_CARD_PROC}',N'P') IS NULL OR COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${SUPPLIER_CARD_PROC}'))),2),'')<>'${SUPPLIER_CARD_PROC_HASH}' THROW 51076,'SUPPLIER_CARD_EXISTING_DEFINITION_MISMATCH',1;
  IF NOT EXISTS(SELECT 1 FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'${SUPPLIER_CARD_PROC}') AND grantee_principal_id=DATABASE_PRINCIPAL_ID(N'melisa_sirket_sales_test_20260929_01') AND permission_name=N'EXECUTE' AND state=N'G') THROW 51076,'SUPPLIER_CARD_EXISTING_EXECUTE_MISMATCH',1;
  COMMIT; SELECT N'NOOP' result,0 writes; RETURN;
 END;
 EXEC sys.sp_executesql ${quote(SUPPLIER_CARD_PROC_SQL)};
 GRANT EXECUTE ON OBJECT::${SUPPLIER_CARD_PROC} TO [melisa_sirket_sales_test_20260929_01];
 IF COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${SUPPLIER_CARD_PROC}'))),2),'')<>'${SUPPLIER_CARD_PROC_HASH}' THROW 51076,'SUPPLIER_CARD_INSTALLED_DEFINITION_MISMATCH',1;
 ${SUPPLIER_CARD_READY_SQL}
 IF (${SUPPLIER_CARD_PRESERVED_SQL})<>'9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E' THROW 51076,'SUPPLIER_CARD_PRESERVED_GUARD_DRIFT',1;
 COMMIT; SELECT N'INSTALLED' result,1 writes;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
-- Rollback: root removes only this newly installed procedure and its object EXECUTE
-- grant after verifying its exact hash; existing guards and commercial data untouched.
`;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){fs.writeFileSync(new URL('./enable-test-supplier-cards.sql',import.meta.url),buildSupplierCardsSql());process.stdout.write(`C07_READ_PROC_SHA256 ${SUPPLIER_CARD_PROC_HASH}\n`);}
