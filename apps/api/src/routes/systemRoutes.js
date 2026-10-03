import { Router } from 'express';
import { getHealth, getMonitoringSummary, getVersion } from '../controllers/systemController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const systemRoutes = Router();

systemRoutes.get('/health', getHealth);
systemRoutes.get('/version', getVersion);
systemRoutes.get('/monitoring/summary', requireAuth, requirePermission('audit.view'), getMonitoringSummary);
