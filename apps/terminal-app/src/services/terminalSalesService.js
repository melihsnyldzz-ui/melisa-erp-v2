import { apiRequest } from './apiClient';

export async function searchTerminalProducts({ q = '', token, limit = 30 } = {}) {
  return apiRequest(`/terminal/products/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`, {
    token,
  });
}

export async function getTerminalProductByBarcode({ barcode, token }) {
  return apiRequest(`/terminal/products/barcode/${encodeURIComponent(barcode)}`, {
    token,
  });
}

export async function searchTerminalCustomers({ q = '', token, limit = 30 } = {}) {
  return apiRequest(`/terminal/customers/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`, {
    token,
  });
}

export async function submitTerminalSale({ token, payload }) {
  return apiRequest('/terminal/sales/submit', {
    method: 'POST',
    token,
    body: payload,
    timeoutMs: 20000,
  });
}
