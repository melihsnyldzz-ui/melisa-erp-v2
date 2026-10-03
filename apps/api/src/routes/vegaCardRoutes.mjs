import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {previewVegaCards,applyVegaCards,vegaCardStatus} from '../services/vegaCardSync.mjs';
export function createVegaCardRoutes(configPath,automatic){
 const router=Router();
 router.use(requireAuth,requirePermission('product.edit'));
 const handle=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(e){next(e);}};
 if(automatic){
  router.get('/automatic',handle(()=>automatic.status()));
  router.put('/automatic',handle(req=>automatic.configure(req.body.enabled,req.user)));
 }
 router.post('/preview',handle(req=>previewVegaCards(configPath,req.user)));
 router.post('/apply',handle(req=>applyVegaCards(configPath,req.body.previewId,req.user)));
 router.get('/status/:previewId',handle(req=>vegaCardStatus(req.params.previewId,req.user)));
 return router;
}
