import { get, post } from './apiClient.js';

export function fetchCatalogOverview(params = {}) {
  return get('/api/catalogs', params);
}

export function createCatalogDraft(payload) {
  return post('/api/catalogs/draft', payload);
}

export function fetchWhatsappPlan(params = {}) {
  return get('/api/catalogs/whatsapp-plan', params);
}

export function fetchWhatsappStatus() {
  return get('/api/catalogs/whatsapp-status');
}

export function sendWhatsappCatalog(payload) {
  return post('/api/catalogs/whatsapp-send', payload);
}
