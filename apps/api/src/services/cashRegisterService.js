import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import {assertCleanCashRegisterTransaction} from './cleanStoreDayScope.mjs';

const CURRENCIES = ['TRY', 'USD', 'EUR'];

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toUpperCase();
  if (!CURRENCIES.includes(currency)) {
    throw makeServiceError('CASH_REGISTER_CURRENCY_INVALID', 'Currency must be TRY, USD or EUR');
  }
  return currency;
}

function normalizeAmount(value, { allowZero = true } = {}) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount <= 0)) {
    throw makeServiceError('CASH_REGISTER_AMOUNT_INVALID', 'Amount is invalid');
  }
  return Number(amount.toFixed(4));
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
    return value.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function trimText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function assertCashRegisterSchema(pool) {
  const result = await pool.request().query(`
    SELECT
      OBJECT_ID(N'dbo.cash_drawers', N'U') AS cash_drawers,
      OBJECT_ID(N'dbo.cash_sessions', N'U') AS cash_sessions,
      OBJECT_ID(N'dbo.cash_session_counts', N'U') AS cash_session_counts,
      OBJECT_ID(N'dbo.expense_categories', N'U') AS expense_categories,
      OBJECT_ID(N'dbo.cash_expenses', N'U') AS cash_expenses,
      OBJECT_ID(N'dbo.cash_transfers', N'U') AS cash_transfers,
      OBJECT_ID(N'dbo.cash_adjustments', N'U') AS cash_adjustments;
  `);
  const row = result.recordset?.[0] || {};
  if (Object.values(row).some((value) => !value)) {
    throw makeServiceError(
      'CASH_REGISTER_SCHEMA_MISSING',
      'Cash register migration 0012_multi_currency_cash_sessions.sql must be applied',
      503,
    );
  }
}

function mapDrawer(row) {
  return {
    id: Number(row.id),
    code: row.drawer_code,
    name: row.drawer_name,
    isActive: Boolean(row.is_active),
  };
}

function mapCategory(row) {
  return {
    id: Number(row.id),
    code: row.category_code,
    name: row.category_name,
    sortOrder: Number(row.sort_order || 0),
    isActive: Boolean(row.is_active),
  };
}

async function getDrawerAccounts(request, drawerId) {
  const result = await request
    .input('drawerAccountsDrawerId', sql.BigInt, drawerId)
    .query(`
      SELECT
        cda.currency_code,
        fa.id AS finance_account_id,
        fa.account_code,
        fa.account_name,
        fa.current_balance
      FROM dbo.cash_drawer_accounts cda
      INNER JOIN dbo.finance_accounts fa ON fa.id = cda.finance_account_id
      WHERE cda.drawer_id = @drawerAccountsDrawerId
        AND fa.is_active = 1;
    `);

  return new Map((result.recordset || []).map((row) => [row.currency_code, {
    id: Number(row.finance_account_id),
    code: row.account_code,
    name: row.account_name,
    currency: row.currency_code,
    currentBalance: Number(row.current_balance || 0),
  }]));
}

async function getMainCashAccount(request, currency) {
  const result = await request
    .input('mainCashCurrency', sql.NVarChar(3), currency)
    .input('mainCashCode', sql.NVarChar(40), `KASA-${currency}`)
    .query(`
      SELECT TOP (1) id, account_code, account_name, current_balance
      FROM dbo.finance_accounts WITH (UPDLOCK, HOLDLOCK)
      WHERE account_code = @mainCashCode
        AND currency_code = @mainCashCurrency
        AND account_type = N'cash'
        AND is_active = 1;
    `);
  const row = result.recordset?.[0];
  if (!row) {
    throw makeServiceError('CASH_REGISTER_MAIN_ACCOUNT_MISSING', `${currency} main cash account is missing`, 409);
  }
  return {
    id: Number(row.id),
    code: row.account_code,
    name: row.account_name,
    currentBalance: Number(row.current_balance || 0),
  };
}

async function insertFinanceMovement(request, {
  accountId,
  sourceType,
  partyType,
  partyMovementId,
  direction,
  amount,
  currency,
  documentNo,
  documentDate,
  description,
  actor,
}) {
  const balanceEffect = direction === 'out' ? -amount : amount;
  await request
    .input('cashMovementAccountId', sql.BigInt, accountId)
    .input('cashMovementSourceType', sql.NVarChar(30), sourceType)
    .input('cashMovementPartyType', sql.NVarChar(20), partyType)
    .input('cashMovementPartyMovementId', sql.BigInt, partyMovementId)
    .input('cashMovementDirection', sql.NVarChar(10), direction)
    .input('cashMovementAmount', sql.Decimal(18, 4), amount)
    .input('cashMovementCurrency', sql.NVarChar(3), currency)
    .input('cashMovementDocumentNo', sql.NVarChar(60), documentNo || null)
    .input('cashMovementDocumentDate', sql.Date, documentDate)
    .input('cashMovementDescription', sql.NVarChar(500), description || null)
    .input('cashMovementCreatedBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
    .input('cashMovementBalanceEffect', sql.Decimal(18, 4), balanceEffect)
    .query(`
      INSERT INTO dbo.finance_account_movements (
        account_id, source_type, party_type, party_movement_id, direction,
        amount, currency_code, payment_method, document_no, document_date,
        description, created_by
      )
      VALUES (
        @cashMovementAccountId, @cashMovementSourceType, @cashMovementPartyType,
        @cashMovementPartyMovementId, @cashMovementDirection, @cashMovementAmount,
        @cashMovementCurrency, N'cash', @cashMovementDocumentNo,
        @cashMovementDocumentDate, @cashMovementDescription, @cashMovementCreatedBy
      );

      UPDATE dbo.finance_accounts
      SET current_balance = current_balance + @cashMovementBalanceEffect,
          updated_at = SYSUTCDATETIME()
      WHERE id = @cashMovementAccountId;
    `);
}

async function createAdjustment(transaction, sqlDriver, {
  sessionId,
  currency,
  kind,
  direction,
  amount,
  reason,
  accountId,
  documentDate,
  actor,
}) {
  if (amount <= 0) return null;
  const result = await new sqlDriver.Request(transaction)
    .input('adjustmentSessionId', sqlDriver.BigInt, sessionId)
    .input('adjustmentCurrency', sqlDriver.NVarChar(3), currency)
    .input('adjustmentKind', sqlDriver.NVarChar(20), kind)
    .input('adjustmentDirection', sqlDriver.NVarChar(10), direction)
    .input('adjustmentAmount', sqlDriver.Decimal(18, 4), amount)
    .input('adjustmentReason', sqlDriver.NVarChar(500), reason)
    .input('adjustmentCreatedBy', sqlDriver.BigInt, actor?.id ? Number(actor.id) : null)
    .query(`
      DECLARE @created TABLE (id bigint NOT NULL);
      INSERT INTO dbo.cash_adjustments (
        session_id, currency_code, adjustment_kind, direction, amount, reason, created_by
      )
      OUTPUT inserted.id INTO @created(id)
      VALUES (
        @adjustmentSessionId, @adjustmentCurrency, @adjustmentKind,
        @adjustmentDirection, @adjustmentAmount, @adjustmentReason, @adjustmentCreatedBy
      );
      SELECT id FROM @created;
    `);
  const adjustmentId = Number(result.recordset[0].id);
  await insertFinanceMovement(new sqlDriver.Request(transaction), {
    accountId,
    sourceType: 'cash_adjustment',
    partyType: 'cash_drawer',
    partyMovementId: adjustmentId,
    direction,
    amount,
    currency,
    documentNo: `${kind === 'opening' ? 'KAF-AC' : 'KAF-KP'}-${adjustmentId}`,
    documentDate,
    description: reason,
    actor,
  });
  return adjustmentId;
}

async function createTransfer(transaction, sqlDriver, {
  sessionId,
  drawerAccountId,
  currency,
  direction,
  amount,
  description,
  documentDate,
  actor,
}) {
  if (amount <= 0) return null;
  const mainAccount = await getMainCashAccount(new sqlDriver.Request(transaction), currency);
  const transferResult = await new sqlDriver.Request(transaction)
    .input('transferSessionId', sqlDriver.BigInt, sessionId)
    .input('transferCurrency', sqlDriver.NVarChar(3), currency)
    .input('transferDirection', sqlDriver.NVarChar(20), direction)
    .input('transferAmount', sqlDriver.Decimal(18, 4), amount)
    .input('transferDescription', sqlDriver.NVarChar(500), description || null)
    .input('transferCreatedBy', sqlDriver.BigInt, actor?.id ? Number(actor.id) : null)
    .query(`
      DECLARE @created TABLE (id bigint NOT NULL);
      INSERT INTO dbo.cash_transfers (
        session_id, currency_code, transfer_direction, amount, description, created_by
      )
      OUTPUT inserted.id INTO @created(id)
      VALUES (
        @transferSessionId, @transferCurrency, @transferDirection,
        @transferAmount, @transferDescription, @transferCreatedBy
      );
      SELECT id FROM @created;
    `);
  const transferId = Number(transferResult.recordset[0].id);
  const mainToDrawer = direction === 'main_to_drawer';
  const documentNo = `KTR-${transferId}`;
  await insertFinanceMovement(new sqlDriver.Request(transaction), {
    accountId: mainAccount.id,
    sourceType: 'cash_transfer',
    partyType: 'main_cash',
    partyMovementId: transferId,
    direction: mainToDrawer ? 'out' : 'in',
    amount,
    currency,
    documentNo,
    documentDate,
    description,
    actor,
  });
  await insertFinanceMovement(new sqlDriver.Request(transaction), {
    accountId: drawerAccountId,
    sourceType: 'cash_transfer',
    partyType: 'cash_drawer',
    partyMovementId: transferId,
    direction: mainToDrawer ? 'in' : 'out',
    amount,
    currency,
    documentNo,
    documentDate,
    description,
    actor,
  });
  return transferId;
}

async function getSessionExpectedAmounts(request, sessionId) {
  const result = await request
    .input('expectedSessionId', sql.BigInt, sessionId)
    .query(`
      SELECT
        csc.currency_code,
        csc.physical_opening_amount,
        csc.opening_transfer_amount,
        csc.physical_opening_amount + COALESCE(SUM(
          CASE
            WHEN fam.source_type = N'cash_adjustment' AND ca.adjustment_kind = N'opening' THEN 0
            WHEN fam.direction = N'in' THEN fam.amount
            ELSE -fam.amount
          END
        ), 0) AS expected_amount
      FROM dbo.cash_session_counts csc
      INNER JOIN dbo.cash_sessions cs ON cs.id = csc.session_id
      INNER JOIN dbo.cash_drawer_accounts cda
        ON cda.drawer_id = cs.drawer_id AND cda.currency_code = csc.currency_code
      LEFT JOIN dbo.finance_account_movements fam
        ON fam.account_id = cda.finance_account_id
        AND fam.created_at >= cs.opened_at
        AND (cs.closed_at IS NULL OR fam.created_at <= cs.closed_at)
      LEFT JOIN dbo.cash_adjustments ca
        ON fam.source_type = N'cash_adjustment'
        AND fam.party_type = N'cash_drawer'
        AND fam.party_movement_id = ca.id
      WHERE csc.session_id = @expectedSessionId
      GROUP BY csc.currency_code, csc.physical_opening_amount, csc.opening_transfer_amount;
    `);
  return new Map((result.recordset || []).map((row) => [row.currency_code, Number(row.expected_amount || 0)]));
}

export async function listExpenseCategories({ includePassive = false } = {}, context) {
  const pool = context?.pool ?? await getSqlPool();
  await assertCashRegisterSchema(pool);
  const result = await pool.request()
    .input('includePassive', sql.Bit, includePassive ? 1 : 0)
    .query(`
      SELECT *
      FROM dbo.expense_categories
      WHERE @includePassive = 1 OR is_active = 1
      ORDER BY sort_order, category_name;
    `);
  return (result.recordset || []).map(mapCategory);
}

export async function getCashRegisterOverview(query = {}, context) {
  const businessDate = normalizeDate(query.businessDate);
  const requestedDrawerId = Number(query.drawerId || 0);
  const pool = context?.pool ?? await getSqlPool();
  await assertCashRegisterSchema(pool);

  const drawersResult = await pool.request().query(`
    SELECT * FROM dbo.cash_drawers WHERE is_active = 1 ORDER BY drawer_name;
  `);
  const drawers = (drawersResult.recordset || []).map(mapDrawer);
  const drawerId = Number.isInteger(requestedDrawerId) && requestedDrawerId > 0
    ? requestedDrawerId
    : drawers[0]?.id;
  const categories = await listExpenseCategories({}, context);
  if (!drawerId) return { drawers, categories, session: null, currencies: [], movements: [] };

  const sessionResult = await pool.request()
    .input('overviewDrawerId', sql.BigInt, drawerId)
    .input('overviewBusinessDate', sql.Date, businessDate)
    .query(`
      SELECT TOP (1) cs.*, cd.drawer_code, cd.drawer_name
      FROM dbo.cash_sessions cs
      INNER JOIN dbo.cash_drawers cd ON cd.id = cs.drawer_id
      WHERE cs.drawer_id = @overviewDrawerId
        AND cs.business_date = @overviewBusinessDate;
    `);
  const sessionRow = sessionResult.recordset?.[0];
  if (!sessionRow) return { drawers, categories, session: null, currencies: [], movements: [] };

  const expectedAmounts = await getSessionExpectedAmounts(pool.request(), Number(sessionRow.id));
  const countsResult = await pool.request()
    .input('countsSessionId', sql.BigInt, Number(sessionRow.id))
    .query(`
      SELECT csc.*, fa.current_balance AS ledger_balance
      FROM dbo.cash_session_counts csc
      INNER JOIN dbo.cash_sessions cs ON cs.id = csc.session_id
      INNER JOIN dbo.cash_drawer_accounts cda
        ON cda.drawer_id = cs.drawer_id AND cda.currency_code = csc.currency_code
      INNER JOIN dbo.finance_accounts fa ON fa.id = cda.finance_account_id
      WHERE csc.session_id = @countsSessionId
      ORDER BY CASE csc.currency_code WHEN N'TRY' THEN 1 WHEN N'USD' THEN 2 ELSE 3 END;
    `);
  const currencies = (countsResult.recordset || []).map((row) => ({
    currency: row.currency_code,
    physicalOpening: Number(row.physical_opening_amount || 0),
    openingTransfer: Number(row.opening_transfer_amount || 0),
    expected: sessionRow.session_status === 'closed' && row.expected_closing_amount !== null
      ? Number(row.expected_closing_amount)
      : expectedAmounts.get(row.currency_code) || 0,
    physicalClosing: row.physical_closing_amount === null ? null : Number(row.physical_closing_amount),
    difference: row.difference_amount === null ? null : Number(row.difference_amount),
    carryForward: row.carry_forward_amount === null ? null : Number(row.carry_forward_amount),
    transferredToMain: row.transferred_to_main_amount === null ? null : Number(row.transferred_to_main_amount),
    ledgerBalance: Number(row.ledger_balance || 0),
  }));

  const movementResult = await pool.request()
    .input('movementSessionId', sql.BigInt, Number(sessionRow.id))
    .query(`
      SELECT
        fam.id,
        fam.source_type,
        fam.direction,
        fam.amount,
        fam.currency_code,
        fam.document_no,
        fam.document_date,
        fam.description,
        fam.created_at,
        ec.category_name,
        ca.adjustment_kind,
        ct.transfer_direction
      FROM dbo.cash_sessions cs
      INNER JOIN dbo.cash_drawer_accounts cda ON cda.drawer_id = cs.drawer_id
      INNER JOIN dbo.finance_account_movements fam
        ON fam.account_id = cda.finance_account_id
        AND fam.created_at >= cs.opened_at
        AND (cs.closed_at IS NULL OR fam.created_at <= cs.closed_at)
      LEFT JOIN dbo.cash_expenses ce
        ON fam.source_type = N'expense' AND fam.party_movement_id = ce.id
      LEFT JOIN dbo.expense_categories ec ON ec.id = ce.expense_category_id
      LEFT JOIN dbo.cash_adjustments ca
        ON fam.source_type = N'cash_adjustment' AND fam.party_movement_id = ca.id
      LEFT JOIN dbo.cash_transfers ct
        ON fam.source_type = N'cash_transfer' AND fam.party_movement_id = ct.id
      WHERE cs.id = @movementSessionId
        AND fam.party_type IN (N'customer', N'supplier', N'cash_drawer')
        AND NOT (fam.source_type = N'cash_adjustment' AND ca.adjustment_kind = N'opening')
      ORDER BY fam.created_at, fam.id;
    `);

  const running = Object.fromEntries(currencies.map((row) => [row.currency, row.physicalOpening]));
  const movements = (movementResult.recordset || []).map((row) => {
    const effect = row.direction === 'out' ? -Number(row.amount || 0) : Number(row.amount || 0);
    running[row.currency_code] = Number((Number(running[row.currency_code] || 0) + effect).toFixed(4));
    const typeLabels = {
      collection: 'Nakit Tahsilat',
      payment: 'Nakit Ödeme',
      expense: 'Masraf',
      cash_transfer: row.transfer_direction === 'main_to_drawer' ? 'Ana Kasadan Giriş' : 'Ana Kasaya Teslim',
      cash_adjustment: 'Kasa Fark Düzeltmesi',
    };
    return {
      id: Number(row.id),
      sourceType: row.source_type,
      typeLabel: typeLabels[row.source_type] || row.source_type,
      direction: row.direction,
      amount: Number(row.amount || 0),
      currency: row.currency_code,
      documentNo: row.document_no || '-',
      documentDate: row.document_date,
      description: row.description || '',
      categoryName: row.category_name || '',
      createdAt: row.created_at,
      runningBalance: running[row.currency_code],
    };
  });

  return {
    drawers,
    categories,
    session: {
      id: Number(sessionRow.id),
      drawerId: Number(sessionRow.drawer_id),
      drawerCode: sessionRow.drawer_code,
      drawerName: sessionRow.drawer_name,
      businessDate: sessionRow.business_date,
      status: sessionRow.session_status,
      openingNote: sessionRow.opening_note || '',
      closingNote: sessionRow.closing_note || '',
      openedAt: sessionRow.opened_at,
      closedAt: sessionRow.closed_at,
    },
    currencies,
    movements,
  };
}

export async function openCashSession(payload, actor, context) {
  if(context)assertCleanCashRegisterTransaction(context,'cash_open',actor);
  assertMelisaWriteEnabled();
  const drawerId = Number(payload.drawerId);
  const businessDate = normalizeDate(payload.businessDate);
  const openingNote = trimText(payload.openingNote);
  if (!Number.isInteger(drawerId) || drawerId < 1) {
    throw makeServiceError('CASH_REGISTER_DRAWER_REQUIRED', 'Cash drawer is required');
  }
  const entries = CURRENCIES.map((currency) => ({
    currency,
    physicalOpening: normalizeAmount(payload.counts?.[currency]?.physicalOpening),
    openingTransfer: normalizeAmount(payload.counts?.[currency]?.openingTransfer),
  }));

  const pool = context?.pool ?? await getSqlPool();
  await assertCashRegisterSchema(pool);
  const sqlDriver = context?.sqlDriver ?? getSqlDriver();
  const transaction = context?.transaction ?? new sqlDriver.Transaction(pool);
  if(!context)await transaction.begin();
  try {
    const accounts = await getDrawerAccounts(new sqlDriver.Request(transaction), drawerId);
    if (CURRENCIES.some((currency) => !accounts.has(currency))) {
      throw makeServiceError('CASH_REGISTER_DRAWER_ACCOUNTS_MISSING', 'Drawer must have TRY, USD and EUR accounts', 409);
    }
    const existing = await new sqlDriver.Request(transaction)
      .input('openDrawerId', sqlDriver.BigInt, drawerId)
      .input('openBusinessDate', sqlDriver.Date, businessDate)
      .query(`
        SELECT TOP (1) id, drawer_id, business_date, session_status
        FROM dbo.cash_sessions WITH (UPDLOCK, HOLDLOCK)
        WHERE (drawer_id = @openDrawerId AND business_date = @openBusinessDate)
           OR session_status = N'open';
      `);
    if (existing.recordset?.[0]) {
      throw makeServiceError('CASH_REGISTER_SESSION_EXISTS', 'Another cash session is already open or this date was previously used', 409);
    }
    const sessionInsert = await new sqlDriver.Request(transaction)
      .input('sessionDrawerId', sqlDriver.BigInt, drawerId)
      .input('sessionBusinessDate', sqlDriver.Date, businessDate)
      .input('sessionOpeningNote', sqlDriver.NVarChar(500), openingNote || null)
      .input('sessionOpenedBy', sqlDriver.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        DECLARE @created TABLE (id bigint NOT NULL);
        INSERT INTO dbo.cash_sessions (drawer_id, business_date, opening_note, opened_by)
        OUTPUT inserted.id INTO @created(id)
        VALUES (@sessionDrawerId, @sessionBusinessDate, @sessionOpeningNote, @sessionOpenedBy);
        SELECT id FROM @created;
      `);
    const sessionId = Number(sessionInsert.recordset[0].id);

    for (const entry of entries) {
      const account = accounts.get(entry.currency);
      const ledgerDifference = Number((entry.physicalOpening - account.currentBalance).toFixed(4));
      if (ledgerDifference !== 0 && !openingNote) {
        throw makeServiceError('CASH_REGISTER_OPENING_DIFFERENCE_NOTE_REQUIRED', 'Opening difference requires a note');
      }
      await new sqlDriver.Request(transaction)
        .input('countSessionId', sqlDriver.BigInt, sessionId)
        .input('countCurrency', sqlDriver.NVarChar(3), entry.currency)
        .input('countPhysicalOpening', sqlDriver.Decimal(18, 4), entry.physicalOpening)
        .input('countOpeningTransfer', sqlDriver.Decimal(18, 4), entry.openingTransfer)
        .query(`
          INSERT INTO dbo.cash_session_counts (
            session_id, currency_code, physical_opening_amount, opening_transfer_amount
          ) VALUES (
            @countSessionId, @countCurrency, @countPhysicalOpening, @countOpeningTransfer
          );
        `);
      if (ledgerDifference !== 0) {
        await createAdjustment(transaction, sqlDriver, {
          sessionId,
          currency: entry.currency,
          kind: 'opening',
          direction: ledgerDifference > 0 ? 'in' : 'out',
          amount: Math.abs(ledgerDifference),
          reason: openingNote,
          accountId: account.id,
          documentDate: businessDate,
          actor,
        });
      }
      if (entry.openingTransfer > 0) {
        await createTransfer(transaction, sqlDriver, {
          sessionId,
          drawerAccountId: account.id,
          currency: entry.currency,
          direction: 'main_to_drawer',
          amount: entry.openingTransfer,
          description: 'Sabah ana kasadan çekmeceye eklenen para',
          documentDate: businessDate,
          actor,
        });
      }
    }

    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'cash_session_opened',
      entityType: 'cash_session',
      entityId: sessionId,
      afterSnapshot: { drawerId, businessDate, entries, openingNote },
    });
    if(!context)await transaction.commit();
    return getCashRegisterOverview({ drawerId, businessDate },context);
  } catch (error) {
    if(!context)await transaction.rollback();
    throw error;
  }
}

export async function createCashExpense(payload, actor, context) {
  if(context)assertCleanCashRegisterTransaction(context,'cash_expense',actor);
  assertMelisaWriteEnabled();
  const sessionId = Number(payload.sessionId);
  const categoryId = Number(payload.categoryId);
  const currency = normalizeCurrency(payload.currency);
  const amount = normalizeAmount(payload.amount, { allowZero: false });
  const description = trimText(payload.description);
  const documentNo = trimText(payload.documentNo, 60);
  if (!Number.isInteger(sessionId) || sessionId < 1 || !Number.isInteger(categoryId) || categoryId < 1) {
    throw makeServiceError('CASH_EXPENSE_REQUIRED_FIELDS', 'Session and expense category are required');
  }
  if (!description) throw makeServiceError('CASH_EXPENSE_DESCRIPTION_REQUIRED', 'Expense description is required');

  const pool = context?.pool ?? await getSqlPool();
  await assertCashRegisterSchema(pool);
  const sqlDriver = context?.sqlDriver ?? getSqlDriver();
  const transaction = context?.transaction ?? new sqlDriver.Transaction(pool);
  if(!context)await transaction.begin();
  try {
    const session = await new sqlDriver.Request(transaction)
      .input('expenseSessionId', sqlDriver.BigInt, sessionId)
      .input('expenseCurrency', sqlDriver.NVarChar(3), currency)
      .input('expenseCategoryId', sqlDriver.BigInt, categoryId)
      .query(`
        SELECT TOP (1)
          cs.id, cs.business_date, cda.finance_account_id, ec.category_name
        FROM dbo.cash_sessions cs WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.cash_drawer_accounts cda
          ON cda.drawer_id = cs.drawer_id AND cda.currency_code = @expenseCurrency
        INNER JOIN dbo.expense_categories ec
          ON ec.id = @expenseCategoryId AND ec.is_active = 1
        WHERE cs.id = @expenseSessionId AND cs.session_status = N'open';
      `);
    const row = session.recordset?.[0];
    if (!row) throw makeServiceError('CASH_REGISTER_OPEN_SESSION_REQUIRED', 'Open cash session is required', 409);

    const expenseInsert = await new sqlDriver.Request(transaction)
      .input('insertExpenseSessionId', sqlDriver.BigInt, sessionId)
      .input('insertExpenseCategoryId', sqlDriver.BigInt, categoryId)
      .input('insertExpenseCurrency', sqlDriver.NVarChar(3), currency)
      .input('insertExpenseAmount', sqlDriver.Decimal(18, 4), amount)
      .input('insertExpenseDocumentNo', sqlDriver.NVarChar(60), documentNo || null)
      .input('insertExpenseDescription', sqlDriver.NVarChar(500), description)
      .input('insertExpenseCreatedBy', sqlDriver.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        DECLARE @created TABLE (id bigint NOT NULL);
        INSERT INTO dbo.cash_expenses (
          session_id, expense_category_id, currency_code, amount,
          document_no, description, created_by
        )
        OUTPUT inserted.id INTO @created(id)
        VALUES (
          @insertExpenseSessionId, @insertExpenseCategoryId, @insertExpenseCurrency,
          @insertExpenseAmount, @insertExpenseDocumentNo, @insertExpenseDescription,
          @insertExpenseCreatedBy
        );
        SELECT id FROM @created;
      `);
    const expenseId = Number(expenseInsert.recordset[0].id);
    await insertFinanceMovement(new sqlDriver.Request(transaction), {
      accountId: Number(row.finance_account_id),
      sourceType: 'expense',
      partyType: 'cash_drawer',
      partyMovementId: expenseId,
      direction: 'out',
      amount,
      currency,
      documentNo: documentNo || `MSF-${expenseId}`,
      documentDate: normalizeDate(row.business_date),
      description: `${row.category_name}: ${description}`,
      actor,
    });
    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'cash_expense_created',
      entityType: 'cash_expense',
      entityId: expenseId,
      afterSnapshot: { sessionId, categoryId, categoryName: row.category_name, currency, amount, documentNo, description },
    });
    if(!context)await transaction.commit();
    return { id: expenseId, sessionId, currency, amount, categoryName: row.category_name };
  } catch (error) {
    if(!context)await transaction.rollback();
    throw error;
  }
}

export async function createCashTransfer(payload, actor, context) {
  if(context)assertCleanCashRegisterTransaction(context,'cash_transfer',actor);
  assertMelisaWriteEnabled();
  const sessionId = Number(payload.sessionId);
  const currency = normalizeCurrency(payload.currency);
  const amount = normalizeAmount(payload.amount, { allowZero: false });
  const direction = trimText(payload.direction, 20);
  const description = trimText(payload.description) || (direction === 'main_to_drawer' ? 'Ana kasadan çekmeceye transfer' : 'Çekmeceden ana kasaya transfer');
  if (!['main_to_drawer', 'drawer_to_main'].includes(direction)) {
    throw makeServiceError('CASH_TRANSFER_DIRECTION_INVALID', 'Transfer direction is invalid');
  }
  const pool = context?.pool ?? await getSqlPool();
  await assertCashRegisterSchema(pool);
  const sqlDriver = context?.sqlDriver ?? getSqlDriver();
  const transaction = context?.transaction ?? new sqlDriver.Transaction(pool);
  if(!context)await transaction.begin();
  try {
    const session = await new sqlDriver.Request(transaction)
      .input('manualTransferSessionId', sqlDriver.BigInt, sessionId)
      .input('manualTransferCurrency', sqlDriver.NVarChar(3), currency)
      .query(`
        SELECT TOP (1) cs.business_date, cda.finance_account_id
        FROM dbo.cash_sessions cs WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.cash_drawer_accounts cda
          ON cda.drawer_id = cs.drawer_id AND cda.currency_code = @manualTransferCurrency
        WHERE cs.id = @manualTransferSessionId AND cs.session_status = N'open';
      `);
    const row = session.recordset?.[0];
    if (!row) throw makeServiceError('CASH_REGISTER_OPEN_SESSION_REQUIRED', 'Open cash session is required', 409);
    const transferId = await createTransfer(transaction, sqlDriver, {
      sessionId,
      drawerAccountId: Number(row.finance_account_id),
      currency,
      direction,
      amount,
      description,
      documentDate: normalizeDate(row.business_date),
      actor,
    });
    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'cash_transfer_created',
      entityType: 'cash_transfer',
      entityId: transferId,
      afterSnapshot: { sessionId, currency, direction, amount, description },
    });
    if(!context)await transaction.commit();
    return { id: transferId, sessionId, currency, direction, amount };
  } catch (error) {
    if(!context)await transaction.rollback();
    throw error;
  }
}

export async function closeCashSession(payload, actor, context) {
  if(context)assertCleanCashRegisterTransaction(context,'cash_close',actor);
  assertMelisaWriteEnabled();
  const sessionId = Number(payload.sessionId);
  const closingNote = trimText(payload.closingNote);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    throw makeServiceError('CASH_REGISTER_SESSION_REQUIRED', 'Cash session is required');
  }
  const entries = CURRENCIES.map((currency) => ({
    currency,
    physicalClosing: normalizeAmount(payload.counts?.[currency]?.physicalClosing),
    carryForward: normalizeAmount(payload.counts?.[currency]?.carryForward),
  }));
  if (entries.some((entry) => entry.carryForward > entry.physicalClosing)) {
    throw makeServiceError('CASH_REGISTER_CARRY_INVALID', 'Carry forward cannot exceed physical closing amount');
  }

  const pool = context?.pool ?? await getSqlPool();
  await assertCashRegisterSchema(pool);
  const sqlDriver = context?.sqlDriver ?? getSqlDriver();
  const transaction = context?.transaction ?? new sqlDriver.Transaction(pool);
  if(!context)await transaction.begin();
  try {
    const sessionResult = await new sqlDriver.Request(transaction)
      .input('closeSessionId', sqlDriver.BigInt, sessionId)
      .query(`
        SELECT TOP (1) * FROM dbo.cash_sessions WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @closeSessionId AND session_status = N'open';
      `);
    const session = sessionResult.recordset?.[0];
    if (!session) throw makeServiceError('CASH_REGISTER_OPEN_SESSION_REQUIRED', 'Open cash session is required', 409);
    const accounts = await getDrawerAccounts(new sqlDriver.Request(transaction), Number(session.drawer_id));
    const expectedAmounts = await getSessionExpectedAmounts(new sqlDriver.Request(transaction), sessionId);
    const differences = entries.map((entry) => ({
      ...entry,
      expected: Number(expectedAmounts.get(entry.currency) || 0),
      difference: Number((entry.physicalClosing - Number(expectedAmounts.get(entry.currency) || 0)).toFixed(4)),
      transferToMain: Number((entry.physicalClosing - entry.carryForward).toFixed(4)),
    }));
    if (differences.some((entry) => entry.difference !== 0) && !closingNote) {
      throw makeServiceError('CASH_REGISTER_CLOSING_DIFFERENCE_NOTE_REQUIRED', 'Closing difference requires a note');
    }

    for (const entry of differences) {
      const account = accounts.get(entry.currency);
      if (entry.difference !== 0) {
        await createAdjustment(transaction, sqlDriver, {
          sessionId,
          currency: entry.currency,
          kind: 'closing',
          direction: entry.difference > 0 ? 'in' : 'out',
          amount: Math.abs(entry.difference),
          reason: closingNote,
          accountId: account.id,
          documentDate: normalizeDate(session.business_date),
          actor,
        });
      }
      if (entry.transferToMain > 0) {
        await createTransfer(transaction, sqlDriver, {
          sessionId,
          drawerAccountId: account.id,
          currency: entry.currency,
          direction: 'drawer_to_main',
          amount: entry.transferToMain,
          description: 'Akşam çekmeceden ana kasaya teslim',
          documentDate: normalizeDate(session.business_date),
          actor,
        });
      }
      await new sqlDriver.Request(transaction)
        .input('closeCountSessionId', sqlDriver.BigInt, sessionId)
        .input('closeCountCurrency', sqlDriver.NVarChar(3), entry.currency)
        .input('closeExpected', sqlDriver.Decimal(18, 4), entry.expected)
        .input('closePhysical', sqlDriver.Decimal(18, 4), entry.physicalClosing)
        .input('closeDifference', sqlDriver.Decimal(18, 4), entry.difference)
        .input('closeCarry', sqlDriver.Decimal(18, 4), entry.carryForward)
        .input('closeTransferred', sqlDriver.Decimal(18, 4), entry.transferToMain)
        .query(`
          UPDATE dbo.cash_session_counts
          SET expected_closing_amount = @closeExpected,
              physical_closing_amount = @closePhysical,
              difference_amount = @closeDifference,
              carry_forward_amount = @closeCarry,
              transferred_to_main_amount = @closeTransferred
          WHERE session_id = @closeCountSessionId AND currency_code = @closeCountCurrency;
        `);
    }

    await new sqlDriver.Request(transaction)
      .input('finishSessionId', sqlDriver.BigInt, sessionId)
      .input('finishClosingNote', sqlDriver.NVarChar(500), closingNote || null)
      .input('finishClosedBy', sqlDriver.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.cash_sessions
        SET session_status = N'closed', closing_note = @finishClosingNote,
            closed_by = @finishClosedBy, closed_at = SYSUTCDATETIME()
        WHERE id = @finishSessionId;
      `);
    await writeAuditLog(new sqlDriver.Request(transaction), {
      actor,
      action: 'cash_session_closed',
      entityType: 'cash_session',
      entityId: sessionId,
      afterSnapshot: { differences, closingNote },
    });
    if(!context)await transaction.commit();
    return getCashRegisterOverview({ drawerId: Number(session.drawer_id), businessDate: normalizeDate(session.business_date) },context);
  } catch (error) {
    if(!context)await transaction.rollback();
    throw error;
  }
}
