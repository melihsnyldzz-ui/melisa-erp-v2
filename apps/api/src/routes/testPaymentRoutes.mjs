import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {paymentContext,payTestSupplier,cancelTestPayment} from '../services/testPaymentService.mjs';
export const testPaymentRoutes=Router();
const handle=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req),meta:{environment:'ISOLATED_TEST'}})}catch(e){next(e)}};
testPaymentRoutes.get('/test-payment/context',requireAuth,requirePermission('purchase.view'),handle(r=>paymentContext(r.user)));
testPaymentRoutes.post('/test-payment/payments',requireAuth,requirePermission('finance.payment'),handle(r=>payTestSupplier(r.body,r.user)));
testPaymentRoutes.post('/test-payment/payments/:id/cancel',requireAuth,requirePermission('finance.payment.cancel'),handle(r=>cancelTestPayment(r.params.id,r.body,r.user)));
