import {
  changePipelineStatus,
  convertOfferToOrder,
  convertOrderToSalesDraft,
  createPipelineDocument,
  getPipelineDocument,
  listPipelineDocuments,
  updatePipelineDocument,
} from '../services/salesPipelineService.js';
import { created, fail, ok } from '../utils/response.js';

function pipelineError(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Sales pipeline request failed',
  );
}

export function kindFromRequest(req = {}) {
  const routePath = `${req.baseUrl || ''}${req.path || ''}`.toLowerCase();
  if (routePath.includes('/sales-orders')) return 'order';
  if (routePath.includes('/sales-offers')) return 'offer';
  return '';
}

export async function listSalesPipelineDocuments(req, res) {
  try {
    const { data, meta } = await listPipelineDocuments(kindFromRequest(req), req.query);
    return ok(res, data, meta);
  } catch (error) {
    return pipelineError(res, error, 'SALES_PIPELINE_LIST_FAILED');
  }
}

export async function getSalesPipelineDocument(req, res) {
  try {
    const data = await getPipelineDocument(kindFromRequest(req), req.params.id);
    return ok(res, data, { source: 'sql-sales-pipeline' });
  } catch (error) {
    return pipelineError(res, error, 'SALES_PIPELINE_DETAIL_FAILED');
  }
}

export async function createSalesPipelineDocument(req, res) {
  try {
    const data = await createPipelineDocument(kindFromRequest(req), req.body, req.user);
    return created(res, data, { source: 'sql-sales-pipeline' });
  } catch (error) {
    return pipelineError(res, error, 'SALES_PIPELINE_CREATE_FAILED');
  }
}

export async function updateSalesPipelineDocument(req, res) {
  try {
    const data = await updatePipelineDocument(kindFromRequest(req), req.params.id, req.body, req.user);
    return ok(res, data, { source: 'sql-sales-pipeline' });
  } catch (error) {
    return pipelineError(res, error, 'SALES_PIPELINE_UPDATE_FAILED');
  }
}

export async function changeSalesPipelineDocumentStatus(req, res) {
  try {
    const data = await changePipelineStatus(kindFromRequest(req), req.params.id, req.body.status, req.user);
    return ok(res, data, { source: 'sql-sales-pipeline' });
  } catch (error) {
    return pipelineError(res, error, 'SALES_PIPELINE_STATUS_FAILED');
  }
}

export async function convertSalesOfferToOrder(req, res) {
  try {
    const data = await convertOfferToOrder(req.params.id, req.user);
    return ok(res, data, { source: 'sql-sales-pipeline-conversion' });
  } catch (error) {
    return pipelineError(res, error, 'SALES_OFFER_CONVERT_FAILED');
  }
}

export async function convertSalesOrderToDraft(req, res) {
  try {
    const data = await convertOrderToSalesDraft(req.params.id, req.user);
    return ok(res, data, { source: 'sql-sales-pipeline-conversion' });
  } catch (error) {
    return pipelineError(res, error, 'SALES_ORDER_CONVERT_FAILED');
  }
}
