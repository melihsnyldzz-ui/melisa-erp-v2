import { demoWorkspaceSummary, demoWorkspaceManagement } from '../demo/demoWorkspace.js';
import { demoMeta } from '../demo/demoReadModel.js';
import { get } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoDashboardAlertsResponse, demoDashboardSummaryResponse } from '../demo/demoDashboard.js';

export async function fetchDashboardSummary(options = {}) {
  if (apiConfig.demoMode) {
    return { success: true, data: { ...demoDashboardSummaryResponse().data, ...demoWorkspaceSummary() }, meta: demoMeta() };
  }

  return get('/api/dashboard/summary', {}, options);
}

export async function fetchDashboardAlerts() {
  if (apiConfig.demoMode) {
    return demoDashboardAlertsResponse();
  }

  return get('/api/dashboard/alerts');
}

export async function fetchManagementReporting() {
  if (apiConfig.demoMode) {
    return demoWorkspaceManagement();
  }

  return get('/api/dashboard/management-reporting');
}

export async function fetchPeriodicAccounting(params = {}) {
  return get('/api/dashboard/periodic-accounting', params);
}

export async function fetchVegaSalesComparison() {
  return get('/api/dashboard/vega-sales-comparison');
}

export async function fetchVegaSalesPerformance() {
  return get('/api/dashboard/vega-sales-performance');
}

export async function fetchVegaProductProfitability(params = {}) {
  return get('/api/dashboard/vega-product-profitability', params);
}
