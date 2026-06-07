import { get } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoProductsResponse } from '../demo/demoProducts.js';

export async function fetchProducts({ page = 1, limit = 100, search = '', barcode = '', supplierId = '', activeOnly = true } = {}) {
  if (apiConfig.demoMode) {
    return demoProductsResponse({ page, limit, search, activeOnly });
  }

  return get('/api/products', {
    page,
    limit,
    search,
    barcode,
    supplierId,
    activeOnly,
  });
}
