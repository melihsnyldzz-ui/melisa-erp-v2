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

function extractRows(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.products)) return response.products;
  if (Array.isArray(response?.customers)) return response.customers;
  return [];
}

async function downloadAllPages(fetchPage, { pageSize = 100, maxPages = 50 } = {}) {
  const allRows = [];
  let page = 1;
  let totalPages = 1;
  let totalRows = null;

  while (page <= totalPages && page <= maxPages) {
    const response = await fetchPage({ page, limit: pageSize });
    const rows = extractRows(response);
    allRows.push(...rows);

    totalPages = Number(response?.meta?.totalPages || response?.totalPages || totalPages || 1);
    totalRows = response?.meta?.total ?? response?.total ?? totalRows;

    if (!rows.length || page >= totalPages) {
      break;
    }

    page += 1;
  }

  return {
    rows: allRows,
    pageCount: page,
    totalPages,
    totalRows: Number(totalRows ?? allRows.length),
  };
}

export async function downloadAllTerminalProducts({ token, pageSize = 100 } = {}) {
  return downloadAllPages(
    ({ page, limit }) => apiRequest(`/terminal/products/search?q=&limit=${encodeURIComponent(limit)}&page=${encodeURIComponent(page)}`, { token }),
    { pageSize },
  );
}

export async function downloadAllTerminalCustomers({ token, pageSize = 100 } = {}) {
  return downloadAllPages(
    ({ page, limit }) => apiRequest(`/terminal/customers/search?q=&limit=${encodeURIComponent(limit)}&page=${encodeURIComponent(page)}`, { token }),
    { pageSize },
  );
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
