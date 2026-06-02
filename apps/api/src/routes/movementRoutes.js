import { Router } from 'express';
import {
  getCustomerMovements,
  getCustomerStatementReport,
  getStockMovements,
  getSupplierMovements,
  getSupplierStatementReport,
} from '../controllers/movementController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const movementRoutes = Router();

movementRoutes.get('/stock-movements', requireAuth, requirePermission('product.view'), getStockMovements);
movementRoutes.get('/customer-movements', requireAuth, requirePermission('customer.view'), getCustomerMovements);
movementRoutes.get('/customer-statement', requireAuth, requirePermission('customer.view'), getCustomerStatementReport);
movementRoutes.get('/supplier-movements', requireAuth, requirePermission('customer.view'), getSupplierMovements);
movementRoutes.get('/supplier-statement', requireAuth, requirePermission('customer.view'), getSupplierStatementReport);
