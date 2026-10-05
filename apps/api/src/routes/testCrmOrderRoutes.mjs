import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {testCrmOrders} from '../services/testCrmOrderService.mjs';
export const testCrmOrderRoutes=Router();
const handle=operation=>async(req,res,next)=>{try{res.json({success:true,data:await operation(req),meta:{environment:'CANONICAL_TEST',purpose:'crm-order-draft-only',externalOperations:false}})}catch(error){next(error)}};
testCrmOrderRoutes.get('/test/crm/orders/context',requireAuth,requirePermission('sales.view'),handle(req=>testCrmOrders().context(req.user,req.get('x-crm-authorization'))));
testCrmOrderRoutes.post('/test/crm/orders/drafts',requireAuth,requirePermission('sales.create'),handle(req=>testCrmOrders().create(req.body,req.user,req.get('x-crm-authorization'))));
testCrmOrderRoutes.get('/test/crm/orders/drafts/:requestId',requireAuth,requirePermission('sales.view'),handle(req=>testCrmOrders().get(req.params.requestId,req.user,req.get('x-crm-authorization'))));
