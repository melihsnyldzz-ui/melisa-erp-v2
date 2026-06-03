import { Router } from 'express';
import {
  getFinanceAccountList,
  getAccountingControlReport,
  getDocumentNumberFixPreviewReport,
  getFinanceAccountCleanupPreviewReport,
  getFinanceJournalReport,
  getFinanceMovementList,
  getFinanceSummaryReport,
  patchFinanceAccount,
  postFinanceAccount,
  postFinanceAccountCleanup,
  postFinanceAccountStandardization,
  postDocumentNumberFix,
  postCustomerCollection,
  postSupplierPayment,
} from '../controllers/financeController.js';
import { requireAnyPermission, requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const financeRoutes = Router();

financeRoutes.get('/finance/summary', requireAuth, requirePermission('dashboard.view'), getFinanceSummaryReport);
financeRoutes.get('/finance/accounting-control', requireAuth, requireAnyPermission(['finance.view', 'dashboard.view']), getAccountingControlReport);
financeRoutes.get('/finance/document-number-fix-preview', requireAuth, requireAnyPermission(['finance.view', 'settings.manage']), getDocumentNumberFixPreviewReport);
financeRoutes.post('/finance/document-number-fix', requireAuth, requireAnyPermission(['finance.payment', 'finance.collection', 'settings.manage']), postDocumentNumberFix);
financeRoutes.get('/finance/accounts', requireAuth, requireAnyPermission(['finance.view', 'customer.view']), getFinanceAccountList);
financeRoutes.post('/finance/accounts', requireAuth, requireAnyPermission(['finance.payment', 'finance.collection', 'settings.manage']), postFinanceAccount);
financeRoutes.get('/finance/accounts/cleanup-preview', requireAuth, requireAnyPermission(['finance.view', 'settings.manage']), getFinanceAccountCleanupPreviewReport);
financeRoutes.post('/finance/accounts/cleanup', requireAuth, requireAnyPermission(['finance.payment', 'finance.collection', 'settings.manage']), postFinanceAccountCleanup);
financeRoutes.post('/finance/accounts/standardize', requireAuth, requireAnyPermission(['finance.payment', 'finance.collection', 'settings.manage']), postFinanceAccountStandardization);
financeRoutes.patch('/finance/accounts/:id', requireAuth, requireAnyPermission(['finance.payment', 'finance.collection', 'settings.manage']), patchFinanceAccount);
financeRoutes.get('/finance/movements', requireAuth, requireAnyPermission(['finance.view', 'customer.view']), getFinanceMovementList);
financeRoutes.get('/finance/journal', requireAuth, requireAnyPermission(['finance.view', 'dashboard.view']), getFinanceJournalReport);
financeRoutes.post('/finance/collections', requireAuth, requireAnyPermission(['finance.collection', 'customer.edit']), postCustomerCollection);
financeRoutes.post('/finance/payments', requireAuth, requireAnyPermission(['finance.payment', 'purchase.edit']), postSupplierPayment);
