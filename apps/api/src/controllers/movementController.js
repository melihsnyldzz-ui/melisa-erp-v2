import {
  getCustomerMovementsList,
  getCustomerStatement,
  getSupplierMovementsList,
  getSupplierStatement,
  getStockMovementsList,
  getStockValuationReport,
  applyStockCountAdjustment,
} from '../services/movementService.js';
import {
  getVegaCustomerLedgerListFromWorker,
  getVegaCustomerStockExitDocumentFromWorker,
  getVegaSalesStockExitListFromWorker,
} from '../services/vegaKoliLedgerClientService.js';
import {
  getVegaPurchaseInvoiceListFromWorker,
  getVegaSupplierLedgerListFromWorker,
  getVegaSupplierPurchaseDocumentFromWorker,
  getVegaSupplierPurchaseIntelligenceFromWorker,
} from '../services/vegaSupplierClientService.js';
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

export async function getVegaCustomerLedger(req, res) {
  try {
    const { data, meta } = await getVegaCustomerLedgerListFromWorker(req.params.customerSourceId, req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_CUSTOMER_LEDGER_FAILED', 'Vega cari hareketleri okunamadı');
  }
}

export async function getVegaCustomerStockExitDocument(req, res) {
  try {
    const data = await getVegaCustomerStockExitDocumentFromWorker(req.params.customerSourceId, req.params.movementSourceId);
    return ok(res, data, { source: 'vega-live-read-only' });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_CUSTOMER_STOCK_EXIT_FAILED', 'Vega stok çıkış fişi okunamadı');
  }
}

export async function getVegaSalesStockExits(req, res) {
  try {
    const { data, meta } = await getVegaSalesStockExitListFromWorker(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_SALES_STOCK_EXIT_LIST_FAILED', 'Vega satış fişleri okunamadı');
  }
}

export async function getVegaSupplierLedger(req, res) {
  try {
    const { data, meta } = await getVegaSupplierLedgerListFromWorker(req.params.supplierSourceId, req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_SUPPLIER_LEDGER_FAILED', 'Vega tedarikçi hareketleri okunamadı');
  }
}

export async function getVegaPurchaseInvoices(req, res) {
  try {
    const { data, meta } = await getVegaPurchaseInvoiceListFromWorker(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_PURCHASE_LIST_FAILED', 'Vega alış fişleri okunamadı');
  }
}

export async function getVegaSupplierPurchaseDocument(req, res) {
  try {
    const data = await getVegaSupplierPurchaseDocumentFromWorker(req.params.supplierSourceId, req.params.movementSourceId);
    return ok(res, data, { source: 'vega-live-read-only' });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_SUPPLIER_PURCHASE_FAILED', 'Vega alış faturası okunamadı');
  }
}

export async function getVegaSupplierPurchaseIntelligence(req, res) {
  try {
    const data = await getVegaSupplierPurchaseIntelligenceFromWorker(req.params.supplierSourceId, req.query);
    return ok(res, data, { source: 'vega-live-read-only' });
  } catch (error) {
    return fail(
      res,
      error.statusCode || 503,
      error.code || 'VEGA_SUPPLIER_PURCHASE_INTELLIGENCE_FAILED',
      'Vega tedarikçi ürün ve alış fiyatı bağlamı okunamadı',
    );
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
