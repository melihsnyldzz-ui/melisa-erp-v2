import { get } from './apiClient.js';

export async function fetchTerminalAdminOverview(params = {}) {
  return get('/api/terminal-admin/overview', params);
}
