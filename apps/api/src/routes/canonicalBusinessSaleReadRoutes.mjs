import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {canonicalBusinessSaleReadService} from '../services/canonicalBusinessSaleReadService.mjs';
export function createCanonicalBusinessSaleReadRoutes({authenticate=requireAuth,permission=requirePermission,service=canonicalBusinessSaleReadService}={}){
 const r=Router();
 r.get('/business-sales/selection',authenticate,permission('sales.view'),permission('customer.view'),permission('product.view'),async(req,res,next)=>{
  try{if(req.get('transfer-encoding')||Number(req.get('content-length')??0)>0)return res.status(400).json({success:false,error:{code:'BUSINESS_SALE_READ_BODY_REJECTED'}});res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).json({success:true,...await service.selection(req.query,req.user)});}catch(error){next(error);}
 });
 r.all('/business-sales/selection',(_req,res)=>res.status(405).set('Allow','GET, HEAD').json({success:false,error:{code:'BUSINESS_SALE_READ_ONLY'}}));
 return r;
}
export const canonicalBusinessSaleReadRoutes=createCanonicalBusinessSaleReadRoutes();
