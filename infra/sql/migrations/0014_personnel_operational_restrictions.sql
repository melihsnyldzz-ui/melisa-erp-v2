/*
  Melisa ERP v2 - Personnel operational restrictions

  Safety:
  - Only runs against MELISA_ERP_V2.
  - Existing personnel keep terminal sale access to preserve current behavior.
  - Price override starts disabled unless explicitly allowed.
*/

IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
    THROW 51000, '0014_personnel_operational_restrictions.sql can only run on MELISA_ERP_V2.', 1;
END;
GO

SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.employees', N'can_terminal_sale') IS NULL
BEGIN
    ALTER TABLE dbo.employees
        ADD can_terminal_sale BIT NOT NULL
            CONSTRAINT DF_employees_can_terminal_sale DEFAULT (1) WITH VALUES;
END;
GO

IF COL_LENGTH(N'dbo.employees', N'can_change_sale_price') IS NULL
BEGIN
    ALTER TABLE dbo.employees
        ADD can_change_sale_price BIT NOT NULL
            CONSTRAINT DF_employees_can_change_sale_price DEFAULT (0) WITH VALUES;
END;
GO

IF COL_LENGTH(N'dbo.employees', N'max_sale_discount_percent') IS NULL
BEGIN
    ALTER TABLE dbo.employees
        ADD max_sale_discount_percent DECIMAL(5,2) NOT NULL
            CONSTRAINT DF_employees_max_sale_discount DEFAULT (0) WITH VALUES;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_employees_max_sale_discount'
      AND parent_object_id = OBJECT_ID(N'dbo.employees')
)
BEGIN
    ALTER TABLE dbo.employees
        ADD CONSTRAINT CK_employees_max_sale_discount
        CHECK (max_sale_discount_percent >= 0 AND max_sale_discount_percent <= 100);
END;
GO

COMMIT TRANSACTION;
GO
