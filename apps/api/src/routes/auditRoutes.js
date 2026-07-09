import { Router } from 'express';
import { getAuditCoverageReport, getAuditLogs } from '../controllers/auditController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const auditRoutes = Router();

auditRoutes.get('/audit/logs', requireAuth, requirePermission('audit.view'), getAuditLogs);
auditRoutes.get('/audit/coverage', requireAuth, requirePermission('audit.view'), getAuditCoverageReport);
