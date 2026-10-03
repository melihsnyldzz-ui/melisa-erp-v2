import { Router } from 'express';
import {
  getPurchaseInvoice,
  getPurchaseInvoices,
  getSalesInvoice,
  getSalesInvoices,
  postPurchaseCancel,
  postPurchaseFinalize,
  postSalesCancel,
  postSalesFinalize,
  postPurchaseDraft,
  postSalesDraft,
  putPurchaseDraft,
  putSalesDraft,
} from '../controllers/invoiceController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const invoiceRoutes = Router();

invoiceRoutes.get('/sales-invoices', requireAuth, requirePermission('sales.view'), getSalesInvoices);
invoiceRoutes.post('/sales-invoices/draft', requireAuth, requirePermission('sales.create'), postSalesDraft);
invoiceRoutes.post('/sales-invoices/:id/finalize', requireAuth, requirePermission('sales.finalize'), postSalesFinalize);
invoiceRoutes.post('/sales-invoices/:id/cancel', requireAuth, requirePermission('sales.cancel'), postSalesCancel);
invoiceRoutes.get('/sales-invoices/:id', requireAuth, requirePermission('sales.view'), getSalesInvoice);
invoiceRoutes.put('/sales-invoices/:id/draft', requireAuth, requirePermission('sales.edit'), putSalesDraft);
invoiceRoutes.get('/purchase-invoices', requireAuth, requirePermission('purchase.view'), getPurchaseInvoices);
invoiceRoutes.post('/purchase-invoices/draft', requireAuth, requirePermission('purchase.create'), postPurchaseDraft);
invoiceRoutes.post('/purchase-invoices/:id/finalize', requireAuth, requirePermission('purchase.finalize'), postPurchaseFinalize);
invoiceRoutes.post('/purchase-invoices/:id/cancel', requireAuth, requirePermission('purchase.cancel'), postPurchaseCancel);
invoiceRoutes.get('/purchase-invoices/:id', requireAuth, requirePermission('purchase.view'), getPurchaseInvoice);
invoiceRoutes.put('/purchase-invoices/:id/draft', requireAuth, requirePermission('purchase.edit'), putPurchaseDraft);
