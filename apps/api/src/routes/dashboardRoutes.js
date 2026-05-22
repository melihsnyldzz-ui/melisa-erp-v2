import { Router } from 'express';
import { getDashboardAlerts, getDashboardSummary } from '../controllers/dashboardController.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/dashboard/summary', getDashboardSummary);
dashboardRoutes.get('/dashboard/alerts', getDashboardAlerts);
