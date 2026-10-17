import {Router} from 'express';
import {requireAuth} from '../middleware/authMiddleware.js';
import {homeSummaryService} from '../services/homeSummaryService.mjs';
export function createHomeSummaryRoutes({authenticate=requireAuth,service=homeSummaryService}={}){
 const router=Router();router.get('/home/summary',authenticate,async(req,res,next)=>{try{if(Object.keys(req.query).length)throw Object.assign(new Error('Ana sayfa özeti ek filtre kabul etmiyor.'),{statusCode:400,code:'HOME_QUERY_INVALID'});res.json({success:true,data:await service.summary(req.user)});}catch(error){next(error);}});return router;
}
export const homeSummaryRoutes=createHomeSummaryRoutes();
