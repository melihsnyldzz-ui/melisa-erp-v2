import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {workSalesService} from '../services/workSalesService.mjs';
import {businessSelectedSalePreviewStore} from '../services/businessSelectedSalePreviewStore.mjs';
import {dailyWebScopeMiddleware,resolveDailyWebPolicy} from '../services/dailyWebPolicy.mjs';
export function createWorkSalesRoutes({authenticate=requireAuth,permission=requirePermission,service=workSalesService,selectedService=businessSelectedSalePreviewStore}={}){
 const r=Router(),run=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
 r.use(dailyWebScopeMiddleware(resolveDailyWebPolicy({dailyWebEnabled:true,automaticCardSyncEnabled:false,invoiceExportEnabled:false})));
 r.get('/work-sales/context',authenticate,permission('sales.view'),run(req=>service.context(req.user)));
 r.get('/work-sales/selection-options',authenticate,permission('sales.view'),run(req=>service.selectionOptions(req.user)));
 r.post('/work-sales/preview',authenticate,permission('sales.create'),run(req=>service.preview(req.body,req.user)));
 r.post('/work-sales/selected-context',authenticate,permission('sales.view'),permission('sales.create'),run(req=>service.selectedContext(req.body,req.user)));
 r.post('/work-sales/selected-preview',authenticate,permission('sales.view'),permission('sales.create'),run(req=>selectedService.preview(req.body,req.user)));
 r.post('/work-sales/drafts',authenticate,permission('sales.create'),run(req=>service.createDraft(req.body,req.user)));
 r.post('/work-sales/drafts/:id/finalize',authenticate,permission('sales.finalize'),run(req=>service.finalize(req.params.id,req.body,req.user)));
 r.post('/work-sales/drafts/:id/cancel',authenticate,permission('sales.cancel'),run(req=>service.cancel(req.params.id,req.body,req.user)));
 r.get('/work-sales/invoices',authenticate,permission('sales.view'),run(req=>service.list(req.query,req.user)));
 r.get('/work-sales/invoices/:id',authenticate,permission('sales.view'),run(req=>service.invoice(req.params.id,req.user)));
 r.get('/work-sales/requests/:id',authenticate,permission('sales.view'),run(req=>service.request(req.params.id,req.user)));
 return r;
}
export const workSalesRoutes=createWorkSalesRoutes();
