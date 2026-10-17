// Source-only C07 fixture contact installer. Root applies the exact TEST script.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CONTACT_READY_SQL,CONTACT_GET_PROC,CONTACT_SET_PROC,CONTACT_TABLE,CONTACT_ROW_GUARD,CONTACT_JOURNAL_GUARD,CONTACT_GET_SQL,CONTACT_SET_SQL,CONTACT_ROW_GUARD_SQL,CONTACT_JOURNAL_GUARD_SQL,CONTACT_GET_HASH,CONTACT_SET_HASH,CONTACT_ROW_GUARD_HASH,CONTACT_JOURNAL_GUARD_HASH} from '../../apps/api/src/services/testSupplierContactStore.mjs';
const quote=s=>"N'"+s.replaceAll("'","''")+"'";
export const CONTACT_TABLE_SQL=`CREATE TABLE ${CONTACT_TABLE}(
request_id uniqueidentifier NOT NULL CONSTRAINT PK_test_supplier_contact_requests PRIMARY KEY,
supplier_id bigint NOT NULL,actor_id bigint NOT NULL,operation nvarchar(30) NOT NULL,
payload_json nvarchar(max) NOT NULL,payload_hash char(64) NOT NULL,
before_json nvarchar(max) NOT NULL,before_revision char(64) NOT NULL,
phone nvarchar(40) NULL,city nvarchar(100) NULL,country nvarchar(100) NULL,
state varchar(12) NOT NULL,after_json nvarchar(max) NULL,after_revision char(64) NULL,response_json nvarchar(max) NULL,
created_at datetime2(3) NOT NULL,completed_at datetime2(3) NULL,
CONSTRAINT CK_test_supplier_contact_scope CHECK(supplier_id=13373 AND actor_id=16 AND operation=N'supplier_contact_updated'),
CONSTRAINT CK_test_supplier_contact_phase CHECK((state='reserved' AND after_json IS NULL AND after_revision IS NULL AND response_json IS NULL AND completed_at IS NULL) OR (state='completed' AND after_json IS NOT NULL AND after_revision IS NOT NULL AND response_json IS NOT NULL AND completed_at IS NOT NULL)),
CONSTRAINT CK_test_supplier_contact_json CHECK(ISJSON(payload_json)=1 AND ISJSON(before_json)=1 AND (after_json IS NULL OR ISJSON(after_json)=1) AND (response_json IS NULL OR ISJSON(response_json)=1))
);`;
export const CONTACT_TABLE_HASH=createHash('sha256').update(CONTACT_TABLE_SQL,'utf16le').digest('hex').toUpperCase();
const objects=[[CONTACT_ROW_GUARD,CONTACT_ROW_GUARD_SQL,CONTACT_ROW_GUARD_HASH,'TR'],[CONTACT_JOURNAL_GUARD,CONTACT_JOURNAL_GUARD_SQL,CONTACT_JOURNAL_GUARD_HASH,'TR'],[CONTACT_GET_PROC,CONTACT_GET_SQL,CONTACT_GET_HASH,'P'],[CONTACT_SET_PROC,CONTACT_SET_SQL,CONTACT_SET_HASH,'P']];
const definitions=objects.map(([name,,hash,type])=>`IF OBJECT_ID(N'${name}',N'${type}') IS NULL OR COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${name}'))),2),'')<>'${hash}'${type==='TR'?` OR COALESCE(OBJECTPROPERTY(OBJECT_ID(N'${name}'),'ExecIsTriggerDisabled'),1)<>0`:''} THROW 51077,'TEST_SUPPLIER_CONTACT_DEFINITION_MISMATCH',1;`).join('\n');
const cols=[['request_id','uniqueidentifier',16,0],['supplier_id','bigint',8,0],['actor_id','bigint',8,0],['operation','nvarchar',60,0],['payload_json','nvarchar',-1,0],['payload_hash','char',64,0],['before_json','nvarchar',-1,0],['before_revision','char',64,0],['phone','nvarchar',80,1],['city','nvarchar',200,1],['country','nvarchar',200,1],['state','varchar',12,0],['after_json','nvarchar',-1,1],['after_revision','char',64,1],['response_json','nvarchar',-1,1],['created_at','datetime2',7,0],['completed_at','datetime2',7,1]];
const expected=cols.map(([n,t,l,b])=>`(N'${n}',N'${t}',${l},${b})`).join(',');
export const CONTACT_SCHEMA_VERIFY_SQL=`IF OBJECT_ID(N'${CONTACT_TABLE}',N'U') IS NULL OR (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'${CONTACT_TABLE}'))<>17 OR EXISTS(SELECT v.name,v.type,v.length,v.nullable FROM(VALUES${expected})v(name,type,length,nullable) EXCEPT SELECT name,TYPE_NAME(user_type_id),max_length,CONVERT(int,is_nullable) FROM sys.columns WHERE object_id=OBJECT_ID(N'${CONTACT_TABLE}')) OR EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'${CONTACT_TABLE}') AND (is_identity=1 OR is_computed=1 OR (TYPE_NAME(user_type_id)=N'datetime2' AND scale<>3))) THROW 51077,'TEST_SUPPLIER_CONTACT_SCHEMA_MISMATCH',1;
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=1 AND major_id=OBJECT_ID(N'${CONTACT_TABLE}') AND minor_id=0 AND name=N'contact_schema_sha256' AND CONVERT(varchar(64),value)='${CONTACT_TABLE_HASH}') OR (SELECT COUNT(*) FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'${CONTACT_TABLE}'))<>3 OR EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'${CONTACT_TABLE}') AND (is_disabled=1 OR is_not_trusted=1 OR name NOT IN(N'CK_test_supplier_contact_scope',N'CK_test_supplier_contact_phase',N'CK_test_supplier_contact_json'))) OR NOT EXISTS(SELECT 1 FROM sys.key_constraints k JOIN sys.index_columns ic ON ic.object_id=k.parent_object_id AND ic.index_id=k.unique_index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE k.parent_object_id=OBJECT_ID(N'${CONTACT_TABLE}') AND k.type=N'PK' AND c.name=N'request_id' AND ic.key_ordinal=1) THROW 51077,'TEST_SUPPLIER_CONTACT_SCHEMA_MISMATCH',1;
IF EXISTS(SELECT v.name,v.hash FROM(VALUES(N'CK_test_supplier_contact_json',N'C369D1B9918A8DC0EB166AB742C0B81039DBF66251B0C4EB5522CB87D034E8C3'),(N'CK_test_supplier_contact_phase',N'EE729975DEAA144486448FED08F60E82CA2283223528EF5223C24B84AED1BB06'),(N'CK_test_supplier_contact_scope',N'9AF511646C809DB95D808971231692AE1BECB15262B0CC054778B5F6DF91E3B7'))v(name,hash) EXCEPT SELECT name,CONVERT(varchar(64),HASHBYTES('SHA2_256',definition),2) FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'${CONTACT_TABLE}')) OR (SELECT COUNT(*) FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID(N'${CONTACT_TABLE}'))<>1 OR (SELECT COUNT(*) FROM sys.index_columns WHERE object_id=OBJECT_ID(N'${CONTACT_TABLE}') AND key_ordinal>0)<>1 OR (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID(N'${CONTACT_TABLE}') AND index_id>0)<>1 OR EXISTS(SELECT 1 FROM sys.default_constraints WHERE parent_object_id=OBJECT_ID(N'${CONTACT_TABLE}')) OR EXISTS(SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(N'${CONTACT_TABLE}')) OR EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'${CONTACT_TABLE}') AND collation_name IS NOT NULL AND collation_name<>CONVERT(nvarchar(128),DATABASEPROPERTYEX(DB_NAME(),'Collation'))) THROW 51077,'TEST_SUPPLIER_CONTACT_SCHEMA_MISMATCH',1;`;
const grants=[CONTACT_GET_PROC,CONTACT_SET_PROC].map(n=>`IF NOT EXISTS(SELECT 1 FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'${n}') AND grantee_principal_id=DATABASE_PRINCIPAL_ID(N'melisa_sirket_sales_test_20260929_01') AND permission_name=N'EXECUTE' AND state=N'G') THROW 51077,'TEST_SUPPLIER_CONTACT_EXECUTE_MISMATCH',1;`).join('\n')+`\nIF (SELECT COUNT(*) FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'${CONTACT_TABLE}') AND grantee_principal_id=DATABASE_PRINCIPAL_ID(N'melisa_sirket_sales_test_20260929_01') AND minor_id=0 AND permission_name IN(N'SELECT',N'INSERT',N'UPDATE',N'DELETE') AND state=N'D')<>4 OR EXISTS(SELECT 1 FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'${CONTACT_TABLE}') AND grantee_principal_id=DATABASE_PRINCIPAL_ID(N'melisa_sirket_sales_test_20260929_01') AND (minor_id<>0 OR state<>N'D')) THROW 51077,'TEST_SUPPLIER_CONTACT_DENIAL_MISMATCH',1;`;
export function buildSupplierContactSql(){return `-- C07 only synthetic supplier13373 contact fields, actor16. No legacy guard change.
-- User authorized TEST supplier.view/edit; permission changes are separate root work.
SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON;
SET CONCAT_NULL_YIELDS_NULL ON; SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\\MELISADEV' OR COALESCE(IS_SRVROLEMEMBER('sysadmin'),0)<>1 THROW 51077,'TEST_SUPPLIER_CONTACT_INSTALL_TARGET_REQUIRED',1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
 IF @lock<0 THROW 51077,'TEST_SUPPLIER_CONTACT_INSTALL_LOCK_REQUIRED',1;
 ${CONTACT_READY_SQL}
 IF DATABASE_PRINCIPAL_ID(N'melisa_sirket_sales_test_20260929_01') IS NULL THROW 51077,'TEST_SUPPLIER_CONTACT_EXISTING_PRINCIPAL_REQUIRED',1;
 IF OBJECT_ID(N'${CONTACT_TABLE}') IS NOT NULL BEGIN
 ${CONTACT_SCHEMA_VERIFY_SQL}
 ${definitions}
 ${grants}
 IF EXISTS(SELECT 1 FROM ${CONTACT_TABLE} WHERE state<>N'completed') THROW 51077,'TEST_SUPPLIER_CONTACT_INCOMPLETE_REQUEST',1;
 COMMIT; SELECT N'NOOP' result,0 writes; RETURN;
 END;
 ${objects.map(([n])=>`IF OBJECT_ID(N'${n}') IS NOT NULL THROW 51077,'TEST_SUPPLIER_CONTACT_UNKNOWN_EXISTING_OBJECT',1;`).join('\n')}
 EXEC sys.sp_executesql ${quote(CONTACT_TABLE_SQL)};
 EXEC sys.sp_addextendedproperty @name=N'contact_schema_sha256',@value=N'${CONTACT_TABLE_HASH}',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'test_supplier_contact_requests';
 ${objects.map(([,body])=>`EXEC sys.sp_executesql ${quote(body)};`).join('\n')}
 GRANT EXECUTE ON OBJECT::${CONTACT_GET_PROC} TO [melisa_sirket_sales_test_20260929_01];
 GRANT EXECUTE ON OBJECT::${CONTACT_SET_PROC} TO [melisa_sirket_sales_test_20260929_01];
 DENY SELECT,INSERT,UPDATE,DELETE ON OBJECT::${CONTACT_TABLE} TO [melisa_sirket_sales_test_20260929_01];
 ${CONTACT_SCHEMA_VERIFY_SQL}
 ${definitions}
 ${grants}
 ${CONTACT_READY_SQL}
 COMMIT; SELECT N'INSTALLED' result,5 writes;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
-- Root rollback: preserve request audit evidence first. Remove ONLY exact-hash
-- new C07 objects/table when no contact effect remains; never alter baseline guards.
-- All installer DDL and grants are atomic; failure restores the previous state.
`;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){fs.writeFileSync(new URL('./enable-test-supplier-contact.sql',import.meta.url),buildSupplierContactSql());process.stdout.write(`CONTACT_GET_SHA256 ${CONTACT_GET_HASH}\nCONTACT_SET_SHA256 ${CONTACT_SET_HASH}\n`);}
