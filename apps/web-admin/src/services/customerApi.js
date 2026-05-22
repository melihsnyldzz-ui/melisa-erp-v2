import { get } from './apiClient.js';

export async function fetchCustomers({ page = 1, limit = 100, search = '', activeOnly = true } = {}) {
  return get('/api/customers', {
    page,
    limit,
    search,
    activeOnly,
  });
}
