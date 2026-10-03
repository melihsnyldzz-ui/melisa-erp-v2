import { Router } from 'express';
import { getSupplier, getSuppliers, getVegaSuppliers, postSupplier, putSupplier } from '../controllers/supplierController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const supplierRoutes = Router();

supplierRoutes.get('/suppliers', requireAuth, requirePermission('supplier.view'), getSuppliers);
supplierRoutes.get('/vega/suppliers', requireAuth, requirePermission('supplier.view'), getVegaSuppliers);
supplierRoutes.post('/suppliers', requireAuth, requirePermission('supplier.edit'), postSupplier);
supplierRoutes.get('/suppliers/:id', requireAuth, requirePermission('supplier.view'), getSupplier);
supplierRoutes.put('/suppliers/:id', requireAuth, requirePermission('supplier.edit'), putSupplier);
