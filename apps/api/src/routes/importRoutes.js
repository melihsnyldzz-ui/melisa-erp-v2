import { Router } from 'express';
import {
  postCustomersCommit,
  postCustomersPreview,
  postProductsCommit,
  postProductsPreview,
  postSuppliersCommit,
  postSuppliersPreview,
} from '../controllers/importController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const importRoutes = Router();

importRoutes.post('/import/products/preview', requireAuth, requirePermission('import.run'), postProductsPreview);
importRoutes.post('/import/products/commit', requireAuth, requirePermission('import.run'), postProductsCommit);
importRoutes.post('/import/products/apply', requireAuth, requirePermission('import.run'), postProductsCommit);
importRoutes.post('/import/customers/preview', requireAuth, requirePermission('import.run'), postCustomersPreview);
importRoutes.post('/import/customers/commit', requireAuth, requirePermission('import.run'), postCustomersCommit);
importRoutes.post('/import/customers/apply', requireAuth, requirePermission('import.run'), postCustomersCommit);
importRoutes.post('/import/suppliers/preview', requireAuth, requirePermission('import.run'), postSuppliersPreview);
importRoutes.post('/import/suppliers/commit', requireAuth, requirePermission('import.run'), postSuppliersCommit);
importRoutes.post('/import/suppliers/apply', requireAuth, requirePermission('import.run'), postSuppliersCommit);
