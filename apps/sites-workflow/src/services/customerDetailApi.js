import { get, patch, post, put } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import {
  demoCustomerDetailResponse,
  demoCustomerPassiveResponse,
  demoCustomerWriteResponse,
} from '../demo/demoCustomers.js';

export async function fetchCustomerDetail(id) {
  if (apiConfig.demoMode) {
    return demoCustomerDetailResponse(id);
  }

  return get(`/api/customers/${id}`);
}

export async function createCustomer(payload) {
  if (apiConfig.demoMode) {
    return demoCustomerWriteResponse(payload);
  }

  return post('/api/customers', payload);
}

export async function updateCustomer(id, payload) {
  if (apiConfig.demoMode) {
    return demoCustomerWriteResponse(payload, id);
  }

  return put(`/api/customers/${id}`, payload);
}

export async function changeCustomerPassive(id, isPassive) {
  if (apiConfig.demoMode) {
    return demoCustomerPassiveResponse(id, isPassive);
  }

  return patch(`/api/customers/${id}/passive`, { isPassive });
}
