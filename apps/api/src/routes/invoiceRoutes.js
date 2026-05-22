import { Router } from 'express';
import {
  getPurchaseInvoice,
  getPurchaseInvoices,
  getSalesInvoice,
  getSalesInvoices,
  postPurchaseFinalize,
  postSalesFinalize,
  postPurchaseDraft,
  postSalesDraft,
  putPurchaseDraft,
  putSalesDraft,
} from '../controllers/invoiceController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const invoiceRoutes = Router();

invoiceRoutes.get('/sales-invoices', getSalesInvoices);
invoiceRoutes.post('/sales-invoices/draft', requireAuth, requirePermission('sales.draft.write'), postSalesDraft);
invoiceRoutes.post('/sales-invoices/:id/finalize', requireAuth, requirePermission('sales.finalize'), postSalesFinalize);
invoiceRoutes.get('/sales-invoices/:id', getSalesInvoice);
invoiceRoutes.put('/sales-invoices/:id/draft', requireAuth, requirePermission('sales.draft.write'), putSalesDraft);
invoiceRoutes.get('/purchase-invoices', getPurchaseInvoices);
invoiceRoutes.post('/purchase-invoices/draft', requireAuth, requirePermission('purchase.draft.write'), postPurchaseDraft);
invoiceRoutes.post('/purchase-invoices/:id/finalize', requireAuth, requirePermission('purchase.finalize'), postPurchaseFinalize);
invoiceRoutes.get('/purchase-invoices/:id', getPurchaseInvoice);
invoiceRoutes.put('/purchase-invoices/:id/draft', requireAuth, requirePermission('purchase.draft.write'), putPurchaseDraft);
