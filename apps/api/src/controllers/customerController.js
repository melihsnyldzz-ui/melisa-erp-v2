import {
  changeCustomerPassive,
  createCustomer,
  ensureAndListCashCustomers,
  getCustomerDetail,
  getCustomersList,
  updateCustomer,
} from '../services/customerService.js';
import { getVegaCustomersListFromWorker } from '../services/vegaCustomerClientService.js';
import { created, fail, ok } from '../utils/response.js';

function writeError(res, error) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || 'CUSTOMER_WRITE_FAILED',
    error.statusCode ? error.message : 'Customer write operation failed',
  );
}

export async function getCustomers(req, res) {
  try {
    const { data, meta } = await getCustomersList(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, 'SQL_SELECT_FAILED', 'Customers query failed');
  }
}

export async function getVegaCustomers(req, res) {
  try {
    const { data, meta } = await getVegaCustomersListFromWorker(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_CUSTOMER_LIST_FAILED', 'Vega customer list could not be read');
  }
}

export async function postCashCustomersEnsure(req, res) {
  try {
    const data = await ensureAndListCashCustomers();
    return ok(res, data, {
      source: 'sql-write',
      operation: 'cash-customer-ensure',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function getCustomer(req, res) {
  try {
    const data = await getCustomerDetail(req.params.id);
    return ok(res, data, {
      source: 'sql-select-only',
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'SQL_SELECT_FAILED', 'Customer detail query failed');
  }
}

export async function postCustomer(req, res) {
  try {
    const data = await createCustomer(req.body, req.user);
    return created(res, data, {
      source: 'sql-write',
      audit: 'customer_created',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function putCustomer(req, res) {
  try {
    const data = await updateCustomer(req.params.id, req.body, req.user);
    return ok(res, data, {
      source: 'sql-write',
      audit: 'customer_updated',
    });
  } catch (error) {
    return writeError(res, error);
  }
}

export async function patchCustomerPassive(req, res) {
  try {
    const result = await changeCustomerPassive(req.params.id, req.body, req.user);
    return ok(res, result.data, {
      source: 'sql-write',
      audit: result.auditWritten ? 'customer_passive_changed' : 'skipped_no_state_change',
    });
  } catch (error) {
    return writeError(res, error);
  }
}
