SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

IF DB_NAME() NOT IN (N'MELISA_ERP_FULL_TEST_20260916', N'MELISA_ERP_PROD_CANDIDATE_20260917_01')
  THROW 51000, 'LIVE_FIX_4_DATABASE_GUARD_FAILED', 1;

IF OBJECT_ID(N'dbo.sales_invoice_items', N'U') IS NULL
  THROW 51000, 'LIVE_FIX_4_SALES_ITEMS_TABLE_MISSING', 1;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.sales_invoice_items')
    AND name = N'IX_sales_invoice_items_invoice_id_id'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_sales_invoice_items_invoice_id_id
    ON dbo.sales_invoice_items (sales_invoice_id, id)
    INCLUDE (product_id, quantity);
END;

SELECT
  DB_NAME() AS database_name,
  i.name AS index_name,
  i.type_desc,
  i.is_disabled
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID(N'dbo.sales_invoice_items')
  AND i.name = N'IX_sales_invoice_items_invoice_id_id';
