import { get, post } from './apiClient.js';

export async function fetchFinanceSummary() {
  return get('/api/finance/summary');
}

export async function fetchFinanceMovements(params = {}) {
  return get('/api/finance/movements', params);
}

export async function createCustomerCollection(payload) {
  return post('/api/finance/collections', payload);
}

export async function createSupplierPayment(payload) {
  return post('/api/finance/payments', payload);
}
