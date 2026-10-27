import {Router} from 'express';import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {canonicalBusinessPartyHistoryService} from '../services/canonicalBusinessPartyHistoryService.mjs';
export function createCanonicalBusinessPartyHistoryRoutes({authenticate=requireAuth,permission=requirePermission,service=canonicalBusinessPartyHistoryService}={}){
 const r=Router(),path='/business-party-history/:kind/:partyId/:accountId';
 r.get(path,authenticate,permission('finance.view'),async(req,res,next)=>{try{
  if(Object.keys(req.query).some(k=>!['currency','page','dateFrom','dateTo'].includes(k))||req.get('transfer-encoding')||Number(req.get('content-length')??0)>0)return res.status(400).json({success:false,error:{code:'BUSINESS_PARTY_HISTORY_QUERY_INVALID'}});
  res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).json({success:true,...await service.read({...req.params,...req.query},req.user)});
 }catch(e){next(e);}});
 r.all(path,(_req,res)=>res.status(405).set('Allow','GET, HEAD').json({success:false,error:{code:'BUSINESS_PARTY_HISTORY_READ_ONLY'}}));return r;
}
export const canonicalBusinessPartyHistoryRoutes=createCanonicalBusinessPartyHistoryRoutes();
