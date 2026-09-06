import { Router } from 'express';
import { getProductIntelligence, getProductSalesEvidence } from '../controllers/productIntelligenceController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const productIntelligenceRoutes = Router();

productIntelligenceRoutes.get(
  '/vega/ai/product-intelligence',
  requireAuth,
  requirePermission('sales.view'),
  getProductIntelligence,
);

productIntelligenceRoutes.get(
  '/vega/ai/product-sales-evidence',
  requireAuth,
  requirePermission('sales.view'),
  getProductSalesEvidence,
);
