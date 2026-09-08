-- Product cards and supplier portfolio queries require an optional main supplier.
-- Existing products remain unassigned; never infer a commercial relationship.
IF OBJECT_ID(N'dbo.products', N'U') IS NULL OR OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
    THROW 51118, 'Product and supplier tables must exist before migration 0018', 1;
GO
IF COL_LENGTH(N'dbo.products', N'supplier_id') IS NULL
    ALTER TABLE dbo.products ADD supplier_id BIGINT NULL;
GO
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.products') AND name = N'supplier_id'
      AND system_type_id = TYPE_ID(N'bigint') AND is_nullable = 1
)
    THROW 51119, 'Existing products.supplier_id must be nullable BIGINT; manual review required', 1;
GO
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_key_columns fkc
    INNER JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
    WHERE fkc.parent_object_id = OBJECT_ID(N'dbo.products')
      AND fkc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.products'), N'supplier_id', 'ColumnId')
      AND fkc.referenced_object_id = OBJECT_ID(N'dbo.suppliers')
      AND fkc.referenced_column_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.suppliers'), N'id', 'ColumnId')
      AND fk.is_disabled = 0 AND fk.is_not_trusted = 0
)
    ALTER TABLE dbo.products WITH CHECK ADD CONSTRAINT FK_products_suppliers
      FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id);
GO
