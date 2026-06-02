import { Router } from 'express';
import { getSettings, putSettings } from '../controllers/settingsController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const settingsRoutes = Router();

settingsRoutes.get('/settings', requireAuth, requirePermission('settings.manage'), getSettings);
settingsRoutes.put('/settings', requireAuth, requirePermission('settings.manage'), putSettings);
