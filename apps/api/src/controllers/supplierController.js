import { createSupplier, getSupplierDetail, getSuppliersList, updateSupplier } from '../services/supplierService.js';
import { getVegaSuppliersListFromWorker } from '../services/vegaSupplierClientService.js';
import { created, fail, ok } from '../utils/response.js';

export async function getSuppliers(req, res) {
  try {
    const { data, meta } = await getSuppliersList(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, 'SQL_SELECT_FAILED', 'Suppliers query failed');
  }
}

export async function getVegaSuppliers(req, res) {
  try {
    const { data, meta } = await getVegaSuppliersListFromWorker(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_SUPPLIER_LIST_FAILED', 'Vega tedarikçi listesi okunamadı');
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

export async function postSupplier(req, res) {
  try {
    const data = await createSupplier(req.body, req.user);
    return created(res, data, {
      source: 'sql-write',
      audit: 'supplier_created',
    });
  } catch (error) {
    return fail(
      res,
      error.statusCode || 503,
      error.code || 'SUPPLIER_WRITE_FAILED',
      error.statusCode ? error.message : 'Supplier create failed',
    );
  }
}

export async function putSupplier(req, res) {
  try {
    const data = await updateSupplier(req.params.id, req.body, req.user);
    return ok(res, data, {
      source: 'sql-write',
      audit: 'supplier_updated',
    });
  } catch (error) {
    return fail(
      res,
      error.statusCode || 503,
      error.code || 'SUPPLIER_WRITE_FAILED',
      error.statusCode ? error.message : 'Supplier update failed',
    );
  }
}
