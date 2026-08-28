import { Router } from 'express';
import {
  getAuthAdmin,
  patchAuthAdminUser,
  patchAuthAdminUserPassword,
  postAuthAdminUser,
} from '../controllers/authAdminController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const authAdminRoutes = Router();

authAdminRoutes.get('/auth-admin/overview', requireAuth, requirePermission('audit.view'), getAuthAdmin);
authAdminRoutes.post('/auth-admin/users', requireAuth, requirePermission('settings.manage'), postAuthAdminUser);
authAdminRoutes.patch('/auth-admin/users/:id', requireAuth, requirePermission('settings.manage'), patchAuthAdminUser);
authAdminRoutes.patch('/auth-admin/users/:id/password', requireAuth, requirePermission('settings.manage'), patchAuthAdminUserPassword);
