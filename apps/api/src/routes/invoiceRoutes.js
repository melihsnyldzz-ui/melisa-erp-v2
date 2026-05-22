import { Router } from 'express';
import { getPurchaseInvoices, getSalesInvoices } from '../controllers/invoiceController.js';

export const invoiceRoutes = Router();

invoiceRoutes.get('/sales-invoices', getSalesInvoices);
invoiceRoutes.get('/purchase-invoices', getPurchaseInvoices);
