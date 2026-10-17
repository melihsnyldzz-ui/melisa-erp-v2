import {operationQuarantineGate} from '../services/operationQuarantineGate.mjs';
import { Router } from 'express';
import { getCustomer, getCustomerCard, getCustomerCards, getCustomerContact, getCustomerContactRequest, postCustomerContact, getCustomers, getVegaCustomers, patchCustomerPassive, postCashCustomersEnsure, postCustomer, putCustomer } from '../controllers/customerController.js';
import { requireAnyPermission, requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const customerRoutes = Router();

customerRoutes.get('/customer-cards', requireAuth, requirePermission('customer.view'), getCustomerCards);
customerRoutes.get('/customers/:id/card', requireAuth, requirePermission('customer.view'), getCustomerCard);
customerRoutes.get('/customers/:id/contact/requests/:requestId',requireAuth,requirePermission('customer.view'),requirePermission('customer.edit'),getCustomerContactRequest);
customerRoutes.get('/customers/:id/contact',requireAuth,requirePermission('customer.view'),requirePermission('customer.edit'),getCustomerContact);
customerRoutes.post('/customers/:id/contact',requireAuth,requirePermission('customer.view'),requirePermission('customer.edit'),operationQuarantineGate('customer'),postCustomerContact);

customerRoutes.get('/customers', requireAuth, requirePermission('customer.view'), getCustomers);
customerRoutes.get('/vega/customers', requireAuth, requirePermission('customer.view'), getVegaCustomers);
customerRoutes.post('/customers/cash/ensure', requireAuth, requireAnyPermission(['sales.create', 'customer.edit']), postCashCustomersEnsure);
customerRoutes.post('/customers', requireAuth, requirePermission('customer.edit'), postCustomer);
customerRoutes.get('/customers/:id', requireAuth, requirePermission('customer.view'), getCustomer);
customerRoutes.put('/customers/:id', requireAuth, requirePermission('customer.edit'), operationQuarantineGate('customer'), putCustomer);
customerRoutes.patch('/customers/:id/passive', requireAuth, requirePermission('customer.passive'), operationQuarantineGate('customer'), patchCustomerPassive);

