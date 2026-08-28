import {
  closeCashSession,
  createCashExpense,
  createCashTransfer,
  getCashRegisterOverview,
  listExpenseCategories,
  openCashSession,
} from '../services/cashRegisterService.js';
import { created, fail, ok } from '../utils/response.js';

function cashRegisterFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Cash register operation failed',
  );
}

export async function getCashRegister(req, res) {
  try {
    return ok(res, await getCashRegisterOverview(req.query), { source: 'sql-cash-register' });
  } catch (error) {
    return cashRegisterFail(res, error, 'CASH_REGISTER_READ_FAILED');
  }
}

export async function getCashExpenseCategories(req, res) {
  try {
    return ok(res, await listExpenseCategories(req.query), { source: 'sql-expense-categories' });
  } catch (error) {
    return cashRegisterFail(res, error, 'CASH_EXPENSE_CATEGORIES_FAILED');
  }
}

export async function postCashSessionOpen(req, res) {
  try {
    return created(res, await openCashSession(req.body, req.user), {
      audit: 'cash_session_opened',
      source: 'sql-cash-register',
    });
  } catch (error) {
    return cashRegisterFail(res, error, 'CASH_SESSION_OPEN_FAILED');
  }
}

export async function postCashExpense(req, res) {
  try {
    return created(res, await createCashExpense(req.body, req.user), {
      audit: 'cash_expense_created',
      source: 'sql-cash-register',
    });
  } catch (error) {
    return cashRegisterFail(res, error, 'CASH_EXPENSE_CREATE_FAILED');
  }
}

export async function postCashTransfer(req, res) {
  try {
    return created(res, await createCashTransfer(req.body, req.user), {
      audit: 'cash_transfer_created',
      source: 'sql-cash-register',
    });
  } catch (error) {
    return cashRegisterFail(res, error, 'CASH_TRANSFER_CREATE_FAILED');
  }
}

export async function postCashSessionClose(req, res) {
  try {
    return ok(res, await closeCashSession(req.body, req.user), {
      audit: 'cash_session_closed',
      source: 'sql-cash-register',
    });
  } catch (error) {
    return cashRegisterFail(res, error, 'CASH_SESSION_CLOSE_FAILED');
  }
}
