import { Router } from 'express';
import { getCustomer, getCustomers, patchCustomerPassive, postCustomer, putCustomer } from '../controllers/customerController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const customerRoutes = Router();

customerRoutes.get('/customers', requireAuth, requirePermission('customer.view'), getCustomers);
customerRoutes.post('/customers', requireAuth, requirePermission('customer.edit'), postCustomer);
customerRoutes.get('/customers/:id', requireAuth, requirePermission('customer.view'), getCustomer);
customerRoutes.put('/customers/:id', requireAuth, requirePermission('customer.edit'), putCustomer);
customerRoutes.patch('/customers/:id/passive', requireAuth, requirePermission('customer.passive'), patchCustomerPassive);
