import { Router } from 'express';
import { getSupplier, getSuppliers, postSupplier, putSupplier } from '../controllers/supplierController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const supplierRoutes = Router();

supplierRoutes.get('/suppliers', requireAuth, requirePermission('supplier.view'), getSuppliers);
supplierRoutes.post('/suppliers', requireAuth, requirePermission('supplier.edit'), postSupplier);
supplierRoutes.get('/suppliers/:id', requireAuth, requirePermission('supplier.view'), getSupplier);
supplierRoutes.put('/suppliers/:id', requireAuth, requirePermission('supplier.edit'), putSupplier);
