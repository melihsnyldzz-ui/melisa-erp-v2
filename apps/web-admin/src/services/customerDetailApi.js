import { get } from './apiClient.js';

export async function fetchCustomerDetail(id) {
  return get(`/api/customers/${id}`);
}
