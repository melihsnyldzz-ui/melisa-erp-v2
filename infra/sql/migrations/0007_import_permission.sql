IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, 'This migration can run only on MELISA_ERP_V2.', 1;
END;
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
    (N'admin', N'import.run', 1, 1, 0, 0, 1),
    (N'owner_manager', N'import.run', 1, 1, 0, 0, 1);

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
