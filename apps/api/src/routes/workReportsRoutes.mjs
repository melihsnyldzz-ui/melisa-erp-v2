import {Router} from 'express';
import {requireAuth} from '../middleware/authMiddleware.js';
import {workReportsService} from '../services/workReportsService.mjs';
export function createWorkReportsRoutes({authenticate=requireAuth,service=workReportsService}={}){const router=Router();
 for(const [path,handler] of [['/work-reports/context',req=>service.context(req.user)],['/work-reports/export',req=>service.report(req.query,req.user,{exporting:true})],['/work-reports',req=>service.report(req.query,req.user)]])router.get(path,authenticate,async(req,res,next)=>{try{res.json({success:true,data:await handler(req)});}catch(e){next(e);}});
 return router;}
export const workReportsRoutes=createWorkReportsRoutes();
