IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, 'This migration can only run on MELISA_ERP_V2.', 1;
END;
GO

IF COL_LENGTH(N'dbo.stock_movements', N'unit_price') IS NULL
BEGIN
    ALTER TABLE dbo.stock_movements
        ADD unit_price DECIMAL(18,4) NULL;
END;
GO

IF COL_LENGTH(N'dbo.stock_movements', N'currency_code') IS NULL
BEGIN
    ALTER TABLE dbo.stock_movements
        ADD currency_code NVARCHAR(3) NULL;
END;
GO

IF COL_LENGTH(N'dbo.stock_movements', N'amount_try') IS NULL
BEGIN
    ALTER TABLE dbo.stock_movements
        ADD amount_try DECIMAL(18,4) NULL;
END;
GO
