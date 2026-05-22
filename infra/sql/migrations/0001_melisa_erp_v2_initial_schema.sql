/*
  Melisa ERP v2 initial database schema draft.
  Target database: MELISA_ERP_V2

  Safety:
  - Draft only. Review before running.
  - Do not run against Vega databases.
  - This script is not executed by the sprint.
*/

IF DB_ID(N'MELISA_ERP_V2') IS NULL
BEGIN
    CREATE DATABASE [MELISA_ERP_V2];
END;
GO

USE [MELISA_ERP_V2];
GO

CREATE TABLE dbo.roles (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
    code NVARCHAR(50) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(250) NULL,
    is_system_role BIT NOT NULL CONSTRAINT DF_roles_is_system_role DEFAULT (0),
    is_active BIT NOT NULL CONSTRAINT DF_roles_is_active DEFAULT (1),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_roles_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT UQ_roles_code UNIQUE (code)
);
GO

CREATE TABLE dbo.permissions (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_permissions PRIMARY KEY,
    role_id BIGINT NOT NULL,
    permission_key NVARCHAR(120) NOT NULL,
    can_view BIT NOT NULL CONSTRAINT DF_permissions_can_view DEFAULT (0),
    can_create BIT NOT NULL CONSTRAINT DF_permissions_can_create DEFAULT (0),
    can_update BIT NOT NULL CONSTRAINT DF_permissions_can_update DEFAULT (0),
    can_delete BIT NOT NULL CONSTRAINT DF_permissions_can_delete DEFAULT (0),
    can_approve BIT NOT NULL CONSTRAINT DF_permissions_can_approve DEFAULT (0),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_permissions_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT FK_permissions_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(id),
    CONSTRAINT UQ_permissions_role_key UNIQUE (role_id, permission_key)
);
GO

CREATE TABLE dbo.users (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    username NVARCHAR(80) NOT NULL,
    password_hash NVARCHAR(255) NULL,
    display_name NVARCHAR(150) NOT NULL,
    role_id BIGINT NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_users_is_active DEFAULT (1),
    last_login_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_users_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    updated_at DATETIME2(0) NULL,
    updated_by BIGINT NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT UQ_users_username UNIQUE (username),
    CONSTRAINT FK_users_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(id)
);
GO

CREATE TABLE dbo.products (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_products PRIMARY KEY,
    stock_code NVARCHAR(50) NOT NULL,
    name NVARCHAR(250) NOT NULL,
    category NVARCHAR(120) NULL,
    brand NVARCHAR(120) NULL,
    unit NVARCHAR(20) NOT NULL CONSTRAINT DF_products_unit DEFAULT (N'ADET'),
    currency_code NVARCHAR(3) NOT NULL CONSTRAINT DF_products_currency_code DEFAULT (N'TRY'),
    sales_price DECIMAL(18,4) NOT NULL CONSTRAINT DF_products_sales_price DEFAULT (0),
    purchase_price DECIMAL(18,4) NOT NULL CONSTRAINT DF_products_purchase_price DEFAULT (0),
    average_cost_try DECIMAL(18,4) NOT NULL CONSTRAINT DF_products_average_cost_try DEFAULT (0),
    current_stock_qty DECIMAL(18,3) NOT NULL CONSTRAINT DF_products_current_stock_qty DEFAULT (0),
    is_active BIT NOT NULL CONSTRAINT DF_products_is_active DEFAULT (1),
    is_deleted BIT NOT NULL CONSTRAINT DF_products_is_deleted DEFAULT (0),
    passive_at DATETIME2(0) NULL,
    passive_reason NVARCHAR(250) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_products_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    updated_at DATETIME2(0) NULL,
    updated_by BIGINT NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT UQ_products_stock_code UNIQUE (stock_code)
);
GO

CREATE TABLE dbo.product_barcodes (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_product_barcodes PRIMARY KEY,
    product_id BIGINT NOT NULL,
    barcode NVARCHAR(80) NOT NULL,
    barcode_type NVARCHAR(30) NOT NULL CONSTRAINT DF_product_barcodes_barcode_type DEFAULT (N'extra'),
    is_primary BIT NOT NULL CONSTRAINT DF_product_barcodes_is_primary DEFAULT (0),
    is_active BIT NOT NULL CONSTRAINT DF_product_barcodes_is_active DEFAULT (1),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_product_barcodes_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    updated_at DATETIME2(0) NULL,
    updated_by BIGINT NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT FK_product_barcodes_products FOREIGN KEY (product_id) REFERENCES dbo.products(id),
    CONSTRAINT CK_product_barcodes_type CHECK (barcode_type IN (N'primary', N'extra', N'package'))
);
GO

CREATE UNIQUE INDEX UX_product_barcodes_active_barcode
ON dbo.product_barcodes(barcode)
WHERE is_active = 1;
GO

CREATE TABLE dbo.product_images (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_product_images PRIMARY KEY,
    product_id BIGINT NOT NULL,
    file_path NVARCHAR(500) NULL,
    storage_key NVARCHAR(200) NULL,
    is_primary BIT NOT NULL CONSTRAINT DF_product_images_is_primary DEFAULT (0),
    sort_order INT NOT NULL CONSTRAINT DF_product_images_sort_order DEFAULT (0),
    is_active BIT NOT NULL CONSTRAINT DF_product_images_is_active DEFAULT (1),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_product_images_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    updated_at DATETIME2(0) NULL,
    updated_by BIGINT NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT FK_product_images_products FOREIGN KEY (product_id) REFERENCES dbo.products(id)
);
GO

CREATE TABLE dbo.customers (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_customers PRIMARY KEY,
    customer_code NVARCHAR(50) NOT NULL,
    name NVARCHAR(250) NOT NULL,
    phone NVARCHAR(50) NULL,
    email NVARCHAR(150) NULL,
    city NVARCHAR(100) NULL,
    country NVARCHAR(100) NULL,
    address NVARCHAR(500) NULL,
    currency_code NVARCHAR(3) NOT NULL CONSTRAINT DF_customers_currency_code DEFAULT (N'TRY'),
    customer_type NVARCHAR(30) NOT NULL CONSTRAINT DF_customers_customer_type DEFAULT (N'customer'),
    balance DECIMAL(18,4) NOT NULL CONSTRAINT DF_customers_balance DEFAULT (0),
    risk_limit DECIMAL(18,4) NOT NULL CONSTRAINT DF_customers_risk_limit DEFAULT (0),
    is_active BIT NOT NULL CONSTRAINT DF_customers_is_active DEFAULT (1),
    is_deleted BIT NOT NULL CONSTRAINT DF_customers_is_deleted DEFAULT (0),
    passive_at DATETIME2(0) NULL,
    passive_reason NVARCHAR(250) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_customers_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    updated_at DATETIME2(0) NULL,
    updated_by BIGINT NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT UQ_customers_customer_code UNIQUE (customer_code),
    CONSTRAINT CK_customers_customer_type CHECK (customer_type IN (N'customer', N'wholesale', N'retail', N'mixed'))
);
GO

CREATE TABLE dbo.suppliers (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_suppliers PRIMARY KEY,
    supplier_code NVARCHAR(50) NOT NULL,
    name NVARCHAR(250) NOT NULL,
    phone NVARCHAR(50) NULL,
    email NVARCHAR(150) NULL,
    city NVARCHAR(100) NULL,
    country NVARCHAR(100) NULL,
    address NVARCHAR(500) NULL,
    currency_code NVARCHAR(3) NOT NULL CONSTRAINT DF_suppliers_currency_code DEFAULT (N'TRY'),
    balance DECIMAL(18,4) NOT NULL CONSTRAINT DF_suppliers_balance DEFAULT (0),
    is_active BIT NOT NULL CONSTRAINT DF_suppliers_is_active DEFAULT (1),
    is_deleted BIT NOT NULL CONSTRAINT DF_suppliers_is_deleted DEFAULT (0),
    passive_at DATETIME2(0) NULL,
    passive_reason NVARCHAR(250) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_suppliers_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    updated_at DATETIME2(0) NULL,
    updated_by BIGINT NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT UQ_suppliers_supplier_code UNIQUE (supplier_code)
);
GO

CREATE TABLE dbo.terminal_devices (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_terminal_devices PRIMARY KEY,
    device_code NVARCHAR(80) NOT NULL,
    device_name NVARCHAR(150) NOT NULL,
    device_token_hash NVARCHAR(255) NULL,
    assigned_user_id BIGINT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_terminal_devices_is_active DEFAULT (1),
    last_sync_at DATETIME2(0) NULL,
    last_seen_at DATETIME2(0) NULL,
    offline_since_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_terminal_devices_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT UQ_terminal_devices_device_code UNIQUE (device_code),
    CONSTRAINT FK_terminal_devices_users FOREIGN KEY (assigned_user_id) REFERENCES dbo.users(id)
);
GO

CREATE TABLE dbo.currency_rates (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_currency_rates PRIMARY KEY,
    currency_code NVARCHAR(3) NOT NULL,
    rate_date DATE NOT NULL,
    rate_to_try DECIMAL(18,8) NOT NULL,
    source NVARCHAR(50) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_currency_rates_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    CONSTRAINT UQ_currency_rates_code_date UNIQUE (currency_code, rate_date)
);
GO

CREATE TABLE dbo.sales_invoices (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sales_invoices PRIMARY KEY,
    document_no NVARCHAR(30) NOT NULL,
    document_date DATE NOT NULL,
    customer_id BIGINT NOT NULL,
    terminal_device_id BIGINT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_sales_invoices_status DEFAULT (N'draft'),
    customer_currency NVARCHAR(3) NOT NULL,
    document_currency NVARCHAR(3) NOT NULL,
    exchange_rate_snapshot DECIMAL(18,8) NOT NULL CONSTRAINT DF_sales_invoices_exchange_rate DEFAULT (1),
    description NVARCHAR(500) NULL,
    subtotal DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_invoices_subtotal DEFAULT (0),
    discount_rate DECIMAL(9,4) NOT NULL CONSTRAINT DF_sales_invoices_discount_rate DEFAULT (0),
    discount_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_invoices_discount_total DEFAULT (0),
    grand_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_invoices_grand_total DEFAULT (0),
    amount_try DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_invoices_amount_try DEFAULT (0),
    estimated_profit_try DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_invoices_estimated_profit_try DEFAULT (0),
    finalized_at DATETIME2(0) NULL,
    cancelled_at DATETIME2(0) NULL,
    cancel_reason NVARCHAR(250) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_sales_invoices_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    updated_at DATETIME2(0) NULL,
    updated_by BIGINT NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT FK_sales_invoices_customers FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
    CONSTRAINT FK_sales_invoices_terminal_devices FOREIGN KEY (terminal_device_id) REFERENCES dbo.terminal_devices(id),
    CONSTRAINT CK_sales_invoices_status CHECK (status IN (N'draft', N'finalized', N'cancelled'))
);
GO

CREATE TABLE dbo.sales_invoice_items (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sales_invoice_items PRIMARY KEY,
    sales_invoice_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    stock_code_snapshot NVARCHAR(50) NOT NULL,
    barcode_snapshot NVARCHAR(80) NULL,
    product_name_snapshot NVARCHAR(250) NOT NULL,
    quantity DECIMAL(18,3) NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    unit_price DECIMAL(18,4) NOT NULL,
    line_total DECIMAL(18,4) NOT NULL,
    average_cost_try_snapshot DECIMAL(18,4) NOT NULL CONSTRAINT DF_sales_invoice_items_average_cost_try DEFAULT (0),
    stock_status_snapshot NVARCHAR(50) NULL,
    note NVARCHAR(250) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_sales_invoice_items_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_sales_invoice_items_sales_invoices FOREIGN KEY (sales_invoice_id) REFERENCES dbo.sales_invoices(id),
    CONSTRAINT FK_sales_invoice_items_products FOREIGN KEY (product_id) REFERENCES dbo.products(id)
);
GO

CREATE TABLE dbo.purchase_invoices (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_purchase_invoices PRIMARY KEY,
    document_no NVARCHAR(30) NOT NULL,
    document_date DATE NOT NULL,
    supplier_id BIGINT NOT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_purchase_invoices_status DEFAULT (N'draft'),
    supplier_currency NVARCHAR(3) NOT NULL,
    document_currency NVARCHAR(3) NOT NULL,
    exchange_rate_snapshot DECIMAL(18,8) NOT NULL CONSTRAINT DF_purchase_invoices_exchange_rate DEFAULT (1),
    description NVARCHAR(500) NULL,
    subtotal DECIMAL(18,4) NOT NULL CONSTRAINT DF_purchase_invoices_subtotal DEFAULT (0),
    line_discount_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_purchase_invoices_line_discount_total DEFAULT (0),
    invoice_discount_rate DECIMAL(9,4) NOT NULL CONSTRAINT DF_purchase_invoices_invoice_discount_rate DEFAULT (0),
    supplier_discount_rate DECIMAL(9,4) NOT NULL CONSTRAINT DF_purchase_invoices_supplier_discount_rate DEFAULT (0),
    discount_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_purchase_invoices_discount_total DEFAULT (0),
    grand_total DECIMAL(18,4) NOT NULL CONSTRAINT DF_purchase_invoices_grand_total DEFAULT (0),
    amount_try DECIMAL(18,4) NOT NULL CONSTRAINT DF_purchase_invoices_amount_try DEFAULT (0),
    stock_cost_effect_try DECIMAL(18,4) NOT NULL CONSTRAINT DF_purchase_invoices_stock_cost_effect_try DEFAULT (0),
    finalized_at DATETIME2(0) NULL,
    cancelled_at DATETIME2(0) NULL,
    cancel_reason NVARCHAR(250) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_purchase_invoices_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    updated_at DATETIME2(0) NULL,
    updated_by BIGINT NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT FK_purchase_invoices_suppliers FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
    CONSTRAINT CK_purchase_invoices_status CHECK (status IN (N'draft', N'finalized', N'cancelled'))
);
GO

CREATE TABLE dbo.purchase_invoice_items (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_purchase_invoice_items PRIMARY KEY,
    purchase_invoice_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    stock_code_snapshot NVARCHAR(50) NOT NULL,
    barcode_snapshot NVARCHAR(80) NULL,
    product_name_snapshot NVARCHAR(250) NOT NULL,
    quantity DECIMAL(18,3) NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    purchase_price DECIMAL(18,4) NOT NULL,
    line_discount_rate DECIMAL(9,4) NOT NULL CONSTRAINT DF_purchase_invoice_items_line_discount_rate DEFAULT (0),
    line_total DECIMAL(18,4) NOT NULL,
    line_total_try DECIMAL(18,4) NOT NULL,
    stock_effect_snapshot NVARCHAR(50) NULL,
    note NVARCHAR(250) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_purchase_invoice_items_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_purchase_invoice_items_purchase_invoices FOREIGN KEY (purchase_invoice_id) REFERENCES dbo.purchase_invoices(id),
    CONSTRAINT FK_purchase_invoice_items_products FOREIGN KEY (product_id) REFERENCES dbo.products(id)
);
GO

CREATE TABLE dbo.stock_movements (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_stock_movements PRIMARY KEY,
    product_id BIGINT NOT NULL,
    movement_type NVARCHAR(30) NOT NULL,
    source_type NVARCHAR(40) NOT NULL,
    source_id BIGINT NULL,
    quantity_in DECIMAL(18,3) NOT NULL CONSTRAINT DF_stock_movements_quantity_in DEFAULT (0),
    quantity_out DECIMAL(18,3) NOT NULL CONSTRAINT DF_stock_movements_quantity_out DEFAULT (0),
    quantity_net DECIMAL(18,3) NOT NULL,
    unit_cost_try DECIMAL(18,4) NOT NULL CONSTRAINT DF_stock_movements_unit_cost_try DEFAULT (0),
    average_cost_try_after DECIMAL(18,4) NOT NULL CONSTRAINT DF_stock_movements_average_cost_after DEFAULT (0),
    document_date DATE NOT NULL,
    customer_id BIGINT NULL,
    supplier_id BIGINT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_stock_movements_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    CONSTRAINT FK_stock_movements_products FOREIGN KEY (product_id) REFERENCES dbo.products(id),
    CONSTRAINT FK_stock_movements_customers FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
    CONSTRAINT FK_stock_movements_suppliers FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
    CONSTRAINT CK_stock_movements_type CHECK (movement_type IN (N'in', N'out', N'adjustment', N'count')),
    CONSTRAINT CK_stock_movements_source_type CHECK (source_type IN (N'sales_invoice', N'purchase_invoice', N'stock_adjustment', N'terminal_sync', N'stock_count'))
);
GO

CREATE TABLE dbo.catalogs (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_catalogs PRIMARY KEY,
    catalog_no NVARCHAR(50) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    customer_id BIGINT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_catalogs_status DEFAULT (N'draft'),
    valid_from DATE NULL,
    valid_to DATE NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_catalogs_created_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT NULL,
    updated_at DATETIME2(0) NULL,
    updated_by BIGINT NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT UQ_catalogs_catalog_no UNIQUE (catalog_no),
    CONSTRAINT FK_catalogs_customers FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
    CONSTRAINT CK_catalogs_status CHECK (status IN (N'draft', N'published', N'archived'))
);
GO

CREATE TABLE dbo.catalog_items (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_catalog_items PRIMARY KEY,
    catalog_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    product_image_id BIGINT NULL,
    display_order INT NOT NULL CONSTRAINT DF_catalog_items_display_order DEFAULT (0),
    price_snapshot DECIMAL(18,4) NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    note NVARCHAR(250) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_catalog_items_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_catalog_items_catalogs FOREIGN KEY (catalog_id) REFERENCES dbo.catalogs(id),
    CONSTRAINT FK_catalog_items_products FOREIGN KEY (product_id) REFERENCES dbo.products(id),
    CONSTRAINT FK_catalog_items_product_images FOREIGN KEY (product_image_id) REFERENCES dbo.product_images(id)
);
GO

CREATE TABLE dbo.terminal_sync_queue (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_terminal_sync_queue PRIMARY KEY,
    terminal_device_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    event_type NVARCHAR(40) NOT NULL,
    client_request_id NVARCHAR(120) NOT NULL,
    payload_json NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_terminal_sync_queue_status DEFAULT (N'pending'),
    retry_count INT NOT NULL CONSTRAINT DF_terminal_sync_queue_retry_count DEFAULT (0),
    last_error NVARCHAR(1000) NULL,
    target_entity NVARCHAR(80) NULL,
    target_entity_id BIGINT NULL,
    received_at DATETIME2(0) NOT NULL CONSTRAINT DF_terminal_sync_queue_received_at DEFAULT (SYSUTCDATETIME()),
    processed_at DATETIME2(0) NULL,
    row_version ROWVERSION NOT NULL,
    CONSTRAINT UQ_terminal_sync_queue_client_request UNIQUE (client_request_id),
    CONSTRAINT FK_terminal_sync_queue_terminal_devices FOREIGN KEY (terminal_device_id) REFERENCES dbo.terminal_devices(id),
    CONSTRAINT FK_terminal_sync_queue_users FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT CK_terminal_sync_queue_event_type CHECK (event_type IN (N'invoice_created', N'invoice_updated', N'stock_count', N'device_ping', N'sync_retry', N'sync_failed')),
    CONSTRAINT CK_terminal_sync_queue_status CHECK (status IN (N'pending', N'processing', N'synced', N'failed'))
);
GO

CREATE TABLE dbo.audit_logs (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_audit_logs PRIMARY KEY,
    actor_user_id BIGINT NULL,
    action NVARCHAR(120) NOT NULL,
    entity_type NVARCHAR(80) NOT NULL,
    entity_id BIGINT NULL,
    before_json NVARCHAR(MAX) NULL,
    after_json NVARCHAR(MAX) NULL,
    reason NVARCHAR(500) NULL,
    source NVARCHAR(40) NOT NULL CONSTRAINT DF_audit_logs_source DEFAULT (N'web-admin'),
    ip_address NVARCHAR(80) NULL,
    device_id BIGINT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_audit_logs_users FOREIGN KEY (actor_user_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_audit_logs_terminal_devices FOREIGN KEY (device_id) REFERENCES dbo.terminal_devices(id)
);
GO

CREATE INDEX IX_products_name ON dbo.products(name);
CREATE INDEX IX_products_category_brand ON dbo.products(category, brand);
CREATE INDEX IX_products_current_stock_qty ON dbo.products(current_stock_qty);

CREATE INDEX IX_customers_name ON dbo.customers(name);
CREATE INDEX IX_suppliers_name ON dbo.suppliers(name);

CREATE INDEX IX_sales_invoices_customer_date_status ON dbo.sales_invoices(customer_id, document_date, status);
CREATE INDEX IX_sales_invoices_document_no ON dbo.sales_invoices(document_no);

CREATE INDEX IX_purchase_invoices_supplier_date_status ON dbo.purchase_invoices(supplier_id, document_date, status);
CREATE INDEX IX_purchase_invoices_document_no ON dbo.purchase_invoices(document_no);

CREATE INDEX IX_stock_movements_product_date ON dbo.stock_movements(product_id, document_date);
CREATE INDEX IX_stock_movements_source ON dbo.stock_movements(source_type, source_id);

CREATE INDEX IX_terminal_sync_queue_status_device ON dbo.terminal_sync_queue(status, terminal_device_id);
CREATE INDEX IX_terminal_sync_queue_received_at ON dbo.terminal_sync_queue(received_at);

CREATE INDEX IX_audit_logs_entity_date ON dbo.audit_logs(entity_type, entity_id, created_at);
CREATE INDEX IX_audit_logs_actor_date ON dbo.audit_logs(actor_user_id, created_at);
GO
