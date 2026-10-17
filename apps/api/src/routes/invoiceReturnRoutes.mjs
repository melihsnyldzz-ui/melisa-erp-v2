import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {ok,fail} from '../utils/response.js';
import {previewInvoiceReturn,submitInvoiceReturn,getInvoiceReturnStatus,listInvoiceReturns,cancelInvoiceReturn} from '../services/invoiceReturnService.mjs';
export function createInvoiceReturnRouter({authenticate=requireAuth,authorize=requirePermission,preview=previewInvoiceReturn,submit=submitInvoiceReturn,status=getInvoiceReturnStatus,list=listInvoiceReturns,cancel=cancelInvoiceReturn}={}){
 const router=Router();
 const handler=work=>async(req,res)=>{try{return ok(res,await work(req),{source:'melisa-invoice-return'});}catch(e){return fail(res,e.statusCode||503,e.statusCode?e.code:'RETURN_RESULT_UNCONFIRMED',e.statusCode?e.message:'İade sonucu doğrulanamadı. Aynı işlem kimliğiyle durumunu kontrol edin.');}};
 for(const kind of ['sales','purchase']){
  const base='/invoice-returns/'+kind;
  router.get(base,authenticate,authorize(kind+'.view'),handler(req=>list(kind,req.user)));
  router.get(base+'/status/:requestId',authenticate,authorize(kind+'.cancel'),handler(async req=>{const row=await status(req.params.requestId,req.user);if(row&&row.kind!==kind)throw Object.assign(new Error('İade bulunamadı.'),{code:'RETURN_NOT_FOUND',statusCode:404});return row;}));
  router.post(base+'/preview',authenticate,authorize(kind+'.cancel'),handler(req=>preview({...req.body,kind},req.user)));
  router.post(base,authenticate,authorize(kind+'.cancel'),handler(req=>submit({...req.body,kind},req.user)));
  router.post(base+'/:id/cancel',authenticate,authorize(kind+'.cancel'),handler(req=>cancel(req.params.id,{...req.body,kind},req.user)));
 }
 return router;
}
export const invoiceReturnRoutes=createInvoiceReturnRouter();
