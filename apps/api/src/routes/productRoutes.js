import { Router } from 'express';
import { getProducts } from '../controllers/productController.js';

export const productRoutes = Router();

productRoutes.get('/products', getProducts);
