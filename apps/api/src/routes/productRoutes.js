import { Router } from 'express';
import { getProduct, getProducts, patchProductPassive, postProduct, putProduct } from '../controllers/productController.js';

export const productRoutes = Router();

productRoutes.get('/products', getProducts);
productRoutes.post('/products', postProduct);
productRoutes.get('/products/:id', getProduct);
productRoutes.put('/products/:id', putProduct);
productRoutes.patch('/products/:id/passive', patchProductPassive);
