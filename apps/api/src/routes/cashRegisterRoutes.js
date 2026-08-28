import { Router } from 'express';
import {
  getCashExpenseCategories,
  getCashRegister,
  postCashExpense,
  postCashSessionClose,
  postCashSessionOpen,
  postCashTransfer,
} from '../controllers/cashRegisterController.js';
import { requireAnyPermission, requireAuth } from '../middleware/authMiddleware.js';

export const cashRegisterRoutes = Router();

cashRegisterRoutes.get('/finance/cash-register', requireAuth, requireAnyPermission(['finance.view', 'finance.collection', 'finance.payment']), getCashRegister);
cashRegisterRoutes.get('/finance/expense-categories', requireAuth, requireAnyPermission(['finance.view', 'finance.payment']), getCashExpenseCategories);
cashRegisterRoutes.post('/finance/cash-register/open', requireAuth, requireAnyPermission(['finance.collection', 'finance.payment']), postCashSessionOpen);
cashRegisterRoutes.post('/finance/cash-register/expenses', requireAuth, requireAnyPermission(['finance.payment']), postCashExpense);
cashRegisterRoutes.post('/finance/cash-register/transfers', requireAuth, requireAnyPermission(['finance.payment']), postCashTransfer);
cashRegisterRoutes.post('/finance/cash-register/close', requireAuth, requireAnyPermission(['finance.collection', 'finance.payment']), postCashSessionClose);
