import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {createBusinessProductPriceService} from '../services/businessProductPriceService.mjs';
import {businessProductPriceStore} from '../services/businessProductPriceStore.mjs';

export function createBusinessProductPriceRoutes(){
  const router=Router(),service=createBusinessProductPriceService({getStore:()=>businessProductPriceStore});
  const handle=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
  const path='/products/:productId/current-prices';
  router.get(path,requireAuth,requirePermission('product.view'),requirePermission('purchase.view'),handle(req=>service.context(req.params.productId,req.user)));
  router.post(path,requireAuth,requirePermission('product.view'),requirePermission('purchase.view'),requirePermission('product.price.edit'),handle(req=>service.update(req.params.productId,req.body,req.user)));
  return router;
}
