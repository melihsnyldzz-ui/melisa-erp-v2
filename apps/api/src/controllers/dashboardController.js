import { getDashboardAlertsData, getDashboardSummaryData } from '../services/dashboardService.js';
import { fail, ok } from '../utils/response.js';

export async function getDashboardSummary(req, res) {
  try {
    const data = await getDashboardSummaryData();
    return ok(res, data, {
      source: 'sql-select-aggregate',
      refreshPolicySeconds: 30,
      readOnly: true,
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'DASHBOARD_SUMMARY_FAILED', 'Dashboard summary query failed');
  }
}

export async function getDashboardAlerts(req, res) {
  try {
    const data = await getDashboardAlertsData();
    return ok(res, data, {
      source: 'sql-select-aggregate',
      refreshPolicySeconds: 30,
      readOnly: true,
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'DASHBOARD_ALERTS_FAILED', 'Dashboard alerts query failed');
  }
}
