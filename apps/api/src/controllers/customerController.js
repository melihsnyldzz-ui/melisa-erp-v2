import {
  changeCustomerPassive,
  createCustomer,
  ensureAndListCashCustomers,
  getCustomerDetail,
  getCustomersList,
  updateCustomer,
} from '../services/customerService.js';
import { getVegaCustomersListFromWorker } from '../services/vegaCustomerClientService.js';
import {customerCardService} from '../services/customerCardService.mjs';
import {customerContactService} from '../services/customerContactService.mjs';
import { created, fail, ok } from '../utils/response.js';

const contactErrors=new Map([
 ['CUSTOMER_ID_INVALID',400],['CUSTOMER_VALIDATION_FAILED',400],['AUTH_PERMISSION_DENIED',403],
 ['CUSTOMER_CONTACT_FORBIDDEN',403],['CUSTOMER_CONTACT_SCOPE',403],['CUSTOMER_CONTACT_STALE',409],
 ['CUSTOMER_CONTACT_REQUEST_CONFLICT',409],['CUSTOMER_CONTACT_SOURCE_CHANGED',409],['CUSTOMER_CONTACT_UNAVAILABLE',503],
]);
function contactError(res,error){const status=contactErrors.get(error?.code);return fail(res,status??503,status?error.code:'CUSTOMER_CONTACT_UNAVAILABLE','Müşteri iletişim bilgileri veya düzenleme yetkisi doğrulanamadı.');}
export async function getCustomerContactRequest(req,res){try{return ok(res,await customerContactService.recover(req.params.id,req.params.requestId,req.user,req.query));}catch(error){return contactError(res,error);}}
export async function getCustomerContact(req,res){try{return ok(res,await customerContactService.context(req.params.id,req.user,req.query));}catch(error){return contactError(res,error);}}
export async function postCustomerContact(req,res){try{return ok(res,await customerContactService.update(req.params.id,req.body,req.user));}catch(error){return contactError(res,error);}}

function cardReadError(res, error) {
  const known = typeof error?.code === 'string' && error.code.startsWith('CUSTOMER_CARD_');
  return fail(res, known ? error.statusCode || 503 : 503,
    known ? error.code : 'CUSTOMER_CARD_READ_FAILED',
    known ? error.message : 'Müşteri kartı şu anda okunamıyor.');
}

export async function getCustomerCards(req, res) {
  try {
    const {data, meta} = await customerCardService.list(req.query);
    return ok(res, data, meta);
  } catch (error) { return cardReadError(res, error); }
}

export async function getCustomerCard(req, res) {
  try {
    const {data, meta} = await customerCardService.detail(req.params.id);
    return ok(res, data, meta);
  } catch (error) { return cardReadError(res, error); }
}

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

