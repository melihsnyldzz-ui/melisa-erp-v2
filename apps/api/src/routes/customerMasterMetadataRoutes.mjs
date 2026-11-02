import {Router} from 'express';
import {customerMasterError} from '../services/customerMasterModel.mjs';

async function defaultAuthenticate(req,res,next){
 try{return (await import('../middleware/authMiddleware.js')).requireAuth(req,res,next);}catch(error){next(error);}
}
async function defaultAuthorize(req,res,next){
 try{
  const {requirePermission}=await import('../middleware/authMiddleware.js');
  return requirePermission('customer.view')(req,res,error=>error?next(error):requirePermission('customer.edit')(req,res,next));
 }catch(error){next(error);}
}
const empty=value=>value===undefined||value!==null&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Reflect.ownKeys(value).length===0;

// This route accepts an already prepared reader, never connection options or
// query text. Authentication remains the normal application middleware.
export function createCustomerMasterMetadataRoutes({reader,authenticate=defaultAuthenticate}={}){
 const router=Router();let pending=false;
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
