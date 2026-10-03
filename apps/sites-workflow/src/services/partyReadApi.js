import { get } from './apiClient.js';

function basePath(kind) {
  if (!['customer', 'supplier'].includes(kind)) throw new Error('Cari türü geçersiz.');
  return `/api/read-only-parties/${kind}`;
}

export function fetchReadOnlyParties(kind, params = {}, options = {}) {
  return get(basePath(kind), params, options);
}

export function fetchReadOnlyParty(kind, id, options = {}) {
  return get(`${basePath(kind)}/${id}`, {}, options);
}

export function fetchReadOnlyPartyMovements(kind, id, params = {}, options = {}) {
  return get(`${basePath(kind)}/${id}/movements`, params, options);
}
