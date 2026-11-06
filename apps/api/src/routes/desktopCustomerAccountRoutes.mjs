import {Router} from 'express';
import {desktopCustomerAccountCommand,isCustomerAccountOutcome} from '../../../../packages/shared/src/desktopCustomerAccount.mjs';
export function createDesktopCustomerAccountRoutes({service,authenticateNormal}={}){
 if(typeof service?.createCustomerAccount!=='function'||typeof authenticateNormal!=='function')throw Error('CUSTOMER_ACCOUNT_CONFIGURATION');const router=Router({caseSensitive:true,strict:true});
 router.post('/api/desktop-local/customer-accounts',async(req,res)=>{
  res.set('Cache-Control','no-store');const requestId=req.body?.requestId;
  if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId))return res.status(400).json({success:false,error:{code:'REQUEST_ID_INVALID'}});
  const unknown=()=>res.status(503).json({success:false,data:{state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY',requiresRecovery:true},error:{code:'LOCAL_REQUEST_UNKNOWN'}});
  try{
   if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||!req.is('application/json')||Object.keys(req.query??{}).length)return unknown();
   const c=desktopCustomerAccountCommand(req.body),s=await authenticateNormal(req);
   if(s?.kind!=='normal'||typeof s.userId!=='string'||!Array.isArray(s.permissions)||!['customer.view','customer.edit'].every(p=>s.permissions.includes(p)))return unknown();
   const result=await service.createCustomerAccount(s.userId,c);if(!isCustomerAccountOutcome(result,c))return unknown();
   if(result.state==='NOT_COMMITTED')return res.status(409).json({success:false,data:result,error:{code:result.reason}});
   return res.status(result.replayed?200:201).json({success:true,data:result});
  }catch{return unknown();}
 });return router;
}
