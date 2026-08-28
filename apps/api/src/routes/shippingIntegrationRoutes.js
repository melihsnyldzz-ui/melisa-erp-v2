import { Router } from 'express';
import {
  createFedexCustomerQuote,
  createFedexShippingQuote,
  downloadFedexCustomerQuotePdf,
  finalizeFedexCustomerQuote,
  getFedexIntegrationStatus,
  getFedexShippingRates,
} from '../controllers/shippingIntegrationController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';

export const shippingIntegrationRoutes = Router();

shippingIntegrationRoutes.get('/shipping/fedex/status', requireAuth, requirePermission('sales.view'), getFedexIntegrationStatus);
shippingIntegrationRoutes.post('/shipping/fedex/quotes', requireAuth, requirePermission('sales.create'), createFedexShippingQuote);
shippingIntegrationRoutes.post('/shipping/fedex/quotes/:id/rates', requireAuth, requirePermission('sales.create'), getFedexShippingRates);
shippingIntegrationRoutes.post('/shipping/fedex/quotes/:id/customer-quotes', requireAuth, requirePermission('sales.create'), createFedexCustomerQuote);
shippingIntegrationRoutes.post('/shipping/fedex/customer-quotes/:id/finalize', requireAuth, requirePermission('sales.finalize'), finalizeFedexCustomerQuote);
shippingIntegrationRoutes.get('/shipping/fedex/customer-quotes/:id/pdf', requireAuth, requirePermission('sales.view'), downloadFedexCustomerQuotePdf);
