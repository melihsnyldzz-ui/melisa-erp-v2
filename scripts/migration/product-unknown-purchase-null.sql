-- Narrow lossless TEST schema adjustment: an unknown new-card purchase price
-- must be NULL. Existing values, precision, default and business rows are kept.
SET XACT_ABORT ON;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01'
 OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\MELISADEV'
 OR COALESCE(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1
 THROW 51832,'PRODUCT_NULL_WRONG_TEST_TARGET',1;
IF @@TRANCOUNT=0 THROW 51832,'PRODUCT_NULL_OWNER_TRANSACTION_REQUIRED',1;
IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.products') AND name=N'purchase_price'
 AND TYPE_NAME(user_type_id)=N'decimal' AND precision=18 AND scale=4 AND is_computed=0 AND is_identity=0)
 THROW 51832,'PRODUCT_NULL_SCHEMA_DRIFT',1;
IF EXISTS(SELECT 1 FROM sys.sql_expression_dependencies d JOIN sys.objects o ON o.object_id=d.referencing_id
 WHERE d.referenced_id=OBJECT_ID(N'dbo.products') AND d.is_schema_bound_reference=1
 AND(d.referenced_minor_id=0 OR d.referenced_minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.products'),N'purchase_price','ColumnId')))
 THROW 51832,'PRODUCT_NULL_SCHEMA_BOUND_DEPENDENCY',1;
IF EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.products') AND name=N'purchase_price' AND is_nullable=0)
 ALTER TABLE dbo.products ALTER COLUMN purchase_price decimal(18,4) NULL;
