import { get } from './apiClient.js';

export async function fetchDashboardSummary() {
  return get('/api/dashboard/summary');
}

export async function fetchDashboardAlerts() {
  return get('/api/dashboard/alerts');
}
