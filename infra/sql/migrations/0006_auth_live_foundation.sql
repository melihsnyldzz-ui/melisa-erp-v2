IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, 'This migration can run only on MELISA_ERP_V2.', 1;
END;
GO

IF OBJECT_ID(N'dbo.auth_refresh_tokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.auth_refresh_tokens (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_auth_refresh_tokens PRIMARY KEY,
        user_id BIGINT NOT NULL,
        token_hash NVARCHAR(255) NOT NULL,
        expires_at DATETIME2(0) NOT NULL,
        revoked_at DATETIME2(0) NULL,
        user_agent NVARCHAR(300) NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_auth_refresh_tokens_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_auth_refresh_tokens_users FOREIGN KEY (user_id) REFERENCES dbo.users(id)
    );

    CREATE UNIQUE INDEX UX_auth_refresh_tokens_hash ON dbo.auth_refresh_tokens(token_hash);
    CREATE INDEX IX_auth_refresh_tokens_user_active ON dbo.auth_refresh_tokens(user_id, revoked_at, expires_at);
END;
GO

MERGE dbo.roles AS target
USING (VALUES
    (N'admin', N'Admin', N'Sistem ayarlari, kullanici, yetki ve teknik isler', 1),
    (N'owner_manager', N'Patron / Yonetici', N'Tam ticari yonetim ve kritik islem yetkileri', 1),
    (N'accounting', N'Muhasebe', N'Cari, alis, satis, rapor ve fis isleme rolu', 1),
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
    (N'admin', N'dashboard.view', 1, 0, 0, 0, 0),
    (N'admin', N'product.update', 1, 1, 1, 0, 1),
    (N'admin', N'product.passive', 1, 0, 1, 0, 1),
    (N'admin', N'customer.update', 1, 1, 1, 0, 1),
    (N'admin', N'customer.passive', 1, 0, 1, 0, 1),
    (N'admin', N'sales.draft.write', 1, 1, 1, 0, 0),
    (N'admin', N'purchase.draft.write', 1, 1, 1, 0, 0),
    (N'admin', N'sales.finalize', 1, 0, 0, 0, 1),
    (N'admin', N'purchase.finalize', 1, 0, 0, 0, 1),

    (N'owner_manager', N'dashboard.view', 1, 0, 0, 0, 0),
    (N'owner_manager', N'product.update', 1, 1, 1, 0, 1),
    (N'owner_manager', N'product.passive', 1, 0, 1, 0, 1),
    (N'owner_manager', N'customer.update', 1, 1, 1, 0, 1),
    (N'owner_manager', N'customer.passive', 1, 0, 1, 0, 1),
    (N'owner_manager', N'sales.draft.write', 1, 1, 1, 0, 0),
    (N'owner_manager', N'purchase.draft.write', 1, 1, 1, 0, 0),
    (N'owner_manager', N'sales.finalize', 1, 0, 0, 0, 1),
    (N'owner_manager', N'purchase.finalize', 1, 0, 0, 0, 1),

    (N'accounting', N'dashboard.view', 1, 0, 0, 0, 0),
    (N'accounting', N'customer.update', 1, 1, 1, 0, 0),
    (N'accounting', N'customer.passive', 1, 0, 1, 0, 0),
    (N'accounting', N'sales.draft.write', 1, 1, 1, 0, 0),
    (N'accounting', N'purchase.draft.write', 1, 1, 1, 0, 0),
    (N'accounting', N'sales.finalize', 1, 0, 0, 0, 1),
    (N'accounting', N'purchase.finalize', 1, 0, 0, 0, 1),

    (N'terminal_user', N'dashboard.view', 1, 0, 0, 0, 0);

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

DECLARE @admin_role_id BIGINT;
SELECT @admin_role_id = id FROM dbo.roles WHERE code = N'admin';

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE username = N'admin')
BEGIN
    INSERT INTO dbo.users (username, password_hash, display_name, role_id, is_active, created_by, updated_by)
    VALUES (
        N'admin',
        N'$2b$12$hMrmW2NlgmsXqCfgdS8bfeiNWxcf59qJMbZhHhJxnji2Uzt3iyYYm',
        N'Melisa ERP Admin',
        @admin_role_id,
        1,
        NULL,
        NULL
    );
END;
GO
