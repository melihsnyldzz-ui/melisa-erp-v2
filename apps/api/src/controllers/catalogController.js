import {
  createCatalogDraft,
  getCatalogOverview,
  getPublicCatalogProducts,
  getWhatsappPlanner,
  getWhatsappProviderStatus,
  sendCatalogToWhatsapp,
} from '../services/catalogService.js';
import { created, fail, ok } from '../utils/response.js';

function catalogFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Catalog request failed',
  );
}

export async function getCatalogs(req, res) {
  try {
    const data = await getCatalogOverview(req.query);
    return ok(res, data, { source: 'sql-catalogs' });
  } catch (error) {
    return catalogFail(res, error, 'CATALOG_OVERVIEW_FAILED');
  }
}

export async function getPublicCatalogProductList(req, res) {
  try {
    const data = await getPublicCatalogProducts(req.query);
    return ok(res, data.products, data.meta);
  } catch (error) {
    return catalogFail(res, error, 'PUBLIC_CATALOG_PRODUCTS_FAILED');
  }
}

export async function postCatalogDraft(req, res) {
  try {
    const data = await createCatalogDraft(req.body, req.user);
    return created(res, data, { source: 'sql-catalogs', audit: 'catalog_draft_created' });
  } catch (error) {
    return catalogFail(res, error, 'CATALOG_CREATE_FAILED');
  }
}

export async function getWhatsappPlan(req, res) {
  try {
    const data = await getWhatsappPlanner(req.query);
    return ok(res, data, { source: 'sql-catalogs' });
  } catch (error) {
    return catalogFail(res, error, 'WHATSAPP_PLAN_FAILED');
  }
}

export async function getWhatsappStatus(req, res) {
  try {
    const data = await getWhatsappProviderStatus();
    return ok(res, data, { source: 'whatsapp-provider' });
  } catch (error) {
    return catalogFail(res, error, 'WHATSAPP_STATUS_FAILED');
  }
}

export async function postWhatsappSend(req, res) {
  try {
    const data = await sendCatalogToWhatsapp(req.body);
    return ok(res, data, { source: 'whatsapp-provider' });
  } catch (error) {
    return catalogFail(res, error, 'WHATSAPP_SEND_FAILED');
  }
}
