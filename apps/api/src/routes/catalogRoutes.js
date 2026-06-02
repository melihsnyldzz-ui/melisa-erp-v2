import { Router } from 'express';
import { getCatalogs, getWhatsappPlan, postCatalogDraft } from '../controllers/catalogController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const catalogRoutes = Router();

catalogRoutes.get('/catalogs', requireAuth, requirePermission('product.view'), getCatalogs);
catalogRoutes.post('/catalogs/draft', requireAuth, requirePermission('product.edit'), postCatalogDraft);
catalogRoutes.get('/catalogs/whatsapp-plan', requireAuth, requirePermission('customer.view'), getWhatsappPlan);
