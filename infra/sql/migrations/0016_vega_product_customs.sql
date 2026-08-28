/*
  Melisa ERP v2 - Local customs classification for read-only Vega products

  Safety:
  - Only runs against MELISA_ERP_V2.
  - Does not connect to or write into VEGA2026.
  - Candidate classifications remain draft until material/construction is verified.
*/

IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, '0016_vega_product_customs.sql can only run on MELISA_ERP_V2.', 1;
END;
GO

SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.vega_product_customs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.vega_product_customs (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_vega_product_customs PRIMARY KEY,
        vega_source_id BIGINT NOT NULL,
        stock_code NVARCHAR(120) NOT NULL,
        gtip_code NVARCHAR(20) NOT NULL,
        classification_status NVARCHAR(20) NOT NULL CONSTRAINT DF_vega_product_customs_status DEFAULT (N'draft'),
        confidence NVARCHAR(20) NOT NULL CONSTRAINT DF_vega_product_customs_confidence DEFAULT (N'low'),
        material_basis NVARCHAR(120) NULL,
        classification_note NVARCHAR(500) NULL,
        source_document_no NVARCHAR(60) NULL,
        source_header_id BIGINT NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_vega_product_customs_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_vega_product_customs_updated_at DEFAULT (SYSUTCDATETIME()),
        created_by BIGINT NULL,
        updated_by BIGINT NULL,
        CONSTRAINT CK_vega_product_customs_status CHECK (classification_status IN (N'draft', N'verified')),
        CONSTRAINT CK_vega_product_customs_confidence CHECK (confidence IN (N'low', N'medium', N'high'))
    );

    CREATE UNIQUE INDEX UX_vega_product_customs_source
        ON dbo.vega_product_customs (vega_source_id);

    CREATE INDEX IX_vega_product_customs_gtip
        ON dbo.vega_product_customs (gtip_code, classification_status)
        INCLUDE (stock_code, confidence, source_document_no);
END;
GO

COMMIT TRANSACTION;
GO
