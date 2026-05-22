import { get } from './apiClient.js';

export async function fetchProducts({ page = 1, limit = 100, search = '', activeOnly = true } = {}) {
  return get('/api/products', {
    page,
    limit,
    search,
    activeOnly,
  });
}
