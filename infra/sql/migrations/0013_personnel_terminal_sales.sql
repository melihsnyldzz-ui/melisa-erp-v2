/*
  Melisa ERP v2 - Personnel, terminal assignment and sales ownership

  Safety:
  - Only runs against MELISA_ERP_V2.
  - Idempotent for repeated deployment.
  - Existing sales are not assigned retrospectively because historical
    terminal-personnel ownership cannot be proven safely.
*/

IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, '0013_personnel_terminal_sales.sql can only run on MELISA_ERP_V2.', 1;
END;
GO

SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.employees', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.employees (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_employees PRIMARY KEY,
        employee_code NVARCHAR(50) NOT NULL,
        full_name NVARCHAR(150) NOT NULL,
        phone NVARCHAR(40) NULL,
        department NVARCHAR(100) NULL,
        job_title NVARCHAR(100) NULL,
        user_id BIGINT NULL,
        is_active BIT NOT NULL CONSTRAINT DF_employees_is_active DEFAULT (1),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_employees_created_at DEFAULT (SYSUTCDATETIME()),
        created_by BIGINT NULL,
        updated_at DATETIME2(0) NULL,
        updated_by BIGINT NULL,
        row_version ROWVERSION NOT NULL,
        CONSTRAINT UQ_employees_employee_code UNIQUE (employee_code),
        CONSTRAINT FK_employees_users FOREIGN KEY (user_id) REFERENCES dbo.users(id)
    );

    CREATE INDEX IX_employees_active_name
        ON dbo.employees(is_active, full_name, id);

    CREATE UNIQUE INDEX UX_employees_user_id
        ON dbo.employees(user_id)
        WHERE user_id IS NOT NULL;
END;

IF COL_LENGTH(N'dbo.terminal_devices', N'assigned_employee_id') IS NULL
BEGIN
    ALTER TABLE dbo.terminal_devices
        ADD assigned_employee_id BIGINT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_terminal_devices_employees'
      AND parent_object_id = OBJECT_ID(N'dbo.terminal_devices')
)
BEGIN
    ALTER TABLE dbo.terminal_devices
        ADD CONSTRAINT FK_terminal_devices_employees
        FOREIGN KEY (assigned_employee_id) REFERENCES dbo.employees(id);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_terminal_devices_assigned_employee'
      AND object_id = OBJECT_ID(N'dbo.terminal_devices')
)
BEGIN
    CREATE INDEX IX_terminal_devices_assigned_employee
        ON dbo.terminal_devices(assigned_employee_id, is_active, id);
END;

IF COL_LENGTH(N'dbo.sales_invoices', N'employee_id') IS NULL
BEGIN
    ALTER TABLE dbo.sales_invoices
        ADD employee_id BIGINT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_sales_invoices_employees'
      AND parent_object_id = OBJECT_ID(N'dbo.sales_invoices')
)
BEGIN
    ALTER TABLE dbo.sales_invoices
        ADD CONSTRAINT FK_sales_invoices_employees
        FOREIGN KEY (employee_id) REFERENCES dbo.employees(id);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_sales_invoices_employee_date'
      AND object_id = OBJECT_ID(N'dbo.sales_invoices')
)
BEGIN
    CREATE INDEX IX_sales_invoices_employee_date
        ON dbo.sales_invoices(employee_id, document_date, status, id);
END;

COMMIT TRANSACTION;
GO
