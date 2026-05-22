import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { customerRoutes } from './customerRoutes.js';
import { dashboardRoutes } from './dashboardRoutes.js';
import { invoiceRoutes } from './invoiceRoutes.js';
import { productRoutes } from './productRoutes.js';
import { sqlHealthRoutes } from './sqlHealthRoutes.js';
import { systemRoutes } from './systemRoutes.js';

export const apiRoutes = Router();

apiRoutes.use(systemRoutes);
apiRoutes.use(authRoutes);
apiRoutes.use(dashboardRoutes);
apiRoutes.use(productRoutes);
apiRoutes.use(customerRoutes);
apiRoutes.use(invoiceRoutes);
apiRoutes.use(sqlHealthRoutes);
