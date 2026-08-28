/*
  Melisa ERP v2 - Local image mappings for read-only Vega products

  Safety:
  - Only runs against MELISA_ERP_V2.
  - Does not connect to or write into VEGA2026.
  - Stores only the local file reference and the Vega source identity.
*/

IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, '0015_vega_product_images.sql can only run on MELISA_ERP_V2.', 1;
END;
GO

SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.vega_product_images', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.vega_product_images (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_vega_product_images PRIMARY KEY,
        vega_source_id BIGINT NOT NULL,
        stock_code NVARCHAR(120) NOT NULL,
        file_path NVARCHAR(500) NOT NULL,
        storage_key NVARCHAR(200) NOT NULL,
        is_primary BIT NOT NULL CONSTRAINT DF_vega_product_images_is_primary DEFAULT (1),
        is_active BIT NOT NULL CONSTRAINT DF_vega_product_images_is_active DEFAULT (1),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_vega_product_images_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_vega_product_images_updated_at DEFAULT (SYSUTCDATETIME()),
        created_by BIGINT NULL,
        updated_by BIGINT NULL
    );

    CREATE INDEX IX_vega_product_images_source_active
        ON dbo.vega_product_images (vega_source_id, is_active, is_primary)
        INCLUDE (file_path, storage_key, stock_code);

    CREATE UNIQUE INDEX UX_vega_product_images_primary_active
        ON dbo.vega_product_images (vega_source_id)
        WHERE is_primary = 1 AND is_active = 1;
END;
GO

COMMIT TRANSACTION;
GO
