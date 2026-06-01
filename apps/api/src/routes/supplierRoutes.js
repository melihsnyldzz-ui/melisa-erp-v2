import { Router } from 'express';
import { getSupplier, getSuppliers } from '../controllers/supplierController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const supplierRoutes = Router();

supplierRoutes.get('/suppliers', requireAuth, getSuppliers);
supplierRoutes.get('/suppliers/:id', requireAuth, getSupplier);
