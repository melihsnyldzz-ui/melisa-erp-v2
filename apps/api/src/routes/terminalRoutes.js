import { Router } from 'express';
import {
  getTerminalCustomersSearch,
  getTerminalCurrencyRates,
  getTerminalProductBarcode,
  getTerminalProductsSearch,
  postTerminalSalePrint,
  postTerminalSaleSubmit,
  postTerminalSaleStatus,
  postTerminalSaleReadiness,
  postTerminalWhatsappShare,
} from '../controllers/terminalController.js';
import { requireAnyPermission, requireAuth } from '../middleware/authMiddleware.js';
import { getTerminalSalesCapabilities } from '../controllers/terminalCapabilityController.js';
import { getTerminalOfflineContext } from '../controllers/terminalOfflineController.js';
import { startTerminalCatalogSync, getTerminalCatalogSyncPage, getTerminalCatalogVersion } from '../controllers/terminalCatalogSyncController.js';

export const terminalRoutes = Router();

const catalogPermissions = [requireAuth, requireAnyPermission(['terminal.sync.run', 'product.view']), requireAnyPermission(['terminal.sync.run', 'customer.view'])];
terminalRoutes.post('/terminal/catalog-sync', ...catalogPermissions, startTerminalCatalogSync);
terminalRoutes.get('/terminal/catalog-sync/version', ...catalogPermissions, getTerminalCatalogVersion);
terminalRoutes.get('/terminal/catalog-sync/:jobId', ...catalogPermissions, getTerminalCatalogSyncPage);

terminalRoutes.get('/terminal/sales/capabilities', requireAuth, getTerminalSalesCapabilities);
terminalRoutes.get('/terminal/offline/context', requireAuth,
  requireAnyPermission(['terminal.sync.run', 'terminal.sales.create', 'sales.create', 'product.view', 'customer.view']), getTerminalOfflineContext);

terminalRoutes.get('/terminal/currency-rates', requireAuth, requireAnyPermission(['terminal.sales.create', 'sales.view']), getTerminalCurrencyRates);
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
terminalRoutes.post('/terminal/sales/status', requireAuth,
  requireAnyPermission(['terminal.sales.create', 'sales.view']), postTerminalSaleStatus);
terminalRoutes.post('/terminal/sales/readiness', requireAuth,
  requireAnyPermission(['terminal.sales.create', 'sales.create']), postTerminalSaleReadiness);
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
