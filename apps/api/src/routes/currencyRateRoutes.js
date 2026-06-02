import { Router } from 'express';
import { getRates, putRates } from '../controllers/currencyRateController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const currencyRateRoutes = Router();

currencyRateRoutes.get('/currency-rates', requireAuth, requirePermission('sales.view'), getRates);
currencyRateRoutes.put('/currency-rates', requireAuth, requirePermission('settings.manage'), putRates);
