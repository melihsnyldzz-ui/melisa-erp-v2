import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {refundContext,prepareRefund,supplierRefund,cancelSupplierRefund} from '../services/testRefundService.mjs';
export const testRefundRoutes=Router();
const handle=fn=>async(r,res,next)=>{try{res.json({success:true,data:await fn(r)})}catch(e){next(e)}};
testRefundRoutes.get('/test-refund/context',requireAuth,requirePermission('purchase.view'),handle(r=>refundContext(r.user)));
testRefundRoutes.post('/test-refund/prepare',requireAuth,requirePermission('finance.payment'),handle(r=>prepareRefund(r.body,r.user)));
testRefundRoutes.post('/test-refund/receive',requireAuth,requirePermission('finance.payment'),handle(r=>supplierRefund(r.body,r.user)));
testRefundRoutes.post('/test-refund/:id/cancel',requireAuth,requirePermission('finance.payment.cancel'),handle(r=>cancelSupplierRefund(r.params.id,r.body,r.user)));
