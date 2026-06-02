import { Router } from 'express';
import {
  getProduct,
  getProducts,
  patchProductBarcodePassive,
  patchProductPassive,
  postProduct,
  postProductBarcode,
  postProductImage,
  putProduct,
} from '../controllers/productController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const productRoutes = Router();

productRoutes.get('/products', requireAuth, requirePermission('product.view'), getProducts);
productRoutes.post('/products', requireAuth, requirePermission('product.edit'), postProduct);
productRoutes.post('/products/:id/barcodes', requireAuth, requirePermission('product.edit'), postProductBarcode);
productRoutes.patch('/products/:id/barcodes/:barcodeId/passive', requireAuth, requirePermission('product.edit'), patchProductBarcodePassive);
productRoutes.post('/products/:id/images', requireAuth, requirePermission('product.edit'), postProductImage);
productRoutes.get('/products/:id', requireAuth, requirePermission('product.view'), getProduct);
productRoutes.put('/products/:id', requireAuth, requirePermission('product.edit'), putProduct);
productRoutes.patch('/products/:id/passive', requireAuth, requirePermission('product.passive'), patchProductPassive);
