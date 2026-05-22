import { get, patch, post, put } from './apiClient.js';

export async function fetchProductDetail(id) {
  return get(`/api/products/${id}`);
}

export async function createProduct(payload) {
  return post('/api/products', payload);
}

export async function updateProduct(id, payload) {
  return put(`/api/products/${id}`, payload);
}

export async function changeProductPassive(id, isPassive) {
  return patch(`/api/products/${id}/passive`, { isPassive });
}
