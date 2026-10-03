import { Router } from 'express';
import {
  getCustomerMovements,
  getVegaCustomerLedger,
  getVegaCustomerStockExitDocument,
  getVegaSalesStockExits,
  getVegaPurchaseInvoices,
  getVegaSupplierLedger,
  getVegaSupplierPurchaseDocument,
  getVegaSupplierPurchaseIntelligence,
  getCustomerStatementReport,
  getStockMovements,
  getSupplierMovements,
  getSupplierStatementReport,
  getStockValuation,
  postStockCountAdjustment,
} from '../controllers/movementController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const movementRoutes = Router();

movementRoutes.get('/stock-movements', requireAuth, requirePermission('product.view'), getStockMovements);
movementRoutes.get('/stock-valuation', requireAuth, requirePermission('product.view'), getStockValuation);
movementRoutes.post('/stock-count/adjust', requireAuth, requirePermission('product.view'), requirePermission('stock.adjust'), postStockCountAdjustment);
movementRoutes.get('/customer-movements', requireAuth, requirePermission('customer.view'), getCustomerMovements);
movementRoutes.get('/vega/sales/stock-exits', requireAuth, requirePermission('sales.view'), getVegaSalesStockExits);
movementRoutes.get('/vega/purchases/invoices', requireAuth, requirePermission('purchase.view'), getVegaPurchaseInvoices);
movementRoutes.get('/vega/customers/:customerSourceId/movements', requireAuth, requirePermission('customer.view'), getVegaCustomerLedger);
movementRoutes.get('/vega/customers/:customerSourceId/movements/:movementSourceId/stock-exit', requireAuth, requirePermission('sales.view'), requirePermission('customer.view'), getVegaCustomerStockExitDocument);
movementRoutes.get('/vega/suppliers/:supplierSourceId/movements', requireAuth, requirePermission('supplier.view'), getVegaSupplierLedger);
movementRoutes.get('/vega/suppliers/:supplierSourceId/purchase-intelligence', requireAuth, requirePermission('supplier.view'), getVegaSupplierPurchaseIntelligence);
movementRoutes.get('/vega/suppliers/:supplierSourceId/movements/:movementSourceId/purchase-invoice', requireAuth, requirePermission('supplier.view'), getVegaSupplierPurchaseDocument);
movementRoutes.get('/customer-statement', requireAuth, requirePermission('customer.view'), getCustomerStatementReport);
movementRoutes.get('/supplier-movements', requireAuth, requirePermission('supplier.view'), getSupplierMovements);
movementRoutes.get('/supplier-statement', requireAuth, requirePermission('supplier.view'), getSupplierStatementReport);
