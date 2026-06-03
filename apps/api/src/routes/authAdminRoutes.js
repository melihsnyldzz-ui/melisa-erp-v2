import { Router } from 'express';
import { getAuthAdmin, patchAuthAdminUser } from '../controllers/authAdminController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const authAdminRoutes = Router();

authAdminRoutes.get('/auth-admin/overview', requireAuth, requirePermission('audit.view'), getAuthAdmin);
authAdminRoutes.patch('/auth-admin/users/:id', requireAuth, requirePermission('settings.manage'), patchAuthAdminUser);
