import {
  createPurchaseDraft,
  createSalesDraft,
  getPurchaseDraft,
  getPurchaseDraftsList,
  getSalesDraft,
  getSalesDraftsList,
  updatePurchaseDraft,
  updateSalesDraft,
} from '../services/invoiceDraftService.js';
import { created, fail, ok } from '../utils/response.js';

function writeError(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Draft invoice operation failed',
  );
}

export async function getSalesInvoices(req, res) {
  try {
    const { data, meta } = await getSalesDraftsList(req.query);
    return ok(res, data, {
      ...meta,
      commercialEffect: false,
    });
  } catch (error) {
    return writeError(res, error, 'SALES_DRAFT_LIST_FAILED');
  }
}

export async function getPurchaseInvoices(req, res) {
  try {
    const { data, meta } = await getPurchaseDraftsList(req.query);
    return ok(res, data, {
      ...meta,
      commercialEffect: false,
    });
  } catch (error) {
    return writeError(res, error, 'PURCHASE_DRAFT_LIST_FAILED');
  }
}

export async function postSalesDraft(req, res) {
  try {
    const data = await createSalesDraft(req.body);
    return created(res, data, {
      source: 'sql-write',
      audit: 'sales_invoice_draft_created',
      commercialEffect: false,
    });
  } catch (error) {
    return writeError(res, error, 'SALES_DRAFT_WRITE_FAILED');
  }
}

export async function putSalesDraft(req, res) {
  try {
    const data = await updateSalesDraft(req.params.id, req.body);
    return ok(res, data, {
      source: 'sql-write',
      audit: 'sales_invoice_draft_updated',
      commercialEffect: false,
    });
  } catch (error) {
    return writeError(res, error, 'SALES_DRAFT_WRITE_FAILED');
  }
}

export async function getSalesInvoice(req, res) {
  try {
    const data = await getSalesDraft(req.params.id);
    return ok(res, data, {
      source: 'sql-select',
      commercialEffect: false,
    });
  } catch (error) {
    return writeError(res, error, 'SALES_DRAFT_SELECT_FAILED');
  }
}

export async function postPurchaseDraft(req, res) {
  try {
    const data = await createPurchaseDraft(req.body);
    return created(res, data, {
      source: 'sql-write',
      audit: 'purchase_invoice_draft_created',
      commercialEffect: false,
    });
  } catch (error) {
    return writeError(res, error, 'PURCHASE_DRAFT_WRITE_FAILED');
  }
}

export async function putPurchaseDraft(req, res) {
  try {
    const data = await updatePurchaseDraft(req.params.id, req.body);
    return ok(res, data, {
      source: 'sql-write',
      audit: 'purchase_invoice_draft_updated',
      commercialEffect: false,
    });
  } catch (error) {
    return writeError(res, error, 'PURCHASE_DRAFT_WRITE_FAILED');
  }
}

export async function getPurchaseInvoice(req, res) {
  try {
    const data = await getPurchaseDraft(req.params.id);
    return ok(res, data, {
      source: 'sql-select',
      commercialEffect: false,
    });
  } catch (error) {
    return writeError(res, error, 'PURCHASE_DRAFT_SELECT_FAILED');
  }
}
