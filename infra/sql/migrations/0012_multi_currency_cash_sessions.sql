IF DB_NAME() <> N'MELISA_ERP_V2'
BEGIN
  THROW 51000, 'This migration can only run on MELISA_ERP_V2.', 1;
END;
GO

IF OBJECT_ID(N'dbo.finance_accounts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.finance_accounts (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_finance_accounts PRIMARY KEY,
    account_code NVARCHAR(40) NOT NULL CONSTRAINT UQ_finance_accounts_code UNIQUE,
    account_name NVARCHAR(160) NOT NULL,
    account_type NVARCHAR(20) NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    opening_balance DECIMAL(18,4) NOT NULL CONSTRAINT DF_finance_accounts_opening DEFAULT (0),
    current_balance DECIMAL(18,4) NOT NULL CONSTRAINT DF_finance_accounts_current DEFAULT (0),
    is_active BIT NOT NULL CONSTRAINT DF_finance_accounts_active DEFAULT (1),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_finance_accounts_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NULL
  );
END;
GO

IF OBJECT_ID(N'dbo.finance_account_movements', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.finance_account_movements (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_finance_account_movements PRIMARY KEY,
    account_id BIGINT NOT NULL,
    source_type NVARCHAR(30) NOT NULL,
    party_type NVARCHAR(20) NOT NULL,
    party_movement_id BIGINT NOT NULL,
    direction NVARCHAR(10) NOT NULL,
    amount DECIMAL(18,4) NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    payment_method NVARCHAR(20) NOT NULL,
    document_no NVARCHAR(60) NULL,
    document_date DATE NOT NULL,
    description NVARCHAR(500) NULL,
    created_by BIGINT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_finance_account_movements_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_finance_account_movements_account FOREIGN KEY (account_id) REFERENCES dbo.finance_accounts(id),
    CONSTRAINT UQ_finance_account_source UNIQUE (source_type, party_type, party_movement_id)
  );
END;
GO

IF OBJECT_ID(N'dbo.cash_drawers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cash_drawers (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_drawers PRIMARY KEY,
    drawer_code NVARCHAR(40) NOT NULL CONSTRAINT UQ_cash_drawers_code UNIQUE,
    drawer_name NVARCHAR(160) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_cash_drawers_active DEFAULT (1),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_cash_drawers_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NULL
  );
END;
GO

IF OBJECT_ID(N'dbo.cash_drawer_accounts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cash_drawer_accounts (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_drawer_accounts PRIMARY KEY,
    drawer_id BIGINT NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    finance_account_id BIGINT NOT NULL,
    CONSTRAINT FK_cash_drawer_accounts_drawer FOREIGN KEY (drawer_id) REFERENCES dbo.cash_drawers(id),
    CONSTRAINT FK_cash_drawer_accounts_finance FOREIGN KEY (finance_account_id) REFERENCES dbo.finance_accounts(id),
    CONSTRAINT UQ_cash_drawer_currency UNIQUE (drawer_id, currency_code),
    CONSTRAINT UQ_cash_drawer_finance_account UNIQUE (finance_account_id),
    CONSTRAINT CK_cash_drawer_currency CHECK (currency_code IN (N'TRY', N'USD', N'EUR'))
  );
END;
GO

IF OBJECT_ID(N'dbo.cash_sessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cash_sessions (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_sessions PRIMARY KEY,
    drawer_id BIGINT NOT NULL,
    business_date DATE NOT NULL,
    session_status NVARCHAR(20) NOT NULL CONSTRAINT DF_cash_sessions_status DEFAULT (N'open'),
    opening_note NVARCHAR(500) NULL,
    closing_note NVARCHAR(500) NULL,
    opened_by BIGINT NULL,
    opened_at DATETIME2 NOT NULL CONSTRAINT DF_cash_sessions_opened DEFAULT SYSUTCDATETIME(),
    closed_by BIGINT NULL,
    closed_at DATETIME2 NULL,
    CONSTRAINT FK_cash_sessions_drawer FOREIGN KEY (drawer_id) REFERENCES dbo.cash_drawers(id),
    CONSTRAINT UQ_cash_sessions_day UNIQUE (drawer_id, business_date),
    CONSTRAINT CK_cash_sessions_status CHECK (session_status IN (N'open', N'closed'))
  );
END;
GO

IF OBJECT_ID(N'dbo.cash_session_counts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cash_session_counts (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_session_counts PRIMARY KEY,
    session_id BIGINT NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    physical_opening_amount DECIMAL(18,4) NOT NULL CONSTRAINT DF_cash_counts_physical_opening DEFAULT (0),
    opening_transfer_amount DECIMAL(18,4) NOT NULL CONSTRAINT DF_cash_counts_opening_transfer DEFAULT (0),
    expected_closing_amount DECIMAL(18,4) NULL,
    physical_closing_amount DECIMAL(18,4) NULL,
    difference_amount DECIMAL(18,4) NULL,
    carry_forward_amount DECIMAL(18,4) NULL,
    transferred_to_main_amount DECIMAL(18,4) NULL,
    CONSTRAINT FK_cash_session_counts_session FOREIGN KEY (session_id) REFERENCES dbo.cash_sessions(id),
    CONSTRAINT UQ_cash_session_count_currency UNIQUE (session_id, currency_code),
    CONSTRAINT CK_cash_count_currency CHECK (currency_code IN (N'TRY', N'USD', N'EUR'))
  );
END;
GO

IF OBJECT_ID(N'dbo.expense_categories', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.expense_categories (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_expense_categories PRIMARY KEY,
    category_code NVARCHAR(40) NOT NULL CONSTRAINT UQ_expense_categories_code UNIQUE,
    category_name NVARCHAR(120) NOT NULL,
    sort_order INT NOT NULL CONSTRAINT DF_expense_categories_sort DEFAULT (0),
    is_active BIT NOT NULL CONSTRAINT DF_expense_categories_active DEFAULT (1),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_expense_categories_created DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NULL
  );
END;
GO

IF OBJECT_ID(N'dbo.cash_expenses', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cash_expenses (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_expenses PRIMARY KEY,
    session_id BIGINT NOT NULL,
    expense_category_id BIGINT NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    amount DECIMAL(18,4) NOT NULL,
    document_no NVARCHAR(60) NULL,
    description NVARCHAR(500) NOT NULL,
    created_by BIGINT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_cash_expenses_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_cash_expenses_session FOREIGN KEY (session_id) REFERENCES dbo.cash_sessions(id),
    CONSTRAINT FK_cash_expenses_category FOREIGN KEY (expense_category_id) REFERENCES dbo.expense_categories(id),
    CONSTRAINT CK_cash_expenses_amount CHECK (amount > 0),
    CONSTRAINT CK_cash_expenses_currency CHECK (currency_code IN (N'TRY', N'USD', N'EUR'))
  );
END;
GO

IF OBJECT_ID(N'dbo.cash_transfers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cash_transfers (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_transfers PRIMARY KEY,
    session_id BIGINT NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    transfer_direction NVARCHAR(20) NOT NULL,
    amount DECIMAL(18,4) NOT NULL,
    description NVARCHAR(500) NULL,
    created_by BIGINT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_cash_transfers_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_cash_transfers_session FOREIGN KEY (session_id) REFERENCES dbo.cash_sessions(id),
    CONSTRAINT CK_cash_transfers_direction CHECK (transfer_direction IN (N'main_to_drawer', N'drawer_to_main')),
    CONSTRAINT CK_cash_transfers_amount CHECK (amount > 0),
    CONSTRAINT CK_cash_transfers_currency CHECK (currency_code IN (N'TRY', N'USD', N'EUR'))
  );
END;
GO

IF OBJECT_ID(N'dbo.cash_adjustments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cash_adjustments (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cash_adjustments PRIMARY KEY,
    session_id BIGINT NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    adjustment_kind NVARCHAR(20) NOT NULL,
    direction NVARCHAR(10) NOT NULL,
    amount DECIMAL(18,4) NOT NULL,
    reason NVARCHAR(500) NOT NULL,
    created_by BIGINT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_cash_adjustments_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_cash_adjustments_session FOREIGN KEY (session_id) REFERENCES dbo.cash_sessions(id),
    CONSTRAINT CK_cash_adjustments_kind CHECK (adjustment_kind IN (N'opening', N'closing')),
    CONSTRAINT CK_cash_adjustments_direction CHECK (direction IN (N'in', N'out')),
    CONSTRAINT CK_cash_adjustments_amount CHECK (amount > 0),
    CONSTRAINT CK_cash_adjustments_currency CHECK (currency_code IN (N'TRY', N'USD', N'EUR'))
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.expense_categories)
BEGIN
  INSERT INTO dbo.expense_categories (category_code, category_name, sort_order)
  VALUES
    (N'YEMEK', N'Yemek', 10),
    (N'MARKET', N'Market', 20),
    (N'KIRTASIYE', N'Kırtasiye', 30),
    (N'KARGO', N'Kargo', 40),
    (N'ULASIM', N'Ulaşım', 50),
    (N'TEMIZLIK', N'Temizlik', 60),
    (N'BAKIM_ONARIM', N'Bakım / Onarım', 70),
    (N'PERSONEL', N'Personel', 80),
    (N'VERGI_HARC', N'Vergi / Harç', 90),
    (N'DIGER', N'Diğer', 100);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.cash_drawers WHERE drawer_code = N'MERKEZ-CEKMECE')
BEGIN
  INSERT INTO dbo.cash_drawers (drawer_code, drawer_name)
  VALUES (N'MERKEZ-CEKMECE', N'Merkez Çekmece');
END;
GO

DECLARE @drawerId BIGINT = (SELECT TOP (1) id FROM dbo.cash_drawers WHERE drawer_code = N'MERKEZ-CEKMECE');
DECLARE @currency NVARCHAR(3);
DECLARE @accountId BIGINT;

DECLARE currency_cursor CURSOR LOCAL FAST_FORWARD FOR
  SELECT currency_code FROM (VALUES (N'TRY'), (N'USD'), (N'EUR')) AS currencies(currency_code);

OPEN currency_cursor;
FETCH NEXT FROM currency_cursor INTO @currency;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.finance_accounts WHERE account_code = CONCAT(N'KASA-', @currency))
  BEGIN
    INSERT INTO dbo.finance_accounts (account_code, account_name, account_type, currency_code)
    VALUES (CONCAT(N'KASA-', @currency), CONCAT(@currency, N' Ana Kasa'), N'cash', @currency);
  END;

  IF NOT EXISTS (SELECT 1 FROM dbo.finance_accounts WHERE account_code = CONCAT(N'CEKMECE-', @currency))
  BEGIN
    INSERT INTO dbo.finance_accounts (account_code, account_name, account_type, currency_code)
    VALUES (CONCAT(N'CEKMECE-', @currency), CONCAT(@currency, N' Merkez Çekmece'), N'cash', @currency);
  END;

  SET @accountId = (SELECT TOP (1) id FROM dbo.finance_accounts WHERE account_code = CONCAT(N'CEKMECE-', @currency));
  IF NOT EXISTS (SELECT 1 FROM dbo.cash_drawer_accounts WHERE drawer_id = @drawerId AND currency_code = @currency)
  BEGIN
    INSERT INTO dbo.cash_drawer_accounts (drawer_id, currency_code, finance_account_id)
    VALUES (@drawerId, @currency, @accountId);
  END;

  FETCH NEXT FROM currency_cursor INTO @currency;
END;
CLOSE currency_cursor;
DEALLOCATE currency_cursor;
GO
