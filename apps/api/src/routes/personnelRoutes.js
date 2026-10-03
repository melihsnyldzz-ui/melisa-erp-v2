import { Router } from 'express';
import {
  getPersonnel,
  patchEmployee,
  patchTerminalEmployee,
  postEmployee,
  postTerminalDevice,
} from '../controllers/personnelController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const personnelRoutes = Router();

personnelRoutes.get('/personnel/overview', requireAuth, requirePermission('dashboard.view'), getPersonnel);
personnelRoutes.post('/personnel/employees', requireAuth, requirePermission('settings.manage'), postEmployee);
personnelRoutes.patch('/personnel/employees/:id', requireAuth, requirePermission('settings.manage'), patchEmployee);
personnelRoutes.post('/personnel/terminals', requireAuth, requirePermission('settings.manage'), postTerminalDevice);
personnelRoutes.patch('/personnel/terminals/:id/employee', requireAuth, requirePermission('settings.manage'), patchTerminalEmployee);
