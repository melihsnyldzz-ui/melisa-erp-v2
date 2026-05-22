import { get, post, put } from './apiClient.js';

export async function fetchSalesDrafts(params = {}) {
  return get('/api/sales-invoices', params);
}

export async function createSalesDraft(payload) {
  return post('/api/sales-invoices/draft', payload);
}

export async function updateSalesDraft(id, payload) {
  return put(`/api/sales-invoices/${id}/draft`, payload);
}

export async function fetchSalesInvoice(id) {
  return get(`/api/sales-invoices/${id}`);
}

export async function finalizeSalesInvoice(id) {
  return post(`/api/sales-invoices/${id}/finalize`);
}

export async function fetchPurchaseDrafts(params = {}) {
  return get('/api/purchase-invoices', params);
}

export async function createPurchaseDraft(payload) {
  return post('/api/purchase-invoices/draft', payload);
}

export async function updatePurchaseDraft(id, payload) {
  return put(`/api/purchase-invoices/${id}/draft`, payload);
}

export async function fetchPurchaseInvoice(id) {
  return get(`/api/purchase-invoices/${id}`);
}

export async function finalizePurchaseInvoice(id) {
  return post(`/api/purchase-invoices/${id}/finalize`);
}
