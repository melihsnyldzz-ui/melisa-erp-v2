import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import { getVegaProductVisualProfile } from '../controllers/productVisualProfileController.js';

export const productVisualProfileRoutes = Router();
productVisualProfileRoutes.get('/vega/products/:sourceId/visual-profile', requireAuth, requirePermission('product.view'), getVegaProductVisualProfile);
