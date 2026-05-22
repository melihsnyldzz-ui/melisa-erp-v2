import { get, post, put } from './apiClient.js';

export async function fetchCustomerDetail(id) {
  return get(`/api/customers/${id}`);
}

export async function createCustomer(payload) {
  return post('/api/customers', payload);
}

export async function updateCustomer(id, payload) {
  return put(`/api/customers/${id}`, payload);
}
