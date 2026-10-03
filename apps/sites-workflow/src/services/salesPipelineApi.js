import { get, patch, post, put } from './apiClient.js';

export async function fetchSalesOffers(params = {}) {
  return get('/api/sales-offers', params);
}

export async function fetchSalesOffer(id) {
  return get(`/api/sales-offers/${id}`);
}

export async function createSalesOffer(payload) {
  return post('/api/sales-offers', payload);
}

export async function updateSalesOffer(id, payload) {
  return put(`/api/sales-offers/${id}`, payload);
}

export async function changeSalesOfferStatus(id, status) {
  return patch(`/api/sales-offers/${id}/status`, { status });
}

export async function convertSalesOfferToOrder(id) {
  return post(`/api/sales-offers/${id}/convert-to-order`);
}

export async function fetchSalesOrders(params = {}) {
  return get('/api/sales-orders', params);
}

export async function fetchSalesOrder(id) {
  return get(`/api/sales-orders/${id}`);
}

export async function createSalesOrder(payload) {
  return post('/api/sales-orders', payload);
}

export async function updateSalesOrder(id, payload) {
  return put(`/api/sales-orders/${id}`, payload);
}

export async function changeSalesOrderStatus(id, status) {
  return patch(`/api/sales-orders/${id}/status`, { status });
}

export async function convertSalesOrderToSalesDraft(id) {
  return post(`/api/sales-orders/${id}/convert-to-sales-draft`);
}
