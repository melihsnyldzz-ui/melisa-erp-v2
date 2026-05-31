import { get } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoCustomersResponse } from '../demo/demoCustomers.js';

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
