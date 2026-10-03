import { get } from './apiClient.js';

export async function fetchAuditLogs(params = {}, options = {}) {
  return get('/api/audit/logs', params, options);
}

export async function fetchAuditCoverage(options = {}) {
  return get('/api/audit/coverage', {}, options);
}
