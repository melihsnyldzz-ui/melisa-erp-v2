import { Router } from 'express';
import { getCustomer, getCustomers, getVegaCustomers, patchCustomerPassive, postCashCustomersEnsure, postCustomer, putCustomer } from '../controllers/customerController.js';
import { requireAnyPermission, requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const customerRoutes = Router();

customerRoutes.get('/customers', requireAuth, requirePermission('customer.view'), getCustomers);
customerRoutes.get('/vega/customers', requireAuth, requirePermission('customer.view'), getVegaCustomers);
customerRoutes.post('/customers/cash/ensure', requireAuth, requireAnyPermission(['sales.create', 'customer.edit']), postCashCustomersEnsure);
customerRoutes.post('/customers', requireAuth, requirePermission('customer.edit'), postCustomer);
customerRoutes.get('/customers/:id', requireAuth, requirePermission('customer.view'), getCustomer);
customerRoutes.put('/customers/:id', requireAuth, requirePermission('customer.edit'), putCustomer);
customerRoutes.patch('/customers/:id/passive', requireAuth, requirePermission('customer.passive'), patchCustomerPassive);
