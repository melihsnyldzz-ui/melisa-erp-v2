/*
  Melisa ERP v2 reference role and permission seed draft.
  Target database: MELISA_ERP_V2

  Safety:
  - Draft only. Review before running.
  - Does not create real users or passwords.
  - Do not run against Vega databases.
*/

USE [MELISA_ERP_V2];
GO

MERGE dbo.roles AS target
USING (VALUES
    (N'owner_manager', N'Patron / Yonetici', N'Tam ticari yonetim ve kritik islem yetkileri', 1),
    (N'owner_partner', N'Patron / Kardes', N'Yonetim ekranlari ve rapor odakli rol', 1),
    (N'accounting', N'Muhasebe', N'Cari, alis, satis, rapor ve fis isleme rolu', 1),
    (N'admin', N'Admin', N'Sistem ayarlari, kullanici, yetki ve teknik isler', 1),
    (N'terminal_user', N'Terminal Kullanicisi', N'Android terminal satis ve sync operasyonlari', 1)
) AS source (code, name, description, is_system_role)
ON target.code = source.code
WHEN MATCHED THEN
    UPDATE SET
        target.name = source.name,
        target.description = source.description,
        target.is_system_role = source.is_system_role,
        target.is_active = 1,
        target.updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (code, name, description, is_system_role, is_active)
    VALUES (source.code, source.name, source.description, source.is_system_role, 1);
GO

DECLARE @permission_matrix TABLE (
    role_code NVARCHAR(50) NOT NULL,
    permission_key NVARCHAR(120) NOT NULL,
    can_view BIT NOT NULL,
    can_create BIT NOT NULL,
    can_update BIT NOT NULL,
    can_delete BIT NOT NULL,
    can_approve BIT NOT NULL
);

INSERT INTO @permission_matrix (role_code, permission_key, can_view, can_create, can_update, can_delete, can_approve)
VALUES
    (N'owner_manager', N'dashboard.view', 1, 0, 0, 0, 0),
    (N'owner_manager', N'products.manage', 1, 1, 1, 0, 1),
    (N'owner_manager', N'customers.manage', 1, 1, 1, 0, 1),
    (N'owner_manager', N'suppliers.manage', 1, 1, 1, 0, 1),
    (N'owner_manager', N'sales_invoices.manage', 1, 1, 1, 0, 1),
    (N'owner_manager', N'purchase_invoices.manage', 1, 1, 1, 0, 1),
    (N'owner_manager', N'reports.view', 1, 0, 0, 0, 0),
    (N'owner_manager', N'audit.view', 1, 0, 0, 0, 0),
    (N'owner_manager', N'price.change', 1, 0, 1, 0, 1),
    (N'owner_manager', N'discount.apply', 1, 0, 1, 0, 1),
    (N'owner_manager', N'stock.adjust', 1, 1, 1, 0, 1),

    (N'owner_partner', N'dashboard.view', 1, 0, 0, 0, 0),
    (N'owner_partner', N'products.manage', 1, 0, 1, 0, 0),
    (N'owner_partner', N'customers.manage', 1, 0, 1, 0, 0),
    (N'owner_partner', N'sales_invoices.manage', 1, 1, 1, 0, 0),
    (N'owner_partner', N'purchase_invoices.manage', 1, 0, 0, 0, 0),
    (N'owner_partner', N'reports.view', 1, 0, 0, 0, 0),
    (N'owner_partner', N'price.change', 1, 0, 1, 0, 0),
    (N'owner_partner', N'discount.apply', 1, 0, 1, 0, 0),

    (N'accounting', N'dashboard.view', 1, 0, 0, 0, 0),
    (N'accounting', N'customers.manage', 1, 1, 1, 0, 0),
    (N'accounting', N'suppliers.manage', 1, 1, 1, 0, 0),
    (N'accounting', N'sales_invoices.manage', 1, 1, 1, 0, 1),
    (N'accounting', N'purchase_invoices.manage', 1, 1, 1, 0, 1),
    (N'accounting', N'reports.view', 1, 0, 0, 0, 0),
    (N'accounting', N'audit.view', 1, 0, 0, 0, 0),

    (N'admin', N'dashboard.view', 1, 0, 0, 0, 0),
    (N'admin', N'users.manage', 1, 1, 1, 0, 1),
    (N'admin', N'permissions.manage', 1, 1, 1, 0, 1),
    (N'admin', N'terminal.manage', 1, 1, 1, 0, 1),
    (N'admin', N'settings.manage', 1, 1, 1, 0, 1),
    (N'admin', N'import.run', 1, 1, 0, 0, 1),
    (N'admin', N'audit.view', 1, 0, 0, 0, 0),

    (N'terminal_user', N'terminal.sales.create', 1, 1, 0, 0, 0),
    (N'terminal_user', N'terminal.stock_count.create', 1, 1, 0, 0, 0),
    (N'terminal_user', N'terminal.sync.run', 1, 1, 0, 0, 0);

MERGE dbo.permissions AS target
USING (
    SELECT
        r.id AS role_id,
        pm.permission_key,
        pm.can_view,
        pm.can_create,
        pm.can_update,
        pm.can_delete,
        pm.can_approve
    FROM @permission_matrix pm
    INNER JOIN dbo.roles r ON r.code = pm.role_code
) AS source
ON target.role_id = source.role_id
AND target.permission_key = source.permission_key
WHEN MATCHED THEN
    UPDATE SET
        target.can_view = source.can_view,
        target.can_create = source.can_create,
        target.can_update = source.can_update,
        target.can_delete = source.can_delete,
        target.can_approve = source.can_approve,
        target.updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (role_id, permission_key, can_view, can_create, can_update, can_delete, can_approve)
    VALUES (source.role_id, source.permission_key, source.can_view, source.can_create, source.can_update, source.can_delete, source.can_approve);
GO
