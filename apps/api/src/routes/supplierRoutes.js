import {operationQuarantineGate} from '../services/operationQuarantineGate.mjs';
import { Router } from 'express';
import { getSupplier, getSupplierCard, getSupplierCards, getSuppliers, getVegaSuppliers, getTestSupplierContact, postTestSupplierContact, postSupplier, putSupplier } from '../controllers/supplierController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const supplierRoutes = Router();

supplierRoutes.get('/supplier-cards', requireAuth, requirePermission('supplier.view'), getSupplierCards);
supplierRoutes.get('/suppliers/:id/card', requireAuth, requirePermission('supplier.view'), getSupplierCard);
supplierRoutes.get('/test-supplier-cards/:id/contact', requireAuth, requirePermission('supplier.view'), requirePermission('supplier.edit'), getTestSupplierContact);
supplierRoutes.post('/test-supplier-cards/:id/contact', requireAuth, requirePermission('supplier.view'), requirePermission('supplier.edit'), postTestSupplierContact);

supplierRoutes.get('/suppliers', requireAuth, requirePermission('supplier.view'), getSuppliers);
supplierRoutes.get('/vega/suppliers', requireAuth, requirePermission('supplier.view'), getVegaSuppliers);
supplierRoutes.post('/suppliers', requireAuth, requirePermission('supplier.edit'), postSupplier);
supplierRoutes.get('/suppliers/:id', requireAuth, requirePermission('supplier.view'), getSupplier);
supplierRoutes.put('/suppliers/:id', requireAuth, requirePermission('supplier.edit'), operationQuarantineGate('supplier'), putSupplier);
