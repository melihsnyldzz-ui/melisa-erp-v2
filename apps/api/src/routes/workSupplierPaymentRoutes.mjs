import {Router} from 'express';
import {workSupplierPaymentService} from '../services/workSupplierPaymentService.mjs';
async function defaultAuthenticate(req,res,next){try{return (await import('../middleware/authMiddleware.js')).requireAuth(req,res,next);}catch(error){next(error);}}
export function createWorkSupplierPaymentRoutes({authenticate=defaultAuthenticate,service=workSupplierPaymentService}={}){
 const r=Router(),handle=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
 r.use('/work-supplier-payments',authenticate);
 r.get('/work-supplier-payments/context',handle(q=>service.context(q.user)));
 r.post('/work-supplier-payments/preview',handle(q=>service.preview(q.body,q.user)));
 r.post('/work-supplier-payments/payments',handle(q=>service.create(q.body,q.user)));
 r.post('/work-supplier-payments/payments/:id/cancel',handle(q=>service.cancel(q.params.id,q.body,q.user)));
 r.get('/work-supplier-payments/requests/:id',handle(q=>service.request(q.params.id,q.user)));
 return r;
}
export const workSupplierPaymentRoutes=createWorkSupplierPaymentRoutes();
