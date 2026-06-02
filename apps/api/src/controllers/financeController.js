import {
  createCustomerCollection,
  createSupplierPayment,
  getFinanceMovements,
  getFinanceSummary,
} from '../services/financeService.js';
import { created, fail, ok } from '../utils/response.js';

function financeFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Finance operation failed',
  );
}

export async function getFinanceSummaryReport(req, res) {
  try {
    const data = await getFinanceSummary();
    return ok(res, data, { source: 'sql-finance-summary' });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_SUMMARY_FAILED');
  }
}

export async function getFinanceMovementList(req, res) {
  try {
    const data = await getFinanceMovements(req.query);
    return ok(res, data, { source: 'sql-finance-movements' });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_MOVEMENTS_FAILED');
  }
}

export async function postCustomerCollection(req, res) {
  try {
    const data = await createCustomerCollection(req.body, req.user);
    return created(res, data, {
      audit: 'customer_collection_created',
      source: 'sql-finance',
    });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_COLLECTION_FAILED');
  }
}

export async function postSupplierPayment(req, res) {
  try {
    const data = await createSupplierPayment(req.body, req.user);
    return created(res, data, {
      audit: 'supplier_payment_created',
      source: 'sql-finance',
    });
  } catch (error) {
    return financeFail(res, error, 'FINANCE_PAYMENT_FAILED');
  }
}
