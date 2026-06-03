import { Router } from 'express';
import {
  getCustomerMovements,
  getCustomerStatementReport,
  getStockMovements,
  getSupplierMovements,
  getSupplierStatementReport,
  getStockValuation,
  postStockCountAdjustment,
} from '../controllers/movementController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const movementRoutes = Router();

movementRoutes.get('/stock-movements', requireAuth, requirePermission('product.view'), getStockMovements);
movementRoutes.get('/stock-valuation', requireAuth, requirePermission('product.view'), getStockValuation);
movementRoutes.post('/stock-count/adjust', requireAuth, requirePermission('product.edit'), postStockCountAdjustment);
movementRoutes.get('/customer-movements', requireAuth, requirePermission('customer.view'), getCustomerMovements);
movementRoutes.get('/customer-statement', requireAuth, requirePermission('customer.view'), getCustomerStatementReport);
movementRoutes.get('/supplier-movements', requireAuth, requirePermission('customer.view'), getSupplierMovements);
movementRoutes.get('/supplier-statement', requireAuth, requirePermission('customer.view'), getSupplierStatementReport);
