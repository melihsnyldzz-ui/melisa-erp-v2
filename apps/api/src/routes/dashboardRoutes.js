import { Router } from 'express';
import {
  getDashboardAlerts,
  getDashboardSummary,
  getManagementReporting,
  getPeriodicAccounting,
  getVegaAnnualSalesComparison,
  getVegaProductProfitabilityReport,
  getVegaSalesPerformanceReport,
} from '../controllers/dashboardController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/dashboard/summary', requireAuth, requirePermission('dashboard.view'), getDashboardSummary);
dashboardRoutes.get('/dashboard/alerts', requireAuth, requirePermission('dashboard.view'), getDashboardAlerts);
dashboardRoutes.get('/dashboard/management-reporting', requireAuth, requirePermission('dashboard.view'), getManagementReporting);
dashboardRoutes.get('/dashboard/periodic-accounting', requireAuth, requirePermission('dashboard.view'), getPeriodicAccounting);
dashboardRoutes.get('/dashboard/vega-sales-comparison', requireAuth, requirePermission('dashboard.view'), getVegaAnnualSalesComparison);
dashboardRoutes.get('/dashboard/vega-sales-performance', requireAuth, requirePermission('dashboard.view'), getVegaSalesPerformanceReport);
dashboardRoutes.get('/dashboard/vega-product-profitability', requireAuth, requirePermission('dashboard.view'), getVegaProductProfitabilityReport);
