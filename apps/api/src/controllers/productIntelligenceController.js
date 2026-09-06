import { getVegaProductIntelligence } from '../services/vegaProductIntelligenceService.js';
import { getVegaProductSalesEvidence } from '../services/vegaProductSalesEvidenceService.js';
import { fail, ok } from '../utils/response.js';

export async function getProductIntelligence(req, res) {
  try {
    const { data, meta } = await getVegaProductIntelligence(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(
      res,
      error.statusCode || 503,
      error.code || 'VEGA_PRODUCT_INTELLIGENCE_FAILED',
      error.statusCode ? error.message : 'Vega product intelligence could not be read',
    );
  }
}

export async function getProductSalesEvidence(req, res) {
  try {
    const { data, meta } = await getVegaProductSalesEvidence(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code?.startsWith('VEGA_SALES_EVIDENCE_')
      ? error.code : 'VEGA_SALES_EVIDENCE_FAILED', error.code?.startsWith('VEGA_SALES_EVIDENCE_')
      ? error.message : 'Vega product movement evidence could not be read');
  }
}
