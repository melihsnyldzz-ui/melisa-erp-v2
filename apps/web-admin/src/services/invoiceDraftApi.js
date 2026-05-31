import { get, post, put } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import {
  demoPurchaseDraftsResponse,
  demoPurchaseDraftWriteResponse,
  demoPurchaseFinalizeResponse,
  demoPurchaseInvoiceResponse,
  demoSalesDraftsResponse,
  demoSalesDraftWriteResponse,
  demoSalesFinalizeResponse,
  demoSalesInvoiceResponse,
} from '../demo/demoInvoices.js';

export async function fetchSalesDrafts(params = {}) {
  if (apiConfig.demoMode) {
    return demoSalesDraftsResponse(params);
  }

  return get('/api/sales-invoices', params);
}

export async function createSalesDraft(payload) {
  if (apiConfig.demoMode) {
    return demoSalesDraftWriteResponse(payload);
  }

  return post('/api/sales-invoices/draft', payload);
}

export async function updateSalesDraft(id, payload) {
  if (apiConfig.demoMode) {
    return demoSalesDraftWriteResponse(payload, id);
  }

  return put(`/api/sales-invoices/${id}/draft`, payload);
}

export async function fetchSalesInvoice(id) {
  if (apiConfig.demoMode) {
    return demoSalesInvoiceResponse(id);
  }

  return get(`/api/sales-invoices/${id}`);
}

export async function finalizeSalesInvoice(id) {
  if (apiConfig.demoMode) {
    return demoSalesFinalizeResponse(id);
  }

  return post(`/api/sales-invoices/${id}/finalize`);
}

export async function fetchPurchaseDrafts(params = {}) {
  if (apiConfig.demoMode) {
    return demoPurchaseDraftsResponse(params);
  }

  return get('/api/purchase-invoices', params);
}

export async function createPurchaseDraft(payload) {
  if (apiConfig.demoMode) {
    return demoPurchaseDraftWriteResponse(payload);
  }

  return post('/api/purchase-invoices/draft', payload);
}

export async function updatePurchaseDraft(id, payload) {
  if (apiConfig.demoMode) {
    return demoPurchaseDraftWriteResponse(payload, id);
  }

  return put(`/api/purchase-invoices/${id}/draft`, payload);
}

export async function fetchPurchaseInvoice(id) {
  if (apiConfig.demoMode) {
    return demoPurchaseInvoiceResponse(id);
  }

  return get(`/api/purchase-invoices/${id}`);
}

export async function finalizePurchaseInvoice(id) {
  if (apiConfig.demoMode) {
    return demoPurchaseFinalizeResponse(id);
  }

  return post(`/api/purchase-invoices/${id}/finalize`);
}
