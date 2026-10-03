-- Keep concurrent invoice snapshots within their own invoice's item range.
-- No business rows, document numbers or isolation settings are changed.
IF OBJECT_ID(N'dbo.sales_invoice_items', N'U') IS NULL
   OR OBJECT_ID(N'dbo.purchase_invoice_items', N'U') IS NULL
    THROW 51019, 'Invoice item tables are required before migration 0019', 1;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.sales_invoice_items') AND name=N'IX_sales_invoice_items_invoice_snapshot')
    CREATE NONCLUSTERED INDEX IX_sales_invoice_items_invoice_snapshot
    ON dbo.sales_invoice_items(sales_invoice_id, id)
    INCLUDE (product_id, stock_code_snapshot, barcode_snapshot, product_name_snapshot,
             quantity, currency_code, unit_price, line_total, average_cost_try_snapshot,
             gross_profit_try, gross_profit_rate, stock_status_snapshot, note);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.purchase_invoice_items') AND name=N'IX_purchase_invoice_items_invoice_snapshot')
    CREATE NONCLUSTERED INDEX IX_purchase_invoice_items_invoice_snapshot
    ON dbo.purchase_invoice_items(purchase_invoice_id, id)
    INCLUDE (product_id, stock_code_snapshot, barcode_snapshot, product_name_snapshot,
             quantity, currency_code, purchase_price, line_discount_rate, line_total,
             line_total_try, stock_effect_snapshot, note);
GO
