import { get } from './apiClient.js';

export async function fetchMonitoringSummary() {
  return get('/api/monitoring/summary');
}
