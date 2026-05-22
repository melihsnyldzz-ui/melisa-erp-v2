import { Router } from 'express';
import { getCustomer, getCustomers, postCustomer, putCustomer } from '../controllers/customerController.js';

export const customerRoutes = Router();

customerRoutes.get('/customers', getCustomers);
customerRoutes.post('/customers', postCustomer);
customerRoutes.get('/customers/:id', getCustomer);
customerRoutes.put('/customers/:id', putCustomer);
