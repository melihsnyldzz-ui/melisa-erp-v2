import { get } from './apiClient.js';

export async function fetchAuditLogs(params = {}) {
  return get('/api/audit/logs', params);
}

export async function fetchAuditCoverage() {
  return get('/api/audit/coverage');
}
