import { getSupplierDetail, getSuppliersList } from '../services/supplierService.js';
import { fail, ok } from '../utils/response.js';

export async function getSuppliers(req, res) {
  try {
    const { data, meta } = await getSuppliersList(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, 'SQL_SELECT_FAILED', 'Suppliers query failed');
  }
}

export async function getSupplier(req, res) {
  try {
    const data = await getSupplierDetail(req.params.id);
    return ok(res, data, {
      source: 'sql-select-only',
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'SQL_SELECT_FAILED', 'Supplier detail query failed');
  }
}
