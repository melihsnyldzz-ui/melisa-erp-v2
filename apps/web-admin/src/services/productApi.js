import { get, post, remove } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoProductsResponse } from '../demo/demoProducts.js';
import { demoVegaProductsResponse } from '../demo/demoVegaReadOnly.js';

export async function fetchProducts({ page = 1, limit = 100, search = '', barcode = '', supplierId = '', activeOnly = true, cardOpenedFrom = '', cardOpenedTo = '' } = {}) {
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
    cardOpenedFrom,
    cardOpenedTo,
  });
}

export async function fetchVegaProducts({ page = 1, limit = 100, search = '', barcode = '', activeOnly = true, cardOpenedFrom = '', cardOpenedTo = '', imageStatus = 'all', imageUsage = '', sourceId = '' } = {}) {
  if (apiConfig.demoMode) {
    return demoVegaProductsResponse({ page, limit, search, barcode, activeOnly, cardOpenedFrom, cardOpenedTo, imageStatus });
  }

  return get('/api/vega/products', {
    page,
    limit,
    search,
    barcode,
    activeOnly,
    cardOpenedFrom,
    cardOpenedTo,
    imageStatus,
    imageUsage,
    sourceId,
  });
}

export async function saveVegaProductImage(sourceId, payload) {
  return post(`/api/vega/products/${sourceId}/image`, payload);
}

export async function removeVegaProductImage(sourceId) {
  return remove(`/api/vega/products/${sourceId}/image`);
}
