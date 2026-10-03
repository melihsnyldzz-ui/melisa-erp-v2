import {
  getDashboardAlertsData,
  getDashboardSummaryData,
  getManagementReportingData,
  getPeriodicAccountingData,
} from '../services/dashboardService.js';
import { getVegaSalesComparisonFromWorker } from '../services/vegaSalesComparisonClientService.js';
import { getVegaSalesPerformanceFromWorker } from '../services/vegaSalesPerformanceClientService.js';
import { getVegaProductProfitabilityFromWorker } from '../services/vegaProductProfitabilityClientService.js';
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

export async function getVegaAnnualSalesComparison(req, res) {
  try {
    const data = await getVegaSalesComparisonFromWorker();
    return ok(res, data, {
      source: 'vega-live-read-only',
      refreshPolicySeconds: 300,
      readOnly: true,
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_SALES_COMPARISON_FAILED', 'Vega satış karşılaştırması okunamadı');
  }
}

export async function getVegaSalesPerformanceReport(req, res) {
  try {
    const data = await getVegaSalesPerformanceFromWorker();
    return ok(res, data, {
      source: 'vega-live-read-only',
      refreshPolicySeconds: 300,
      readOnly: true,
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'VEGA_SALES_PERFORMANCE_FAILED', 'Vega satış performansı okunamadı');
  }
}

export async function getVegaProductProfitabilityReport(req, res) {
  try {
    const data = await getVegaProductProfitabilityFromWorker(req.query);
    return ok(res, data, {
      source: 'vega-live-read-only',
      refreshPolicySeconds: 300,
      readOnly: true,
      reportType: 'operational-gross-profit',
    });
  } catch (error) {
    return fail(
      res,
      error.statusCode || 503,
      error.code || 'VEGA_PRODUCT_PROFITABILITY_FAILED',
      error.statusCode === 400 ? error.message : 'Vega ürün kârlılığı okunamadı',
    );
  }
}
