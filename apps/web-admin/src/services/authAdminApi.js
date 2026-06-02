import { get, patch } from './apiClient.js';

export async function fetchAuthAdminOverview() {
  return get('/api/auth-admin/overview');
}

export async function updateAuthAdminUser(id, payload) {
  return patch(`/api/auth-admin/users/${id}`, payload);
}
