import {customerMasterService} from '../services/customerMasterService.mjs';
import {ok,fail} from '../utils/response.js';
const errors=new Map([['CUSTOMER_ID_INVALID',400],['CUSTOMER_VALIDATION_FAILED',400],['AUTH_PERMISSION_DENIED',403],['CUSTOMER_MASTER_FORBIDDEN',403],['CUSTOMER_MASTER_STALE',409],['CUSTOMER_MASTER_REQUEST_CONFLICT',409],['CUSTOMER_MASTER_CODE_CONFLICT',409],['CUSTOMER_MASTER_UNAVAILABLE',503]]);
export function createCustomerMasterController(service=customerMasterService){
 const handle=operation=>async(req,res)=>{try{return ok(res,await operation(req));}catch(error){const status=errors.get(error?.code);return fail(res,status??503,status?error.code:'CUSTOMER_MASTER_UNAVAILABLE','Müşteri kartı şu anda düzenlenemiyor.');}};
 return {context:handle(req=>service.context(req.params.id,req.user,req.query)),update:handle(req=>service.update(req.params.id,req.body,req.user)),recover:handle(req=>service.recover(req.params.id,req.params.requestId,req.user,req.query))};
}
export const customerMasterController=createCustomerMasterController();
