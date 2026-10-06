import {Router} from 'express';
import {workInboundService} from '../services/workInboundService.mjs';
async function defaultAuthenticate(req,res,next){try{const {requireAuth}=await import('../middleware/authMiddleware.js');return requireAuth(req,res,next);}catch(error){next(error);}}
export function createWorkInboundRoutes({authenticate=defaultAuthenticate,service=workInboundService}={}){
 const r=Router(),handle=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(e){next(e);}};r.use(['/work-receiving','/work-purchases','/work-suppliers'],authenticate);
 r.get('/work-receiving/context',handle(q=>service.context(q.user)));
 r.get('/work-receiving/home',handle(q=>service.home(q.user)));
 r.get('/work-receiving/count-drafts',handle(q=>service.list(q.user)));
 r.post('/work-receiving/count-drafts',handle(q=>service.create(q.body,q.user)));
 r.get('/work-receiving/count-drafts/:id',handle(q=>service.draft(q.params.id,q.user)));
 for(const action of ['update','submit','cancel'])r.post('/work-receiving/count-drafts/:id/'+action,handle(q=>service[action](q.params.id,q.body,q.user)));
 for(const action of ['approve','reject'])r.post('/work-receiving/receipts/:id/'+action,handle(q=>service.decide(q.params.id,q.body,q.user,action==='approve')));
 r.get('/work-receiving/requests/:id',handle(q=>service.request(q.params.id,q.user)));
 r.get('/work-purchases/context',handle(q=>service.purchaseContext(q.user)));
 r.post('/work-purchases/preview',handle(q=>service.preview(q.body,q.user)));
 r.post('/work-purchases/drafts',handle(q=>service.purchaseDraft(q.body,q.user)));
 r.get('/work-purchases/drafts/:id',handle(q=>service.purchaseGet(q.params.id,q.user)));
 for(const action of ['finalize','cancel'])r.post('/work-purchases/drafts/:id/'+action,handle(q=>service.purchaseDecide(q.params.id,q.body,q.user,action==='cancel')));
 for(const action of ['context','history'])r.get('/work-suppliers/'+action,handle(q=>service.supplier(q.user)));
 return r;
}
export const workInboundRoutes=createWorkInboundRoutes();
