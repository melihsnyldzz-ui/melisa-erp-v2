import {
  getTerminalProductByBarcode,
  searchTerminalCustomers,
  searchTerminalProducts,
  submitTerminalSale,
  getTerminalSaleStatus,
  getTerminalSaleReadiness,
} from '../services/terminalService.js';
import { sendTerminalWhatsappShare } from '../services/catalogService.js';
import { printTerminalSaleReceipt } from '../services/terminalReceiptPrintService.js';
import { getCurrencyRates } from '../services/currencyRateService.js';
import { readArmadaProfile } from '../services/armadaReadBridgeClient.mjs';
import { issueTerminalRateSnapshot } from '../services/terminalRateSnapshot.mjs';
import { enrichOfflineCatalog } from '../services/terminalOfflineCatalogService.mjs';
import { created, fail, ok } from '../utils/response.js';

function terminalError(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Terminal request failed',
    error.code === 'TERMINAL_VEGA_SALE_WRITE_DISABLED' || (error.submissionAttempted === false && error.commercialEffect === false)
      ? { submissionAttempted: false, commercialEffect: false }
      : {},
  );
}

export async function postTerminalSaleSubmit(req, res) {
  try {
    const data = await submitTerminalSale(req.body, req.user);
    if (data.state === 'SUBMITTED_PENDING_VERIFICATION') return ok(res.status(202), data, { source: 'terminal-armada-transport', commercialEffect: null, submissionAttempted: true });
    if (data.state === 'REVIEW_REQUIRED') return ok(res.status(202), data, { source: 'terminal-armada', commercialEffect: null, submissionAttempted: true });
    if (data.state === 'VERIFIED') return ok(res, data, { source: 'terminal-armada-vega-verified', commercialEffect: true, submissionAttempted: true });
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
    const rows = req.query.offline === '1' ? await enrichOfflineCatalog('product', data) : data;
    return ok(res, rows, {
      ...meta,
      source: meta?.source || 'terminal-product-search',
    });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_PRODUCT_SEARCH_FAILED');
  }
}

export async function getTerminalProductBarcode(req, res) {
  try {
    const data = await getTerminalProductByBarcode(req.params.barcode);
    return ok(res, data, {
      source: 'terminal-vega-live-read-only',
      saleWriteEnabled: false,
    });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_PRODUCT_BARCODE_FAILED');
  }
}

export async function getTerminalCustomersSearch(req, res) {
  try {
    const { data, meta } = await searchTerminalCustomers(req.query);
    const rows = req.query.offline === '1' ? await enrichOfflineCatalog('customer', data) : data;
    return ok(res, rows, {
      ...meta,
      source: meta?.source || 'terminal-customer-search',
    });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_CUSTOMER_SEARCH_FAILED');
  }
}

export async function getTerminalCurrencyRates(req, res) {
  try {
    const [data, profile] = await Promise.all([getCurrencyRates(req.query), readArmadaProfile()]);
    const rateSnapshot = issueTerminalRateSnapshot({ rateSet: data, profile });
    return ok(res, { ...data, rateSnapshot }, { source: 'sql-currency-rates', readOnly: true });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_CURRENCY_RATES_FAILED');
  }
}

export async function postTerminalSaleStatus(req, res) {
  try { return ok(res, await getTerminalSaleStatus(req.body, req.user), { source: 'terminal-armada-status', readOnly: true }); }
  catch (error) { return terminalError(res, error, 'TERMINAL_SALE_STATUS_FAILED'); }
}

export async function postTerminalSaleReadiness(req, res) {
  try { return ok(res, await getTerminalSaleReadiness(req.body, req.user), { source: 'terminal-armada-preflight', readOnly: true }); }
  catch (error) { return terminalError(res, error, 'TERMINAL_SALE_PREFLIGHT_FAILED'); }
}

export async function postTerminalWhatsappShare(req, res) {
  try {
    const data = await sendTerminalWhatsappShare(req.body);
    return ok(res, data, { source: 'terminal-whatsapp-provider' });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_WHATSAPP_SHARE_FAILED');
  }
}

export async function postTerminalSalePrint(req, res) {
  try {
    const data = await printTerminalSaleReceipt(req.params.invoiceId, req.user);
    return ok(res, data, {
      source: 'terminal-receipt-windows-printer',
      externalEffect: true,
    });
  } catch (error) {
    return terminalError(res, error, 'TERMINAL_RECEIPT_PRINT_FAILED');
  }
}
