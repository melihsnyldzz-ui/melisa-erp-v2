import { Router } from 'express';
import { getCustomer, getCustomers } from '../controllers/customerController.js';

export const customerRoutes = Router();

customerRoutes.get('/customers', getCustomers);
customerRoutes.get('/customers/:id', getCustomer);
