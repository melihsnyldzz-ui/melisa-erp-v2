import {Router} from 'express';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const same=(value,key,expected)=>value?.[key]===expected;
export function createDesktopCreditRoutes({service,authenticateNormal}={}){
 const methods=['readAccount','savePolicy','saveTerms','readInvoice','createRequest','listRequests','approve','resolve','readDueInvoice','createDueRequest','listDueRequests','approveDue'];
 if(!service||methods.some(k=>typeof service[k]!=='function')||typeof authenticateNormal!=='function')throw Error('DESKTOP_CREDIT_CONFIGURATION');
 const router=Router(),base='/api/desktop-credit';
 const handle=(operation,write=false)=>async(req,res)=>{
  let entered=false;try{
   if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||Object.keys(req.query??{}).length||write&&!req.is('application/json')||Object.values(req.params).some(v=>!id(v)))return res.status(403).json({success:false,code:'DESKTOP_CREDIT_FORBIDDEN'});
   const actor=await authenticateNormal(req),accountOperation=['readAccount','savePolicy','saveTerms'].includes(operation)||operation==='resolve'&&['savePolicy','saveTerms'].includes(req.body?.kind),permission=accountOperation?'customer.view':'sales.view';
   if(actor?.kind!=='normal'||!id(actor.userId)||!Array.isArray(actor.permissions)||!actor.permissions.includes(permission))return res.status(403).json({success:false,code:'DESKTOP_CREDIT_FORBIDDEN'});
   let args;
   if(operation==='readAccount')args={customerId:req.params.customerId,accountId:req.params.accountId};
   else if(operation==='savePolicy'||operation==='saveTerms'){
    if(!same(req.body,'customerId',req.params.customerId)||!same(req.body,'accountId',req.params.accountId)||!actor.permissions.includes('customer.edit'))return res.status(403).json({success:false,code:'DESKTOP_CREDIT_FORBIDDEN'});
    args=req.body;
   }else if(['readInvoice','readDueInvoice'].includes(operation))args={invoiceId:req.params.invoiceId};
   else if(['approve','approveDue'].includes(operation)){
    if(!req.body||Object.keys(req.body).sort().join(',')!=='reason,requestId')return res.status(403).json({success:false,code:'DESKTOP_CREDIT_FORBIDDEN'});
    args={...req.body,approvalRequestId:req.params.id};
   }else args=req.body;
   // A resolver performs durable fencing; it is a write, even if the result
   // says NOT_COMMITTED. The service rechecks the operation's real permission.
   entered=true;const data=['listRequests','listDueRequests'].includes(operation)?await service[operation](actor.userId):await service[operation](actor.userId,args);
   return res.json({success:true,data});
  }catch{
   if(write&&entered)return res.status(503).json({success:false,code:'DESKTOP_CREDIT_UNKNOWN',retry:'SAME_REQUEST_ONLY'});
   return res.status(403).json({success:false,code:'DESKTOP_CREDIT_FORBIDDEN'});
  }
 };
 const account=base+'/customers/:customerId/accounts/:accountId';
 router.get(account,handle('readAccount'));router.post(account,handle('savePolicy',true));router.post(account+'/terms',handle('saveTerms',true));
 router.get(base+'/invoices/:invoiceId/due-exception',handle('readDueInvoice'));
 router.get(base+'/due-requests',handle('listDueRequests'));router.post(base+'/due-requests',handle('createDueRequest',true));
 router.post(base+'/due-requests/:id/approve',handle('approveDue',true));
 router.get(base+'/invoices/:invoiceId',handle('readInvoice'));
 router.get(base+'/requests',handle('listRequests'));router.post(base+'/requests',handle('createRequest',true));
 router.post(base+'/requests/:id/approve',handle('approve',true));router.post(base+'/resolve',handle('resolve',true));
 return router;
}
