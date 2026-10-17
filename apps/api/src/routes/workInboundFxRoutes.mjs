import {Router} from 'express';
import {workInboundFxService} from '../services/workInboundFxService.mjs';
async function defaultAuthenticate(req,res,next){try{const {requireAuth}=await import('../middleware/authMiddleware.js');return requireAuth(req,res,next);}catch(error){next(error);}}
export function createWorkInboundFxRoutes({authenticate=defaultAuthenticate,service=workInboundFxService}={}){
 const r=Router(),handle=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
 r.use('/work-purchases/fx',authenticate);
 r.get('/work-purchases/fx/context',handle(q=>service.context(q.user)));
 r.post('/work-purchases/fx/preview',handle(q=>service.preview(q.body,q.user)));
 r.post('/work-purchases/fx/receipts',handle(q=>service.createReceipt(q.body,q.user)));
 for(const action of ['approve','reject'])r.post('/work-purchases/fx/receipts/:id/'+action,handle(q=>service.decideReceipt(q.params.id,q.body,q.user,action==='approve')));
 r.post('/work-purchases/fx/drafts',handle(q=>service.createDraft(q.body,q.user)));
 r.get('/work-purchases/fx/drafts/:id',handle(q=>service.getDraft(q.params.id,q.user)));
 for(const action of ['finalize','cancel'])r.post('/work-purchases/fx/drafts/:id/'+action,handle(q=>service[action+'Draft'](q.params.id,q.body,q.user)));
 return r;
}
export const workInboundFxRoutes=createWorkInboundFxRoutes();
