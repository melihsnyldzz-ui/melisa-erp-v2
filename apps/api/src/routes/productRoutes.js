import {operationQuarantineGate} from '../services/operationQuarantineGate.mjs';
import { Router } from 'express';
import {
  getProduct,
  getProductBulkCreatePreview,
  getProductBulkUpdatePreview,
  getProductIdentityCheck,
  getProductOptions,
  getProducts,
  getVegaProducts,
  patchProductBarcodePassive,
  patchProductPassive,
  postProduct,
  postProductBulkCreateApply,
  postProductBulkUpdateApply,
  postProductBarcode,
  postProductImage,
  postVegaProductImage,
  deleteVegaProductImage,
  putProduct,
} from '../controllers/productController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import {getOpeningProductPrices,getOpeningPriceProducts} from '../controllers/openingPriceController.js';

import {registerProductPurchaseReferenceRoute} from '../controllers/productPurchaseReferenceController.js';
export const productRoutes = Router();
registerProductPurchaseReferenceRoute(productRoutes,{requireAuth,requirePermission});

productRoutes.get('/migration-opening-prices', requireAuth, requirePermission('product.view'), requirePermission('purchase.view'), getOpeningPriceProducts);
productRoutes.get('/products/:id/opening-prices', requireAuth, requirePermission('product.view'), requirePermission('purchase.view'), getOpeningProductPrices);

productRoutes.get('/products', requireAuth, requirePermission('product.view'), getProducts);
productRoutes.get('/vega/products', requireAuth, requirePermission('product.view'), getVegaProducts);
productRoutes.post('/vega/products/:sourceId/image', requireAuth, requirePermission('product.edit'), postVegaProductImage);
productRoutes.delete('/vega/products/:sourceId/image', requireAuth, requirePermission('product.edit'), deleteVegaProductImage);
productRoutes.get('/products/options', requireAuth, requirePermission('product.view'), getProductOptions);
productRoutes.get('/products/identity-check', requireAuth, requirePermission('product.view'), getProductIdentityCheck);
productRoutes.post('/products/bulk-create/preview', requireAuth, requirePermission('product.edit'), getProductBulkCreatePreview);
productRoutes.post('/products/bulk-create/apply', requireAuth, requirePermission('product.edit'), postProductBulkCreateApply);
productRoutes.post('/products/bulk-update/preview', requireAuth, requirePermission('product.edit'), getProductBulkUpdatePreview);
productRoutes.post('/products/bulk-update/apply', requireAuth, requirePermission('product.edit'), postProductBulkUpdateApply);
productRoutes.post('/products', requireAuth, requirePermission('product.edit'), postProduct);
productRoutes.post('/products/:id/barcodes', requireAuth, requirePermission('product.edit'), operationQuarantineGate('product'), postProductBarcode);
productRoutes.patch('/products/:id/barcodes/:barcodeId/passive', requireAuth, requirePermission('product.edit'), operationQuarantineGate('product'), patchProductBarcodePassive);
productRoutes.post('/products/:id/images', requireAuth, requirePermission('product.edit'), operationQuarantineGate('product'), postProductImage);
productRoutes.get('/products/:id', requireAuth, requirePermission('product.view'), getProduct);
productRoutes.put('/products/:id', requireAuth, requirePermission('product.edit'), operationQuarantineGate('product'), putProduct);
productRoutes.patch('/products/:id/passive', requireAuth, requirePermission('product.passive'), operationQuarantineGate('product'), patchProductPassive);
