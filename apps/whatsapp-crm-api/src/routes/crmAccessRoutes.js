import { Router } from 'express';
import { postCrmAccessUnlock } from '../controllers/crmAccessController.js';
import { requireCrmAuth, requireCrmPermission } from '../middleware/auth.js';
import { crmAccessRateLimit } from '../middleware/security.js';

export const crmAccessRoutes = Router();

crmAccessRoutes.post(
  '/crm/access/unlock',
  requireCrmAuth,
  requireCrmPermission('crm.view'),
  crmAccessRateLimit,
  postCrmAccessUnlock,
);
