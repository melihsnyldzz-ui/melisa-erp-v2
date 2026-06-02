import { Router } from 'express';
import {
  getFinanceMovementList,
  getFinanceSummaryReport,
  postCustomerCollection,
  postSupplierPayment,
} from '../controllers/financeController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const financeRoutes = Router();

financeRoutes.get('/finance/summary', requireAuth, requirePermission('dashboard.view'), getFinanceSummaryReport);
financeRoutes.get('/finance/movements', requireAuth, requirePermission('customer.view'), getFinanceMovementList);
financeRoutes.post('/finance/collections', requireAuth, requirePermission('customer.edit'), postCustomerCollection);
financeRoutes.post('/finance/payments', requireAuth, requirePermission('purchase.edit'), postSupplierPayment);
