import { get } from './apiClient.js';

export async function fetchProductDetail(id) {
  return get(`/api/products/${id}`);
}
