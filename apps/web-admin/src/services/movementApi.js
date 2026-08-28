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

export async function fetchVegaCustomerMovements(customerSourceId, params = {}) {
  return get(`/api/vega/customers/${customerSourceId}/movements`, params);
}

export async function fetchVegaCustomerStockExitDocument(customerSourceId, movementSourceId) {
  return get(`/api/vega/customers/${customerSourceId}/movements/${movementSourceId}/stock-exit`);
}

export async function fetchVegaSalesStockExits(params = {}) {
  return get('/api/vega/sales/stock-exits', params);
}

export async function fetchVegaPurchaseInvoices(params = {}) {
  return get('/api/vega/purchases/invoices', params);
}

export async function fetchVegaSupplierMovements(supplierSourceId, params = {}) {
  return get(`/api/vega/suppliers/${supplierSourceId}/movements`, params);
}

export async function fetchVegaSupplierPurchaseDocument(supplierSourceId, movementSourceId) {
  return get(`/api/vega/suppliers/${supplierSourceId}/movements/${movementSourceId}/purchase-invoice`);
}

export async function fetchVegaSupplierPurchaseIntelligence(supplierSourceId, params = {}) {
  return get(`/api/vega/suppliers/${supplierSourceId}/purchase-intelligence`, params);
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
