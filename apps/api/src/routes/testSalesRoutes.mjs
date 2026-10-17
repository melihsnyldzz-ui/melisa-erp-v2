import {operationQuarantineGate} from '../services/operationQuarantineGate.mjs';
import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {completeTestSale,cancelTestSale,testSalesContext} from '../services/testSalesService.mjs';
export const testSalesRoutes=Router();
const handle=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req),meta:{environment:'ISOLATED_TEST',externalOperations:false}})}catch(e){next(e)}};
testSalesRoutes.get('/test-sales/context',requireAuth,requirePermission('sales.view'),handle(()=>testSalesContext()));
testSalesRoutes.post('/sales-invoices/test-complete',requireAuth,requirePermission('sales.create'),requirePermission('sales.finalize'),operationQuarantineGate('sales'),handle(req=>completeTestSale(req.body,req.user)));
testSalesRoutes.post('/sales-invoices/:id/cancel',requireAuth,requirePermission('sales.cancel'),handle(req=>cancelTestSale(req.params.id,req.body,req.user)));
