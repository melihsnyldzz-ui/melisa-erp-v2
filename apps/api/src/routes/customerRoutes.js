import { Router } from 'express';
import { getCustomers } from '../controllers/customerController.js';

export const customerRoutes = Router();

customerRoutes.get('/customers', getCustomers);
