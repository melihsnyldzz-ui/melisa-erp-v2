import {Router} from 'express';
import {requireAuth} from '../middleware/authMiddleware.js';
import {workSystemService} from '../services/workSystemService.mjs';
export function createWorkSystemRoutes({authenticate=requireAuth,service=workSystemService}={}){const router=Router();router.get('/work-system/summary',authenticate,async(req,res,next)=>{try{if(Object.keys(req.query).length)throw Object.assign(Error('Sistem özeti ek filtre kabul etmiyor.'),{statusCode:400});res.json({success:true,data:await service.summary(req.user)});}catch(e){next(e);}});return router;}
export const workSystemRoutes=createWorkSystemRoutes();
