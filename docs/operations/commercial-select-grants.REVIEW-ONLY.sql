-- REVIEW ONLY: prepared for an authorized database administrator; NOT applied.
-- Replace REVIEWED_READ_ONLY_USER with the existing dedicated Bionic database user.
-- No login/user creation, role changes, business writes, migrations or EXECUTE grants.
-- Object-level SELECT is limited to commercial objects established by ERP migrations.
-- Invisible objects are not assumed absent. Missing objects need a schema inventory,
-- not a migration. Review each object before applying its statement.
USE [MELISA_ERP_V2];
GO
IF DB_NAME() <> N'MELISA_ERP_V2' THROW 51000, 'Wrong database', 1;
IF USER_ID(N'REVIEWED_READ_ONLY_USER') IS NULL THROW 51000, 'Existing dedicated user required', 1;
IF ISNULL(IS_ROLEMEMBER(N'db_owner', N'REVIEWED_READ_ONLY_USER'),1) <> 0
   OR ISNULL(IS_ROLEMEMBER(N'db_datawriter', N'REVIEWED_READ_ONLY_USER'),1) <> 0
   OR ISNULL(IS_ROLEMEMBER(N'db_ddladmin', N'REVIEWED_READ_ONLY_USER'),1) <> 0
   THROW 51000, 'Target must be the dedicated SELECT-only user', 1;
IF ISNULL(IS_SRVROLEMEMBER(N'sysadmin',
   (SELECT SUSER_SNAME(sid) FROM sys.database_principals WHERE name=N'REVIEWED_READ_ONLY_USER')),1) <> 0
   THROW 51000, 'A sysadmin or unverifiable login is not allowed', 1;
IF OBJECT_ID(N'dbo.customers',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[customers] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.customers';

IF OBJECT_ID(N'dbo.customer_movements',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[customer_movements] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.customer_movements';

IF OBJECT_ID(N'dbo.supplier_movements',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[supplier_movements] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.supplier_movements';

IF OBJECT_ID(N'dbo.stock_movements',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[stock_movements] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.stock_movements';

IF OBJECT_ID(N'dbo.sales_invoices',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[sales_invoices] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.sales_invoices';

IF OBJECT_ID(N'dbo.sales_invoice_items',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[sales_invoice_items] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.sales_invoice_items';

IF OBJECT_ID(N'dbo.purchase_invoices',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[purchase_invoices] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.purchase_invoices';

IF OBJECT_ID(N'dbo.purchase_invoice_items',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[purchase_invoice_items] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.purchase_invoice_items';

IF OBJECT_ID(N'dbo.sales_offers',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[sales_offers] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.sales_offers';

IF OBJECT_ID(N'dbo.sales_offer_items',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[sales_offer_items] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.sales_offer_items';

IF OBJECT_ID(N'dbo.sales_orders',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[sales_orders] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.sales_orders';

IF OBJECT_ID(N'dbo.sales_order_items',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[sales_order_items] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.sales_order_items';

IF OBJECT_ID(N'dbo.currency_rates',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[currency_rates] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.currency_rates';

IF OBJECT_ID(N'dbo.finance_accounts',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[finance_accounts] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.finance_accounts';

IF OBJECT_ID(N'dbo.finance_account_movements',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[finance_account_movements] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.finance_account_movements';

IF OBJECT_ID(N'dbo.cash_drawers',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[cash_drawers] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.cash_drawers';

IF OBJECT_ID(N'dbo.cash_drawer_accounts',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[cash_drawer_accounts] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.cash_drawer_accounts';

IF OBJECT_ID(N'dbo.cash_sessions',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[cash_sessions] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.cash_sessions';

IF OBJECT_ID(N'dbo.cash_session_counts',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[cash_session_counts] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.cash_session_counts';

IF OBJECT_ID(N'dbo.expense_categories',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[expense_categories] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.expense_categories';

IF OBJECT_ID(N'dbo.cash_expenses',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[cash_expenses] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.cash_expenses';

IF OBJECT_ID(N'dbo.cash_transfers',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[cash_transfers] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.cash_transfers';

IF OBJECT_ID(N'dbo.cash_adjustments',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[cash_adjustments] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.cash_adjustments';

IF OBJECT_ID(N'dbo.vega_product_images',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[vega_product_images] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.vega_product_images';

IF OBJECT_ID(N'dbo.vega_product_customs',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[vega_product_customs] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.vega_product_customs';

IF OBJECT_ID(N'dbo.catalogs',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[catalogs] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.catalogs';

IF OBJECT_ID(N'dbo.catalog_items',N'U') IS NOT NULL
  GRANT SELECT ON OBJECT::[dbo].[catalog_items] TO [REVIEWED_READ_ONLY_USER];
ELSE PRINT N'Not visible or not present: dbo.catalog_items';

