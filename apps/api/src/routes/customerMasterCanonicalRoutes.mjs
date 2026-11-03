// Source-only wiring for the prepared canonical binding. This router is not
// mounted by the normal application and does not enable or configure a writer.
// Runtime activation requires a separately verified target, schema, permissions
// and transition; the bound store still validates its transaction frame per call.
import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {operationQuarantineGate} from '../services/operationQuarantineGate.mjs';
import {createCustomerMasterController} from '../controllers/customerMasterController.mjs';
import {ok,fail} from '../utils/response.js';

export function createCustomerMasterCanonicalRoutes(binding){
 if(!binding?.service||!binding?.cards||!['context','update','recover'].every(k=>typeof binding.service[k]==='function')||!['list','detail'].every(k=>typeof binding.cards[k]==='function'))throw Error('CUSTOMER_MASTER_UNAVAILABLE');
 const router=Router(),master=createCustomerMasterController(binding.service);
 const cards=operation=>async(req,res)=>{try{const {data,meta}=await operation(req);return ok(res,data,meta);}catch(error){
  const known=typeof error?.code==='string'&&error.code.startsWith('CUSTOMER_CARD_');
  return fail(res,known?error.statusCode||503:503,known?error.code:'CUSTOMER_CARD_READ_FAILED',known?error.message:'Müşteri kartı şu anda okunamıyor.');
 }};
 router.get('/customer-cards',requireAuth,requirePermission('customer.view'),cards(req=>binding.cards.list(req.query,req.user)));
 router.get('/customers/:id/card',requireAuth,requirePermission('customer.view'),cards(req=>binding.cards.detail(req.params.id,req.user)));
 router.get('/customers/:id/master/requests/:requestId',requireAuth,requirePermission('customer.view'),requirePermission('customer.edit'),master.recover);
 router.get('/customers/:id/master',requireAuth,requirePermission('customer.view'),requirePermission('customer.edit'),master.context);
 router.post('/customers/:id/master',requireAuth,requirePermission('customer.view'),requirePermission('customer.edit'),operationQuarantineGate('customer'),master.update);
 return router;
}
