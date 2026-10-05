import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {workCollectionService} from '../services/workCollectionService.mjs';
export function createWorkCollectionRoutes({authenticate=requireAuth,permission=requirePermission,service=workCollectionService}={}){
 const r=Router(),run=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
 r.get('/work-collections/context',authenticate,permission('customer.view'),run(req=>service.context(req.query,req.user)));
 r.post('/work-collections/preview',authenticate,permission('finance.collection'),run(req=>service.preview(req.body,req.user)));
 r.post('/work-collections',authenticate,permission('finance.collection'),run(req=>service.collect(req.body,req.user)));
 r.post('/work-collections/:id/cancel',authenticate,permission('finance.collection.cancel'),run(req=>service.cancel(req.params.id,req.body,req.user)));
 return r;
}
export const workCollectionRoutes=createWorkCollectionRoutes();
