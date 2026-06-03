import { get, post } from './apiClient.js';

export async function fetchStockMovements(params = {}) {
  return get('/api/stock-movements', params);
}

export async function fetchStockValuation(params = {}) {
  return get('/api/stock-valuation', params);
}

export async function applyStockCountAdjustment(payload = {}) {
  return post('/api/stock-count/adjust', payload);
}

export async function fetchCustomerMovements(params = {}) {
  return get('/api/customer-movements', params);
}

export async function fetchCustomerStatement(params = {}) {
  return get('/api/customer-statement', params);
}

export async function fetchSupplierMovements(params = {}) {
  return get('/api/supplier-movements', params);
}

export async function fetchSupplierStatement(params = {}) {
  return get('/api/supplier-statement', params);
}
