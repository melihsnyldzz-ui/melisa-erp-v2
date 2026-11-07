import {Router} from 'express';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export function createDesktopSalesPricingRoutes({service,authenticateNormal}={}){
 if(!service||['create','list','read','approve','resolve'].some(k=>typeof service[k]!=='function')||typeof authenticateNormal!=='function')throw Error('DESKTOP_SALES_PRICING_CONFIGURATION');
 const router=Router(),path='/api/desktop-sale/discount-requests';
 const handler=(method,operation)=>async(req,res)=>{
  let entered=false;try{
   if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||Object.keys(req.query??{}).length||method==='POST'&&!req.is('application/json')||req.params.id!==undefined&&!id(req.params.id))return res.status(403).json({success:false,code:'DESKTOP_SALES_PRICING_FORBIDDEN'});
   const actor=await authenticateNormal(req),actorId=actor?.userId;if(actor?.kind!=='normal'||!id(actorId)||!actor.permissions?.includes('sales.view'))return res.status(403).json({success:false,code:'DESKTOP_SALES_PRICING_FORBIDDEN'});
   entered=true;const data=operation==='list'?await service.list(actorId):operation==='read'?await service.read(actorId,req.params.id):operation==='resolve'?await service.resolve(actorId,req.body):operation==='create'?await service.create(actorId,req.body):await service.approve(actorId,req.params.id,req.body);
   return res.json({success:true,data});
  }catch(error){
   // An already-entered write can have an unknown commit acknowledgement.
   // Keep its UUID/body; only the same command or a verified list can resolve it.
   if(method==='POST'&&entered)return res.status(503).json({success:false,code:'DESKTOP_SALES_APPROVAL_UNKNOWN',retry:'SAME_REQUEST_ONLY'});
   return res.status(403).json({success:false,code:'DESKTOP_SALES_PRICING_FORBIDDEN'});
  }
 };
 router.get(path,handler('GET','list'));router.get(path+'/:id',handler('GET','read'));router.post(path,handler('POST','create'));router.post(path+'/resolve',handler('POST','resolve'));router.post(path+'/:id/approve',handler('POST','approve'));return router;
}
