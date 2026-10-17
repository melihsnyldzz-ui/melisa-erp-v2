SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'MELISA_ERP_FULL_TEST_20260916', N'MELISA_ERP_PROD_CANDIDATE_20260917_01')
  THROW 51000, 'LIVE_FIX_4_DATABASE_GUARD_FAILED', 1;

IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.sales_invoice_items')
    AND name = N'IX_sales_invoice_items_invoice_id_id'
)
BEGIN
  DROP INDEX IX_sales_invoice_items_invoice_id_id ON dbo.sales_invoice_items;
END;
