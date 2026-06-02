import { Router } from 'express';
import { getSupplier, getSuppliers, postSupplier, putSupplier } from '../controllers/supplierController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const supplierRoutes = Router();

supplierRoutes.get('/suppliers', requireAuth, getSuppliers);
supplierRoutes.post('/suppliers', requireAuth, requirePermission('customer.edit'), postSupplier);
supplierRoutes.get('/suppliers/:id', requireAuth, getSupplier);
supplierRoutes.put('/suppliers/:id', requireAuth, requirePermission('customer.edit'), putSupplier);
