import { get, post } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoCashCustomersResponse, demoCustomersResponse } from '../demo/demoCustomers.js';
import { demoVegaCustomersResponse } from '../demo/demoVegaReadOnly.js';

export async function fetchCustomers({ page = 1, limit = 100, search = '', activeOnly = true } = {}) {
  if (apiConfig.demoMode) {
    return demoCustomersResponse({ page, limit, search, activeOnly });
  }

  return get('/api/customers', {
    page,
    limit,
    search,
    activeOnly,
  });
}

export async function fetchVegaCustomers({ page = 1, limit = 100, search = '' } = {}) {
  if (apiConfig.demoMode) {
    return demoVegaCustomersResponse({ page, limit, search });
  }

  return get('/api/vega/customers', {
    page,
    limit,
    search,
  });
}

export async function ensureCashCustomerDefinitions() {
  if (apiConfig.demoMode) {
    return demoCashCustomersResponse();
  }

  return post('/api/customers/cash/ensure', {});
}
