import {
  getCustomerMovementsList,
  getCustomerStatement,
  getSupplierMovementsList,
  getSupplierStatement,
  getStockMovementsList,
  getStockValuationReport,
  applyStockCountAdjustment,
} from '../services/movementService.js';
import { fail, ok } from '../utils/response.js';

function movementError(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Movement query failed',
  );
}

export async function getStockMovements(req, res) {
  try {
    const { data, meta } = await getStockMovementsList(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return movementError(res, error, 'STOCK_MOVEMENTS_FAILED');
  }
}

export async function getStockValuation(req, res) {
  try {
    const { data, meta } = await getStockValuationReport(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return movementError(res, error, 'STOCK_VALUATION_FAILED');
  }
}

export async function postStockCountAdjustment(req, res) {
  try {
    const data = await applyStockCountAdjustment(req.body, req.user);
    return ok(res, data, {
      source: 'sql-stock-count-adjustment',
      write: true,
    });
  } catch (error) {
    return movementError(res, error, 'STOCK_COUNT_ADJUSTMENT_FAILED');
  }
}

export async function getCustomerMovements(req, res) {
  try {
    const { data, meta } = await getCustomerMovementsList(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return movementError(res, error, 'CUSTOMER_MOVEMENTS_FAILED');
  }
}

export async function getCustomerStatementReport(req, res) {
  try {
    const data = await getCustomerStatement(req.query);
    return ok(res, data, {
      source: 'sql-customer-statement',
    });
  } catch (error) {
    return movementError(res, error, 'CUSTOMER_STATEMENT_FAILED');
  }
}

export async function getSupplierMovements(req, res) {
  try {
    const { data, meta } = await getSupplierMovementsList(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return movementError(res, error, 'SUPPLIER_MOVEMENTS_FAILED');
  }
}

export async function getSupplierStatementReport(req, res) {
  try {
    const data = await getSupplierStatement(req.query);
    return ok(res, data, {
      source: 'sql-supplier-statement',
    });
  } catch (error) {
    return movementError(res, error, 'SUPPLIER_STATEMENT_FAILED');
  }
}
