import {Router} from 'express';
import {requireAuth, requirePermission} from '../middleware/authMiddleware.js';
import {testProductPriceService as service} from '../services/testProductPriceService.mjs';
export const testProductPriceRoutes = Router();
const handle = fn => async (req, res, next) => {try {res.json({success: true, data: await fn(req)});} catch (error) {next(error);}};
const path = '/products/:productId/current-prices';
testProductPriceRoutes.get(path, requireAuth, requirePermission('product.view'), requirePermission('purchase.view'), handle(req => service.context(req.params.productId, req.user)));
testProductPriceRoutes.post(path, requireAuth, requirePermission('product.view'), requirePermission('purchase.view'), requirePermission('product.price.edit'), handle(req => service.update(req.params.productId, req.body, req.user)));
