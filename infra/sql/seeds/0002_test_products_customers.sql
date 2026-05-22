/*
  Melisa ERP v2 test product/customer seed.
  Target database: MELISA_ERP_V2

  Safety:
  - Test data only.
  - Do not run against Vega databases.
  - Does not contain real customer, phone, barcode, or credential data.
  - Idempotent inserts; reruns should not create duplicates.
*/

USE [MELISA_ERP_V2];
GO

DECLARE @test_products TABLE (
    stock_code NVARCHAR(50) NOT NULL,
    name NVARCHAR(250) NOT NULL,
    category NVARCHAR(120) NULL,
    brand NVARCHAR(120) NULL,
    unit NVARCHAR(20) NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    sales_price DECIMAL(18,4) NOT NULL,
    purchase_price DECIMAL(18,4) NOT NULL,
    average_cost_try DECIMAL(18,4) NOT NULL,
    current_stock_qty DECIMAL(18,3) NOT NULL,
    is_active BIT NOT NULL,
    passive_reason NVARCHAR(250) NULL
);

INSERT INTO @test_products (
    stock_code,
    name,
    category,
    brand,
    unit,
    currency_code,
    sales_price,
    purchase_price,
    average_cost_try,
    current_stock_qty,
    is_active,
    passive_reason
)
VALUES
    (N'TEST-P-001', N'TEST Bebek Tulum 0-3 Ay', N'TEST Yenidogan', N'TEST Melisa', N'ADET', N'TRY', 249.9000, 151.2500, 151.2500, 42.000, 1, NULL),
    (N'TEST-P-002', N'TEST Pamuk Battaniye Mavi', N'TEST Battaniye', N'TEST SoftBaby', N'ADET', N'USD', 18.5000, 11.2000, 362.0000, -5.000, 1, NULL),
    (N'TEST-P-003', N'TEST Zibin Seti 5 Parca', N'TEST Ic Giyim', N'TEST MiniModa', N'ADET', N'TRY', 319.0000, 205.7500, 205.7500, 0.000, 1, NULL),
    (N'TEST-P-004', N'TEST Penye Sapka Seti', N'TEST Aksesuar', N'TEST Melisa', N'ADET', N'TRY', 79.5000, 43.1000, 43.1000, 18.000, 1, NULL),
    (N'TEST-P-005', N'TEST Kislik Mont Pembe', N'TEST Dis Giyim', N'TEST EuroKids', N'ADET', N'EUR', 32.9000, 21.4000, 741.0000, 9.000, 1, NULL),
    (N'TEST-P-006', N'TEST Bebek Ayakkabi No 18', N'TEST Ayakkabi', N'TEST StepBaby', N'CIFT', N'USD', 14.7500, 9.3500, 302.0000, 27.000, 1, NULL),
    (N'TEST-P-007', N'TEST Mama Onlugu 3lu', N'TEST Beslenme', N'TEST CleanKid', N'ADET', N'TRY', 129.9000, 72.8000, 72.8000, 64.000, 1, NULL),
    (N'TEST-P-008', N'TEST Puset Minderi Gri', N'TEST Puset', N'TEST ComfortMini', N'ADET', N'EUR', 24.2000, 15.9000, 551.0000, 7.000, 1, NULL),
    (N'TEST-P-009', N'TEST Cocuk Corap 6li', N'TEST Corap', N'TEST CottonLine', N'PAKET', N'TRY', 99.0000, 55.0000, 55.0000, 120.000, 1, NULL),
    (N'TEST-P-010', N'TEST Oyuncak Cingirak', N'TEST Oyuncak', N'TEST PlayTest', N'ADET', N'USD', 8.9000, 5.1000, 165.0000, 33.000, 1, NULL),
    (N'TEST-P-011', N'TEST Pasif Sezonluk Elbise', N'TEST Sezon Sonu', N'TEST Outlet', N'ADET', N'TRY', 189.0000, 118.0000, 118.0000, 3.000, 0, N'Test pasif urun ornegi'),
    (N'TEST-P-012', N'TEST Pasif Eski Model Yelek', N'TEST Sezon Sonu', N'TEST EuroKids', N'ADET', N'EUR', 17.5000, 10.9000, 378.0000, 0.000, 0, N'Test pasif ve sifir stok ornegi');

INSERT INTO dbo.products (
    stock_code,
    name,
    category,
    brand,
    unit,
    currency_code,
    sales_price,
    purchase_price,
    average_cost_try,
    current_stock_qty,
    is_active,
    is_deleted,
    passive_at,
    passive_reason
)
SELECT
    tp.stock_code,
    tp.name,
    tp.category,
    tp.brand,
    tp.unit,
    tp.currency_code,
    tp.sales_price,
    tp.purchase_price,
    tp.average_cost_try,
    tp.current_stock_qty,
    tp.is_active,
    0,
    CASE WHEN tp.is_active = 0 THEN SYSUTCDATETIME() ELSE NULL END,
    tp.passive_reason
FROM @test_products tp
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.products p
    WHERE p.stock_code = tp.stock_code
);
GO

DECLARE @test_barcodes TABLE (
    stock_code NVARCHAR(50) NOT NULL,
    barcode NVARCHAR(80) NOT NULL,
    barcode_type NVARCHAR(30) NOT NULL,
    is_primary BIT NOT NULL
);

INSERT INTO @test_barcodes (stock_code, barcode, barcode_type, is_primary)
VALUES
    (N'TEST-P-001', N'TEST-BC-000001', N'primary', 1),
    (N'TEST-P-001', N'TEST-BC-000001-ALT', N'extra', 0),
    (N'TEST-P-002', N'TEST-BC-000002', N'primary', 1),
    (N'TEST-P-002', N'TEST-BC-000002-BOX', N'package', 0),
    (N'TEST-P-003', N'TEST-BC-000003', N'primary', 1),
    (N'TEST-P-004', N'TEST-BC-000004', N'primary', 1),
    (N'TEST-P-005', N'TEST-BC-000005', N'primary', 1),
    (N'TEST-P-005', N'TEST-BC-000005-ALT', N'extra', 0),
    (N'TEST-P-006', N'TEST-BC-000006', N'primary', 1),
    (N'TEST-P-007', N'TEST-BC-000007', N'primary', 1),
    (N'TEST-P-008', N'TEST-BC-000008', N'primary', 1),
    (N'TEST-P-008', N'TEST-BC-000008-ALT', N'extra', 0),
    (N'TEST-P-009', N'TEST-BC-000009', N'primary', 1),
    (N'TEST-P-010', N'TEST-BC-000010', N'primary', 1),
    (N'TEST-P-010', N'TEST-BC-000010-BOX', N'package', 0),
    (N'TEST-P-011', N'TEST-BC-000011', N'primary', 1),
    (N'TEST-P-012', N'TEST-BC-000012', N'primary', 1),
    (N'TEST-P-012', N'TEST-BC-000012-ALT', N'extra', 0);

INSERT INTO dbo.product_barcodes (
    product_id,
    barcode,
    barcode_type,
    is_primary,
    is_active
)
SELECT
    p.id,
    tb.barcode,
    tb.barcode_type,
    tb.is_primary,
    1
FROM @test_barcodes tb
INNER JOIN dbo.products p ON p.stock_code = tb.stock_code
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.product_barcodes b
    WHERE b.barcode = tb.barcode
);
GO

DECLARE @test_customers TABLE (
    customer_code NVARCHAR(50) NOT NULL,
    name NVARCHAR(250) NOT NULL,
    phone NVARCHAR(50) NULL,
    email NVARCHAR(150) NULL,
    city NVARCHAR(100) NULL,
    country NVARCHAR(100) NULL,
    address NVARCHAR(500) NULL,
    currency_code NVARCHAR(3) NOT NULL,
    customer_type NVARCHAR(30) NOT NULL,
    balance DECIMAL(18,4) NOT NULL,
    risk_limit DECIMAL(18,4) NOT NULL,
    is_active BIT NOT NULL,
    passive_reason NVARCHAR(250) NULL
);

INSERT INTO @test_customers (
    customer_code,
    name,
    phone,
    email,
    city,
    country,
    address,
    currency_code,
    customer_type,
    balance,
    risk_limit,
    is_active,
    passive_reason
)
VALUES
    (N'TEST-C-001', N'TEST Istanbul Bebek Magazasi', N'+90 555 010 00 01', N'test-c001@example.invalid', N'Istanbul', N'Turkiye', N'TEST adres 1', N'TRY', N'customer', 15420.0000, 50000.0000, 1, NULL),
    (N'TEST-C-002', N'TEST Ankara Toptan Cocuk', N'+90 555 010 00 02', N'test-c002@example.invalid', N'Ankara', N'Turkiye', N'TEST adres 2', N'TRY', N'wholesale', -3250.0000, 75000.0000, 1, NULL),
    (N'TEST-C-003', N'TEST Izmir Perakende', N'+90 555 010 00 03', N'test-c003@example.invalid', N'Izmir', N'Turkiye', N'TEST adres 3', N'EUR', N'retail', 0.0000, 25000.0000, 1, NULL),
    (N'TEST-C-004', N'TEST Bursa Karma Cari', N'+90 555 010 00 04', N'test-c004@example.invalid', N'Bursa', N'Turkiye', N'TEST adres 4', N'USD', N'mixed', 8800.0000, 60000.0000, 1, NULL),
    (N'TEST-C-005', N'TEST Antalya Magaza', N'+90 555 010 00 05', N'test-c005@example.invalid', N'Antalya', N'Turkiye', N'TEST adres 5', N'TRY', N'customer', -1200.0000, 30000.0000, 1, NULL),
    (N'TEST-C-006', N'TEST Berlin Baby Shop', N'+49 555 010 00 06', N'test-c006@example.invalid', N'Berlin', N'Almanya', N'TEST adres 6', N'EUR', N'customer', 2160.0000, 40000.0000, 1, NULL),
    (N'TEST-C-007', N'TEST London Kids Market', N'+44 555 010 00 07', N'test-c007@example.invalid', N'London', N'Birlesik Krallik', N'TEST adres 7', N'USD', N'wholesale', 0.0000, 45000.0000, 1, NULL),
    (N'TEST-C-008', N'TEST Adana Bebek Noktasi', N'+90 555 010 00 08', N'test-c008@example.invalid', N'Adana', N'Turkiye', N'TEST adres 8', N'TRY', N'retail', 742.5000, 15000.0000, 1, NULL),
    (N'TEST-C-009', N'TEST Pasif Eskisehir Cari', N'+90 555 010 00 09', N'test-c009@example.invalid', N'Eskisehir', N'Turkiye', N'TEST adres 9', N'TRY', N'customer', 310.0000, 10000.0000, 0, N'Test pasif cari ornegi'),
    (N'TEST-C-010', N'TEST Pasif Paris Cari', N'+33 555 010 00 10', N'test-c010@example.invalid', N'Paris', N'Fransa', N'TEST adres 10', N'EUR', N'mixed', -640.0000, 12000.0000, 0, N'Test pasif yurtdisi cari ornegi');

INSERT INTO dbo.customers (
    customer_code,
    name,
    phone,
    email,
    city,
    country,
    address,
    currency_code,
    customer_type,
    balance,
    risk_limit,
    is_active,
    is_deleted,
    passive_at,
    passive_reason
)
SELECT
    tc.customer_code,
    tc.name,
    tc.phone,
    tc.email,
    tc.city,
    tc.country,
    tc.address,
    tc.currency_code,
    tc.customer_type,
    tc.balance,
    tc.risk_limit,
    tc.is_active,
    0,
    CASE WHEN tc.is_active = 0 THEN SYSUTCDATETIME() ELSE NULL END,
    tc.passive_reason
FROM @test_customers tc
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.customers c
    WHERE c.customer_code = tc.customer_code
);
GO
