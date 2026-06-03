import { get, post, put } from './apiClient.js';

export async function fetchSettingsOverview() {
  return get('/api/settings');
}

export async function updateSettings(payload) {
  return put('/api/settings', payload);
}

export async function fetchDemoCleanupPreview() {
  return get('/api/settings/demo-cleanup/preview');
}

export async function applyDemoCleanup(payload) {
  return post('/api/settings/demo-cleanup/apply', payload);
}

export async function fetchTestTreeCleanupPreview() {
  return get('/api/settings/test-tree-cleanup/preview');
}

export async function applyTestTreeCleanup(payload) {
  return post('/api/settings/test-tree-cleanup/apply', payload);
}

export async function fetchTestArchiveRestorePreview() {
  return get('/api/settings/test-archive-restore/preview');
}

export async function applyTestArchiveRestore(payload) {
  return post('/api/settings/test-archive-restore/apply', payload);
}
