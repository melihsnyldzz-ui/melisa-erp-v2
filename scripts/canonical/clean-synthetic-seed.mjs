import {CLEAN_TARGET_SQL} from './clean-synthetic-sql.mjs';
export function buildCleanSeedSql(passwordHash){
 if(!/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(passwordHash))throw Error('Password hash required');
 return `${CLEAN_TARGET_SQL}
SET XACT_ABORT ON;BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.products) OR EXISTS(SELECT 1 FROM dbo.customers) OR EXISTS(SELECT 1 FROM dbo.users WHERE id=15) THROW 51992,'CLEAN_SEED_ALREADY_PRESENT',1;
ALTER TABLE dbo.customers ADD party_entity_id bigint NULL;
CREATE TABLE dbo.product_prices(id bigint PRIMARY KEY,product_id bigint NOT NULL REFERENCES dbo.products(id),source_unit_id bigint NOT NULL,price_type nvarchar(20) NOT NULL,price_tier int NOT NULL,currency_code nvarchar(3) NOT NULL,price decimal(28,8) NOT NULL,is_main_unit bit NOT NULL,source_record_key nvarchar(250) NOT NULL UNIQUE);
EXEC(N'CREATE SCHEMA erp_migration');
CREATE TABLE erp_migration.operation_quarantine_holds(entity nvarchar(20),native_id bigint,native_entity_id bigint,source_company nvarchar(20),source_id varchar(80));
CREATE TABLE dbo.party_source_links(customer_id bigint,source_company nvarchar(20),source_id bigint);
SET IDENTITY_INSERT dbo.roles ON;INSERT dbo.roles(id,code,name) VALUES(20,N'clean_test_sales',N'Örnek satış personeli'),(21,N'clean_test_reader',N'Örnek görüntüleme');SET IDENTITY_INSERT dbo.roles OFF;
INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_approve) VALUES(20,N'product.view',1,0,0,0),(20,N'customer.view',1,0,0,0),(20,N'sales.view',1,0,0,0),(20,N'sales.create',0,1,0,0),(21,N'product.view',1,0,0,0),(21,N'sales.view',1,0,0,0);
SET IDENTITY_INSERT dbo.users ON;INSERT dbo.users(id,username,password_hash,display_name,role_id) VALUES(15,N'ornek-satis',N'${passwordHash}',N'Örnek satış personeli',20),(16,N'ornek-okuyucu',N'${passwordHash}',N'Örnek görüntüleme',21);SET IDENTITY_INSERT dbo.users OFF;
INSERT dbo.products(stock_code,name,category,brand,unit,currency_code,sales_price,current_stock_qty) VALUES(N'0007 MELISA',N'Örnek pamuk takım',N'TAKIM',N'MELISA',N'ADET',N'TRY',125.50,24),(N'0161 MELISA',N'Örnek bebek takım',N'TAKIM',N'MELISA',N'ADET',N'USD',8.55,12),(N'0205 MELISA',N'Örnek tulum',N'TULUM',N'MELISA',N'ADET',N'EUR',10.25,0);
INSERT dbo.product_barcodes(product_id,barcode,barcode_type,is_primary) VALUES(1,N'0000000000007',N'primary',1),(2,N'0000000000161',N'primary',1),(3,N'0000000000205',N'primary',1);
INSERT dbo.product_prices SELECT id,id,1,N'sale',1,currency_code,CONVERT(decimal(28,8),sales_price),1,N'SYNTHETIC/20261022/products/'+CONVERT(nvarchar(20),id)+N'/PRICE/sale/1/1/'+currency_code FROM dbo.products;
INSERT dbo.customers(customer_code,name,phone,currency_code) VALUES(N'ORNEK-M01',N'Örnek Mağaza',N'905550000001',N'TRY');
INSERT dbo.suppliers(supplier_code,name,phone,currency_code) VALUES(N'ORNEK-T01',N'Örnek Tedarikçi',N'905550000002',N'TRY');
COMMIT;SELECT N'SYNTHETIC_SEED_CREATED' result;`;
}
