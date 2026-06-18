import { apiRequest } from './apiClient';

function unwrapData(response) {
  return response?.data || response || {};
}

export async function loadCatalogWorkspace({ token, filters = {} } = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    const text = String(value ?? '').trim();
    if (text) {
      params.set(key, text);
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return unwrapData(await apiRequest(`/catalogs${suffix}`, { token, timeoutMs: 20000 }));
}

export async function createCatalogDraft({ token, name, customerId, productIds }) {
  return unwrapData(await apiRequest('/catalogs/draft', {
    method: 'POST',
    token,
    body: {
      name,
      customerId,
      productIds,
    },
    timeoutMs: 25000,
  }));
}

export async function sendCatalogToCustomer({ token, catalogId, phone }) {
  return unwrapData(await apiRequest('/catalogs/whatsapp-send', {
    method: 'POST',
    token,
    body: {
      catalogId,
      phone,
    },
    timeoutMs: 120000,
  }));
}
