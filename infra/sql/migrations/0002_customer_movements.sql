IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, 'This migration can only run on MELISA_ERP_V2.', 1;
END;
GO

IF OBJECT_ID(N'dbo.customer_movements', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.customer_movements (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_customer_movements PRIMARY KEY,
        customer_id BIGINT NOT NULL,
        sales_invoice_id BIGINT NULL,
        movement_type NVARCHAR(40) NOT NULL,
        amount DECIMAL(18,4) NOT NULL,
        currency_code NVARCHAR(3) NOT NULL,
        balance_effect DECIMAL(18,4) NOT NULL,
        document_date DATE NOT NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_customer_movements_created_at DEFAULT (SYSUTCDATETIME()),
        created_by BIGINT NULL,
        CONSTRAINT FK_customer_movements_customers FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
        CONSTRAINT FK_customer_movements_sales_invoices FOREIGN KEY (sales_invoice_id) REFERENCES dbo.sales_invoices(id),
        CONSTRAINT CK_customer_movements_type CHECK (movement_type IN (N'sales_invoice'))
    );

    CREATE INDEX IX_customer_movements_customer_date
        ON dbo.customer_movements(customer_id, document_date);

    CREATE INDEX IX_customer_movements_sales_invoice
        ON dbo.customer_movements(sales_invoice_id);
END;
GO
