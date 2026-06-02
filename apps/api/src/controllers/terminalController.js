import {
  getTerminalProductByBarcode,
  searchTerminalCustomers,
  searchTerminalProducts,
  submitTerminalSale,
} from '../services/terminalService.js';
import { created, fail, ok } from '../utils/response.js';

function terminalError(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Terminal request failed',
  );
}

export async function postTerminalSaleSubmit(req, res) {
  try {
    const data = await submitTerminalSale(req.body, req.user);
    return data.duplicate
      ? ok(res, data, { source: 'terminal-idempotent-replay' })
      : created(res, data, { source: 'terminal-sales-submit', commercialEffect: true });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_SALE_SUBMIT_FAILED');
  }
}

export async function getTerminalProductsSearch(req, res) {
  try {
    const { data, meta } = await searchTerminalProducts(req.query);
    return ok(res, data, {
      ...meta,
      source: 'terminal-product-search',
    });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_PRODUCT_SEARCH_FAILED');
  }
}

export async function getTerminalProductBarcode(req, res) {
  try {
    const data = await getTerminalProductByBarcode(req.params.barcode);
    return ok(res, data, {
      source: 'terminal-product-barcode',
    });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_PRODUCT_BARCODE_FAILED');
  }
}

export async function getTerminalCustomersSearch(req, res) {
  try {
    const { data, meta } = await searchTerminalCustomers(req.query);
    return ok(res, data, {
      ...meta,
      source: 'terminal-customer-search',
    });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_CUSTOMER_SEARCH_FAILED');
  }
}
