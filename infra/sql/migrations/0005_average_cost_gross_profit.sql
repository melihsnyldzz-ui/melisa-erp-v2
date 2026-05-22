IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, 'This migration can run only on MELISA_ERP_V2.', 1;
END;
GO

IF COL_LENGTH(N'dbo.products', N'average_cost_try') IS NULL
BEGIN
    ALTER TABLE dbo.products
    ADD average_cost_try DECIMAL(18,4) NOT NULL
        CONSTRAINT DF_products_average_cost_try_m0005 DEFAULT (0);
END;
GO

IF COL_LENGTH(N'dbo.sales_invoice_items', N'average_cost_try_snapshot') IS NULL
BEGIN
    ALTER TABLE dbo.sales_invoice_items
    ADD average_cost_try_snapshot DECIMAL(18,4) NOT NULL
        CONSTRAINT DF_sales_invoice_items_average_cost_try_m0005 DEFAULT (0);
END;
GO

IF COL_LENGTH(N'dbo.sales_invoice_items', N'gross_profit_try') IS NULL
BEGIN
    ALTER TABLE dbo.sales_invoice_items
    ADD gross_profit_try DECIMAL(18,4) NOT NULL
        CONSTRAINT DF_sales_invoice_items_gross_profit_try DEFAULT (0);
END;
GO

IF COL_LENGTH(N'dbo.sales_invoice_items', N'gross_profit_rate') IS NULL
BEGIN
    ALTER TABLE dbo.sales_invoice_items
    ADD gross_profit_rate DECIMAL(18,6) NOT NULL
        CONSTRAINT DF_sales_invoice_items_gross_profit_rate DEFAULT (0);
END;
GO
