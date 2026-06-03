import { Router } from 'express';
import {
  getDemoCleanupPreview,
  getTestArchiveRestorePreview,
  getTestTreeCleanupPreview,
  postDemoCleanupApply,
  postTestArchiveRestoreApply,
  postTestTreeCleanupApply,
} from '../controllers/cleanupController.js';
import { getSettings, putSettings } from '../controllers/settingsController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const settingsRoutes = Router();

settingsRoutes.get('/settings', requireAuth, requirePermission('settings.manage'), getSettings);
settingsRoutes.put('/settings', requireAuth, requirePermission('settings.manage'), putSettings);
settingsRoutes.get('/settings/demo-cleanup/preview', requireAuth, requirePermission('settings.manage'), getDemoCleanupPreview);
settingsRoutes.post('/settings/demo-cleanup/apply', requireAuth, requirePermission('settings.manage'), postDemoCleanupApply);
settingsRoutes.get('/settings/test-tree-cleanup/preview', requireAuth, requirePermission('settings.manage'), getTestTreeCleanupPreview);
settingsRoutes.post('/settings/test-tree-cleanup/apply', requireAuth, requirePermission('settings.manage'), postTestTreeCleanupApply);
settingsRoutes.get('/settings/test-archive-restore/preview', requireAuth, requirePermission('settings.manage'), getTestArchiveRestorePreview);
settingsRoutes.post('/settings/test-archive-restore/apply', requireAuth, requirePermission('settings.manage'), postTestArchiveRestoreApply);
