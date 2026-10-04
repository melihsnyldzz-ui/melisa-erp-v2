import { createSupplier, getSupplierDetail, getSuppliersList, updateSupplier } from '../services/supplierService.js';
import { getVegaSuppliersListFromWorker } from '../services/vegaSupplierClientService.js';
import { created, fail, ok } from '../utils/response.js';
import {supplierCardService} from '../services/supplierCardService.mjs';
import {testSupplierContactService} from '../services/testSupplierContactService.mjs';

function contactError(res, error) {
  const known = typeof error?.code === 'string' && error.code.startsWith('TEST_SUPPLIER_CONTACT_');
  return fail(res, known ? error.statusCode || 503 : 503,
    known ? error.code : 'TEST_SUPPLIER_CONTACT_UNAVAILABLE',
    known ? error.message : 'TEST iletişim düzenlemesi şu anda kullanılamıyor.');
}
export async function getTestSupplierContact(req, res) {
  try { return ok(res, await testSupplierContactService.context(req.params.id, req.user), {readOnly: true, synthetic: true}); }
  catch (error) { return contactError(res, error); }
}
export async function postTestSupplierContact(req, res) {
  try { return ok(res, await testSupplierContactService.update(req.params.id, req.body, req.user), {synthetic: true}); }
  catch (error) { return contactError(res, error); }
}

function cardReadError(res, error) {
  const known = typeof error?.code === 'string' && error.code.startsWith('SUPPLIER_CARD_');
  return fail(res, known ? error.statusCode || 503 : 503,
    known ? error.code : 'SUPPLIER_CARD_READ_FAILED',
    known ? error.message : 'Tedarikçi kartı şu anda okunamıyor.');
}

export async function getSupplierCards(req, res) {
  try {
    const {data, meta} = await supplierCardService.list(req.query);
    return ok(res, data, meta);
  } catch (error) { return cardReadError(res, error); }
}

export async function getSupplierCard(req, res) {
  try {
    const {data, meta} = await supplierCardService.detail(req.params.id);
    return ok(res, data, meta);
  } catch (error) { return cardReadError(res, error); }
}

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
