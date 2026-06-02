IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, 'This migration can only run on MELISA_ERP_V2.', 1;
END;
GO

IF OBJECT_ID(N'dbo.customer_movements', N'U') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'dbo.CK_customer_movements_type', N'C') IS NOT NULL
        ALTER TABLE dbo.customer_movements DROP CONSTRAINT CK_customer_movements_type;

    ALTER TABLE dbo.customer_movements
        ADD CONSTRAINT CK_customer_movements_type CHECK (
            movement_type IN (N'sales_invoice', N'sales_invoice_cancel', N'collection')
        );
END;
GO

IF OBJECT_ID(N'dbo.supplier_movements', N'U') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'dbo.CK_supplier_movements_type', N'C') IS NOT NULL
        ALTER TABLE dbo.supplier_movements DROP CONSTRAINT CK_supplier_movements_type;

    ALTER TABLE dbo.supplier_movements
        ADD CONSTRAINT CK_supplier_movements_type CHECK (
            movement_type IN (N'purchase_invoice', N'purchase_invoice_cancel', N'payment')
        );
END;
GO
