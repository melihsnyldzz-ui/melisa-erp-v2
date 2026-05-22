import { Router } from 'express';
import { getProduct, getProducts } from '../controllers/productController.js';

export const productRoutes = Router();

productRoutes.get('/products', getProducts);
productRoutes.get('/products/:id', getProduct);
