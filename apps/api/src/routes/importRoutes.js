import { Router } from 'express';
import {
  postCustomersCommit,
  postCustomersPreview,
  postProductsCommit,
  postProductsPreview,
} from '../controllers/importController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const importRoutes = Router();

importRoutes.post('/import/products/preview', requireAuth, requirePermission('import.run'), postProductsPreview);
importRoutes.post('/import/products/commit', requireAuth, requirePermission('import.run'), postProductsCommit);
importRoutes.post('/import/customers/preview', requireAuth, requirePermission('import.run'), postCustomersPreview);
importRoutes.post('/import/customers/commit', requireAuth, requirePermission('import.run'), postCustomersCommit);
