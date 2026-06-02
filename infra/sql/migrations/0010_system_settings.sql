IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, 'This migration can only run on MELISA_ERP_V2.', 1;
END;
GO

IF OBJECT_ID(N'dbo.system_settings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.system_settings (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_system_settings PRIMARY KEY,
        setting_group NVARCHAR(80) NOT NULL,
        setting_key NVARCHAR(120) NOT NULL,
        setting_value NVARCHAR(MAX) NULL,
        value_type NVARCHAR(20) NOT NULL CONSTRAINT DF_system_settings_value_type DEFAULT (N'string'),
        description NVARCHAR(250) NULL,
        is_active BIT NOT NULL CONSTRAINT DF_system_settings_is_active DEFAULT (1),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_system_settings_created_at DEFAULT (SYSUTCDATETIME()),
        created_by BIGINT NULL,
        updated_at DATETIME2(0) NULL,
        updated_by BIGINT NULL,
        row_version ROWVERSION NOT NULL,
        CONSTRAINT UQ_system_settings_group_key UNIQUE (setting_group, setting_key),
        CONSTRAINT CK_system_settings_value_type CHECK (value_type IN (N'string', N'number', N'boolean', N'json'))
    );
END;
GO

MERGE dbo.system_settings AS target
USING (VALUES
    (N'company', N'name', N'Melisa Bebe', N'string', N'Firma adi'),
    (N'company', N'taxOffice', N'', N'string', N'Vergi dairesi'),
    (N'company', N'taxNumber', N'', N'string', N'Vergi numarasi'),
    (N'company', N'address', N'', N'string', N'Firma adresi'),
    (N'company', N'phone', N'', N'string', N'Firma telefonu'),
    (N'documentSeries', N'salesInvoicePrefix', N'SF', N'string', N'Satis fisi seri on eki'),
    (N'documentSeries', N'purchaseInvoicePrefix', N'AF', N'string', N'Alis fisi seri on eki'),
    (N'documentSeries', N'salesOfferPrefix', N'TEK', N'string', N'Teklif seri on eki'),
    (N'documentSeries', N'salesOrderPrefix', N'SIP', N'string', N'Siparis seri on eki'),
    (N'tax', N'defaultVatRate', N'20', N'number', N'Varsayilan KDV orani'),
    (N'tax', N'vatRates', N'[0,1,10,20]', N'json', N'Kullanilabilir KDV oranlari'),
    (N'definitions', N'productUnits', N'["ADET","KOLI","PAKET","KG"]', N'json', N'Stok birimleri'),
    (N'definitions', N'customerTypes', N'["customer","wholesale","retail","mixed"]', N'json', N'Cari tipleri'),
    (N'definitions', N'paymentMethods', N'["CASH","BANK","CARD","OTHER"]', N'json', N'Odeme tahsilat yontemleri'),
    (N'definitions', N'currencies', N'["TRY","USD","EUR"]', N'json', N'Kullanilan para birimleri')
) AS source (setting_group, setting_key, setting_value, value_type, description)
ON target.setting_group = source.setting_group AND target.setting_key = source.setting_key
WHEN NOT MATCHED THEN
    INSERT (setting_group, setting_key, setting_value, value_type, description)
    VALUES (source.setting_group, source.setting_key, source.setting_value, source.value_type, source.description);
GO
