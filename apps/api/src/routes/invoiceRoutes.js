import { Router } from 'express';
import {
  getPurchaseInvoice,
  getPurchaseInvoices,
  getSalesInvoice,
  getSalesInvoices,
  postSalesFinalize,
  postPurchaseDraft,
  postSalesDraft,
  putPurchaseDraft,
  putSalesDraft,
} from '../controllers/invoiceController.js';

export const invoiceRoutes = Router();

invoiceRoutes.get('/sales-invoices', getSalesInvoices);
invoiceRoutes.post('/sales-invoices/draft', postSalesDraft);
invoiceRoutes.post('/sales-invoices/:id/finalize', postSalesFinalize);
invoiceRoutes.get('/sales-invoices/:id', getSalesInvoice);
invoiceRoutes.put('/sales-invoices/:id/draft', putSalesDraft);
invoiceRoutes.get('/purchase-invoices', getPurchaseInvoices);
invoiceRoutes.post('/purchase-invoices/draft', postPurchaseDraft);
invoiceRoutes.get('/purchase-invoices/:id', getPurchaseInvoice);
invoiceRoutes.put('/purchase-invoices/:id/draft', putPurchaseDraft);
