import { Router } from 'express';
import { customerRoutes } from './customerRoutes.js';
import { dashboardRoutes } from './dashboardRoutes.js';
import { invoiceRoutes } from './invoiceRoutes.js';
import { productRoutes } from './productRoutes.js';
import { systemRoutes } from './systemRoutes.js';

export const apiRoutes = Router();

apiRoutes.use(systemRoutes);
apiRoutes.use(dashboardRoutes);
apiRoutes.use(productRoutes);
apiRoutes.use(customerRoutes);
apiRoutes.use(invoiceRoutes);
