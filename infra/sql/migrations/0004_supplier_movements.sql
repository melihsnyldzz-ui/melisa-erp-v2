IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, 'This migration can only run on MELISA_ERP_V2.', 1;
END;
GO

IF OBJECT_ID(N'dbo.supplier_movements', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier_movements (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_supplier_movements PRIMARY KEY,
        supplier_id BIGINT NOT NULL,
        purchase_invoice_id BIGINT NULL,
        movement_type NVARCHAR(40) NOT NULL,
        amount DECIMAL(18,4) NOT NULL,
        currency_code NVARCHAR(3) NOT NULL,
        balance_effect DECIMAL(18,4) NOT NULL,
        document_date DATE NOT NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_supplier_movements_created_at DEFAULT (SYSUTCDATETIME()),
        created_by BIGINT NULL,
        CONSTRAINT FK_supplier_movements_suppliers FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
        CONSTRAINT FK_supplier_movements_purchase_invoices FOREIGN KEY (purchase_invoice_id) REFERENCES dbo.purchase_invoices(id),
        CONSTRAINT CK_supplier_movements_type CHECK (movement_type IN (N'purchase_invoice'))
    );

    CREATE INDEX IX_supplier_movements_supplier_date
        ON dbo.supplier_movements(supplier_id, document_date);

    CREATE INDEX IX_supplier_movements_purchase_invoice
        ON dbo.supplier_movements(purchase_invoice_id);
END;
GO
