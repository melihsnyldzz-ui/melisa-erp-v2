import { get, patch, post, put } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import {
  demoProductDetailResponse,
  demoProductPassiveResponse,
  demoProductWriteResponse,
} from '../demo/demoProducts.js';

export async function fetchProductDetail(id) {
  if (apiConfig.demoMode) {
    return demoProductDetailResponse(id);
  }

  return get(`/api/products/${id}`);
}

export async function createProduct(payload) {
  if (apiConfig.demoMode) {
    return demoProductWriteResponse(payload);
  }

  return post('/api/products', payload);
}

export async function updateProduct(id, payload) {
  if (apiConfig.demoMode) {
    return demoProductWriteResponse(payload, id);
  }

  return put(`/api/products/${id}`, payload);
}

export async function changeProductPassive(id, isPassive) {
  if (apiConfig.demoMode) {
    return demoProductPassiveResponse(id, isPassive);
  }

  return patch(`/api/products/${id}/passive`, { isPassive });
}
