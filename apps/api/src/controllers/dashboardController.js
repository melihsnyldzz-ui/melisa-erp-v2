import {
  getDashboardAlertsData,
  getDashboardSummaryData,
  getManagementReportingData,
  getPeriodicAccountingData,
} from '../services/dashboardService.js';
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

export async function getManagementReporting(req, res) {
  try {
    const data = await getManagementReportingData();
    return ok(res, data, {
      source: 'sql-select-management-reporting',
      refreshPolicySeconds: 60,
      readOnly: true,
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'MANAGEMENT_REPORTING_FAILED', 'Management reporting query failed');
  }
}

export async function getPeriodicAccounting(req, res) {
  try {
    const data = await getPeriodicAccountingData(req.query);
    return ok(res, data, {
      source: 'sql-select-periodic-accounting',
      refreshPolicySeconds: 60,
      readOnly: true,
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'PERIODIC_ACCOUNTING_FAILED', 'Periodic accounting query failed');
  }
}
