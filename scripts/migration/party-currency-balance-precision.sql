-- Prepared only. No startup hook or CLI executes this script.
-- Run only as a phase of the explicitly approved current-finance packet,
-- with verified backup, pinned preimages, native pause and existing guards.
SET XACT_ABORT ON;
IF @@TRANCOUNT <> 1 OR XACT_STATE() <> 1
    THROW 51830, 'CURRENT_FINANCE_SINGLE_OWNER_TRANSACTION_REQUIRED', 1;
IF @@SERVERNAME <> N'Semih\MELISADEV' OR DB_NAME() <> N'MELISA_ERP_SIRKET_TEST_20260929_01'
    THROW 51830, 'CURRENT_FINANCE_EXACT_TEST_REQUIRED', 1;
IF OBJECT_ID(N'tempdb..#approved_current_finance_precision') IS NULL
    THROW 51830, 'CURRENT_FINANCE_SEALED_APPROVAL_REQUIRED', 1;
IF NOT EXISTS (
    SELECT 1 FROM #approved_current_finance_precision
    WHERE packet_hash = CONVERT(char(64), SESSION_CONTEXT(N'current_finance_amount_approval'))
      AND backup_verified = 1 AND fresh_native_source_verified = 1
      AND mirror_before_images_verified = 1 AND native_writes_paused = 1
)
    THROW 51830, 'CURRENT_FINANCE_PRECISION_PRECONDITIONS', 1;
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id IN (OBJECT_ID(N'dbo.customers'),OBJECT_ID(N'dbo.suppliers'))
    AND name = N'balance' AND TYPE_NAME(user_type_id) = N'decimal' AND is_nullable = 0
    AND ((precision = 18 AND scale = 4) OR (precision = 28 AND scale = 8))) <> 2
    THROW 51830, 'CURRENT_FINANCE_EXISTING_BALANCE_SCHEMA', 1;
-- This preserves every existing value. Exact account balances remain the
-- authoritative per-currency values; no rounded source or FX conversion.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.customers') AND name=N'balance' AND scale=4)
    ALTER TABLE dbo.customers ALTER COLUMN balance decimal(28,8) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.suppliers') AND name=N'balance' AND scale=4)
    ALTER TABLE dbo.suppliers ALTER COLUMN balance decimal(28,8) NOT NULL;
-- The separately sealed scalar-mirror phase must then preserve account/ledger
-- and historical16, fix only approved main-currency mirrors, and rebind SQL
-- beforeimage hashes after this representational schema change. No other
-- currency, role, hold, stock, payment or opening is authorized here.
