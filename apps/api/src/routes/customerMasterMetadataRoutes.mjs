import {Router} from 'express';
import {customerMasterError} from '../services/customerMasterModel.mjs';

async function defaultAuthenticate(req,res,next){
 try{return (await import('../middleware/authMiddleware.js')).requireAuth(req,res,next);}catch(error){next(error);}
}
async function defaultAuthorize(req,res,next){
 try{
  if(req.authContext?.nativeTerminalCode||req.user?.nativeTerminalSession===true)throw customerMasterError('CUSTOMER_PERMISSION_DENIED',403);
  const {requirePermission}=await import('../middleware/authMiddleware.js');
  return requirePermission('customer.view')(req,res,error=>error?next(error):requirePermission('customer.edit')(req,res,next));
 }catch(error){next(error);}
}
const empty=value=>value===undefined||value!==null&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Reflect.ownKeys(value).length===0;

// This route accepts an already prepared reader, never connection options or
// query text. Authentication remains the normal application middleware.
export function createCustomerMasterMetadataRoutes({reader,authenticate=defaultAuthenticate,checkAssets}={}){
 const router=Router(),assets=checkAssets??reader?.checkAssets;let pending=false;
 // Public static application assets contain no data or credentials. The only
 // metadata request still passes normal bearer authentication and both roles.
 for(const [path,field,type]of [['/customer-master-metadata-check','html','html'],['/customer-master-metadata-check/client.mjs','script','js']])router.get(path,(_req,res)=>{
  res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer');
  res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  try{const asset=assets();if(typeof asset?.[field]!=='string'||!asset[field])throw Error();return res.type(type).send(asset[field]);}catch{return res.status(503).type('text').send('Kart bağlantısı kontrolü şu anda hazır değil.');}
 });
 const path='/customers/master-metadata';
 router.use(path,(req,res,next)=>{res.set('Cache-Control','no-store');res.set('Pragma','no-cache');res.set('Expires','0');next();},authenticate,defaultAuthorize);
 router.get(path,async(req,res,next)=>{
  if(req.method!=='GET')return res.status(405).set('Allow','GET').end();
  try{
   if(!empty(req.query)||!empty(req.body))throw customerMasterError('CUSTOMER_VALIDATION_FAILED',400);
   if(pending||typeof reader?.read!=='function')throw customerMasterError();
   pending=true;
   try{
    const result=await reader.read();
    if(result?.schemaVersion!=='melisa-customer-master-metadata.v1'||!['OBSERVED','UNAVAILABLE','REJECTED','FAILED'].includes(result.status))throw customerMasterError();
    res.status(result.status==='OBSERVED'?200:503).json({success:result.status==='OBSERVED',data:result});
   }finally{pending=false;}
  }catch(error){next(error);}
 });
 router.all(path,(_req,res)=>res.status(405).set('Allow','GET').end());
 return router;
}
