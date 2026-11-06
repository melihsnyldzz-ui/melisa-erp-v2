// V5 composition only; existing V4 application does not mount this router.
import {Router} from 'express';
import {normalizeDesktopSaleCancellation} from '../../../../packages/shared/src/desktopSaleCancellation.mjs';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export function createDesktopFinalCancellationRoutes({service,authenticateNormal}={}){
 if(typeof service?.cancel!=='function'||typeof authenticateNormal!=='function')throw Error('DESKTOP_FINAL_CANCEL_ROUTE_CONFIGURATION');
 const router=Router();
 router.post('/api/desktop-sale/workflows/:id/cancel-final',async(req,res)=>{
  const requestId=typeof req.body?.requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(req.body.requestId)?req.body.requestId:null;
  try{
   if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||!req.is('application/json')||Object.keys(req.query).length||!id(req.params.id))throw Error();
   const command=normalizeDesktopSaleCancellation(req.body);if(command.invoiceId!==req.params.id)throw Error();
   const user=await authenticateNormal(req),actor=typeof user?.userId==='number'?String(user.userId):user?.userId;
   if(user?.kind!=='normal'||!id(actor)||!Array.isArray(user.permissions)||['sales.view','sales.cancel'].some(p=>!user.permissions.includes(p)))throw Error();
   const result=await service.cancel(actor,command);
   if(!result||Object.keys(result).sort().join(',')!=='invoiceId,replayed,requestId,state,version,workflowState'||result.state!=='COMMITTED'||result.requestId!==command.requestId||result.invoiceId!==command.invoiceId||result.workflowState!=='CANCELLED'||typeof result.version!=='string'||!/^0x[0-9A-F]{16}$/.test(result.version)||typeof result.replayed!=='boolean')throw Error();
   return res.status(result.replayed?200:201).json({success:true,data:result});
  }catch{return res.status(503).json({success:false,data:{state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY'}});}
 });return router;
}
