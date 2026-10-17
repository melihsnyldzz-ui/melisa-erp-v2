import { Router } from 'express';
import {
  getCatalogs,
  getPublicCatalogProductList,
  getWhatsappPlan,
  getWhatsappStatus,
  postCatalogDraft,
  postWhatsappSend,
} from '../controllers/catalogController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const catalogRoutes = Router();

catalogRoutes.get('/public/catalog-products', getPublicCatalogProductList);
catalogRoutes.get('/catalogs', requireAuth, requirePermission('product.view'), getCatalogs);
catalogRoutes.post('/catalogs/draft', requireAuth, requirePermission('product.edit'), postCatalogDraft);
catalogRoutes.get('/catalogs/whatsapp-plan', requireAuth, requirePermission('customer.view'), getWhatsappPlan);
catalogRoutes.get('/catalogs/whatsapp-status', requireAuth, requirePermission('customer.view'), getWhatsappStatus);
catalogRoutes.post('/catalogs/whatsapp-send', requireAuth, requirePermission('customer.view'), postWhatsappSend);
