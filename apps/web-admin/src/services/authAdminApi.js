import { get, patch, post } from './apiClient.js';

export async function fetchAuthAdminOverview() {
  return get('/api/auth-admin/overview');
}

export async function updateAuthAdminUser(id, payload) {
  return patch(`/api/auth-admin/users/${id}`, payload);
}

export async function createAuthAdminUser(payload) {
  return post('/api/auth-admin/users', payload);
}

export async function resetAuthAdminUserPassword(id, password) {
  return patch(`/api/auth-admin/users/${id}/password`, { password });
}
