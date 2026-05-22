import { Router } from 'express';
import { getProduct, getProducts, patchProductPassive, postProduct, putProduct } from '../controllers/productController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const productRoutes = Router();

productRoutes.get('/products', requireAuth, getProducts);
productRoutes.post('/products', requireAuth, requirePermission('product.update'), postProduct);
productRoutes.get('/products/:id', requireAuth, getProduct);
productRoutes.put('/products/:id', requireAuth, requirePermission('product.update'), putProduct);
productRoutes.patch('/products/:id/passive', requireAuth, requirePermission('product.passive'), patchProductPassive);
