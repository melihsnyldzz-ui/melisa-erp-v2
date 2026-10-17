import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {workCollectionService} from '../services/workCollectionService.mjs';
import {isBusinessSelectedSaleCollectionPreparationService} from '../services/businessSelectedSaleCollectionPreparation.mjs';
export function createWorkCollectionRoutes({authenticate=requireAuth,permission=requirePermission,service=workCollectionService,selectedSourceService}={}){
 if(selectedSourceService!==undefined&&!isBusinessSelectedSaleCollectionPreparationService(selectedSourceService))throw Object.assign(new Error('Seçili kaynak tahsilat servisi doğrulanamadı.'),{code:'SOURCE_COLLECTION_PREPARATION_STORE_REQUIRED',statusCode:503});
 const r=Router(),run=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
 r.get('/work-collections/context',authenticate,permission('customer.view'),run(req=>service.context(req.query,req.user)));
 r.post('/work-collections/preview',authenticate,permission('finance.collection'),run(req=>service.preview(req.body,req.user)));
 r.post('/work-collections',authenticate,permission('finance.collection'),run(req=>service.collect(req.body,req.user)));
 r.post('/work-collections/:id/cancel',authenticate,permission('finance.collection.cancel'),run(req=>service.cancel(req.params.id,req.body,req.user)));
 // A caller must explicitly inject the isolated SOURCE transaction adapter.
 // The production router has no selected SOURCE writer or native fallback.
 if(selectedSourceService!==undefined){
  const readRights=[authenticate,permission('finance.view'),permission('customer.view'),permission('finance.collection')];
  r.get('/work-collections/selected-source/context',...readRights,run(req=>selectedSourceService.context(req.query,req.user)));
  r.post('/work-collections/selected-source/preview',...readRights,run(req=>selectedSourceService.preview(req.body,req.user)));
  r.post('/work-collections/selected-source',...readRights,run(req=>selectedSourceService.collect(req.body,req.user)));
  r.post('/work-collections/selected-source/:id/cancel',...readRights,permission('finance.collection.cancel'),run(req=>selectedSourceService.cancel(req.params.id,req.body,req.user)));
 }
 return r;
}
export const workCollectionRoutes=createWorkCollectionRoutes();
