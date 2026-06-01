import { Router } from 'express';
import { getProduct, getProducts, patchProductPassive, postProduct, putProduct } from '../controllers/productController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const productRoutes = Router();

productRoutes.get('/products', requireAuth, requirePermission('product.view'), getProducts);
productRoutes.post('/products', requireAuth, requirePermission('product.edit'), postProduct);
productRoutes.get('/products/:id', requireAuth, requirePermission('product.view'), getProduct);
productRoutes.put('/products/:id', requireAuth, requirePermission('product.edit'), putProduct);
productRoutes.patch('/products/:id/passive', requireAuth, requirePermission('product.passive'), patchProductPassive);
