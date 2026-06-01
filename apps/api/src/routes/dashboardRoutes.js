import { Router } from 'express';
import { getDashboardAlerts, getDashboardSummary, getManagementReporting } from '../controllers/dashboardController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/dashboard/summary', requireAuth, requirePermission('dashboard.view'), getDashboardSummary);
dashboardRoutes.get('/dashboard/alerts', requireAuth, requirePermission('dashboard.view'), getDashboardAlerts);
dashboardRoutes.get('/dashboard/management-reporting', requireAuth, requirePermission('dashboard.view'), getManagementReporting);
