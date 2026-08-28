import { Router } from 'express';
import {
  getTerminalCustomersSearch,
  getTerminalProductBarcode,
  getTerminalProductsSearch,
  postTerminalSalePrint,
  postTerminalSaleSubmit,
  postTerminalWhatsappShare,
} from '../controllers/terminalController.js';
import { requireAnyPermission, requireAuth } from '../middleware/authMiddleware.js';

export const terminalRoutes = Router();

terminalRoutes.get('/terminal/products/search', requireAuth, requireAnyPermission(['terminal.sync.run', 'product.view']), getTerminalProductsSearch);
terminalRoutes.get('/terminal/products/barcode/:barcode', requireAuth, requireAnyPermission(['terminal.sync.run', 'product.view']), getTerminalProductBarcode);
terminalRoutes.get('/terminal/customers/search', requireAuth, requireAnyPermission(['terminal.sync.run', 'customer.view']), getTerminalCustomersSearch);
terminalRoutes.post(
  '/terminal/sales/submit',
  requireAuth,
  requireAnyPermission(['terminal.sales.create', 'sales.create']),
  requireAnyPermission(['terminal.sales.create', 'sales.finalize']),
  postTerminalSaleSubmit,
);
terminalRoutes.post(
  '/terminal/sales/:invoiceId/print',
  requireAuth,
  requireAnyPermission(['terminal.sales.create', 'sales.view']),
  postTerminalSalePrint,
);
terminalRoutes.post(
  '/terminal/whatsapp-share',
  requireAuth,
  requireAnyPermission(['terminal.sales.create', 'customer.view']),
  postTerminalWhatsappShare,
);
