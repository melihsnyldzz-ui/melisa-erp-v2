IF COL_LENGTH('dbo.products', 'purchase_discount_rate') IS NULL
BEGIN
  ALTER TABLE dbo.products
    ADD purchase_discount_rate DECIMAL(9, 4) NOT NULL
      CONSTRAINT DF_products_purchase_discount_rate DEFAULT (0);
END;

IF COL_LENGTH('dbo.suppliers', 'purchase_discount_rate') IS NULL
BEGIN
  ALTER TABLE dbo.suppliers
    ADD purchase_discount_rate DECIMAL(9, 4) NOT NULL
      CONSTRAINT DF_suppliers_purchase_discount_rate DEFAULT (0);
END;
