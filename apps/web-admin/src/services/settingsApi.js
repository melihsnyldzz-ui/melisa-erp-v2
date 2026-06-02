import { get, put } from './apiClient.js';

export async function fetchSettingsOverview() {
  return get('/api/settings');
}

export async function updateSettings(payload) {
  return put('/api/settings', payload);
}
