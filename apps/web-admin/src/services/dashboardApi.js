import { get } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoDashboardAlertsResponse, demoDashboardSummaryResponse } from '../demo/demoDashboard.js';

export async function fetchDashboardSummary() {
  if (apiConfig.demoMode) {
    return demoDashboardSummaryResponse();
  }

  return get('/api/dashboard/summary');
}

export async function fetchDashboardAlerts() {
  if (apiConfig.demoMode) {
    return demoDashboardAlertsResponse();
  }

  return get('/api/dashboard/alerts');
}
