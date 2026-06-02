IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, 'This migration can only run on MELISA_ERP_V2.', 1;
END;
GO

IF OBJECT_ID(N'dbo.sales_offers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sales_offers (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sales_offers PRIMARY KEY,
        document_no NVARCHAR(30) NOT NULL,
        document_date DATE NOT NULL,
        customer_id BIGINT NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_sales_offers_status DEFAULT (N'draft'),
        customer_currency NVARCHAR(3) NOT NULL CONSTRAINT DF_sales_offers_customer_currency DEFAULT (N'TRY'),
        document_currency NVARCHAR(3) NOT NULL CONSTRAINT DF_sales_offers_document_currency DEFAULT (N'TRY'),
        exchange_rate_snapshot DECIMAL(18,8) NOT NULL CONSTRAINT DF_sales_offers_exchange_rate DEFAULT (1),
        description NVARCHAR(500) NULL,
        subtotal DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_offers_subtotal DEFAULT (0),
        discount_rate DECIMAL(9,4) NOT NULL CONSTRAINT DF_sales_offers_discount_rate DEFAULT (0),
        discount_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_offers_discount_total DEFAULT (0),
        grand_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_offers_grand_total DEFAULT (0),
        amount_try DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_offers_amount_try DEFAULT (0),
        valid_until DATE NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_sales_offers_created_at DEFAULT (SYSUTCDATETIME()),
        created_by BIGINT NULL,
        updated_at DATETIME2(0) NULL,
        updated_by BIGINT NULL,
        row_version ROWVERSION NOT NULL,
        CONSTRAINT UQ_sales_offers_document_no UNIQUE (document_no),
        CONSTRAINT FK_sales_offers_customers FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
        CONSTRAINT CK_sales_offers_status CHECK (status IN (N'draft', N'sent', N'accepted', N'cancelled'))
    );
END;
GO

IF OBJECT_ID(N'dbo.sales_offer_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sales_offer_items (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sales_offer_items PRIMARY KEY,
        sales_offer_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        stock_code_snapshot NVARCHAR(50) NOT NULL,
        barcode_snapshot NVARCHAR(80) NULL,
        product_name_snapshot NVARCHAR(250) NOT NULL,
        quantity DECIMAL(18,3) NOT NULL,
        currency_code NVARCHAR(3) NOT NULL CONSTRAINT DF_sales_offer_items_currency_code DEFAULT (N'TRY'),
        unit_price DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_offer_items_unit_price DEFAULT (0),
        line_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_offer_items_line_total DEFAULT (0),
        note NVARCHAR(250) NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_sales_offer_items_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_sales_offer_items_sales_offers FOREIGN KEY (sales_offer_id) REFERENCES dbo.sales_offers(id) ON DELETE CASCADE,
        CONSTRAINT FK_sales_offer_items_products FOREIGN KEY (product_id) REFERENCES dbo.products(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.sales_orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sales_orders (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sales_orders PRIMARY KEY,
        document_no NVARCHAR(30) NOT NULL,
        document_date DATE NOT NULL,
        customer_id BIGINT NOT NULL,
        source_offer_id BIGINT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_sales_orders_status DEFAULT (N'draft'),
        customer_currency NVARCHAR(3) NOT NULL CONSTRAINT DF_sales_orders_customer_currency DEFAULT (N'TRY'),
        document_currency NVARCHAR(3) NOT NULL CONSTRAINT DF_sales_orders_document_currency DEFAULT (N'TRY'),
        exchange_rate_snapshot DECIMAL(18,8) NOT NULL CONSTRAINT DF_sales_orders_exchange_rate DEFAULT (1),
        description NVARCHAR(500) NULL,
        subtotal DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_orders_subtotal DEFAULT (0),
        discount_rate DECIMAL(9,4) NOT NULL CONSTRAINT DF_sales_orders_discount_rate DEFAULT (0),
        discount_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_orders_discount_total DEFAULT (0),
        grand_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_orders_grand_total DEFAULT (0),
        amount_try DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_orders_amount_try DEFAULT (0),
        delivery_note NVARCHAR(500) NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_sales_orders_created_at DEFAULT (SYSUTCDATETIME()),
        created_by BIGINT NULL,
        updated_at DATETIME2(0) NULL,
        updated_by BIGINT NULL,
        row_version ROWVERSION NOT NULL,
        CONSTRAINT UQ_sales_orders_document_no UNIQUE (document_no),
        CONSTRAINT FK_sales_orders_customers FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
        CONSTRAINT FK_sales_orders_sales_offers FOREIGN KEY (source_offer_id) REFERENCES dbo.sales_offers(id),
        CONSTRAINT CK_sales_orders_status CHECK (status IN (N'draft', N'confirmed', N'fulfilled', N'cancelled'))
    );
END;
GO

IF OBJECT_ID(N'dbo.sales_order_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sales_order_items (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sales_order_items PRIMARY KEY,
        sales_order_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        stock_code_snapshot NVARCHAR(50) NOT NULL,
        barcode_snapshot NVARCHAR(80) NULL,
        product_name_snapshot NVARCHAR(250) NOT NULL,
        quantity DECIMAL(18,3) NOT NULL,
        currency_code NVARCHAR(3) NOT NULL CONSTRAINT DF_sales_order_items_currency_code DEFAULT (N'TRY'),
        unit_price DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_order_items_unit_price DEFAULT (0),
        line_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_order_items_line_total DEFAULT (0),
        note NVARCHAR(250) NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_sales_order_items_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_sales_order_items_sales_orders FOREIGN KEY (sales_order_id) REFERENCES dbo.sales_orders(id) ON DELETE CASCADE,
        CONSTRAINT FK_sales_order_items_products FOREIGN KEY (product_id) REFERENCES dbo.products(id)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sales_offers_customer_date_status')
    CREATE INDEX IX_sales_offers_customer_date_status ON dbo.sales_offers(customer_id, document_date, status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sales_orders_customer_date_status')
    CREATE INDEX IX_sales_orders_customer_date_status ON dbo.sales_orders(customer_id, document_date, status);
GO
