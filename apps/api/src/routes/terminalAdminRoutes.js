import { Router } from 'express';
import { getTerminalAdmin } from '../controllers/terminalAdminController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const terminalAdminRoutes = Router();

terminalAdminRoutes.get('/terminal-admin/overview', requireAuth, requirePermission('dashboard.view'), getTerminalAdmin);
