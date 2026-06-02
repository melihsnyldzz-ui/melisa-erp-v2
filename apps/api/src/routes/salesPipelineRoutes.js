import { Router } from 'express';
import {
  changeSalesPipelineDocumentStatus,
  convertSalesOfferToOrder,
  convertSalesOrderToDraft,
  createSalesPipelineDocument,
  getSalesPipelineDocument,
  listSalesPipelineDocuments,
  updateSalesPipelineDocument,
} from '../controllers/salesPipelineController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const salesOfferRoutes = Router();
export const salesOrderRoutes = Router();

salesOfferRoutes.get('/sales-offers', requireAuth, requirePermission('sales.view'), listSalesPipelineDocuments);
salesOfferRoutes.post('/sales-offers', requireAuth, requirePermission('sales.create'), createSalesPipelineDocument);
salesOfferRoutes.get('/sales-offers/:id', requireAuth, requirePermission('sales.view'), getSalesPipelineDocument);
salesOfferRoutes.put('/sales-offers/:id', requireAuth, requirePermission('sales.edit'), updateSalesPipelineDocument);
salesOfferRoutes.patch('/sales-offers/:id/status', requireAuth, requirePermission('sales.edit'), changeSalesPipelineDocumentStatus);
salesOfferRoutes.post('/sales-offers/:id/convert-to-order', requireAuth, requirePermission('sales.create'), convertSalesOfferToOrder);

salesOrderRoutes.get('/sales-orders', requireAuth, requirePermission('sales.view'), listSalesPipelineDocuments);
salesOrderRoutes.post('/sales-orders', requireAuth, requirePermission('sales.create'), createSalesPipelineDocument);
salesOrderRoutes.get('/sales-orders/:id', requireAuth, requirePermission('sales.view'), getSalesPipelineDocument);
salesOrderRoutes.put('/sales-orders/:id', requireAuth, requirePermission('sales.edit'), updateSalesPipelineDocument);
salesOrderRoutes.patch('/sales-orders/:id/status', requireAuth, requirePermission('sales.edit'), changeSalesPipelineDocumentStatus);
salesOrderRoutes.post('/sales-orders/:id/convert-to-sales-draft', requireAuth, requirePermission('sales.create'), convertSalesOrderToDraft);
