import {productPurchaseReferenceService} from '../services/productPurchaseReferenceService.mjs';
import {productLastPurchaseReferenceService} from '../services/productLastPurchaseReferenceService.mjs';
import {ok,fail} from '../utils/response.js';
const configuredService={read(...args){return (process.env.MELISA_PRODUCT_PURCHASE_REFERENCE_VERSION==='2'?productLastPurchaseReferenceService:productPurchaseReferenceService).read(...args);}};
export function createProductPurchaseReferenceController({service=configuredService}={}){return async(req,res)=>{try{const result=await service.read(req.params.id,req.query,req.user);return ok(res,result.data,result.meta);}catch(e){return fail(res,e.statusCode??503,e.code??'PURCHASE_REFERENCE_UNAVAILABLE',e.statusCode?e.message:'Alış referansı şu anda doğrulanamıyor.');}};}
export const getProductPurchaseReference=createProductPurchaseReferenceController();
export function registerProductPurchaseReferenceRoute(router,{requireAuth,requirePermission,controller=getProductPurchaseReference}){router.get('/products/:id/purchase-reference',requireAuth,requirePermission('product.view'),requirePermission('purchase.view'),requirePermission('finance.view'),controller);return router;}
