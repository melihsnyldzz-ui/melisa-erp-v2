import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import { getProductSalesEvidence } from '../controllers/productSalesEvidenceController.js';

export const productSalesEvidenceRoutes = Router();
productSalesEvidenceRoutes.get('/vega/ai/product-sales-evidence', requireAuth, requirePermission('sales.view'), getProductSalesEvidence);
