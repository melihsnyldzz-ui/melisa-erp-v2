import { getCustomersList } from '../services/customerService.js';
import { fail, ok } from '../utils/response.js';

export async function getCustomers(req, res) {
  try {
    const { data, meta } = await getCustomersList(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, 'SQL_SELECT_FAILED', 'Customers query failed');
  }
}
