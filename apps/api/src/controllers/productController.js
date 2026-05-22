import { getProductsList } from '../services/productService.js';
import { fail, ok } from '../utils/response.js';

export async function getProducts(req, res) {
  try {
    const { data, meta } = await getProductsList(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, 'SQL_SELECT_FAILED', 'Products query failed');
  }
}
