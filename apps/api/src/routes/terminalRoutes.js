import { Router } from 'express';
import {
  getTerminalCustomersSearch,
  getTerminalProductBarcode,
  getTerminalProductsSearch,
  postTerminalSaleSubmit,
  postTerminalWhatsappShare,
} from '../controllers/terminalController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const terminalRoutes = Router();

terminalRoutes.get('/terminal/products/search', requireAuth, requirePermission('product.view'), getTerminalProductsSearch);
terminalRoutes.get('/terminal/products/barcode/:barcode', requireAuth, requirePermission('product.view'), getTerminalProductBarcode);
terminalRoutes.get('/terminal/customers/search', requireAuth, requirePermission('customer.view'), getTerminalCustomersSearch);
terminalRoutes.post(
  '/terminal/sales/submit',
  requireAuth,
  requirePermission('sales.create'),
  requirePermission('sales.finalize'),
  postTerminalSaleSubmit,
);
terminalRoutes.post(
  '/terminal/whatsapp-share',
  requireAuth,
  requirePermission('customer.view'),
  postTerminalWhatsappShare,
);
