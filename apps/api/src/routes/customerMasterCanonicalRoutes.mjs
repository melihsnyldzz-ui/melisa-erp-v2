// Factory for the prepared canonical binding. The factory itself never mounts
// or enables a writer. Startup may mount it only after its explicit selection,
// target, metadata and same-transaction readiness checks; each operation still
// validates its own transaction frame.
import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {operationQuarantineGate} from '../services/operationQuarantineGate.mjs';
import {createCustomerMasterController} from '../controllers/customerMasterController.mjs';
import {ok,fail} from '../utils/response.js';
import {getCanonicalBusinessSession,assertCanonicalBusinessSession,BUSINESS_SESSION} from '../services/canonicalBusinessSessionContext.mjs';

// Direct API requests must satisfy the same registered normal TEST identity
// as the browser path. Browser-side checks alone are not authorization.
function requireNormalMasterActor(req,_res,next){
 try{const c=assertCanonicalBusinessSession(getCanonicalBusinessSession()),u=req.user;
  if(c.userId!==17||c.roleId!==17||c.username!==BUSINESS_SESSION.username||c.roleCode!==BUSINESS_SESSION.roleCode||c.database!==BUSINESS_SESSION.database||c.server!==BUSINESS_SESSION.server||c.actualT1!==false||c.externalOperations!==false||!Array.isArray(c.permissions)||String(u?.id)!=='17'||u.username!==c.username||String(u.role?.id)!=='17'||u.role.code!==c.roleCode||u.isActive===false||u.isAdmin===true||u.testAdminSession===true||u.nativeTerminalSession===true||req.authContext?.nativeTerminalCode!==null||!Array.isArray(u.permissions)||JSON.stringify([...u.permissions].sort())!==JSON.stringify([...c.permissions].sort()))throw Error();
  next();
 }catch{next(Object.assign(Error('Not authorized'),{code:'AUTH_PERMISSION_DENIED',statusCode:403}));}
}

export function createCustomerMasterCanonicalRoutes(binding){
 if(!binding?.service||!binding?.cards||!['context','update','recover'].every(k=>typeof binding.service[k]==='function')||!['list','detail'].every(k=>typeof binding.cards[k]==='function'))throw Error('CUSTOMER_MASTER_UNAVAILABLE');
 const router=Router(),master=createCustomerMasterController(binding.service);
 const cards=operation=>async(req,res)=>{try{const {data,meta}=await operation(req);return ok(res,data,meta);}catch(error){
  const known=typeof error?.code==='string'&&error.code.startsWith('CUSTOMER_CARD_');
  return fail(res,known?error.statusCode||503:503,known?error.code:'CUSTOMER_CARD_READ_FAILED',known?error.message:'Müşteri kartı şu anda okunamıyor.');
 }};
 router.get('/customer-cards',requireAuth,requirePermission('customer.view'),cards(req=>binding.cards.list(req.query,req.user)));
 router.get('/customers/:id/card',requireAuth,requirePermission('customer.view'),cards(req=>binding.cards.detail(req.params.id,req.user)));
 router.get('/customers/:id/master/requests/:requestId',requireAuth,requirePermission('customer.view'),requirePermission('customer.edit'),requireNormalMasterActor,master.recover);
 router.get('/customers/:id/master',requireAuth,requirePermission('customer.view'),requirePermission('customer.edit'),requireNormalMasterActor,master.context);
 router.post('/customers/:id/master',requireAuth,requirePermission('customer.view'),requirePermission('customer.edit'),requireNormalMasterActor,operationQuarantineGate('customer'),master.update);
 return router;
}
