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

export async function downloadTerminalProducts({ token, limit = 100 } = {}) {
  return searchTerminalProducts({ q: '', token, limit });
}

export async function downloadTerminalCustomers({ token, limit = 100 } = {}) {
  return searchTerminalCustomers({ q: '', token, limit });
}

export async function submitTerminalSale({ token, payload }) {
  return apiRequest('/terminal/sales/submit', {
    method: 'POST',
    token,
    body: payload,
    timeoutMs: 20000,
  });
}

export function buildTerminalSalePayload({ customer, lines, terminalCode, note }) {
  return {
    terminalCode,
    customerId: Number(customer.id),
    documentCurrency: customer.currency || 'TRY',
    note: note || 'Terminal satis',
    items: lines.map((line) => ({
      productId: Number(line.product.id),
      barcode: line.product.barcodeMasked || line.product.barcode || '',
      quantity: Number(line.quantity || 1),
      unitPrice: Number(line.unitPrice || line.product.salePrice || 0),
      currency: line.product.currency || customer.currency || 'TRY',
    })),
  };
}
