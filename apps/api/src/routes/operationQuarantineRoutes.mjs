import {Router} from 'express';
import {requireAuth} from '../middleware/authMiddleware.js';
import {operationQuarantineService,parseQuarantineQuery} from '../services/operationQuarantineService.js';
import {ok,fail} from '../utils/response.js';
export const operationQuarantineRoutes=Router();
operationQuarantineRoutes.get('/migration-quarantine',requireAuth,async(req,res)=>{
 try{const entity=parseQuarantineQuery(req.query).entity,permission={product:'product.view',customer:'customer.view',supplier:'supplier.view'}[entity];
  if(!req.user?.permissions?.includes(permission))return fail(res,403,'AUTH_PERMISSION_DENIED','Bu kart türünü görme yetkisi gerekli.');
  const {data,meta}=await operationQuarantineService.list(req.query);return ok(res,data,meta);
 }catch(e){return fail(res,e.statusCode||503,e.code||'MIGRATION_QUARANTINE_NOT_READY',e.statusCode?e.message:'Geçiş karantinası okunamadı.');}
});
