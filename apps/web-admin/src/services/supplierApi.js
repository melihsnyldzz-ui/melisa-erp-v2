import { get, post, put } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoSupplierDetailResponse, demoSuppliersResponse } from '../demo/demoSuppliers.js';

export async function fetchSuppliers({ page = 1, limit = 100, search = '', activeOnly = true } = {}) {
  if (apiConfig.demoMode) {
    return demoSuppliersResponse({ page, limit, search, activeOnly });
  }

  return get('/api/suppliers', {
    page,
    limit,
    search,
    activeOnly,
  });
}

export async function fetchSupplier(id) {
  if (apiConfig.demoMode) {
    return demoSupplierDetailResponse(id);
  }

  return get(`/api/suppliers/${id}`);
}

export async function createSupplier(payload) {
  return post('/api/suppliers', payload);
}

export async function updateSupplier(id, payload) {
  return put(`/api/suppliers/${id}`, payload);
}
