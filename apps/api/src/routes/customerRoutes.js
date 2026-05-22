import { Router } from 'express';
import { getCustomer, getCustomers, patchCustomerPassive, postCustomer, putCustomer } from '../controllers/customerController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const customerRoutes = Router();

customerRoutes.get('/customers', requireAuth, getCustomers);
customerRoutes.post('/customers', requireAuth, requirePermission('customer.update'), postCustomer);
customerRoutes.get('/customers/:id', requireAuth, getCustomer);
customerRoutes.put('/customers/:id', requireAuth, requirePermission('customer.update'), putCustomer);
customerRoutes.patch('/customers/:id/passive', requireAuth, requirePermission('customer.passive'), patchCustomerPassive);
