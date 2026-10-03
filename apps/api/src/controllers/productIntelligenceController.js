import { getVegaProductIntelligence } from '../services/vegaProductIntelligenceService.js';
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
